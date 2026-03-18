#!/usr/bin/env bun
/**
 * Downloads SQLite extensions (sqlite-vector) and the nomic-embed-text GGUF model.
 * sqlite-ai comes from @sqliteai/sqlite-ai npm package (auto-installed with bun install).
 *
 * Run: bun run scripts/setup-vendor.ts
 */

import { existsSync } from "fs";
import { Database } from "bun:sqlite";

const VENDOR_DIR = import.meta.dir + "/../vendor";
const MODELS_DIR = VENDOR_DIR + "/models";

const SQLITE_VECTOR_VERSION = "0.9.93";
const NOMIC_MODEL_FILE = "nomic-embed-text-v1.5.Q8_0.gguf";

const platform = process.platform;
const arch = process.arch;
const EXT = platform === "win32" ? "dll" : platform === "darwin" ? "dylib" : "so";

function getVectorAsset(): string {
  if (platform === "win32") {
    throw new Error("sqlite-vector: Windows prebuilt not in standard releases; use WSL or Linux");
  }
  const plat = platform === "darwin" ? "macos" : "linux";
  const a = arch === "arm64" ? "arm64" : "x86_64";
  const isMusl = platform === "linux" && existsSync("/etc/alpine-release");
  const platSuffix = plat === "linux" && isMusl ? "linux-musl" : plat;
  return `vector-${platSuffix}-${a}-${SQLITE_VECTOR_VERSION}.tar.gz`;
}

async function download(url: string, dest: string): Promise<void> {
  console.log(`  Downloading ${url.split("/").pop()}...`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  await Bun.write(dest, buf);
}

async function extractTarGz(archivePath: string, outDir: string): Promise<void> {
  const proc = Bun.spawn(["tar", "-xzf", archivePath, "-C", outDir], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exit = await proc.exited;
  if (exit !== 0) throw new Error(`tar exited ${exit}`);
}

async function main() {
  console.log("Moneypenny JS — Vendor Setup\n");

  try {
    const db = new Database(":memory:");
    const row = db.query("SELECT sqlite_version() as v").get() as { v: string };
    console.log(`SQLite version (Bun built-in): ${row.v}`);
    db.close();
  } catch (e) {
    console.warn("Could not query SQLite version:", e);
  }

  await Bun.$`mkdir -p ${VENDOR_DIR} ${MODELS_DIR}`.quiet();

  const vectorPath = `${VENDOR_DIR}/vector.${EXT}`;
  if (!(await Bun.file(vectorPath).exists())) {
    const vectorAsset = getVectorAsset();
    const vectorUrl = `https://github.com/sqliteai/sqlite-vector/releases/download/${SQLITE_VECTOR_VERSION}/${vectorAsset}`;
    const vectorArchive = `${VENDOR_DIR}/vector.tar.gz`;
    await download(vectorUrl, vectorArchive);
    await extractTarGz(vectorArchive, VENDOR_DIR);
    await Bun.$`rm -f ${vectorArchive}`.quiet();
    console.log("  sqlite-vector installed");
  } else {
    console.log("  sqlite-vector already present");
  }

  const modelPath = `${MODELS_DIR}/${NOMIC_MODEL_FILE}`;
  const modelUrl = `https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/${NOMIC_MODEL_FILE}`;

  if (!(await Bun.file(modelPath).exists())) {
    await download(modelUrl, modelPath);
    console.log("  nomic-embed-text model installed");
  } else {
    console.log("  nomic-embed-text model already present");
  }

  console.log("\nDone. Vendor layout:");
  console.log(`  ${VENDOR_DIR}/`);
  console.log(`    vector.${EXT}`);
  console.log(`  ${MODELS_DIR}/`);
  console.log(`    ${NOMIC_MODEL_FILE}`);
  console.log("\n  sqlite-ai: from @sqliteai/sqlite-ai (bun install)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
