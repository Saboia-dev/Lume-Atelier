import { api, availableSlots, ApiError } from "@/lib/lume-server";
export async function GET(request: Request) { return api(async () => { const date = new URL(request.url).searchParams.get("date"); if (!date) throw new ApiError("Escolha uma data."); return Response.json({ slots: await availableSlots(date) }, { headers: { "Cache-Control": "no-store" } }); }); }
