// Lazy-required so a cold function that never touches PDFs/DOCX doesn't pay
// the parse-time cost of loading these libraries.

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer);
  return { text: result.text as string, pageCount: result.numpages as number };
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
