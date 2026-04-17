"use client";
export const dynamic = "force-dynamic";  // ← agregar esta línea
import { useState, useCallback, useRef } from "react";
import { signInWithPopup, signOut, User, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import Dashboard from "@/components/Dashboard";
import { UploadCloud, LogIn, LogOut, FileSpreadsheet, FileText, X, Loader2, TrendingUp } from "lucide-react";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

type FileItem = {
  file: File;
  id: string;
};

type AnalysisResult = any;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auth ──────────────────────────────────────────────────

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      // Extraer el access token con la API oficial (no propiedades internas)
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) setAccessToken(credential.accessToken);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setAccessToken("");
    setFiles([]);
    setAnalysis(null);
  };

  // ── Google Drive Picker ──────────────────────────────────

  const openDrivePicker = () => {
    if (!accessToken) { setError("Iniciá sesión primero"); return; }

    const buildPicker = () => {
      const picker = new window.google.picker.PickerBuilder()
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .addView(
          new window.google.picker.DocsView()
            .setIncludeFolders(false)
            .setMimeTypes(
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,text/csv,application/vnd.ms-excel"
            )
        )
        .setOAuthToken(accessToken)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!)
        .setCallback(async (data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            await downloadDriveFiles(data.docs);
          }
        })
        .build();
      picker.setVisible(true);
    };

    // Si gapi ya está cargado, usarlo directo
    if (window.gapi && window.google?.picker) {
      window.gapi.load("picker", buildPicker);
      return;
    }

    // Cargar ambos scripts y esperar que los dos estén listos
    let gapiReady = false;
    let pickerReady = false;
    const tryBuild = () => { if (gapiReady && pickerReady) window.gapi.load("picker", buildPicker); };

    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.onload = () => { gapiReady = true; tryBuild(); };
    document.body.appendChild(gapiScript);

    const pickerScript = document.createElement("script");
    pickerScript.src = "https://apis.google.com/js/picker.js";
    pickerScript.onload = () => { pickerReady = true; tryBuild(); };
    document.body.appendChild(pickerScript);
  };

  const downloadDriveFiles = async (docs: any[]) => {
    setLoadingMsg("Descargando archivos de Drive...");
    setLoading(true);
    try {
      const newFiles: FileItem[] = [];
      for (const doc of docs) {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const blob = await res.blob();
        const file = new File([blob], doc.name, { type: blob.type });
        newFiles.push({ file, id: doc.id });
      }
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (e: any) {
      setError("Error descargando archivos: " + e.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ── Upload local ─────────────────────────────────────────

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

  // ── Análisis ─────────────────────────────────────────────

  const runAnalysis = async () => {
    if (!user || files.length === 0) return;
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
      form.append("userId", user.uid);
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

  // ── Render ────────────────────────────────────────────────

  if (analysis) {
    return (
      <Dashboard
        data={analysis}
        user={user!}
        onLogout={handleLogout}
        onNewAnalysis={() => { setAnalysis(null); setFiles([]); }}
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <div className="w-full max-w-xl mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-medium"
          style={{ background: "#fdf3d8", color: "var(--gold)", border: "1px solid #f0e0a8" }}>
          <TrendingUp size={12} /> FinAdvisor
        </div>
        <h1 className="font-display text-4xl leading-tight mb-3" style={{ color: "var(--text)" }}>
          Tu asesor financiero<br />
          <em>personal con IA</em>
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Subí tu planilla de gastos, resúmenes de tarjeta e inversiones.<br />
          Claude analiza todo y genera tu dashboard en segundos.
        </p>
      </div>

      {/* Card principal */}
      <div className="fin-card w-full max-w-xl p-8">

        {/* Login */}
        {!user ? (
          <div className="text-center py-4">
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Iniciá sesión con tu cuenta de Google para cargar archivos desde Drive
            </p>
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{ background: "var(--text)", color: "white" }}
            >
              <LogIn size={16} /> Iniciar sesión con Google
            </button>
          </div>
        ) : (
          <>
            {/* User header */}
            <div className="flex items-center justify-between mb-6 pb-5"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                {user.photoURL && (
                  <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="" />
                )}
                <div>
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <LogOut size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Botones de carga */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                onClick={openDrivePicker}
                className="flex flex-col items-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{ background: "#f0f7ff", border: "1px solid #bdd9f7", color: "#185FA5" }}
              >
                <svg width="20" height="20" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                Seleccionar de Drive
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:opacity-80"
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

            {/* Drop zone */}
            <div
              className={`drop-zone p-6 text-center mb-5 ${dragging ? "active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                O arrastrá tus archivos acá · Excel, PDF, CSV
              </p>
            </div>

            {/* Lista de archivos */}
            {files.length > 0 && (
              <div className="mb-5 space-y-2">
                {files.map((f) => (
                  <div key={f.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: "#f7f6f3", border: "1px solid var(--border)" }}>
                    {fileIcon(f.file.name)}
                    <span className="text-xs flex-1 truncate font-medium">{f.file.name}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {(f.file.size / 1024).toFixed(0)} KB
                    </span>
                    <button onClick={() => removeFile(f.id)} className="p-1 rounded hover:bg-gray-200">
                      <X size={12} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                {error}
              </div>
            )}

            {/* CTA */}
            <button
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
              Tus datos se procesan de forma segura y se guardan en tu cuenta
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
        Powered by Claude (Anthropic) · Almacenado en Firebase
      </p>
    </main>
  );
}
