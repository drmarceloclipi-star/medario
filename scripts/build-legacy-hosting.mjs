import { copyFile, lstat, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, ".firebase", "legacy-public");
const STAGING = path.join(ROOT, ".firebase", "legacy-public.staging");

// Keep this list explicit. Do not replace with a directory glob.
const ALLOWED_FILES = [
  "assets/doctor-lucas.png",
  "assets/doctor-mariana.png",
  "assets/medario-mark.svg",
  "assets/medario-wordmark-topbar.png",
  "conta.html",
  "diagnostico-presenca-digital.html",
  "index.html",
  "institucional.html",
  "medario-pro.html",
  "medicos/joinville.html",
  "medicos/mariana-andrade.html",
  "privacidade.html",
  "reivindicar-perfil.html",
  "robots.txt",
  "script.js",
  "sitemap.xml",
  "sou-medico.html",
  "styles.css",
  "termos.html",
].sort();

function safeRelativePath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\\")) {
    throw new Error(`Unsafe allowlist path: ${relativePath}`);
  }

  const normalized = path.posix.normalize(relativePath);
  if (
    normalized !== relativePath ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error(`Unsafe allowlist path: ${relativePath}`);
  }
}

async function assertRegularFile(source, relativePath) {
  const stats = await lstat(source);
  if (!stats.isFile()) {
    throw new Error(`Allowlisted path is not a regular file: ${relativePath}`);
  }
}

async function build() {
  const files = [...new Set(ALLOWED_FILES)];
  if (files.length !== ALLOWED_FILES.length) {
    throw new Error("Allowlist contains duplicate paths");
  }

  await rm(STAGING, { force: true, recursive: true });
  await mkdir(STAGING, { recursive: true });

  for (const relativePath of files) {
    safeRelativePath(relativePath);

    const source = path.join(ROOT, relativePath);
    const destination = path.join(STAGING, relativePath);
    await assertRegularFile(source, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }

  await rm(OUTPUT, { force: true, recursive: true });
  await rename(STAGING, OUTPUT);

  const manifest = (await readFile(path.join(OUTPUT, "index.html"))).byteLength;
  console.log(`legacy hosting bundle: ${files.length} files, index.html ${manifest} bytes`);
}

build().catch(async (error) => {
  await rm(STAGING, { force: true, recursive: true });
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
