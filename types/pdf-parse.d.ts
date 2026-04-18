declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, any>
  ): Promise<{ text: string; numpages: number; info: any }>;
  export = pdfParse;
}