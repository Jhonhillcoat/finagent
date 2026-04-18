"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  TrendingUp, AlertTriangle, LogOut, RotateCcw, Wallet,
  PiggyBank, CreditCard, Activity, ChevronRight, ArrowUpRight,
  ArrowDownRight, Shield, MessageCircle, Send, X, Clock,
  ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

const C = {
  gold: "#c49630", green: "#059669", red: "#e11d48",
  blue: "#2563eb", purple: "#7c3aed", orange: "#ea580c",
  teal: "#0d9488", pink: "#db2777", gray: "#78716c",
};
const PIE_COLORS = [C.gold, C.green, C.blue, C.purple, C.orange, C.teal, C.pink, C.gray];

function fmt(n: number) {
  if (!n && n !== 0) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("es-AR")}`;
}
function pct(n: number) { return `${Number(n ?? 0).toFixed(1)}%`; }

// ── Score Ring ────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 45;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? C.green : score >= 45 ? C.gold : C.red;
  const label = score >= 70 ? "Buena" : score >= 45 ? "Regular" : "Crítica";
  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e8e4de" strokeWidth="8" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
        <text x="55" y="50" textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 22, fontWeight: 600, fontFamily: "'DM Sans'", fill: color }}>{score}</text>
        <text x="55" y="68" textAnchor="middle"
          style={{ fontSize: 11, fontFamily: "'DM Sans'", fill: "#9c8e84" }}>{label}</text>
      </svg>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, positive }: any) {
  return (
    <div className="fin-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: "#f7f6f3" }}>{icon}</div>
        {positive !== undefined && (
          positive ? <ArrowUpRight size={14} style={{ color: C.green }} />
                   : <ArrowDownRight size={14} style={{ color: C.red }} />
        )}
      </div>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="font-display text-2xl">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #e2ddd6", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────
function HistoryPanel({ userId, onSelectAnalysis }: {
  userId: string;
  onSelectAnalysis: (a: any) => void;
}) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/history?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => { setHistory(d.history ?? []); setLoading(false); });
  }, [userId]);

  const scoreColor = (s: number) => s >= 70 ? C.green : s >= 45 ? C.gold : C.red;

  return (
    <div className="fin-card overflow-hidden">
      <button className="w-full flex items-center justify-between p-5" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <Clock size={16} style={{ color: C.gold }} />
          <span className="font-medium text-sm">Historial de análisis</span>
          {!loading && history.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#f7f6f3", border: "1px solid var(--border)" }}>
              {history.length} {history.length === 1 ? "análisis" : "análisis"}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} />
               : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {loading ? (
            <div className="p-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={14} className="animate-spin inline mr-2" />Cargando historial...
            </div>
          ) : history.length <= 1 ? (
            <div className="p-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Solo hay un análisis por ahora. Cargá nuevos archivos el próximo mes para ver la evolución.
            </div>
          ) : (
            <>
              {/* Gráfico de evolución del score */}
              <div className="px-5 pt-4 pb-2">
                <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Evolución del score de salud financiera</p>
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={[...history].reverse().map((h) => ({
                    fecha: h.fecha_analisis?.slice(5) ?? "—",
                    score: h.score,
                    ahorro: h.metricas?.tasa_ahorro_pct ?? 0,
                  }))}>
                    <defs>
                      <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.gold} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip formatter={(v: any, n: string) => [n === "score" ? `${v}/100` : `${v}%`, n === "score" ? "Score" : "Ahorro"]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="score" stroke={C.gold} fill="url(#gScore)" strokeWidth={2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Lista */}
              <div style={{ borderTop: "1px solid var(--border)" }}>
                {history.map((h, i) => (
                  <button key={h.id} onClick={() => onSelectAnalysis(h)}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                    <div className="text-xs font-mono" style={{ color: "var(--text-muted)", minWidth: 70 }}>
                      {h.fecha_analisis ?? "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium mb-0.5 truncate">
                        {h.archivos_procesados?.join(", ") ?? "Análisis"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Ahorro {pct(h.metricas?.tasa_ahorro_pct ?? 0)} · Deuda {pct(h.metricas?.ratio_deuda_pct ?? 0)}
                      </div>
                    </div>
                    <div className="text-sm font-medium flex-shrink-0" style={{ color: scoreColor(h.score) }}>
                      {h.score}/100
                    </div>
                    {i === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: "#fdf3d8", color: C.gold, border: "1px solid #f0e0a8" }}>
                        actual
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chat Box ──────────────────────────────────────────────────
function ChatBox({ userId, analysisData }: { userId: string; analysisData: any }) {
  type Msg = { role: "user" | "assistant"; content: string };
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Hola! Soy FinAdvisor. Tu score actual es **${analysisData?.score ?? "—"}/100** con perfil **${analysisData?.perfil_riesgo?.toLowerCase().replace("_", " ") ?? "—"}**. ¿Qué querés saber sobre tus finanzas?`
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async (text?: string) => {
    const userMsg = text ?? input.trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.slice(-8);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: userMsg, conversationHistory: history }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Hubo un error: ${e.message}. Intentá de nuevo.`
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const suggestions = [
    "¿En qué gasto más?",
    "¿Cómo mejorar mi score?",
    "¿Qué hago con mis ahorros?",
    "¿Cuál es mi mayor riesgo?",
  ];

  const renderMessage = (content: string) =>
    content.split("**").map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
    );

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-all hover:opacity-90 z-50"
          style={{ background: "var(--text)", color: "white", boxShadow: "0 4px 20px rgba(37,31,29,0.25)" }}>
          <MessageCircle size={16} />
          Preguntar a FinAdvisor
        </button>
      )}

      {/* Panel chat */}
      {open && (
        <div className="fixed bottom-6 right-6 flex flex-col z-50 rounded-2xl overflow-hidden"
          style={{ width: 360, height: 520, background: "white", border: "1px solid var(--border)", boxShadow: "0 8px 40px rgba(37,31,29,0.18)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ background: "var(--text)" }}>
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: C.gold }} />
              <span className="text-sm font-medium text-white">FinAdvisor</span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(196,150,48,0.25)", color: C.gold }}>IA</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 transition-colors">
              <X size={14} className="text-white" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                  style={m.role === "user"
                    ? { background: "var(--text)", color: "white", borderBottomRightRadius: 4 }
                    : { background: "#f7f6f3", color: "var(--text)", borderBottomLeftRadius: 4, border: "1px solid var(--border)" }
                  }>
                  {renderMessage(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl"
                  style={{ background: "#f7f6f3", border: "1px solid var(--border)", borderBottomLeftRadius: 4 }}>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sugerencias */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {suggestions.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-xl transition-colors hover:opacity-80"
                  style={{ background: "#f7f6f3", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Preguntá sobre tus finanzas..."
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "#f7f6f3", border: "1px solid var(--border)" }}
              />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="p-2 rounded-xl transition-all flex-shrink-0"
                style={{ background: input.trim() && !loading ? "var(--text)" : "#d1cdc9", color: "white" }}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────
export default function Dashboard({
  data, user, onLogout, onNewAnalysis,
}: {
  data: any;
  user: User;
  onLogout: () => void;
  onNewAnalysis: () => void;
}) {
  const [currentData, setCurrentData] = useState(data);

  const {
    metricas: m, score, perfil_riesgo, resumen_ejecutivo,
    gastos_por_categoria, portafolio_actual, portafolio_sugerido,
    evolucion_mensual, recomendaciones, alertas, fecha_analisis,
  } = currentData;

  const urgencyColor: Record<string, string> = {
    URGENTE: C.red, IMPORTANTE: C.gold, RECOMENDADO: C.green,
  };
  const perfilColor: Record<string, string> = {
    CONSERVADOR: C.blue, MODERADO: C.gold, AGRESIVO: C.orange, MUY_AGRESIVO: C.red,
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* Top bar */}
      <header className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ background: "rgba(247,246,243,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <TrendingUp size={18} style={{ color: C.gold }} />
          <span className="font-display text-lg">FinAdvisor</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#fdf3d8", color: C.gold, border: "1px solid #f0e0a8" }}>
            {fecha_analisis}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {user.photoURL && <img src={user.photoURL} className="w-7 h-7 rounded-full" alt="" />}
          <button onClick={onNewAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: "var(--text)", color: "white" }}>
            <RotateCcw size={12} /> Nuevo análisis
          </button>
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <LogOut size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Alertas */}
        {alertas?.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: a.tipo === "danger" ? "#fef2f2" : "#fffbeb",
                  border: `1px solid ${a.tipo === "danger" ? "#fecaca" : "#fde68a"}`,
                  color: a.tipo === "danger" ? "#dc2626" : "#92400e",
                }}>
                <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                {a.mensaje}
              </div>
            ))}
          </div>
        )}

        {/* Score + Resumen */}
        <div className="fin-card p-6 flex flex-col md:flex-row gap-6 items-center">
          <ScoreRing score={score} />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="font-display text-xl">Diagnóstico financiero</h2>
              <span className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: "#f7f6f3", color: perfilColor[perfil_riesgo] ?? C.gray, border: "1px solid var(--border)" }}>
                <Shield size={10} className="inline mr-1" />
                Perfil {perfil_riesgo?.replace("_", " ").toLowerCase()}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{resumen_ejecutivo}</p>
          </div>
        </div>

        {/* Historial */}
        <HistoryPanel userId={user.uid} onSelectAnalysis={(a) => setCurrentData(a)} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={<Wallet size={16} style={{ color: C.green }} />}
            label="Ingreso neto mensual" value={fmt(m?.ingreso_neto_mensual)} positive={true} />
          <MetricCard icon={<CreditCard size={16} style={{ color: C.red }} />}
            label="Gasto total mensual" value={fmt(m?.gasto_total_mensual)}
            sub={`${pct(m?.ratio_deuda_pct)} ratio deuda`} />
          <MetricCard icon={<PiggyBank size={16} style={{ color: C.gold }} />}
            label="Superávit mensual" value={fmt(m?.superavit_mensual)}
            positive={(m?.superavit_mensual ?? 0) >= 0}
            sub={`Tasa ahorro ${pct(m?.tasa_ahorro_pct)}`} />
          <MetricCard icon={<Activity size={16} style={{ color: C.blue }} />}
            label="Fondo de emergencia" value={`${(m?.meses_emergencia ?? 0).toFixed(1)} meses`}
            sub="Objetivo: 6 meses" positive={(m?.meses_emergencia ?? 0) >= 6} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="fin-card p-5">
            <h3 className="font-medium text-sm mb-4">Gastos por categoría</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={gastos_por_categoria} dataKey="monto" nameKey="categoria"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {gastos_por_categoria?.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="fin-card p-5">
            <h3 className="font-medium text-sm mb-4">Evolución mensual</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={evolucion_mensual} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.green} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.red} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.red} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={C.green} fill="url(#gIngresos)" strokeWidth={2} />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke={C.red} fill="url(#gGastos)" strokeWidth={2} />
                <Area type="monotone" dataKey="ahorro" name="Ahorro" stroke={C.gold} fill="none" strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portafolio */}
        {portafolio_sugerido?.length > 0 && (
          <div className="fin-card p-5">
            <h3 className="font-medium text-sm mb-4">Portafolio: actual vs recomendado</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={portafolio_sugerido} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="clase" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pct_actual" name="Actual" fill={C.gray} radius={[0, 4, 4, 0]} />
                <Bar dataKey="pct_sugerido" name="Recomendado" fill={C.gold} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recomendaciones */}
        {recomendaciones?.length > 0 && (
          <div>
            <h3 className="font-medium text-sm mb-3">Plan de acción</h3>
            <div className="space-y-3">
              {recomendaciones.map((r: any, i: number) => (
                <div key={i} className="fin-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                      style={{ background: urgencyColor[r.urgencia] ?? C.gray }}>
                      {r.prioridad}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-medium">{r.titulo}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: `${urgencyColor[r.urgencia]}18`, color: urgencyColor[r.urgencia] }}>
                          {r.urgencia?.toLowerCase()}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.descripcion}</p>
                      <div className="flex items-center gap-4 mt-2">
                        {r.impacto_mensual > 0 && (
                          <span className="text-xs font-medium" style={{ color: C.green }}>
                            +{fmt(r.impacto_mensual)}/mes
                          </span>
                        )}
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          <ChevronRight size={10} className="inline" /> {r.plazo}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portafolio detalle */}
        {portafolio_actual?.length > 0 && (
          <div className="fin-card p-5">
            <h3 className="font-medium text-sm mb-4">Portafolio actual — detalle</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Activo", "Monto", "Rend. anual", "Liquidez", "Clase"].map((h) => (
                      <th key={h} className="text-left py-2 pr-4 font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portafolio_actual.map((p: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f0ece6" }}>
                      <td className="py-2.5 pr-4 font-medium">{p.activo}</td>
                      <td className="py-2.5 pr-4">{fmt(p.monto)}</td>
                      <td className="py-2.5 pr-4" style={{ color: p.rendimiento_anual_pct > 0 ? C.green : C.red }}>
                        {p.rendimiento_anual_pct}%
                      </td>
                      <td className="py-2.5 pr-4" style={{ color: "var(--text-muted)" }}>{p.liquidez}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full"
                          style={{ background: "#f7f6f3", border: "1px solid var(--border)" }}>
                          {p.clase}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-center pb-24" style={{ color: "var(--text-muted)" }}>
          Análisis generado por IA · No constituye asesoramiento financiero regulado ·{" "}
          Archivos: {currentData.archivos_procesados?.join(", ")}
        </p>
      </div>

      {/* Chat flotante */}
      <ChatBox userId={user.uid} analysisData={currentData} />
    </div>
  );
}
