declare module "turndown" {
  export default class TurndownService {
    constructor(options?: Record<string, unknown>);
    remove(selectors: string | string[]): void;
    turndown(html: string): string;
  }
}
