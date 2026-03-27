/**
 * Smoke test: GET /health and minimal API checks against a running brain.
 * Start the server first: `bun run start` or `mp serve`
 *
 *   BRAIN_HTTP_PORT | MP_HTTP_PORT | default 3123
 */

const basePort = parseInt(process.env.BRAIN_HTTP_PORT ?? process.env.MP_HTTP_PORT ?? "3123", 10);
const baseUrl = process.env.MONEYPENNY_URL ?? `http://127.0.0.1:${basePort}`;

async function main() {
  const healthUrl = `${baseUrl.replace(/\/$/, "")}/health`;
  const res = await fetch(healthUrl, { method: "GET" }).catch((e) => {
    console.error(`[smoke] Failed to reach ${healthUrl}:`, e);
    process.exit(1);
    throw e;
  });

  if (!res.ok) {
    console.error(`[smoke] ${healthUrl} -> HTTP ${res.status}`);
    process.exit(1);
  }

  const body = (await res.json()) as { status?: string };
  if (body.status !== "ok") {
    console.error("[smoke] Unexpected health JSON:", body);
    process.exit(1);
  }

  const root = await fetch(`${baseUrl.replace(/\/$/, "")}/`, { method: "GET" });
  if (!root.ok) {
    console.error(`[smoke] GET / -> HTTP ${root.status}`);
    process.exit(1);
  }

  console.log(`[smoke] OK — brain at ${baseUrl} (health: ok)`);
  process.exit(0);
}

main();
