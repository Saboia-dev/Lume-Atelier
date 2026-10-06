import AuthForm from "@/components/lume/AuthForm";
import { getAppUser } from "@/lib/auth";
import { supabaseSettings } from "@/lib/supabase/config";
import { safeReturnPath } from "@/lib/auth-path";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar — Lume" };
export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const params = await searchParams, returnTo = safeReturnPath(params.next);
  const user = await getAppUser(); if (user) redirect(returnTo);
  return <AuthForm ready={Boolean(supabaseSettings())} returnTo={returnTo} initialError={params.erro ? "O link expirou ou não pôde ser validado. Entre com sua senha ou solicite um novo link de recuperação." : ""} />;
}
