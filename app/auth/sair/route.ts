import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseSettings } from "@/lib/supabase/config";
import { sameOrigin, api, requestOrigin } from "@/lib/lume-server";
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request);
  if (supabaseSettings()) { const supabase = await createClient(); const { error } = await supabase.auth.signOut(); if (error) throw error; }
  return NextResponse.redirect(new URL("/", requestOrigin(request)), 303);
}); }
