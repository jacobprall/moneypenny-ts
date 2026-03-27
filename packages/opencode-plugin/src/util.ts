export function extractTextFromParts(parts: Array<{ type?: string; text?: string }>): string {
  const texts: string[] = [];
  for (const p of parts) {
    if (p.type === "text" && typeof p.text === "string") {
      texts.push(p.text);
    }
  }
  return texts.join("\n").trim();
}

/** Skip brain context for lightweight / utility models. */
export function shouldSkipBrainContext(modelID: string, skipSubstrings: string[]): boolean {
  const id = modelID.toLowerCase();
  for (const s of skipSubstrings) {
    if (id.includes(s.toLowerCase())) return true;
  }
  return false;
}
