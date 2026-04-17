"use client";

import { User } from "firebase/auth";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  LogOut, RotateCcw, Wallet, PiggyBank, CreditCard, Activity,
  ChevronRight, ArrowUpRight, ArrowDownRight, Shield,
} from "lucide-react";

const COLORS = {
  gold: "#c49630",
  green: "#059669",
  red: "#e11d48",
  blue: "#2563eb",
  purple: "#7c3aed",
  orange: "#ea580c",
  teal: "#0d9488",
  pink: "#db2777",
  gray: "#78716c",
};

const PIE_COLORS = [COLORS.gold, COLORS.green, COLORS.blue, COLORS.purple, COLORS.orange, COLORS.teal, COLORS.pink, COLORS.gray];

function fmt(n: number) {
  if (!n && n !== 0) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("es-AR")}`;
}

function pct(n: number) {
  return `${Number(n).toFixed(1)}%`;
}

// ── Score Ring ────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 45;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? COLORS.green : score >= 45 ? COLORS.gold : COLORS.red;
  const label = score >= 70 ? "Buena" : score >= 45 ? "Regular" : "Crítica";

  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e8e4de" strokeWidth="8" />
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text x="55" y="50" textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 22, fontWeight: 600, fontFamily: "'DM Sans'", fill: color }}>
          {score}
        </text>
        <text x="55" y="68" textAnchor="middle"
          style={{ fontSize: 11, fontFamily: "'DM Sans'", fill: "#9c8e84" }}>
          {label}
        </text>
      </svg>
    </div>
  );
}

// ── Metric Card ────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, positive }: any) {
  return (
    <div className="fin-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: "#f7f6f3" }}>{icon}</div>
        {positive !== undefined && (
          positive
            ? <ArrowUpRight size={14} style={{ color: COLORS.green }} />
            : <ArrowDownRight size={14} style={{ color: COLORS.red }} />
        )}
      </div>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="font-display text-2xl" style={{ color: "var(--text)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────
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

// ── Main Dashboard ─────────────────────────────────────────────
export default function Dashboard({
  data, user, onLogout, onNewAnalysis,
}: {
  data: any;
  user: User;
  onLogout: () => void;
  onNewAnalysis: () => void;
}) {
  const { metricas: m, score, perfil_riesgo, resumen_ejecutivo,
    gastos_por_categoria, portafolio_actual, portafolio_sugerido,
    evolucion_mensual, recomendaciones, alertas, fecha_analisis } = data;

  const urgencyColor: Record<string, string> = {
    URGENTE: COLORS.red,
    IMPORTANTE: COLORS.gold,
    RECOMENDADO: COLORS.green,
  };

  const perfilColor: Record<string, string> = {
    CONSERVADOR: COLORS.blue,
    MODERADO: COLORS.gold,
    AGRESIVO: COLORS.orange,
    MUY_AGRESIVO: COLORS.red,
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ background: "rgba(247,246,243,0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <TrendingUp size={18} style={{ color: COLORS.gold }} />
          <span className="font-display text-lg">FinAdvisor</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#fdf3d8", color: COLORS.gold, border: "1px solid #f0e0a8" }}>
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

        {/* ── Alertas ── */}
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

        {/* ── Score + Resumen ── */}
        <div className="fin-card p-6 flex flex-col md:flex-row gap-6 items-center">
          <ScoreRing score={score} />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-display text-xl">Diagnóstico financiero</h2>
              <span className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: "#f7f6f3", color: perfilColor[perfil_riesgo] ?? COLORS.gray, border: "1px solid var(--border)" }}>
                <Shield size={10} className="inline mr-1" />Perfil {perfil_riesgo?.replace("_", " ").toLowerCase()}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{resumen_ejecutivo}</p>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={<Wallet size={16} style={{ color: COLORS.green }} />}
            label="Ingreso neto mensual"
            value={fmt(m?.ingreso_neto_mensual)}
            positive={true}
          />
          <MetricCard
            icon={<CreditCard size={16} style={{ color: COLORS.red }} />}
            label="Gasto total mensual"
            value={fmt(m?.gasto_total_mensual)}
            sub={`${pct(m?.ratio_deuda_pct ?? 0)} ratio deuda`}
          />
          <MetricCard
            icon={<PiggyBank size={16} style={{ color: COLORS.gold }} />}
            label="Superávit mensual"
            value={fmt(m?.superavit_mensual)}
            positive={(m?.superavit_mensual ?? 0) >= 0}
            sub={`Tasa ahorro ${pct(m?.tasa_ahorro_pct ?? 0)}`}
          />
          <MetricCard
            icon={<Activity size={16} style={{ color: COLORS.blue }} />}
            label="Fondo de emergencia"
            value={`${(m?.meses_emergencia ?? 0).toFixed(1)} meses`}
            sub="Objetivo: 6 meses"
            positive={(m?.meses_emergencia ?? 0) >= 6}
          />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Gastos por categoría */}
          <div className="fin-card p-5">
            <h3 className="font-medium text-sm mb-4">Gastos por categoría</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={gastos_por_categoria}
                  dataKey="monto"
                  nameKey="categoria"
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={2}
                >
                  {gastos_por_categoria?.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Evolución mensual */}
          <div className="fin-card p-5">
            <h3 className="font-medium text-sm mb-4">Evolución mensual</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={evolucion_mensual} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={COLORS.green} fill="url(#gIngresos)" strokeWidth={2} />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke={COLORS.red} fill="url(#gGastos)" strokeWidth={2} />
                <Area type="monotone" dataKey="ahorro" name="Ahorro" stroke={COLORS.gold} fill="none" strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Portafolio actual vs sugerido ── */}
        <div className="fin-card p-5">
          <h3 className="font-medium text-sm mb-4">Portafolio: actual vs recomendado</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={portafolio_sugerido} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="clase" tick={{ fontSize: 11 }} width={140} />
              <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pct_actual" name="Actual" fill={COLORS.gray} radius={[0, 4, 4, 0]} />
              <Bar dataKey="pct_sugerido" name="Recomendado" fill={COLORS.gold} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Recomendaciones ── */}
        <div>
          <h3 className="font-medium text-sm mb-3">Plan de acción</h3>
          <div className="space-y-3">
            {recomendaciones?.map((r: any, i: number) => (
              <div key={i} className="fin-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                    style={{ background: urgencyColor[r.urgencia] ?? COLORS.gray }}>
                    {r.prioridad}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{r.titulo}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${urgencyColor[r.urgencia]}18`, color: urgencyColor[r.urgencia] }}>
                        {r.urgencia?.toLowerCase()}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.descripcion}</p>
                    <div className="flex items-center gap-4 mt-2">
                      {r.impacto_mensual > 0 && (
                        <span className="text-xs font-medium" style={{ color: COLORS.green }}>
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

        {/* ── Portafolio detalle ── */}
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
                      <td className="py-2.5 pr-4" style={{ color: p.rendimiento_anual_pct > 0 ? COLORS.green : COLORS.red }}>
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

        <p className="text-xs text-center pb-6" style={{ color: "var(--text-muted)" }}>
          Análisis generado por IA · No constituye asesoramiento financiero regulado ·{" "}
          Archivos procesados: {data.archivos_procesados?.join(", ")}
        </p>
      </div>
    </div>
  );
}
