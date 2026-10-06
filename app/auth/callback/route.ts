import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/lume-server";
import { createClient } from "@/lib/supabase/server";
import { supabaseSettings } from "@/lib/supabase/config";
import { safeReturnPath } from "@/lib/auth-path";
export async function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get("code");
  if (code && supabaseSettings()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeReturnPath(url.searchParams.get("next")), requestOrigin(request)));
  }
  return NextResponse.redirect(new URL("/entrar?erro=confirmacao", requestOrigin(request)));
}
