import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseSettings } from "./config";

export async function createClient() {
  const settings = supabaseSettings();
  if (!settings) throw new Error("SUPABASE_NOT_CONFIGURED");
  const cookieStore = await cookies();
  return createServerClient(settings.url, settings.key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components only read; proxy refreshes the session. */ }
      },
    },
  });
}
