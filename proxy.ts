import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseSettings } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const settings = supabaseSettings();
  if (!settings) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(settings.url, settings.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/", "/perfil", "/entrar", "/nova-senha", "/api/:path*", "/auth/:path*"] };
