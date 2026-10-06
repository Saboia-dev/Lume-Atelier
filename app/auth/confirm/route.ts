import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/lume-server";
import { createClient } from "@/lib/supabase/server";
import { supabaseSettings } from "@/lib/supabase/config";
import { safeReturnPath } from "@/lib/auth-path";
export async function GET(request: Request) {
  const url = new URL(request.url), token_hash = url.searchParams.get("token_hash"), type = url.searchParams.get("type");
  if (token_hash && (type === "email" || type === "recovery") && supabaseSettings()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/nova-senha" : safeReturnPath(url.searchParams.get("next")), requestOrigin(request)));
  }
  return NextResponse.redirect(new URL("/entrar?erro=confirmacao", requestOrigin(request)));
}
