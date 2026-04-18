"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback, useRef } from "react";
import Dashboard from "@/components/Dashboard";
import { UploadCloud, FileSpreadsheet, FileText, X, Loader2, TrendingUp } from "lucide-react";

const ANONYMOUS_USER_ID = "anonymous";

type FileItem = {
  file: File;
  id: string;
};

type AnalysisResult = any;

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const items: FileItem[] = Array.from(incoming).map((f) => ({
      file: f,
      id: Math.random().toString(36).slice(2),
    }));
    setFiles((prev) => [...prev, ...items]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleLocalFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const runAnalysis = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setAnalysis(null);

    const messages = [
      "Leyendo tus archivos...",
      "Procesando datos financieros...",
      "Consultando al agente asesor...",
      "Generando diagnóstico...",
      "Preparando tu dashboard...",
    ];
    let i = 0;
    setLoadingMsg(messages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMsg(messages[i]);
    }, 2500);

    try {
      const form = new FormData();
      form.append("userId", ANONYMOUS_USER_ID);
      files.forEach((f) => form.append("files", f.file));

      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Error del servidor");
      setAnalysis(data.analysis);
    } catch (e: any) {
      setError(e.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const fileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["xlsx", "xls", "csv"].includes(ext ?? ""))
      return <FileSpreadsheet size={16} className="text-emerald-600" />;
    return <FileText size={16} className="text-rose-500" />;
  };

  if (analysis) {
    return (
      <Dashboard
        data={analysis}
        userId={ANONYMOUS_USER_ID}
        onNewAnalysis={() => {
          setAnalysis(null);
          setFiles([]);
        }}
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-xl mb-10 text-center">
        <div
          className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-medium"
          style={{ background: "#fdf3d8", color: "var(--gold)", border: "1px solid #f0e0a8" }}
        >
          <TrendingUp size={12} /> FinAdvisor
        </div>
        <h1 className="font-display text-4xl leading-tight mb-3" style={{ color: "var(--text)" }}>
          Tu asesor financiero
          <br />
          <em>personal con IA</em>
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Subí tu planilla de gastos, resúmenes de tarjeta e inversiones.
          <br />
          Claude analiza todo y genera tu dashboard en segundos.
        </p>
      </div>

      <div className="fin-card w-full max-w-xl p-8">
        <div className="mb-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ background: "#f7f6f3", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <UploadCloud size={20} />
            Subir desde mi PC
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv,.pdf,.txt"
          className="hidden"
          onChange={(e) => handleLocalFiles(e.target.files)}
        />

        <div
          className={`drop-zone p-6 text-center mb-5 ${dragging ? "active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            O arrastrá tus archivos acá · Excel, PDF, CSV
          </p>
        </div>

        {files.length > 0 && (
          <div className="mb-5 space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: "#f7f6f3", border: "1px solid var(--border)" }}
              >
                {fileIcon(f.file.name)}
                <span className="text-xs flex-1 truncate font-medium">{f.file.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {(f.file.size / 1024).toFixed(0)} KB
                </span>
                <button type="button" onClick={() => removeFile(f.id)} className="p-1 rounded hover:bg-gray-200">
                  <X size={12} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={runAnalysis}
          disabled={loading || files.length === 0}
          className="w-full py-4 rounded-xl text-sm font-medium transition-all relative overflow-hidden"
          style={{
            background: files.length > 0 && !loading ? "var(--text)" : "#d1cdc9",
            color: "white",
            cursor: files.length > 0 && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {loadingMsg}
            </span>
          ) : (
            `Analizar ${files.length > 0 ? `(${files.length} archivo${files.length > 1 ? "s" : ""})` : ""}`
          )}
        </button>

        <p className="text-xs text-center mt-3" style={{ color: "var(--text-muted)" }}>
          Tus datos se procesan en esta sesión; el historial queda asociado al modo local (sin cuenta).
        </p>
      </div>

      <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
        Powered by Claude (Anthropic) · Almacenado en Firebase
      </p>
    </main>
  );
}
