import { treatments } from "@/lib/lume-content";
import { api, identity, database, body, sameOrigin, ApiError, checkDatabase } from "@/lib/lume-server";
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); await identity();
  const input = await body(request);
  if (!treatments.some(t => t.id === input?.treatmentId)) throw new ApiError("Escolha um ritual válido.");
  const db = await database();
  const { data, error } = await db.rpc("lume_toggle_favorite", { p_treatment: input.treatmentId });
  checkDatabase(error);
  return Response.json({ favorites: ((data ?? []) as { treatment_id: string }[]).map(row => row.treatment_id) });
}); }
