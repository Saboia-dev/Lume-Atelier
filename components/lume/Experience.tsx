"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { UserRound, Menu, Plus, Heart, CalendarDays, Clock3, Check, MapPin, Pause, Play, MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { treatments, faqs, clinic, money } from "@/lib/lume-content";
import Booking from "./Booking";
import Concierge from "./Concierge";
gsap.registerPlugin(ScrollTrigger);
type User = { name: string; email: string } | null;

export default function Experience({ user }: { user: User }) {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [booking, setBooking] = useState(false);
  const [selected, setSelected] = useState("avaliacao");
  const [detail, setDetail] = useState<(typeof treatments)[number] | null>(null);
  const [active, setActive] = useState("inicio");
  const [reduced, setReduced] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedError, setSavedError] = useState("");
  const [chat, setChat] = useState(false);
  const [intent, setIntent] = useState("equilibrio");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches); update(); mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (user) fetch("/api/profile").then(async r => r.ok ? await r.json() as { favorites: string[] } : null).then(d => { if (d) setFavorites(d.favorites); }).catch(() => {}); }, [user]);
  useEffect(() => {
    const sections = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-chapter]") ?? []);
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: "-20% 0px -65% 0px" });
    sections.forEach(section => observer.observe(section));
    if (reduced) return () => observer.disconnect();
    const context = gsap.context(() => {
      gsap.from(".hero-type, .hero-bottom", { y: 16, autoAlpha: 0, duration: .65, stagger: .06, ease: "power2.out", clearProps: "transform,opacity,visibility" });
      sections.filter(section => section.id !== "inicio").forEach(section => {
        const elements = section.querySelectorAll("[data-reveal]");
        if (elements.length) gsap.from(elements, {
          y: 18, autoAlpha: 0, duration: .55, stagger: .05, ease: "power2.out",
          clearProps: "transform,opacity,visibility",
          scrollTrigger: { trigger: section, start: "top 92%", once: true }
        });
      });
    }, root);
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      if (disposed) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { if (!disposed) ScrollTrigger.refresh(); }, 120);
    };
    document.fonts.ready.then(refresh);
    const resize = new ResizeObserver(refresh);
    if (root.current) resize.observe(root.current);
    const images = Array.from(root.current?.querySelectorAll("img") ?? []);
    images.forEach(img => img.addEventListener("load", refresh));
    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      observer.disconnect();
      resize.disconnect();
      images.forEach(img => img.removeEventListener("load", refresh));
      context.revert();
    };
  }, [reduced]);
  const openBooking = (id = "avaliacao") => { setSelected(id); setBooking(true); setDetail(null); setMenu(false); };
  const navigate = (id: string) => {
    setMenu(false);
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      window.history.replaceState(null, "", `#${id}`);
      target.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    });
  };
  async function favorite(id: string) {
    if (!user) { window.location.assign("/entrar?next=%2F%23rituais"); return; }
    setSavedError("");
    try { const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ treatmentId: id }) }); const data = await response.json() as { error: string; favorites: string[] }; if (!response.ok) throw new Error(data.error); setFavorites(data.favorites); }
    catch (e) { setSavedError(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente."); }
  }
  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => void } }).modelContext;
    if (!modelContext) return; const lifecycle = new AbortController();
    try {
      modelContext.registerTool({ name: "list_lume_rituals", description: "Consultar os rituais da Lume, com duração e valor.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => treatments.map(t => ({ id: t.id, name: t.name, price: t.price, minutes: t.duration })) }, { signal: lifecycle.signal });
      modelContext.registerTool({ name: "start_lume_booking", description: "Abrir o formulário com um ritual selecionado. Não cria uma reserva.", inputSchema: { type: "object", properties: { treatmentId: { type: "string" } }, required: ["treatmentId"], additionalProperties: false }, execute: (input: { treatmentId: string }) => { if (!input || (input.treatmentId !== "avaliacao" && !treatments.some(t => t.id === input.treatmentId))) throw new Error("Ritual inválido"); openBooking(input.treatmentId); return { opened: true, treatmentId: input.treatmentId }; } }, { signal: lifecycle.signal });
    } catch { /* Normal controls remain available. */ }
    return () => lifecycle.abort();
  }, []);
  const recommended = treatments[intent === "vico" ? 1 : intent === "conforto" ? 2 : intent === "pausa" ? 3 : 0];

  return <div ref={root} className={`experience ${reduced ? "motion-reduced" : ""}`}>
    <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
    <header className="site-header">
      <a className="brand" href="#inicio" onClick={e => { e.preventDefault(); navigate("inicio"); }} aria-label="Lume, início">lume<span>atelier de pele</span></a>
      <nav className="desktop-nav" aria-label="Navegação principal">
        {[["filosofia", "A Lume"], ["rituais", "Rituais"], ["espaco", "O espaço"], ["duvidas", "Dúvidas"]].map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} className={active === id ? "current" : ""} onClick={e => { e.preventDefault(); navigate(id); }}>{label}</a>)}
      </nav>
      <div className="header-actions">
        <a href="/perfil" className="profile-link" aria-label="Minha área"><UserRound size={19} /><span>{user ? user.name.split(" ")[0] : "Minha área"}</span></a>
        <button className="button button-blue header-book" onClick={() => openBooking()}>Agendar avaliação</button>
        <button className="menu-toggle icon-button" aria-label="Abrir menu" aria-expanded={menu} onClick={() => setMenu(true)}><Menu /></button>
      </div>
    </header>
    <main id="conteudo">
      <section className="hero" id="inicio" data-chapter>
        <div className="hero-image-wrap"><img className="hero-portrait" src="/images/lume-portrait.webp" alt="Retrato editorial de uma mulher com pele natural e luz suave" width="1086" height="1448" fetchPriority="high" /></div>
        <div className="hero-type">
          <h1><span className="hero-line">Sua pele.</span><span className="hero-line">Seu tempo.</span><span className="hero-line">Seu lugar.</span></h1>
          <div className="hero-copy"><p>Um atelier para cuidar de você.<br />Com escuta, delicadeza e presença.</p><button className="button button-white" onClick={() => openBooking()}>Agendar avaliação <CalendarDays size={17} /></button></div>
        </div>
        <div className="hero-bottom"><button className="scroll-hint" onClick={() => navigate("rituais")}>Conheça os cuidados</button><div className="hero-location"><MapPin size={16} />{clinic.city}</div></div>
      </section>
      <section className="philosophy section-pad" id="filosofia" data-chapter>
        <h2 data-reveal>Cuidar da pele é cuidar de como você se sente.</h2>
        <div className="philosophy-bottom" data-reveal><p>Aqui, a beleza começa com uma conversa. Entendemos sua rotina, respeitamos suas escolhas e criamos um cuidado que faz sentido para você.</p><p>Cada atendimento tem seu tempo. Você participa das escolhas e conhece as etapas antes de começar.</p></div>
      </section>
      <section className="treatments section-pad" id="rituais" data-chapter>
        <div className="section-heading" data-reveal><h2>Encontre o seu ritual.</h2><p>Conheça os cuidados, a duração e os valores de cada sessão.</p></div>
        <div className="treatment-layout">
          <div className="treatment-visual" data-reveal><img src="/images/lume-care.webp" alt="Cuidado facial delicado em um ambiente acolhedor" width="1448" height="1086" loading="lazy" /></div>
          <div className="treatment-list">
            {treatments.map(t => <article className="treatment-row" key={t.id} data-reveal>
              <div className="treatment-row-main"><button className="treatment-title" onClick={() => setDetail(t)}>{t.name}<Plus size={20} /></button><p>{t.short}</p><span>{t.duration} min <span className="meta-divider" /> {money(t.price)}</span></div>
              <button className={`favorite-button ${favorites.includes(t.id) ? "is-favorite" : ""}`} aria-label={`${favorites.includes(t.id) ? "Remover" : "Salvar"} ${t.name}`} aria-pressed={favorites.includes(t.id)} onClick={() => favorite(t.id)}><Heart size={19} fill={favorites.includes(t.id) ? "currentColor" : "none"} /></button>
            </article>)}
            <p className="treatment-note">Valores por sessão. A avaliação define o cuidado adequado para você.</p>{savedError && <p role="alert" className="form-error">{savedError}</p>}
          </div>
        </div>
      </section>
      <section className="intent-section section-pad" id="escolha" data-chapter><div className="intent-intro" data-reveal><h2>O que você procura?</h2><p>Escolha o que faz sentido para você e conheça uma opção de cuidado.</p></div><div className="intent-picker" data-reveal><div className="intent-options" role="group" aria-label="Seu objetivo">{[["equilibrio", "Equilíbrio para minha pele"], ["vico", "Hidratação e viço"], ["conforto", "Um cuidado delicado"], ["pausa", "Uma pausa para o corpo"]].map(([value, label]) => <button key={value} aria-pressed={intent === value} className={intent === value ? "chosen" : ""} onClick={() => setIntent(value)}><span>{label}</span><span className="choice-circle">{intent === value && <Check size={14} />}</span></button>)}</div><div className="intent-result" aria-live="polite"><h3>{recommended.name}</h3><p>{recommended.detail}</p><button className="text-button" onClick={() => openBooking(recommended.id)}>Reservar esse cuidado <CalendarDays size={18} /></button></div></div></section>
      <section className="journey section-pad" id="jornada" data-chapter>
        <div className="section-heading" data-reveal><h2>Como funciona.</h2></div>
        <div className="journey-steps" data-reveal>{[
          {title:"A gente escuta.",copy:"Uma conversa sobre você, sua rotina e o que espera desse momento. Sem pressão para escolher."},
          {title:"O cuidado acontece.",copy:"Cada etapa é explicada. Cada escolha tem uma intenção. Seu conforto vem primeiro."},
          {title:"O vínculo continua.",copy:"Seus rituais e reservas ficam na sua área pessoal. O próximo encontro começa de onde paramos."}
        ].map(step => <article className="journey-step" key={step.title}><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div>
      </section>
      <section className="space section-pad" id="espaco" data-chapter><div className="space-heading" data-reveal><h2>Um lugar que também cuida.</h2><p>Luz natural, silêncio na medida e tempo reservado só para você. O ambiente faz parte da experiência.</p><div className="space-features"><span>Atendimento individual</span><span>Tempo sem pressa</span><span>Cuidado personalizado</span></div></div><div className="space-photo" data-reveal><img src="/images/lume-space.webp" alt="Ambiente conceitual do atelier: luz natural, linhas curvas e uma poltrona azul" width="1448" height="1086" loading="lazy" /></div></section>
      <section className="concierge-section section-pad" id="concierge" data-chapter><div data-reveal><h2>Podemos ajudar?</h2><p>Tire dúvidas sobre os cuidados, valores e horários com o concierge Lume.</p></div><button className="button button-blue" data-reveal onClick={() => setChat(true)}>Conversar com a Lume <MessageCircle size={18} /></button></section>
      <section className="faq-section section-pad" id="duvidas" data-chapter><div data-reveal><h2>Suas dúvidas.</h2><p>O que você precisa saber antes da visita.</p></div><Accordion type="single" collapsible className="faq-list">{faqs.map((faq, i) => <AccordionItem value={`faq-${i}`} key={faq.q} className="faq-item" data-reveal><AccordionTrigger>{faq.q}</AccordionTrigger><AccordionContent>{faq.a}</AccordionContent></AccordionItem>)}</Accordion></section>
      <section className="closing section-pad" id="reservar" data-chapter><div data-reveal><h2>Reserve seu momento.</h2><p>Comece com uma avaliação de 30 minutos por R$ 60. Escolha um horário e conheça o cuidado indicado para você.</p></div><button className="button button-white" data-reveal onClick={() => openBooking()}>Agendar avaliação <CalendarDays size={18} /></button></section>
    </main>
    <footer className="footer section-pad" id="contato" data-chapter><div className="footer-top" data-reveal><a className="brand" href="#inicio" onClick={e => { e.preventDefault(); navigate("inicio"); }}>lume<span>atelier de pele</span></a><div><p>Cuide de você, no seu tempo.</p><p>{clinic.city}</p></div><nav aria-label="Links do rodapé"><button onClick={() => navigate("rituais")}>Rituais</button><a href="/perfil">Minha área</a><button onClick={() => setChat(true)}>Falar com a Lume</button><button onClick={() => navigate("duvidas")}>Dúvidas</button></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Lume Atelier de Pele</span><a href="/privacidade">Privacidade</a><button className="motion-control" aria-pressed={!reduced} onClick={() => setReduced(v => !v)}>{reduced ? <Play size={14} /> : <Pause size={14} />}{reduced ? "Ativar animações" : "Pausar animações"}</button></div></footer>
    <Dialog open={menu} onOpenChange={setMenu}><DialogContent className="menu-dialog"><DialogTitle>Explore a Lume.</DialogTitle><DialogDescription>Cuidados, espaço e agendamento.</DialogDescription><nav>{[["filosofia", "A Lume"], ["rituais", "Nossos rituais"], ["jornada", "Como funciona"], ["espaco", "O espaço"], ["concierge", "Converse com a Lume"], ["duvidas", "Suas dúvidas"]].map(([id,label]) => <button key={id} onClick={() => navigate(id)}>{label}</button>)}</nav><button className="button button-blue" onClick={() => openBooking()}>Agendar avaliação</button></DialogContent></Dialog>
    <Dialog open={!!detail} onOpenChange={v => { if (!v) setDetail(null); }}><DialogContent className="ritual-dialog"><DialogTitle>{detail?.name}</DialogTitle><DialogDescription>{detail?.short}</DialogDescription>{detail && <><div className="ritual-meta"><span><Clock3 size={17} />{detail.duration} minutos</span><strong>{money(detail.price)}</strong></div><p>{detail.description}</p><h4>Como acontece</h4><ol className="ritual-steps">{detail.steps.map(s => <li key={s}><Check size={16} />{s}</li>)}</ol><p className="small-note">O cuidado é definido após avaliação presencial. Cada pele responde de forma diferente.</p><button className="button button-blue" onClick={() => openBooking(detail.id)}>Reservar esse ritual <CalendarDays size={18} /></button></>}</DialogContent></Dialog>
    <Booking open={booking} onOpenChange={setBooking} initialTreatment={selected} user={user} /><Concierge open={chat} onOpenChange={setChat} onBook={id => { setChat(false); openBooking(id); }} />
  </div>;
}
