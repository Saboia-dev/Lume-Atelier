"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
type Message = { role: "user" | "assistant"; content: string };
export default function Concierge({ open, onOpenChange, onBook }: { open: boolean; onOpenChange: (value: boolean) => void; onBook: (id: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Olá, eu sou o concierge Lume. Posso apresentar os rituais, explicar valores e ajudar você a reservar. O que gostaria de conhecer?" }]);
  const [input, setInput] = useState(""); const [sending, setSending] = useState(false); const [error, setError] = useState(""); const [mode, setMode] = useState("guide");
  const viewport = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch("/api/chat", { signal: controller.signal }).then(async r => {
      if (!r.ok) return null;
      return await r.json() as { mode: string };
    }).then(data => { if (data && !controller.signal.aborted) setMode(data.mode); }).catch(() => {});
    return () => controller.abort();
  }, [open]);
  useEffect(() => {
    const container = viewport.current;
    if (open && container && follow.current) container.scrollTop = container.scrollHeight;
  }, [messages, sending, open]);
  useEffect(() => () => abort.current?.abort(), []);
  async function send(value = input) {
    const text = value.trim(); if (!text || sending) return;
    follow.current = true;
    const next: Message[] = [...messages, { role: "user", content: text }]; setMessages(next); setInput(""); setSending(true); setError("");
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-10) }), signal: controller.signal });
      if (!response.ok) { const d = await response.json() as { error: string }; throw new Error(d.error || "O concierge está indisponível. Tente novamente."); }
      setMode(response.headers.get("X-Lume-Mode") ?? "guide");
      const reader = response.body?.getReader(); if (!reader) throw new Error("Não foi possível receber a resposta.");
      setMessages([...next, { role: "assistant", content: "" }]); const decoder = new TextDecoder(); let content = "";
      while (true) { const { done, value: part } = await reader.read(); if (done) break; content += decoder.decode(part, { stream: true }); setMessages([...next, { role: "assistant", content }]); }
      if (!content.trim()) throw new Error("Não foi possível receber a resposta. Tente novamente.");
    } catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Falha na conexão. Tente novamente."); }
    finally { setSending(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="chat-dialog"><div className="chat-header"><div><DialogTitle>Lume concierge</DialogTitle><DialogDescription>{mode === "ai" ? "Assistente com inteligência artificial" : "Guia de rituais e agendamento"}</DialogDescription></div></div><div className="chat-messages" ref={viewport} role="log" aria-label="Conversa com a Lume" aria-live="polite" aria-relevant="additions text" aria-busy={sending} onScroll={e => { const container = e.currentTarget; follow.current = container.scrollHeight - container.scrollTop - container.clientHeight < 70; }}>{messages.map((m,i) => <div key={i} className={`chat-message ${m.role}`}><span>{m.role === "assistant" ? "Lume" : "Você"}</span><p>{m.content || "Pensando…"}</p></div>)}{sending && messages.at(-1)?.role !== "assistant" && <p className="inline-loading"><Loader2 className="spin" size={15} />Preparando sua resposta…</p>}</div>{messages.length <= 2 && <div className="chat-suggestions">{["Quais são os rituais?", "Como funciona a avaliação?", "Quero agendar"].map(q => <button key={q} onClick={() => send(q)} disabled={sending}>{q}</button>)}</div>}{error && <p className="form-error" role="alert">{error}</p>}<button className="chat-book text-button" onClick={() => onBook("avaliacao")}><CalendarDays size={16} />Reservar uma avaliação</button><form className="chat-input" onSubmit={e => { e.preventDefault(); send(); }}><input aria-label="Sua mensagem" value={input} onChange={e => setInput(e.target.value)} maxLength={1200} placeholder="Conte o que você procura…" disabled={sending} /><button aria-label="Enviar mensagem" disabled={!input.trim() || sending} type="submit">{sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}</button></form><p className="chat-note">Informações sobre a Lume. A avaliação presencial orienta seu cuidado.</p></DialogContent></Dialog>;
}
