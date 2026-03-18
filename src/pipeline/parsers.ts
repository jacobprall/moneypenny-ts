/**
 * HTML content extraction and markdown conversion.
 */

import { parseHTML } from "linkedom";
import TurndownService from "turndown";

export function extractMainContent(html: string): string {
  const { document } = parseHTML(html);
  const article = document.querySelector("article") ?? document.querySelector("main") ?? document.querySelector("[role='main']");
  const root = article ?? document.body;
  if (!root) return html;
  return root.innerHTML;
}

export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({ headingStyle: "atx" });
  turndown.remove(["script", "style", "nav", "header", "footer", "aside"]);
  return turndown.turndown(html);
}

export function toMarkdown(raw: { type: string; body: string }): string {
  if (raw.type === "markdown" || raw.type === "text") return raw.body;
  if (raw.type === "html") {
    const extracted = extractMainContent(raw.body);
    return htmlToMarkdown(extracted);
  }
  return raw.body;
}
