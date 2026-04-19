"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────
type Analysis = any;
type Msg = { role: "user" | "assistant"; content: string };

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number) {
  if (!n && n !== 0) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("es-AR")}`;
}
function pct(n: number) { return `${Number(n ?? 0).toFixed(1)}%`; }

// ── Score Ring ────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 42, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#3B6D11" : score >= 45 ? "#854F0B" : "#A32D2D";
  const bg = score >= 70 ? "#EAF3DE" : score >= 45 ? "#FAEEDA" : "#FCEBEB";
  const label = score >= 70 ? "Buena" : score >= 45 ? "Regular" : "Crítico";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill={bg} stroke="none" />
        <circle cx={50} cy={50} r={r} fill="none" stroke="#e2ddd6" strokeWidth={7} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
        <text x={50} y={46} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 20, fontWeight: 600, fill: color }}>{score}</text>
        <text x={50} y={64} textAnchor="middle"
          style={{ fontSize: 10, fill: color, opacity: 0.8 }}>{label}</text>
      </svg>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────
function Metric({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px 14px" }}>
      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 500, color: danger ? "#A32D2D" : "var(--color-text-primary)" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

// ── Bar ───────────────────────────────────────────────────────
function Bar({ label, pct: p, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{p.toFixed(1)}%</span>
      </div>
      <div style={{ background: "var(--color-background-secondary)", borderRadius: 6, height: 7, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(p, 100)}%`, height: 7, borderRadius: 6, background: color, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

// ── Tag ───────────────────────────────────────────────────────
function Tag({ text, type }: { text: string; type: "r" | "y" | "g" }) {
  const styles = {
    r: { background: "#FCEBEB", color: "#A32D2D" },
    y: { background: "#FAEEDA", color: "#854F0B" },
    g: { background: "#EAF3DE", color: "#3B6D11" },
  };
  return (
    <span style={{ ...styles[type], fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
      {text}
    </span>
  );
}

// ── Section Title ─────────────────────────────────────────────
function STitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </p>
  );
}

// ── Card ──────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "16px 18px", ...style }}>
      {children}
    </div>
  );
}

// ── Upload Panel ──────────────────────────────────────────────
function UploadPanel({ onAnalysisDone }: { onAnalysisDone: (a: Analysis) => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl)]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files);
  }, []);

  const run = async () => {
    if (!files.length) return;
    setLoading(true); setError("");
    const msgs = ["Leyendo archivos...", "Procesando datos...", "Consultando al agente...", "Generando diagnóstico..."];
    let i = 0; setLoadingMsg(msgs[0]);
    const iv = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMsg(msgs[i]); }, 2800);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error del servidor");
      onAnalysisDone(data.analysis);
      setFiles([]); setOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      clearInterval(iv); setLoading(false); setLoadingMsg("");
    }
  };

  return (
    <>
      <button onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", background: open ? "var(--color-text-primary)" : "transparent", color: open ? "white" : "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", transition: "all 0.15s" }}>
        <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M8 2v9M4 7l4 4 4-4M2 12h12" strokeLinecap="round" />
        </svg>
        Cargar archivos
      </button>

      {open && (
        <div style={{ position: "absolute", top: 52, right: 0, width: 340, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 12, padding: 16, zIndex: 100, boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Cargar archivos del mes</p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{ border: `1.5px dashed ${dragging ? "#378ADD" : "var(--color-border-secondary)"}`, borderRadius: 8, padding: "20px 12px", textAlign: "center", cursor: "pointer", background: dragging ? "#E6F1FB" : "var(--color-background-secondary)", transition: "all 0.15s" }}>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Arrastrá o hacé clic</p>
            <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>Excel, PDF, CSV</p>
          </div>
          <input ref={inputRef} type="file" multiple accept=".xlsx,.xls,.csv,.pdf,.txt" style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />

          {files.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--color-background-secondary)", borderRadius: 6 }}>
                  <span style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-primary)" }}>{f.name}</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{(f.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {error && <p style={{ fontSize: 11, color: "#A32D2D", background: "#FCEBEB", padding: "6px 10px", borderRadius: 6, marginTop: 8 }}>{error}</p>}

          <button onClick={run} disabled={loading || !files.length}
            style={{ width: "100%", marginTop: 10, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: files.length && !loading ? "pointer" : "not-allowed", background: files.length && !loading ? "var(--color-text-primary)" : "#d1cdc9", color: "white", border: "none", transition: "background 0.15s" }}>
            {loading ? loadingMsg : `Analizar${files.length ? ` (${files.length})` : ""}`}
          </button>
        </div>
      )}
    </>
  );
}

