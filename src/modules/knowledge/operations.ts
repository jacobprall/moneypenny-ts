import type { OperationContext } from "../../core/context";
import { runIngestPipeline } from "../../pipeline/ingest";
import { retrieve } from "../../retrieval/engine";
import * as docs from "../../pipeline/documents";
import { runEmbedderBatch } from "../../pipeline/embedder-job";

export interface AddInput {
  content: string;
  context: string;
  sourceType?: "user" | "url" | "file" | "text";
  source?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AddOutput {
  id: string;
  context: string;
}

export const add = {
  name: "knowledge.add",
  async execute(ctx: OperationContext, input: AddInput): Promise<AddOutput> {
    const result = await runIngestPipeline(ctx.db, {
      source: "text",
      content: input.content,
      context: input.context,
      title: input.title ?? undefined,
    });
    void runEmbedderBatch(ctx.db);
    return { id: result.documentId, context: result.context };
  },
};

export interface SearchInput {
  query: string;
  limit?: number;
  minScore?: number;
}

export interface SearchOutput {
  results: Array<{ content: string; context: string; score: number }>;
}

export const search = {
  name: "knowledge.search",
  async execute(ctx: OperationContext, input: SearchInput): Promise<SearchOutput> {
    const results = await retrieve(ctx.db, input.query, {
      limit: input.limit ?? 30,
      minScore: input.minScore ?? 0,
    });
    return {
      results: results.map((r) => ({
        content: r.content,
        context: "",
        score: r.score,
      })),
    };
  },
};

export interface ListInput {
  sourceType?: string;
  limit?: number;
}

export interface ListOutput {
  entries: Array<{
    id: string;
    sourceType: string;
    source: string | null;
    title: string | null;
    context: string;
    createdAt: number;
  }>;
}

export const list = {
  name: "knowledge.list",
  async execute(ctx: OperationContext, input: ListInput): Promise<ListOutput> {
    const entries = docs.listDocuments(ctx.db, {
      sourceType: input.sourceType,
      limit: input.limit ?? 100,
    });
    return {
      entries: entries.map((e) => ({
        id: e.id,
        sourceType: e.sourceType,
        source: e.source,
        title: e.title,
        context: e.context,
        createdAt: e.createdAt,
      })),
    };
  },
};

export interface DeleteInput {
  context: string;
}

export interface DeleteOutput {
  deleted: boolean;
}

export const deleteOp = {
  name: "knowledge.delete",
  async execute(ctx: OperationContext, input: DeleteInput): Promise<DeleteOutput> {
    docs.deleteDocumentByContext(ctx.db, input.context);
    return { deleted: true };
  },
};

export interface IngestInput {
  source: "url" | "file" | "text";
  url?: string;
  path?: string;
  content?: string;
  context?: string;
  title?: string;
}

export interface IngestOutput {
  id: string;
  context: string;
  title?: string;
}

export const ingest = {
  name: "knowledge.ingest",
  async execute(ctx: OperationContext, input: IngestInput): Promise<IngestOutput> {
    const result = await runIngestPipeline(ctx.db, {
      source: input.source,
      url: input.url,
      path: input.path,
      content: input.content,
      context: input.context,
      title: input.title,
    });
    void runEmbedderBatch(ctx.db);
    return {
      id: result.documentId,
      context: result.context,
      title: input.title,
    };
  },
};
