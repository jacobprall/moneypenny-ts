/**
 * Markdown section chunking — split on headings (# ## ###).
 * Long sections are split at paragraph boundaries up to maxChunkSize.
 */

import type { Chunk, ChunkingStrategy } from "./types";

export interface MarkdownSectionOptions {
  /** Max chars per chunk when a section exceeds this (default 2000) */
  maxChunkSize?: number;
  /** Heading levels to split on: 1 = #, 2 = ##, 3 = ### (default 3) */
  headingLevels?: number;
}

const DEFAULT_MAX_CHUNK_SIZE = 2000;
const DEFAULT_HEADING_LEVELS = 3;

export function createMarkdownSectionStrategy(
  options: MarkdownSectionOptions = {}
): ChunkingStrategy {
  const maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
  const headingLevels = options.headingLevels ?? DEFAULT_HEADING_LEVELS;

  return {
    name: "markdown-sections",
    chunk(markdown: string): Chunk[] {
      const trimmed = markdown.trim();
      if (!trimmed) return [];

      const sections = splitByHeadings(trimmed, headingLevels);
      const chunks: Chunk[] = [];
      let position = 0;

      for (const section of sections) {
        const subChunks = splitBySize(section, maxChunkSize);
        for (const content of subChunks) {
          chunks.push({
            id: crypto.randomUUID(),
            content,
            position: position++,
          });
        }
      }

      return chunks;
    },
  };
}

/** Split markdown into sections by heading boundaries. Each section includes its heading. */
function splitByHeadings(markdown: string, maxLevel: number): string[] {
  const headingRegex = new RegExp(`^(#{1,${maxLevel}})\\s+.+$`, "gm");
  const matches: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(markdown)) !== null) {
    matches.push(match.index);
  }

  const sections: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i];
    const end = i + 1 < matches.length ? matches[i + 1] : markdown.length;
    sections.push(markdown.slice(start, end).trim());
  }
  if (matches.length === 0) {
    sections.push(markdown.trim());
  } else if (matches[0] > 0) {
    sections.unshift(markdown.slice(0, matches[0]).trim());
  }

  return sections.filter((s) => s.length > 0);
}

/** Split text at paragraph boundaries, max size per chunk. */
function splitBySize(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const result: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  let current = "";
  for (const p of paragraphs) {
    const withSep = current ? current + "\n\n" + p : p;
    if (withSep.length <= maxSize) {
      current = withSep;
    } else {
      if (current) {
        result.push(current);
        current = "";
      }
      if (p.length <= maxSize) {
        current = p;
      } else {
        result.push(p.slice(0, maxSize));
        const rest = p.slice(maxSize);
        result.push(...splitBySize(rest, maxSize));
      }
    }
  }
  if (current) result.push(current);
  return result;
}

export const markdownSectionStrategy = createMarkdownSectionStrategy();