// ── Chat Box ──────────────────────────────────────────────────
function ChatBox({ analysis }: { analysis: Analysis | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{
    role: "assistant",
    content: analysis
      ? `Hola Juan Manuel. Tu score actual es **${analysis.score}/100** con perfil **${analysis.perfil_riesgo?.toLowerCase().replace("_", " ")}**. ¿En qué te puedo ayudar?`
      : "Hola. Todavía no hay análisis cargado. Una vez que subas tus archivos podré responder preguntas sobre tu situación financiera."
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, conversationHistory: messages.slice(-8) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const renderMsg = (content: string) =>
    content.split("**").map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : <span key={j}>{p}</span>);

  const suggestions = ["¿En qué gasto más?", "¿Cómo mejorar mi score?", "¿Qué hago con mis ahorros?", "¿Cuál es mi mayor riesgo?"];

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 200 }}>
      {!open && (
        <button onClick={() => setOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer", background: "var(--color-text-primary)", color: "white", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
          <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth={1.5}>
            <path d="M14 10a2 2 0 01-2 2H4l-2 2V4a2 2 0 012-2h8a2 2 0 012 2v6z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Preguntarle a FinAdvisor
        </button>
      )}

      {open && (
        <div style={{ width: 350, height: 500, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
          <div style={{ padding: "12px 16px", background: "var(--color-text-primary)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="#EF9F27" strokeWidth={1.5}>
                <path d="M2 12l3-8 3 4 2-2 4 6H2z" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 500, color: "white" }}>FinAdvisor</span>
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 5, background: "rgba(239,159,39,0.25)", color: "#EF9F27" }}>IA</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                  ...(m.role === "user"
                    ? { background: "var(--color-text-primary)", color: "white", borderBottomRightRadius: 4 }
                    : { background: "var(--color-background-secondary)", color: "var(--color-text-primary)", borderBottomLeftRadius: 4, border: "0.5px solid var(--color-border-tertiary)" }) }}>
                  {renderMsg(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "8px 12px", borderRadius: 12, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0, 150, 300].map((d) => (
                      <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-text-tertiary)", display: "inline-block", animation: "bounce 1s infinite", animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}
                  style={{ fontSize: 11, padding: "5px 10px", borderRadius: 10, cursor: "pointer", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-secondary)" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: "10px 12px", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 8, flexShrink: 0 }}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Preguntá sobre tus finanzas..."
              style={{ flex: 1, padding: "7px 12px", borderRadius: 10, fontSize: 12, outline: "none", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)" }} />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              style={{ padding: "7px 12px", borderRadius: 10, cursor: input.trim() && !loading ? "pointer" : "not-allowed", background: input.trim() && !loading ? "var(--color-text-primary)" : "#d1cdc9", border: "none", color: "white" }}>
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth={2}>
                <path d="M15 1L7 9M15 1L10 14l-3-5-5-3L15 1z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
function EmptyState() {
  return (
    <Card style={{ textAlign: "center", padding: "48px 24px" }}>
      <svg width={40} height={40} viewBox="0 0 40 40" fill="none" stroke="var(--color-text-tertiary)" strokeWidth={1.5} style={{ margin: "0 auto 16px" }}>
        <rect x={6} y={4} width={28} height={32} rx={4} />
        <path d="M13 12h14M13 18h14M13 24h8" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Sin análisis todavía</p>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Hacé clic en "Cargar archivos" arriba a la derecha para subir tu planilla de gastos y resúmenes de tarjeta.</p>
    </Card>
  );
}

// ── History Charts ────────────────────────────────────────────
function HistoryCharts() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => { setHistory((d.history ?? []).reverse()); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || history.length < 2) return null;

  // ── Transformar datos ─────────────────────────────────────
  const label = (h: any) => h.fecha_analisis?.slice(0, 7).replace("-", "/") ?? "—";

  const scoreData = history.map((h) => ({
    mes: label(h),
    score: h.score ?? 0,
  }));

  const flujoData = history.map((h) => ({
    mes: label(h),
    ingresos: Math.round((h.metricas?.ingreso_neto_mensual ?? 0) / 1000),
    gastos: Math.round((h.metricas?.gasto_total_mensual ?? 0) / 1000),
    ahorro: Math.round((h.metricas?.superavit_mensual ?? 0) / 1000),
  }));

  const classCols: Record<string, string> = {
    renta_fija: "Renta fija",
    cash_usd: "Cash/USD",
    renta_variable: "CEDEARs/RV",
    on_corporativas: "ON corp.",
    otros: "Otros",
  };

  const portfolioData = history.map((h) => {
    const row: any = { mes: label(h) };
    const activos = h.portafolio_actual ?? [];
    let totalUSD = 0;
    Object.keys(classCols).forEach((cls) => { row[cls] = 0; });
    activos.forEach((a: any) => {
      const cls = a.clase ?? "otros";
      const key = Object.keys(classCols).find((k) => cls.includes(k)) ?? "otros";
      const monto = a.monto ?? 0;
      const enUSD = monto > 10000 ? Math.round(monto / 1430) : monto;
      row[key] = (row[key] ?? 0) + enUSD;
      totalUSD += enUSD;
    });
    row.total = Math.round(totalUSD);
    return row;
  });

  const brechaData = history.map((h) => {
    const activos = h.portafolio_actual ?? [];
    let totalUSD = 0;
    activos.forEach((a: any) => {
      const monto = a.monto ?? 0;
      totalUSD += monto > 10000 ? monto / 1430 : monto;
    });
    return { mes: label(h), capital: Math.round(totalUSD / 1000), objetivo: 1100 };
  });

  const tt = { contentStyle: { fontSize: 11, borderRadius: 8, border: "0.5px solid #e2ddd6" }, cursor: { fill: "rgba(136,135,128,0.07)" } };
  const ax = { tick: { fontSize: 10, fill: "#888780" }, axisLine: false, tickLine: false };
  const gr = <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,135,128,0.15)" vertical={false} />;

  return (
    <Card style={{ marginTop: 0 }}>
      <STitle>Seguimiento histórico</STitle>
      <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 20 }}>
        {history.length} análisis cargados · {label(history[0])} → {label(history[history.length - 1])}
      </p>

      {/* ── Gráfico 1: Score ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Score de salud financiera</p>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 10 }}>Evolución mensual del estado general</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={scoreData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            {gr}
            <XAxis dataKey="mes" {...ax} />
            <YAxis domain={[0, 100]} ticks={[0, 45, 70, 100]} {...ax}
              tickFormatter={(v) => v + "%"} width={36} />
            <Tooltip {...tt} formatter={(v: any) => [`${v}/100`, "Score"]} />
            <ReferenceLine y={70} stroke="#639922" strokeDasharray="5 4" strokeWidth={1.2} label={{ value: "saludable", position: "right", fontSize: 10, fill: "#639922" }} />
            <ReferenceLine y={45} stroke="#E24B4A" strokeDasharray="3 4" strokeWidth={1.2} label={{ value: "crítico", position: "right", fontSize: 10, fill: "#E24B4A" }} />
            <Line type="monotone" dataKey="score" stroke="#BA7517" strokeWidth={2.5}
              dot={{ r: 4, fill: "#BA7517", strokeWidth: 0 }}
              activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Gráfico 2: Ingresos vs Gastos ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Ingresos vs gastos vs ahorro</p>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 10 }}>En miles de pesos por mes</p>
        <ResponsiveContainer width="100%" height={170}>
          <ComposedChart data={flujoData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            {gr}
            <XAxis dataKey="mes" {...ax} />
            <YAxis {...ax} tickFormatter={(v) => `$${v}K`} width={48} />
            <Tooltip {...tt} formatter={(v: any, n: string) => [`$${v}K`, n]} />
            <Bar dataKey="ingresos" name="Ingresos" fill="rgba(29,158,117,0.65)" radius={[3, 3, 0, 0]} barSize={16} />
            <Bar dataKey="gastos" name="Gastos" fill="rgba(226,75,74,0.65)" radius={[3, 3, 0, 0]} barSize={16} />
            <Line type="monotone" dataKey="ahorro" name="Ahorro" stroke="#BA7517"
              strokeWidth={2.5} dot={{ r: 3, fill: "#BA7517", strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>
          {[["#1D9E75", "Ingresos"], ["#E24B4A", "Gastos"], ["#BA7517", "Ahorro"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* ── Gráfico 3: Portafolio ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Evolución del portafolio</p>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 10 }}>Capital invertido por clase de activo (en U$S)</p>
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={portfolioData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {[["cash_usd","#B4B2A9"], ["renta_fija","#378ADD"], ["on_corporativas","#EF9F27"], ["renta_variable","#639922"]].map(([k, c]) => (
                <linearGradient key={k} id={`g_${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={c} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            {gr}
            <XAxis dataKey="mes" {...ax} />
            <YAxis {...ax} tickFormatter={(v) => `U$S${v}K`} width={56} />
            <Tooltip {...tt} formatter={(v: any, n: string) => [`U$S ${v}K`, n]} />
            <Area type="monotone" dataKey="cash_usd" name="Cash/USD" stackId="1" stroke="#B4B2A9" fill="url(#g_cash_usd)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="renta_fija" name="Renta fija" stackId="1" stroke="#378ADD" fill="url(#g_renta_fija)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="on_corporativas" name="ON corp." stackId="1" stroke="#EF9F27" fill="url(#g_on_corporativas)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="renta_variable" name="CEDEARs/RV" stackId="1" stroke="#639922" fill="url(#g_renta_variable)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)", flexWrap: "wrap" }}>
          {[["#B4B2A9","Cash/USD"],["#378ADD","Renta fija"],["#EF9F27","ON corp."],["#639922","CEDEARs/RV"]].map(([c,l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* ── Gráfico 4: Brecha retiro ── */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Brecha hacia el retiro</p>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 10 }}>Capital acumulado vs objetivo U$S 1.1M</p>
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={brechaData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="g_brecha" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E24B4A" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#E24B4A" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="g_capital" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#639922" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#639922" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {gr}
            <XAxis dataKey="mes" {...ax} />
            <YAxis {...ax} tickFormatter={(v) => `U$S${v}K`} domain={[0, 1200]} width={60} />
            <Tooltip {...tt} formatter={(v: any, n: string) => [`U$S ${v}K`, n]} />
            <ReferenceLine y={1100} stroke="#378ADD" strokeDasharray="6 4" strokeWidth={1.5}
              label={{ value: "U$S 1.1M", position: "right", fontSize: 10, fill: "#378ADD" }} />
            <Area type="monotone" dataKey="objetivo" name="Objetivo" stroke="transparent" fill="url(#g_brecha)" strokeWidth={0} />
            <Area type="monotone" dataKey="capital" name="Capital" stroke="#639922" fill="url(#g_capital)" strokeWidth={2.5}
              dot={{ r: 4, fill: "#639922", strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#639922", display: "inline-block" }} />Capital acumulado
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 16, height: 0, borderTop: "2px dashed #378ADD", display: "inline-block" }} />Objetivo U$S 1.1M
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#FCEBEB", border: "1px solid #E24B4A", display: "inline-block" }} />Brecha restante
          </span>
        </div>
      </div>
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
function Dashboard({ data }: { data: Analysis }) {
  const m = data.metricas ?? {};
  const urgColor: Record<string, string> = { URGENTE: "#A32D2D", IMPORTANTE: "#854F0B", RECOMENDADO: "#3B6D11" };
  const barColors = ["#378ADD", "#1D9E75", "#EF9F27", "#888780", "#7F77DD", "#D85A30", "#D4537E", "#E24B4A"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 20px", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12 }}>
        <ScoreRing score={data.score ?? 0} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <p style={{ fontSize: 16, fontWeight: 500 }}>Diagnóstico financiero</p>
            <Tag text={`Perfil ${(data.perfil_riesgo ?? "").replace("_", " ").toLowerCase()}`} type={data.perfil_riesgo === "CONSERVADOR" ? "g" : data.perfil_riesgo === "MODERADO" ? "y" : "r"} />
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{data.fecha_analisis}</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{data.resumen_ejecutivo}</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <Metric label="Ingreso mensual" value={fmt(m.ingreso_neto_mensual)} />
        <Metric label="Gasto mensual" value={fmt(m.gasto_total_mensual)} sub={`Deuda ${pct(m.ratio_deuda_pct)}`} />
        <Metric label="Superávit" value={fmt(m.superavit_mensual)} danger={(m.superavit_mensual ?? 0) < 0} sub={`Ahorro ${pct(m.tasa_ahorro_pct)}`} />
        <Metric label="Fondo emergencia" value={`${(m.meses_emergencia ?? 0).toFixed(1)} meses`} sub="objetivo: 6 meses" danger={(m.meses_emergencia ?? 0) < 3} />
        <Metric label="Intereses tarjetas" value={fmt(m.costo_financiero_tarjetas_anual_pct ? m.gasto_total_mensual * m.costo_financiero_tarjetas_anual_pct / 1200 : 0)} danger sub="mensual estimado" />
      </div>

      {/* Alertas */}
      {data.alertas?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.alertas.map((a: any, i: number) => (
            <div key={i} style={{
              background: a.tipo === "danger" ? "#FCEBEB" : "#FAEEDA",
              border: `0.5px solid ${a.tipo === "danger" ? "#F09595" : "#FAC775"}`,
              borderRadius: 8, padding: "10px 14px", fontSize: 12,
              color: a.tipo === "danger" ? "#A32D2D" : "#854F0B",
              display: "flex", gap: 8
            }}>
              <span style={{ flexShrink: 0, fontWeight: 600 }}>!</span>
              <span>{a.mensaje}</span>
            </div>
          ))}
        </div>
      )}

      {/* Gastos + Tarjetas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <STitle>Estructura de gastos</STitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(data.gastos_por_categoria ?? []).map((g: any, i: number) => (
              <Bar key={i} label={g.categoria} pct={g.pct} color={barColors[i % barColors.length]} />
            ))}
          </div>
        </Card>

        <Card>
          <STitle>Tarjetas al cierre</STitle>
          {(data.portafolio_actual ?? []).filter((p: any) => p.clase === "tarjeta" || p.activo?.toLowerCase().includes("tarjeta") || p.activo?.toLowerCase().includes("visa") || p.activo?.toLowerCase().includes("master") || p.activo?.toLowerCase().includes("amex")).length > 0
            ? (data.portafolio_actual ?? []).map((p: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < data.portafolio_actual.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{p.activo}</p>
                  <p style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{p.liquidez}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{fmt(p.monto)}</p>
              </div>
            ))
            : (data.gastos_por_categoria ?? []).slice(0, 4).map((g: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                <p style={{ fontSize: 13 }}>{g.categoria}</p>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{fmt(g.monto)}</p>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Portafolio sugerido */}
      {(data.portafolio_sugerido ?? []).length > 0 && (
        <Card>
          <STitle>Portafolio sugerido vs actual</STitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.portafolio_sugerido.map((p: any, i: number) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12 }}>{p.clase}</span>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    actual <strong>{p.pct_actual}%</strong> → sugerido <strong style={{ color: "#3B6D11" }}>{p.pct_sugerido}%</strong>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 3, height: 6 }}>
                  <div style={{ width: `${p.pct_actual}%`, background: "#B4B2A9", borderRadius: "4px 0 0 4px", transition: "width 0.8s ease" }} />
                  <div style={{ width: `${p.pct_sugerido}%`, background: "#639922", borderRadius: "0 4px 4px 0", transition: "width 0.8s ease" }} />
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "var(--color-text-tertiary)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 6, background: "#B4B2A9", borderRadius: 3, display: "inline-block" }} />Actual</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 6, background: "#639922", borderRadius: 3, display: "inline-block" }} />Sugerido</span>
            </div>
          </div>
        </Card>
      )}

      {/* Plan de acción */}
      {(data.recomendaciones ?? []).length > 0 && (
        <Card>
          <STitle>Plan de acción</STitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.recomendaciones.map((r: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: urgColor[r.urgencia] ?? "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "white", flexShrink: 0, marginTop: 1 }}>
                  {r.prioridad}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{r.titulo}</p>
                    <Tag text={r.urgencia?.toLowerCase()} type={r.urgencia === "URGENTE" ? "r" : r.urgencia === "IMPORTANTE" ? "y" : "g"} />
                    {r.impacto_mensual > 0 && <span style={{ fontSize: 11, color: "#3B6D11", fontWeight: 500 }}>+{fmt(r.impacto_mensual)}/mes</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{r.descripcion}</p>
                  <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}>→ {r.plazo}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Seguimiento histórico */}
      <HistoryCharts />

      {/* Retiro */}
      <Card>
        <STitle>Planificación de retiro</STitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
          <Metric label="Edad" value="60 años" />
          <Metric label="Gasto mensual" value="U$S 3.700" sub="objetivo declarado" />
          <Metric label="Capital objetivo" value="U$S 1.1M" sub="tasa 6% anual" />
          <Metric label="Gasto anual ajustado" value="U$S 66K" sub="con inflación 20 años" />
        </div>
        <div style={{ padding: 10, background: "var(--color-background-info)", borderRadius: 8, fontSize: 12, color: "var(--color-text-info)" }}>
          Para alcanzar U$S 1.1M de capital necesitás registrar tus inversiones actuales. Cargalas en el próximo análisis para calcular la brecha exacta.
        </div>
      </Card>

      <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", paddingBottom: 80 }}>
        {data.archivos_procesados?.join(" · ")} · Análisis generado por IA · No constituye asesoramiento regulado
      </p>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/last")
      .then((r) => r.json())
      .then((d) => { setAnalysis(d.analysis); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", fontFamily: "var(--font-sans)" }}>

      {/* Top bar */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(var(--color-background-tertiary-rgb, 247,246,243), 0.92)", backdropFilter: "blur(8px)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width={18} height={18} viewBox="0 0 16 16" fill="none" stroke="#BA7517" strokeWidth={1.5}>
            <path d="M2 12l3-8 3 4 2-2 4 6H2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 16, fontWeight: 500 }}>FinAdvisor</span>
          {analysis && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#FAEEDA", color: "#854F0B" }}>
              {analysis.fecha_analisis}
            </span>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <UploadPanel onAnalysisDone={(a) => setAnalysis(a)} />
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-tertiary)", fontSize: 13 }}>
            Cargando análisis...
          </div>
        ) : analysis ? (
          <Dashboard data={analysis} />
        ) : (
          <EmptyState />
        )}
      </main>

      {/* Chat */}
      <ChatBox analysis={analysis} />
    </div>
  );
}
