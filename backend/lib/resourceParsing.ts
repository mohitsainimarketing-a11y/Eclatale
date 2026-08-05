// Lazy-required so a cold function that never touches PDFs/DOCX doesn't pay
// the parse-time cost of loading these libraries.

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // unpdf ships PDF.js compiled for serverless/Node runtimes — plain
  // pdf-parse (and pdfjs-dist's browser build) reference DOMMatrix, which
  // doesn't exist outside a browser and throws "DOMMatrix is not defined"
  // on Vercel's Node functions.
  const { getDocumentProxy, extractText } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text, pageCount: totalPages };
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value as string;
}

export function extractCsvSummary(text: string): string {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return '';
  const header = lines[0];
  const rowCount = lines.length - 1;
  const preview = lines.slice(0, 6).join('\n');
  return `CSV with ${rowCount} rows. Columns: ${header}\n\nFirst rows:\n${preview}`;
}

// Truncates extracted text to a safe prompt-context size — long PDFs/CSVs
// shouldn't blow the model's context or dominate the conversation.
export function truncateForPrompt(text: string, maxChars = 12000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[...truncated...]';
}
