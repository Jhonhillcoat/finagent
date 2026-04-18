import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminDb } from "@/lib/firebaseAdmin";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { userId, message, conversationHistory } = await req.json();

    if (!userId || !message) {
      return NextResponse.json({ error: "userId y message requeridos" }, { status: 400 });
    }

    // Cargar el último análisis y el historial de análisis del usuario
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const lastAnalysis = userData?.lastAnalysis;

    // Cargar los últimos 6 análisis para dar contexto histórico
    const analysesSnap = await adminDb
      .collection("users")
      .doc(userId)
      .collection("analyses")
      .orderBy("createdAt", "desc")
      .limit(6)
      .get();

    const analyses = analysesSnap.docs.map((d) => d.data());

    // Construir contexto financiero completo
    const financialContext = lastAnalysis
      ? `
════════════════════════════════════════
CONTEXTO FINANCIERO DEL USUARIO
════════════════════════════════════════

ANÁLISIS MÁS RECIENTE (${lastAnalysis.fecha_analisis ?? "sin fecha"}):
- Score de salud financiera: ${lastAnalysis.score}/100
- Perfil de riesgo: ${lastAnalysis.perfil_riesgo}
- Ingreso neto mensual: $${lastAnalysis.metricas?.ingreso_neto_mensual?.toLocaleString("es-AR")}
- Gasto total mensual: $${lastAnalysis.metricas?.gasto_total_mensual?.toLocaleString("es-AR")}
- Superávit mensual: $${lastAnalysis.metricas?.superavit_mensual?.toLocaleString("es-AR")}
- Tasa de ahorro: ${lastAnalysis.metricas?.tasa_ahorro_pct}%
- Ratio de deuda: ${lastAnalysis.metricas?.ratio_deuda_pct}%
- Fondo de emergencia: ${lastAnalysis.metricas?.meses_emergencia} meses
- Resumen: ${lastAnalysis.resumen_ejecutivo}

PORTAFOLIO ACTUAL:
${JSON.stringify(lastAnalysis.portafolio_actual ?? [], null, 2)}

GASTOS POR CATEGORÍA:
${JSON.stringify(lastAnalysis.gastos_por_categoria ?? [], null, 2)}

RECOMENDACIONES PENDIENTES:
${(lastAnalysis.recomendaciones ?? []).map((r: any) => `- [${r.urgencia}] ${r.titulo}: ${r.descripcion}`).join("\n")}

HISTORIAL DE SCORES (últimos ${analyses.length} meses):
${analyses.map((a: any) => `- ${a.fecha_analisis ?? "sin fecha"}: score ${a.score}/100, ahorro ${a.metricas?.tasa_ahorro_pct}%`).join("\n")}
`
      : "El usuario aún no tiene análisis financiero cargado.";

    const systemPrompt = `Sos FinAdvisor, el asesor financiero personal del usuario. 
Tenés acceso completo a su situación financiera actual e histórica.
Respondé preguntas de forma concisa, clara y personalizada basándote en sus datos reales.
Usá pesos argentinos ($) como moneda por defecto.
Si el usuario pregunta algo que no tiene respuesta en sus datos, decíselo honestamente.
Nunca inventés datos ni hagas suposiciones sin base.
Respondé siempre en español, de forma conversacional pero precisa.

${financialContext}`;

    // Construir el historial de conversación para Claude
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...(conversationHistory ?? []),
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("Error en /api/chat:", err);
    return NextResponse.json(
      { error: err.message ?? "Error interno" },
      { status: 500 }
    );
  }
}
