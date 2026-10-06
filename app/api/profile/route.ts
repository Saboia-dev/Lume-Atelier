import { z } from "zod";
import { api, identity, database, body, sameOrigin, ApiError, checkDatabase } from "@/lib/lume-server";
const profileInput = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(20), goal: z.enum(["equilibrio", "vico", "conforto", "pausa"]), avatarColor: z.enum(["blue", "violet", "green"]) });
export async function GET() { return api(async () => {
  const user = await identity(), db = await database();
  const [profile, favorites, bookings] = await Promise.all([
    db.from("lume_profiles").select("name,phone,goal,avatarColor:avatar_color").eq("user_id", user.userId).maybeSingle(),
    db.from("lume_favorites").select("treatment_id").eq("user_id", user.userId),
    db.from("lume_bookings").select("id,treatmentId:treatment_id,name,phone,date,slot,status,createdAt:created_at").eq("user_id", user.userId).order("date", { ascending: false }).order("slot", { ascending: false }),
  ]);
  [profile.error, favorites.error, bookings.error].forEach(checkDatabase);
  return Response.json({ profile: profile.data ?? { name: user.displayName, phone: "", goal: "equilibrio", avatarColor: "blue" }, email: user.email, favorites: (favorites.data ?? []).map(f => f.treatment_id), bookings: bookings.data ?? [] });
}); }
export async function PUT(request: Request) { return api(async () => {
  sameOrigin(request);
  const user = await identity(), db = await database();
  const parsed = profileInput.safeParse(await body(request));
  if (!parsed.success) throw new ApiError("Revise seu nome e as preferências selecionadas.");
  const profile = parsed.data;
  const { error } = await db.from("lume_profiles").upsert({ user_id: user.userId, name: profile.name, phone: profile.phone, goal: profile.goal, avatar_color: profile.avatarColor, updated_at: new Date().toISOString() });
  checkDatabase(error);
  return Response.json({ profile });
}); }
export async function DELETE(request: Request) { return api(async () => {
  sameOrigin(request); await identity();
  const db = await database();
  const { error } = await db.rpc("lume_delete_data"); checkDatabase(error);
  return Response.json({ deleted: true });
}); }
