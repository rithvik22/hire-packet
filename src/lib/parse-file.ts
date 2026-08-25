export const MAX_RESUME_BYTES = 4 * 1024 * 1024;

export function resumeFileError(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase();
  if (!file.size) return "The file is empty.";
  if (file.size > MAX_RESUME_BYTES) return "Resume must be 4 MB or smaller.";
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) return "Upload a PDF or DOCX resume.";
  return null;
}

export function normalizeResumeLayout(text: string): string {
  return String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/\f/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(
      /\b(professional summary|summary|objective|technical skills|skills|experience|work history|employment|education|projects|certifications|awards)\b/gi,
      "\n$1\n"
    )
    .replace(/\s+([•●▪◦])\s*/g, "\n$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractResumeText(buffer: Buffer, filename: string): Promise<string> {
  const name = filename.toLowerCase();
  let text = "";
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    text = String(result.value || "");
  } else if (name.endsWith(".pdf")) {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    text = String(result.text || "");
  } else {
    throw new Error("Upload a PDF or DOCX resume.");
  }
  return normalizeResumeLayout(text);
}
