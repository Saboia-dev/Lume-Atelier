# Lume — versão para Vercel + Supabase

Esta versão usa **Next.js nativo**, com App Router, React, GSAP e Supabase Auth/Postgres. Mantém o layout limpo, as fontes e imagens locais e as animações discretas. Não tem objeto 3D acompanhando a página.

O pacote anterior usava Vinext/Vite + Cloudflare Workers/D1 e gerava `dist/server`. A Vercel, configurada para Next.js, procurava `.next/routes-manifest.json`. Este projeto substitui o build por `next build --webpack`, que gera o manifesto e as funções de servidor corretos. Não é necessário criar o arquivo manualmente.

## 1. Preparar o Supabase

1. Crie ou escolha um projeto **ativo** dedicado à Lume em https://supabase.com/dashboard. Um projeto pausado/inativo precisa estar ativo antes de conectar.
2. Abra **SQL Editor**, cole **todo** o conteúdo de `supabase/setup.sql` e execute.
3. Em **Project Settings → API Keys / Connect**, copie a URL do projeto e a **publishable key**. A chave `anon` antiga também é aceita. Não use `service_role` ou uma secret key neste projeto.
4. Em **Authentication → Sign In / Providers**, habilite e-mail e senha e mantenha a confirmação por e-mail.

O SQL cria tabelas próprias (`lume_profiles`, `lume_favorites`, `lume_bookings`), políticas RLS e funções para reservar, cancelar, consultar horários livres e excluir os dados do perfil. Cada usuário acessa apenas seus dados. O índice único impede duas reservas ativas para o mesmo dia e horário. O script pode ser executado novamente sem apagar os dados.

**O SQL não foi executado em sua conta.** Não há um Supabase real conectado no pacote. Os dados do Cloudflare D1 da versão anterior não são migrados automaticamente para este banco.

## 2. Configurar a Vercel

Extraia este ZIP. Substitua os arquivos do projeto antigo pelos arquivos desta versão no repositório usado pelo seu projeto Vercel. A raiz correta contém `package.json`, `package-lock.json`, `next.config.ts` e a pasta `app`.

Em **Project Settings → Build and Deployment**:

| Configuração | Valor |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | Pasta que contém o novo `package.json` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Padrão do Next.js; remova qualquer override `dist`, `dist/server` ou `out` |
| Node.js | 22.x ou 24.x |

O `vercel.json` incluído configura Next.js e o build. Remova overrides antigos no painel e não misture a configuração de Vite/Cloudflare com esta versão. Faça commit/push e depois **Redeploy**, desmarcando o uso do cache de build na primeira tentativa.

Adicione as variáveis em **Environment Variables**, no ambiente Production e também em Preview se for testar previews:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key do mesmo projeto |
| `NEXT_PUBLIC_SITE_URL` | Domínio final HTTPS da Lume, sem barra no fim |
| `AI_GATEWAY_API_KEY` | Opcional: chave do Vercel AI Gateway |
| `AI_MODEL` | Opcional: ID de um modelo habilitado no seu Gateway |

Use `.env.example` como referência. Se usar a chave antiga, preencha `NEXT_PUBLIC_SUPABASE_ANON_KEY` no lugar da publishable key. **Após mudar variáveis, faça novo deploy**: as variáveis públicas também são incorporadas ao build.

Sem Supabase configurado, o site abre e o concierge funciona no modo guia, mas cadastro, login, perfil e reservas não ficam operacionais. O site não inventa um login ou reserva local para substituir o banco.

## 3. Configurar os links de autenticação

Em **Supabase → Authentication → URL Configuration**:

- **Site URL**: `https://SEU-DOMINIO`
- **Redirect URLs**: `https://SEU-DOMINIO/auth/callback**` e, para desenvolvimento, `http://localhost:3000/auth/callback**`.
- Se usar um domínio de preview, autorize também o callback daquele domínio. Use domínios que você controla.

O callback padrão usa PKCE e deve ser aberto no navegador em que a solicitação foi iniciada. Para confirmação e recuperação também funcionarem quando o usuário abre o e-mail em outro navegador, configure os templates em **Authentication → Email Templates**:

**Confirm signup**, link de confirmação:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirmar meu cadastro</a>
```

**Reset password**, link de recuperação:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Criar nova senha</a>
```

Ambas as rotas estão implementadas. Com os templates acima, o domínio usado será o **Site URL**; mantenha-o igual ao domínio final. A recuperação abre `/nova-senha` e exige uma sessão válida.

Para atender clientes reais, configure **SMTP próprio** em Authentication. O serviço de e-mail padrão do Supabase é destinado a testes e restringe destinatários aos membros da organização. Não desative confirmação para contornar a configuração de e-mails.

## 4. Conferir antes de entregar ao cliente

1. Criar uma conta e confirmar o e-mail.
2. Entrar, editar o perfil, salvar um ritual e recarregar a página.
3. Reservar uma data futura e verificar a reserva em `/perfil` e no Supabase.
4. Entrar com uma segunda conta: os dados da primeira não devem aparecer e o horário ocupado não deve estar disponível.
5. Cancelar uma reserva e verificar que o horário volta a ficar livre.
6. Testar recuperação de senha e saída da conta.

Login, cadastro, recuperação, perfil, favoritos, reservas e exclusão de dados estão implementados. Exclusão dos dados de atendimento remove perfil, favoritos e reservas; não remove a conta Supabase Auth. Não há cobrança, painel administrativo ou sincronização com uma agenda externa nesta versão.

O concierge sem chave responde pelo catálogo no **modo guia**, identificado na interface. Com Gateway configurado e usuário autenticado, pode usar IA. O custo e a habilitação do modelo dependem da sua conta. Não foi feito teste pago com IA neste pacote.

## Desenvolvimento e verificações

```bash
npm ci
# Copie .env.example para .env.local e preencha os valores para usar Supabase.
npm run dev
```

Build e verificação:

```bash
npm run build
npm run check
npm run verify
```

`verify` executa o SQL em PostgreSQL isolado (PGlite), com dois usuários de teste, e inicia o build de produção para verificar páginas, arquivos estáticos e APIs sem credenciais. Não altera nenhum banco remoto. Foram validados RLS, permissões, conflito de horário, cancelamento, limite de reservas, favoritos, limite do chat e exclusão dos dados de um usuário sem afetar outro.

O build nativo gera `.next/routes-manifest.json`. A pasta `.next` e `node_modules` não vão no ZIP: a Vercel instala as dependências e gera o build. A publicação real na Vercel, envio de e-mails e integração com um Supabase hospedado precisam ser conferidos após configurar as suas credenciais.

## Ajustar para a clínica

Conteúdo, valores e horários informativos: `lib/lume-content.ts`. Horários de reserva e regras da agenda: `supabase/setup.sql`. Mantenha ambos coerentes ao personalizar. O fuso da agenda é `America/Sao_Paulo`; há atendimento de segunda a sexta e dois horários no sábado, com reservas até 120 dias e antecedência mínima de uma hora.

A Lume é uma marca conceitual. Confira endereço, contato, serviços e informações da clínica real antes de vender/publicar para um cliente.

Referências oficiais: [Next.js na Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase SSR com Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs), [SMTP do Supabase](https://supabase.com/docs/guides/auth/auth-smtp).
