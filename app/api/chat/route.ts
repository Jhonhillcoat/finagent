import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminDb } from "@/lib/firebaseAdmin";
import { OWNER_ID } from "@/lib/config";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory } = await req.json();
    if (!message) return NextResponse.json({ error: "message requerido" }, { status: 400 });

    const userDoc = await adminDb.collection("users").doc(OWNER_ID).get();
    const lastAnalysis = userDoc.data()?.lastAnalysis;

    const analysesSnap = await adminDb
      .collection("users").doc(OWNER_ID).collection("analyses")
      .orderBy("createdAt", "desc").limit(6).get();
    const analyses = analysesSnap.docs.map((d) => d.data());

    const financialContext = lastAnalysis ? `
════════════════════════════════════════
SITUACIÓN FINANCIERA ACTUAL
════════════════════════════════════════
Análisis más reciente (${lastAnalysis.fecha_analisis ?? "sin fecha"}):
- Score: ${lastAnalysis.score}/100 · Perfil: ${lastAnalysis.perfil_riesgo}
- Ingreso neto mensual: $${lastAnalysis.metricas?.ingreso_neto_mensual?.toLocaleString("es-AR")}
- Gasto total mensual: $${lastAnalysis.metricas?.gasto_total_mensual?.toLocaleString("es-AR")}
- Superávit mensual: $${lastAnalysis.metricas?.superavit_mensual?.toLocaleString("es-AR")}
- Tasa de ahorro: ${lastAnalysis.metricas?.tasa_ahorro_pct}%
- Ratio de deuda: ${lastAnalysis.metricas?.ratio_deuda_pct}%
- Fondo de emergencia: ${lastAnalysis.metricas?.meses_emergencia} meses
- Resumen: ${lastAnalysis.resumen_ejecutivo}

PORTAFOLIO: ${JSON.stringify(lastAnalysis.portafolio_actual ?? [])}
GASTOS: ${JSON.stringify(lastAnalysis.gastos_por_categoria ?? [])}
RECOMENDACIONES PENDIENTES:
${(lastAnalysis.recomendaciones ?? []).map((r: any) => `- [${r.urgencia}] ${r.titulo}`).join("\n")}

HISTORIAL (últimos ${analyses.length} análisis):
${analyses.map((a: any) => `- ${a.fecha_analisis}: score ${a.score}/100, ahorro ${a.metricas?.tasa_ahorro_pct}%`).join("\n")}
` : "Todavía no hay análisis cargado. Pedile al usuario que suba sus archivos.";

    const systemPrompt = `Sos FinAdvisor, el asesor financiero personal de Juan Manuel Hillcoat.
Tenés acceso completo a su situación financiera actual e histórica.
Respondé de forma concisa, directa y personalizada basándote en sus datos reales.
Usá pesos argentinos ($) y dólares (U$S) según corresponda.
Si no hay datos para algo, decíselo honestamente. Nunca inventés números.
Respondé siempre en español rioplatense, tono profesional pero cercano.

${financialContext}`;

    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...(conversationHistory ?? []).slice(-8),
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("Error en /api/chat:", err);
    return NextResponse.json({ error: err.message ?? "Error interno" }, { status: 500 });
  }
}
