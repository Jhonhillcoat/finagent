import * as XLSX from "xlsx";

/** Límite aproximado de entrada al modelo (~700k caracteres ≲ contexto útil de Claude). */
export const MAX_COMBINED_TEXT_CHARS = 700_000;

const MAX_FILE_BYTES = 32 * 1024 * 1024;

function stripUtf8Bom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

/**
 * Decodifica CSV/TXT: UTF-8 con BOM; si hay muchos reemplazos U+FFFD, prueba Latin-1 (común en bancos AR).
 */
export function decodeTextBuffer(buffer: Buffer): string {
  const utf8 = stripUtf8Bom(buffer.toString("utf-8"));
  const bad = (utf8.match(/\uFFFD/g) ?? []).length;
  if (utf8.length > 200 && bad / utf8.length > 0.02) {
    return stripUtf8Bom(buffer.toString("latin1"));
  }
  return utf8;
}

/**
 * Excel / ODS: todas las hojas, rango completo, fechas y celdas vacías en el rango para no perder columnas.
 */
export function parseSpreadsheet(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellStyles: false,
    dense: false,
  });

  const parts: string[] = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    const ref = sheet["!ref"];
    if (!ref) {
      parts.push(`=== Hoja: ${name} (vacía o sin rango) ===\n`);
      continue;
    }

    const range = XLSX.utils.decode_range(ref);
    const rows = range.e.r - range.s.r + 1;
    const cols = range.e.c - range.s.c + 1;

    const csv = XLSX.utils.sheet_to_csv(sheet, {
      FS: ",",
      RS: "\n",
      blankrows: false,
    });

    const trimmed = csv.replace(/\n{4,}/g, "\n\n\n").trim();
    if (!trimmed) continue;

    parts.push(
      `=== Hoja: ${name} | ${rows} filas × ${cols} columnas | rango ${ref} ===\n${trimmed}`
    );
  }

  return parts.join("\n\n");
}

export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const data = await pdfParse(buffer);
    const text = (data.text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const pages = typeof data.numpages === "number" ? data.numpages : 0;
    const header =
      pages > 0
        ? `=== PDF (${pages} página${pages === 1 ? "" : "s"}) ===\n`
        : "=== PDF ===\n";
    return header + text.trim();
  } catch {
    const fallback = buffer
      .toString("latin1")
      .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500_000);
    return `=== PDF (extracción de texto falló; fragmento legible) ===\n${fallback}`;
  }
}

export type ParsedFile = { name: string; content: string; bytes: number; truncated: boolean };

/**
 * Ordena por contenido más largo primero para que, si hay recorte global, queden priorizados los archivos más densos.
 */
function sortByContentLengthDesc(files: ParsedFile[]): ParsedFile[] {
  return [...files].sort((a, b) => b.content.length - a.content.length);
}

/**
 * Une el corpus respetando MAX_COMBINED_TEXT_CHARS (archivos largos primero; cada uno se trunca solo si hace falta).
 */
export function mergeParsedFilesForModel(files: ParsedFile[]): {
  text: string;
  filesMeta: { name: string; chars: number; truncated: boolean }[];
} {
  const sorted = sortByContentLengthDesc(files);
  const sep = (name: string, origLen: number) =>
    `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nARCHIVO: ${name} (${origLen.toLocaleString("es-AR")} caracteres extraídos)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  let out = "";
  const meta: { name: string; chars: number; truncated: boolean }[] = [];
  const included = new Set<number>();

  sorted.forEach((f, idx) => {
    const header = sep(f.name, f.content.length);
    const remaining = MAX_COMBINED_TEXT_CHARS - out.length - header.length - 80;
    if (remaining < 400) return;

    let body = f.content;
    let trunc = f.truncated;
    if (body.length > remaining) {
      body = body.slice(0, remaining);
      trunc = true;
      body += `\n\n[…archivo recortado: ${f.content.length.toLocaleString("es-AR")} caracteres totales; aquí ${remaining.toLocaleString("es-AR")} por límite de contexto…]\n`;
    }
    out += header + body;
    meta.push({ name: f.name, chars: body.length, truncated: trunc });
    included.add(idx);
  });

  const skipped = sorted.filter((_, i) => !included.has(i));
  if (skipped.length) {
    out += `\n\n[AVISO: No entraron por límite de contexto: ${skipped.map((s) => s.name).join(", ")}. Enviá menos archivos o dividí en varias cargas.]\n`;
  }

  return { text: out.trim(), filesMeta: meta };
}

export async function parseUploadedFile(name: string, buffer: Buffer): Promise<ParsedFile> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `El archivo "${name}" supera el máximo de ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB. Dividilo o comprimí el contenido.`
    );
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  let content = "";

  if (["xlsx", "xls", "xlsm", "xlsb", "ods"].includes(ext)) {
    content = parseSpreadsheet(buffer);
  } else if (ext === "pdf") {
    content = await parsePdfBuffer(buffer);
  } else if (["csv", "tsv", "txt"].includes(ext)) {
    const raw = decodeTextBuffer(buffer);
    content = ext === "tsv" ? raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : raw;
  } else {
    content = decodeTextBuffer(buffer);
  }

  const trimmed = content.trim();
  return {
    name,
    content: trimmed || `(sin texto extraíble: ${name})`,
    bytes: buffer.byteLength,
    truncated: false,
  };
}
