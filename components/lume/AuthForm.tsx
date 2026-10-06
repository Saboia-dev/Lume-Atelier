"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
type Mode = "signin" | "signup" | "reset" | "password";
export default function AuthForm({ ready, returnTo, initialError = "", initialMode = "signin" }: { ready: boolean; returnTo: string; initialError?: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(initialError), [notice, setNotice] = useState("");
  const title = mode === "signup" ? "Crie seu espaço." : mode === "reset" ? "Recupere seu acesso." : mode === "password" ? "Sua nova senha." : "Bom ter você aqui.";
  const label = mode === "signup" ? "Criar conta" : mode === "reset" ? "Enviar link de recuperação" : mode === "password" ? "Salvar nova senha" : "Entrar";
  function choose(value: Mode) { setMode(value); setPassword(""); setError(""); setNotice(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!ready || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, ...(mode !== "password" ? { email } : {}), ...(mode !== "reset" ? { password } : {}), ...(mode === "signup" ? { name } : {}), next: returnTo }) });
      const data = await response.json() as { error?: string; message?: string; authenticated?: boolean; next?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível continuar. Tente novamente.");
      if (data.authenticated) { window.location.assign(data.next || returnTo); return; }
      setNotice(data.message || "Confira seu e-mail para continuar."); setPassword("");
    } catch (error) { setError(error instanceof Error ? error.message : "Falha na conexão. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="profile-page auth-page">
    <header className="site-header"><a href="/" className="brand">lume<span>atelier de pele</span></a><a href="/" className="text-button">Voltar à Lume</a></header>
    <main className="auth-main section-pad"><div className="auth-panel"><h1>{title}</h1><p>Seu perfil, seus cuidados favoritos e seus agendamentos em um só lugar.</p>
      {!ready ? <p className="auth-notice" role="status">Estamos preparando o acesso à sua área. Volte em breve.</p> : <>
        {mode !== "password" && <div className="auth-options" aria-label="Opções de acesso"><button type="button" aria-pressed={mode === "signin"} onClick={() => choose("signin")}>Entrar</button><button type="button" aria-pressed={mode === "signup"} onClick={() => choose("signup")}>Criar conta</button></div>}
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && <label>Seu nome<input name="name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required /></label>}
          {mode !== "password" && <label>E-mail<input name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={254} required /></label>}
          {mode !== "reset" && <label>{mode === "password" ? "Nova senha" : "Senha"}<input name="password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signin" ? 1 : 8} maxLength={128} required />{mode !== "signin" && <span className="small-note">Use pelo menos 8 caracteres.</span>}</label>}
          {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="auth-notice" role="status">{notice}</p>}
          <button type="submit" className="button button-blue" disabled={busy}>{busy ? <><Loader2 className="spin" size={18} />Aguarde…</> : label}</button>
          {mode === "signin" && <button type="button" className="text-button" onClick={() => choose("reset")}>Esqueci minha senha</button>}
        </form>
      </>}
      <p className="auth-privacy">Seus dados são usados para gerenciar seus cuidados. <a href="/privacidade">Saiba mais</a>.</p>
    </div></main>
  </div>;
}
