"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Check, Clock3, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { treatments, money } from "@/lib/lume-content";

export default function Booking({ open, onOpenChange, initialTreatment, user, onSaved }: { open: boolean; onOpenChange: (value: boolean) => void; initialTreatment: string; user: { name: string; email: string } | null; onSaved?: () => void }) {
  const [treatment, setTreatment] = useState(initialTreatment);
  const [date, setDate] = useState(""); const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<string[]>([]); const [loadingSlots, setLoadingSlots] = useState(false);
  const [name, setName] = useState(user?.name ?? ""); const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string } | null>(null);
  const chosen = treatments.find(t => t.id === treatment);
  useEffect(() => { if (open) { setTreatment(initialTreatment); setResult(null); setError(""); setSlot(""); } }, [open, initialTreatment]);
  useEffect(() => {
    if (!date || !open) { setSlots([]); setLoadingSlots(false); return; }
    const controller = new AbortController(); setSlot(""); setSlots([]); setLoadingSlots(true); setError("");
    fetch(`/api/availability?date=${date}`, { signal: controller.signal }).then(async r => { const data = await r.json() as { error: string; slots: string[] }; if (!r.ok) throw new Error(data.error); setSlots(data.slots); }).catch(e => { if (e.name !== "AbortError") { setSlots([]); setError("Não foi possível consultar os horários. Tente outra vez."); } }).finally(() => { if (!controller.signal.aborted) setLoadingSlots(false); });
    return () => controller.abort();
  }, [date, open]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ treatmentId: treatment, date, slot, name, phone, consent }) }); const data = await response.json() as { error: string; id: string }; if (!response.ok) throw new Error(data.error); setResult(data); onSaved?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível reservar. Tente novamente."); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="booking-dialog"><DialogTitle>{result ? "Seu momento está reservado." : "Reserve seu momento."}</DialogTitle><DialogDescription>{result ? "Encontre todos os detalhes na sua área pessoal." : "Escolha o cuidado e um horário disponível."}</DialogDescription>
    {result ? <div className="booking-success"><span className="success-icon"><Check size={28} /></span><h3>{chosen?.name ?? "Avaliação inicial"}</h3><p>{new Date(date+"T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })} às {slot}</p><p>{chosen?.duration ?? 30} min · {money(chosen?.price ?? 60)}</p><small>Reserva {result.id.slice(0,8).toUpperCase()}</small><a href="/perfil" className="button button-blue">Ver minha área</a><button className="text-button" onClick={() => onOpenChange(false)}>Continuar explorando</button></div>
    : !user ? <div className="signin-prompt"><CalendarDays size={36} strokeWidth={1.3} /><h3>Um espaço só seu.</h3><p>Entre para reservar, salvar seus rituais e acompanhar seus encontros.</p><a href="/entrar?next=%2Fperfil%3Freservar%3D1" target="_top" className="button button-blue">Entrar ou criar conta</a><p className="small-note">Seus dados ficam associados à sua conta.</p></div>
    : <form onSubmit={submit} className="booking-form"><label>Seu cuidado<Select value={treatment} onValueChange={setTreatment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="avaliacao">Avaliação inicial · 30 min · R$ 60</SelectItem>{treatments.map(t => <SelectItem key={t.id} value={t.id}>{t.name} · {money(t.price)}</SelectItem>)}</SelectContent></Select></label><div className="form-columns"><label>Dia<input type="date" min={today} value={date} required onChange={e => { setDate(e.target.value); setSlot(""); setSlots([]); }} /></label><label>Nome<input value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} autoComplete="name" required /></label></div><fieldset className="slot-fieldset"><legend>Horário disponível</legend>{loadingSlots ? <p className="inline-loading"><Loader2 className="spin" size={17} />Consultando horários…</p> : !date ? <p className="small-note">Escolha um dia para ver os horários.</p> : slots.length ? <div className="slot-grid">{slots.map(s => <button key={s} type="button" className={slot === s ? "chosen" : ""} aria-pressed={slot === s} onClick={() => setSlot(s)}>{s}</button>)}</div> : <p className="small-note">Não há horários nesse dia. Escolha outra data.</p>}</fieldset><label>Celular<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="(15) 99999-9999" maxLength={20} required /></label><label className="consent"><Checkbox checked={consent} onCheckedChange={v => setConsent(v === true)} /><span>Concordo com o uso dos meus dados para gerenciar esta reserva. <a href="/privacidade">Saiba mais</a>.</span></label><div className="booking-summary"><span><Clock3 size={16} />{chosen?.duration ?? 30} minutos</span><strong>{money(chosen?.price ?? 60)}</strong></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-blue" disabled={saving || loadingSlots || !slot || !slots.includes(slot) || !consent} type="submit">{saving ? <><Loader2 className="spin" size={17} />Reservando…</> : <>Confirmar reserva <CalendarDays size={17} /></>}</button><p className="small-note">Nenhum pagamento é cobrado nesta etapa.</p></form>}
  </DialogContent></Dialog>;
}
