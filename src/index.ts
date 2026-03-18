/**
 * Brains — MCP sidecar entry point.
 * Run: bun run src/index.ts
 */

import { runMcpServer } from "./transport/mcp";
import { serveHttp } from "./transport/http";

const basePort = parseInt(process.env.BRAIN_HTTP_PORT ?? "3123", 10);

function startHttpWithFallback() {
  for (let port = basePort; port < basePort + 10; port++) {
    try {
      const { port: actualPort } = serveHttp(port);
      console.error(`Brains HTTP: http://localhost:${actualPort}`);
      return;
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "EADDRINUSE") {
        continue;
      }
      throw err;
    }
  }
  console.error(`Ports ${basePort}-${basePort + 9} in use; HTTP server disabled.`);
}

startHttpWithFallback();

runMcpServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
