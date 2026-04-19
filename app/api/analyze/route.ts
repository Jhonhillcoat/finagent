import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { adminDb } from "@/lib/firebaseAdmin";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers para parsear archivos ────────────────────────────

function escapeTsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[\t\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Exporta cada hoja en TSV con:
 * - lectura con fechas y formatos numéricos (cellDates + cellNF) y celdas vacías en rango (sheetStubs)
 * - valores mostrados como en Excel (raw: false), no solo números serializados
 * - todas las columnas del rango alineadas (defval) para no perder posición entre filas
 * - primera columna = número de fila Excel; cabecera = letras de columna (A, B, …)
 */
function parseExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: true,
    sheetStubs: true,
  });

  const sheetsOut: string[] = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const ref = sheet["!ref"];
    if (!ref) {
      sheetsOut.push(`=== Hoja: ${name} (sin rango / vacía) ===\n`);
      continue;
    }

    const rng = XLSX.utils.decode_range(ref);
    const ncolsFromRef = rng.e.c - rng.s.c + 1;
    const nrowsFromRef = rng.e.r - rng.s.r + 1;

    const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: true,
      dateNF: "yyyy-mm-dd",
    });

    const maxColWidth = Math.max(
      ncolsFromRef,
      ...aoa.map((row) => (Array.isArray(row) ? row.length : 0)),
      0
    );

    const colLabels = Array.from({ length: maxColWidth }, (_, i) =>
      XLSX.utils.encode_col(rng.s.c + i)
    );

    const lines: string[] = [
      `=== Hoja: ${name} ===`,
      `Rango: ${ref} (${nrowsFromRef} filas × ${ncolsFromRef} columnas según Excel; exportadas ${aoa.length} filas × ${maxColWidth} columnas)`,
    ];

    const merges = sheet["!merges"] as XLSX.Range[] | undefined;
    if (merges?.length) {
      const mergeStr = merges.map((m) => XLSX.utils.encode_range(m)).join("; ");
      lines.push(`Celdas combinadas: ${mergeStr}`);
    }

    lines.push(
      "--- Tabla (TSV: columna 1 = nº de fila en Excel; siguientes columnas = A, B, …) ---"
    );
    lines.push(["fila_excel", ...colLabels].join("\t"));

    aoa.forEach((row, i) => {
      const excelRowNum = rng.s.r + i + 1;
      const cells: string[] = [];
      for (let c = 0; c < maxColWidth; c++) {
        const v = Array.isArray(row) ? row[c] : undefined;
        cells.push(escapeTsvCell(v ?? ""));
      }
      lines.push([String(excelRowNum), ...cells].join("\t"));
    });

    sheetsOut.push(lines.join("\n"));
  }

  return sheetsOut.join("\n\n");
}

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // Importar desde el path interno evita que pdf-parse lea
    // su archivo de test al inicializarse (causa crash en serverless)
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const data = await pdfParse(buffer);
    return data.text ?? "";
  } catch {
    // Fallback: extraer texto legible del PDF ignorando binarios
    return buffer
      .toString("latin1")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
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
    content = parseExcel(buffer);
  } else if (ext === "pdf") {
    content = await parsePdf(buffer);
  } else if (["csv", "txt"].includes(ext)) {
    content = await parseCsv(buffer);
  } else {
    content = buffer.toString("utf-8");
  }

  return { name, content };
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
Por favor analizá mis datos financieros. El texto debajo es el contenido completo de cada archivo (sin truncar).

ARCHIVOS ADJUNTOS:
${filesContent}

Recordá devolver ÚNICAMENTE el JSON, sin texto adicional.
`.trim();

    // 3. Llamar a Claude
    const message = await client.messages.create({
      model:"claude-sonnet-4-6",
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
