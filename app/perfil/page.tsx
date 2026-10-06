import { getAppUser } from "@/lib/auth";
import Profile from "@/components/lume/Profile";
export const dynamic = "force-dynamic";
export const metadata = { title: "Seu espaço — Lume" };
export default async function ProfilePage() { const user = await getAppUser(); return <Profile user={user ? { name: user.displayName, email: user.email } : null} />; }
