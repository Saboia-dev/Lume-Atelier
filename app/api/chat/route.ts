import { getAppUser } from "@/lib/auth";
import { createGateway, generateText } from "ai";
import { z } from "zod";
import { treatments, clinic } from "@/lib/lume-content";
import { guideResponse } from "@/lib/lume-concierge";
import { api, database, body, sameOrigin, ApiError, checkDatabase } from "@/lib/lume-server";
const messageSchema = z.object({ messages: z.array(z.object({ role: z.enum(["user","assistant"]), content: z.string().min(1).max(1500) })).min(1).max(10) });
export async function GET() { const user = await getAppUser(); return Response.json({ mode: process.env.AI_GATEWAY_API_KEY && user ? "ai" : "guide" }, { headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const input = messageSchema.safeParse(await body(request));
  if (!input.success || input.data.messages.at(-1)?.role !== "user") throw new ApiError("Escreva uma mensagem de até 1.200 caracteres.");
  const question = input.data.messages.at(-1)!.content;
  const user = await getAppUser();
  if (!process.env.AI_GATEWAY_API_KEY || !user) return new Response(guideResponse(question), { headers: { "Content-Type":"text/plain; charset=utf-8", "X-Lume-Mode":"guide", "Cache-Control":"no-store" } });
  const db = await database();
  const { data: count, error } = await db.rpc("lume_chat_limit");
  checkDatabase(error);
  if (Number(count) > 8) throw new ApiError("Vamos fazer uma pequena pausa. Tente novamente em um minuto.",429);
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  try {
    const result = await generateText({ model: gateway(process.env.AI_MODEL || "openai/gpt-6.1-sol"), system: `Você é o concierge virtual da Lume, um atelier de pele conceitual em ${clinic.city}. Responda em português brasileiro, de forma acolhedora, curta e específica. Use somente estas informações: ${JSON.stringify(treatments)}. Avaliação inicial: 30 min, R$ 60. Horários: ${clinic.hours}. Reservas são feitas no botão Reservar e o site não cobra pagamentos. Remarcação: cancelar uma reserva futura na área pessoal e reservar outro horário, pedindo 24h de antecedência. Não invente endereço, profissionais, certificações, resultados, disponibilidade ou depoimentos. Não diagnostique, não indique tratamentos para condições médicas nem prometa resultados. Nesses casos, oriente avaliação presencial profissional. Não confirme reservas: você apenas explica o fluxo. Não peça dados sensíveis. Se o assunto não for a Lume, retome os rituais e as dúvidas da visita.`, messages: input.data.messages, maxOutputTokens: 600, abortSignal: AbortSignal.timeout(25000), maxRetries: 0 });
    return new Response(result.text, { headers: { "Content-Type":"text/plain; charset=utf-8", "X-Lume-Mode":"ai", "Cache-Control":"no-store" } });
  } catch { throw new ApiError("O assistente com IA está indisponível neste momento. Tente novamente em instantes.",503); }
}); }
