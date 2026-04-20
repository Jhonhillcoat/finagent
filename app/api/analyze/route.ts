import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { adminDb } from "@/lib/firebaseAdmin";
import { OWNER_ID } from "@/lib/config";
import { mergeParsedFilesForModel, parseUploadedFile } from "@/lib/fileParser";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Adjuntá al menos un archivo" }, { status: 400 });
    }

    const parsedFiles = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return parseUploadedFile(file.name, buffer);
      })
    );

    const { text: filesContent } = mergeParsedFilesForModel(parsedFiles);
    const userMessage = `Por favor analizá mis datos financieros de los siguientes archivos y devolvé el JSON completo del diagnóstico.\n\nARCHIVOS ADJUNTOS:\n${filesContent}\n\nRecordá devolver ÚNICAMENTE el JSON, sin texto adicional.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleanJson = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const analysis = JSON.parse(cleanJson);

    const docRef = await adminDb.collection("users").doc(OWNER_ID).collection("analyses").add({
      ...analysis,
      createdAt: new Date().toISOString(),
      archivos_procesados: files.map((f) => f.name),
    });

    await adminDb.collection("users").doc(OWNER_ID).set(
      { lastAnalysis: analysis, lastAnalysisId: docRef.id, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ success: true, analysisId: docRef.id, analysis });
  } catch (err: any) {
    console.error("Error en /api/analyze:", err);
    return NextResponse.json({ error: err.message ?? "Error interno" }, { status: 500 });
  }
}
