import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { adminDb } from "@/lib/firebaseAdmin";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers para parsear archivos ────────────────────────────

async function parseExcel(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: string[] = [];
  workbook.SheetNames.forEach((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
    sheets.push(`=== Hoja: ${name} ===\n${csv}`);
  });
  return sheets.join("\n\n");
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // pdf-parse se importa dinámicamente para evitar errores de SSR
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseCsv(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

async function parseFile(
  name: string,
  buffer: Buffer
): Promise<{ name: string; content: string }> {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  let content = "";

  if (["xlsx", "xls", "xlsm"].includes(ext)) {
    content = await parseExcel(buffer);
  } else if (ext === "pdf") {
    content = await parsePdf(buffer);
  } else if (["csv", "txt"].includes(ext)) {
    content = await parseCsv(buffer);
  } else {
    content = buffer.toString("utf-8").slice(0, 10000); // fallback
  }

  return { name, content: content.slice(0, 25000) }; // max 25k chars por archivo
}

// ── Handler principal ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userId = (formData.get("userId") as string) || "anonymous";
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Adjuntá al menos un archivo" },
        { status: 400 }
      );
    }

    // 1. Parsear todos los archivos
    const parsedFiles = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return parseFile(file.name, buffer);
      })
    );

    // 2. Construir el mensaje para Claude
    const filesContent = parsedFiles
      .map((f) => `\n\n━━━ ARCHIVO: ${f.name} ━━━\n${f.content}`)
      .join("");

    const userMessage = `
Por favor analizá mis datos financieros de los siguientes archivos y devolvé el JSON completo del diagnóstico.

ARCHIVOS ADJUNTOS:
${filesContent}

Recordá devolver ÚNICAMENTE el JSON, sin texto adicional.
`.trim();

    // 3. Llamar a Claude
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // 4. Parsear el JSON de respuesta
    // Limpiar posibles bloques de código que Claude pueda agregar
    const cleanJson = rawText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const analysis = JSON.parse(cleanJson);

    // 5. Guardar en Firestore
    const docRef = await adminDb
      .collection("users")
      .doc(userId)
      .collection("analyses")
      .add({
        ...analysis,
        createdAt: new Date().toISOString(),
        archivos_procesados: files.map((f) => f.name),
      });

    // 6. Actualizar el snapshot más reciente del usuario
    await adminDb.collection("users").doc(userId).set(
      {
        lastAnalysis: analysis,
        lastAnalysisId: docRef.id,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, analysisId: docRef.id, analysis });
  } catch (err: any) {
    console.error("Error en /api/analyze:", err);
    return NextResponse.json(
      { error: err.message ?? "Error interno del servidor" },
      { status: 500 }
    );
  }
}
