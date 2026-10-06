export function safeReturnPath(value: string | null | undefined, fallback = "/perfil") {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://lume.local");
    if (url.origin !== "https://lume.local" || /^\/(?:api|auth|entrar)(?:\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
