import Experience from '@/components/lume/Experience';
import { getAppUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getAppUser();
  return <Experience user={user ? { name: user.displayName, email: user.email } : null} />;
}
