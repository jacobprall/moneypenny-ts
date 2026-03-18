/**
 * Content sources for ingestion pipeline.
 */

export interface RawContent {
  type: "html" | "markdown" | "text";
  body: string;
  url?: string;
  title?: string;
}

export interface ContentSource {
  type: "url" | "file" | "text";
  fetch(): Promise<RawContent>;
}

export async function fetchUrl(url: string): Promise<RawContent> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Moneypenny/1.0 (knowledge-ingestion)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const body = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  let type: RawContent["type"] = "text";
  if (contentType.includes("html")) type = "html";
  else if (contentType.includes("markdown") || url.endsWith(".md")) type = "markdown";

  const title = new URL(url).hostname;
  return { type, body, url, title };
}

export async function fetchFile(path: string): Promise<RawContent> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`File not found: ${path}`);
  const body = await file.text();
  const type: RawContent["type"] = path.endsWith(".md") ? "markdown" : path.endsWith(".html") || path.endsWith(".htm") ? "html" : "text";
  const title = path.split("/").pop() ?? path;
  return { type, body, title };
}

export function passThroughText(content: string, title?: string): RawContent {
  const type: RawContent["type"] = content.includes("<") && content.includes(">") ? "html" : "markdown";
  return { type, body: content, title };
}
