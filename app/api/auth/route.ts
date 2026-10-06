import { z } from "zod";
import { api, body, sameOrigin, ApiError, database, requestOrigin } from "@/lib/lume-server";
import { safeReturnPath } from "@/lib/auth-path";
const inputSchema = z.object({ action: z.enum(["signin", "signup", "reset", "password"]), email: z.string().email().optional(), password: z.string().min(1).max(128).optional(), name: z.string().trim().min(2).max(80).optional(), next: z.string().max(500).optional() });
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request);
  const parsed = inputSchema.safeParse(await body(request));
  if (!parsed.success) throw new ApiError("Confira seu e-mail e use uma senha com pelo menos 8 caracteres.");
  const input = parsed.data;
  if ((input.action === "signup" || input.action === "password") && (!input.password || input.password.length < 8)) throw new ApiError("Use uma senha com pelo menos 8 caracteres.");
  const supabase = await database();
  const origin = requestOrigin(request);
  const next = safeReturnPath(input.next);
  if (input.action === "password") {
    if (!input.password) throw new ApiError("Informe a nova senha.");
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !user) throw new ApiError("Abra o link de recuperação enviado ao seu e-mail.", 401);
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw new ApiError("Não foi possível atualizar a senha. Use uma senha diferente e tente novamente.");
    return Response.json({ authenticated: true, next: "/perfil" });
  }
  if (!input.email) throw new ApiError("Informe seu e-mail.");
  if (input.action === "reset") {
    const { error } = await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: origin + "/auth/callback?next=%2Fnova-senha" });
    if (error) throw new ApiError("Não foi possível enviar o link. Aguarde alguns minutos e tente novamente.");
    return Response.json({ message: "Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha." });
  }
  if (!input.password) throw new ApiError("Informe sua senha.");
  if (input.action === "signup") {
    if (!input.name) throw new ApiError("Informe seu nome.");
    const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password, options: { data: { name: input.name }, emailRedirectTo: origin + "/auth/callback?next=" + encodeURIComponent(next) } });
    if (error) throw new ApiError(error.status === 429 ? "Aguarde alguns minutos antes de tentar novamente." : "Não foi possível criar a conta. Confira os dados e tente novamente.");
    return Response.json({ authenticated: Boolean(data.session), next, message: "Confira seu e-mail para confirmar o cadastro. Depois, entre na sua conta." });
  }
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) throw new ApiError("E-mail ou senha incorretos. Confirme seu cadastro pelo e-mail antes de entrar.", 401);
  return Response.json({ authenticated: true, next });
}); }
