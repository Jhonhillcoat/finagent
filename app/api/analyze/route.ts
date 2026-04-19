import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { adminDb } from "@/lib/firebaseAdmin";
import { OWNER_ID } from "@/lib/config";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  try {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const data = await pdfParse(buffer);
    return data.text ?? "";
  } catch {
    return buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 20000);
  }
}

async function parseFile(name: string, buffer: Buffer): Promise<{ name: string; content: string }> {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  let content = "";
  if (["xlsx", "xls", "xlsm"].includes(ext)) content = await parseExcel(buffer);
  else if (ext === "pdf") content = await parsePdf(buffer);
  else if (["csv", "txt"].includes(ext)) content = buffer.toString("utf-8");
  else content = buffer.toString("utf-8").slice(0, 10000);
  return { name, content: content.slice(0, 25000) };
}

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
        return parseFile(file.name, buffer);
      })
    );

    const filesContent = parsedFiles.map((f) => `\n\n━━━ ARCHIVO: ${f.name} ━━━\n${f.content}`).join("");
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
