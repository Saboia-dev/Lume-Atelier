import AuthForm from "@/components/lume/AuthForm";
import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Nova senha — Lume" };
export default async function NewPassword() {
  if (!(await getAppUser())) redirect("/entrar?erro=recuperacao");
  return <AuthForm ready returnTo="/perfil" initialMode="password" />;
}
