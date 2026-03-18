/**
 * Normalize markdown before chunking — strip boilerplate, collapse whitespace.
 */

const DEFAULT_MAX_SIZE = 120_000;

export interface NormalizeOptions {
  /** Max document size in chars (default 120000) */
  maxSize?: number;
}

export function normalize(
  markdown: string,
  options: NormalizeOptions = {}
): string {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;

  let out = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (out.length > maxSize) {
    out = out.slice(0, maxSize) + "\n\n[... truncated]";
  }

  return out;
}
