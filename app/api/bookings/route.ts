import { z } from "zod";
import { treatments } from "@/lib/lume-content";
import { api, identity, database, body, sameOrigin, ApiError, checkDatabase } from "@/lib/lume-server";
const inputSchema = z.object({ treatmentId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slot: z.string(), name: z.string().trim().min(2).max(80), phone: z.string().trim().min(8).max(20).refine(v => v.replace(/\D/g, "").length >= 10), consent: z.literal(true) });
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); await identity();
  const parsed = inputSchema.safeParse(await body(request));
  if (!parsed.success) throw new ApiError("Revise os dados e o consentimento para reservar.");
  const input = parsed.data;
  if (input.treatmentId !== "avaliacao" && !treatments.some(t => t.id === input.treatmentId)) throw new ApiError("Escolha um ritual válido.");
  const db = await database();
  const { data, error } = await db.rpc("lume_create_booking", { p_treatment: input.treatmentId, p_date: input.date, p_slot: input.slot, p_name: input.name, p_phone: input.phone, p_consent: input.consent });
  checkDatabase(error);
  return Response.json({ id: data, status: "reservado" }, { status: 201 });
}); }
export async function DELETE(request: Request) { return api(async () => {
  sameOrigin(request); await identity();
  const input = z.object({ id: z.string().uuid() }).safeParse(await body(request));
  if (!input.success) throw new ApiError("Reserva inválida.");
  const db = await database();
  const { data, error } = await db.rpc("lume_cancel_booking", { p_id: input.data.id });
  checkDatabase(error);
  return Response.json({ status: data });
}); }
