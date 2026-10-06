import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { supabaseSettings } from "./supabase/config";
export type AppUser = { userId: string; displayName: string; email: string };

export const getAppUser = cache(async (): Promise<AppUser | null> => {
  if (!supabaseSettings()) return null;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const name = user.user_metadata?.name;
  return { userId: user.id, email: user.email ?? "", displayName: typeof name === "string" && name.trim() ? name.trim() : user.email?.split("@")[0] ?? "Cliente" };
});
