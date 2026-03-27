import type { OperationContext } from "../../core/context";
import { loadConfig } from "../../core/config";
import * as Session from "../../session";
import { runLoop } from "../../session/prompt";

export interface CreateInput {
  directory?: string;
  title?: string;
}

export interface CreateOutput {
  id: string;
}

export const create = {
  name: "session.create",
  async execute(ctx: OperationContext, input: CreateInput = {}): Promise<CreateOutput> {
    const sess = Session.create(ctx.db, {
      directory: input.directory ?? process.cwd(),
      title: input.title ?? null,
    });
    return { id: sess.id };
  },
};

export interface RunInput {
  sessionId: string;
  message: string;
}

export interface RunOutput {
  sessionId: string;
}

export const run = {
  name: "session.run",
  async execute(ctx: OperationContext, input: RunInput): Promise<RunOutput> {
    const config = await loadConfig();
    await runLoop({
      db: ctx.db,
      sessionId: input.sessionId,
      config,
      userMessage: input.message,
      onTextDelta: (text) => process.stdout.write(text),
    });
    return { sessionId: input.sessionId };
  },
};

export interface GetInput {
  id: string;
}

export interface GetOutput {
  session: Session.Session | null;
  messages: Session.Message[];
}

export const get = {
  name: "session.get",
  async execute(ctx: OperationContext, input: GetInput): Promise<GetOutput> {
    const session = Session.get(ctx.db, input.id);
    if (!session) return { session: null, messages: [] };
    const messages = Session.getMessages(ctx.db, input.id);
    return { session, messages };
  },
};
