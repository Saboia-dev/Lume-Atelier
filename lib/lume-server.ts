import "server-only";
import { getAppUser } from "./auth";
import { createClient } from "./supabase/server";
import { supabaseSettings } from "./supabase/config";

export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function database() {
  if (!supabaseSettings()) throw new ApiError("O agendamento ainda está em configuração. Tente novamente quando a equipe concluir a conexão do banco.", 503);
  return createClient();
}
export async function identity() {
  const user = await getAppUser();
  if (!user) throw new ApiError("Entre na sua conta para continuar.", 401);
  return user;
}
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") === "https" ? "https:" : url.protocol;
  return new URL(protocol + "//" + (request.headers.get("host") || url.host)).origin;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin(request)) throw new ApiError("Esta solicitação não é permitida.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError("Esta solicitação não é permitida.", 403);
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 18000) throw new ApiError("A solicitação é muito grande.", 413);
  const raw = await request.text();
  if (raw.length > 18000) throw new ApiError("A solicitação é muito grande.", 413);
  try { return JSON.parse(raw); } catch { throw new ApiError("Verifique os dados enviados."); }
}
export function checkDatabase(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (["22007", "22008", "22P02"].includes(error.code ?? "")) throw new ApiError("Confira a data e os dados enviados.");
  if (error.code === "23505") throw new ApiError("Esse horário acabou de ser reservado. Escolha outro.", 409);
  if (error.code === "42501") throw new ApiError("Entre na sua conta para continuar.", 401);
  if (error.code === "P0001") {
    const message = error.message;
    throw new ApiError(message, /não encontrada/i.test(message) ? 404 : /várias reservas|pequena pausa/i.test(message) ? 429 : /horário|já passou/i.test(message) ? 409 : 400);
  }
  console.error("Lume database error", error.code ?? "UNKNOWN");
  throw new ApiError("Não foi possível acessar seus dados. A equipe precisa verificar a configuração do banco.", 503);
}
export async function api(action: () => Promise<Response>) {
  try {
    const response = await action();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    console.error("Lume API failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Não foi possível concluir. Tente novamente em instantes." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export async function availableSlots(date: string) {
  await identity();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError("Escolha uma data válida.");
  const db = await database();
  const { data, error } = await db.rpc("lume_available_slots", { p_date: date });
  checkDatabase(error);
  return (data as { slot: string }[] ?? []).map(row => row.slot);
}
