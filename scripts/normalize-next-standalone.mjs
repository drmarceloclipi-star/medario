import { cp, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const standaloneRoot = path.join(appRoot, ".next", "standalone");
const nestedAppRoot = path.join(standaloneRoot, "apps", "web");

try {
  await stat(path.join(nestedAppRoot, ".next", "routes-manifest.json"));
} catch {
  process.exit(0);
}

for (const entry of await readdir(nestedAppRoot)) {
  const destination = path.join(standaloneRoot, entry);
  // Turbopack can emit a directory at the root and a symlink/file at the
  // nested app path (notably for React packages). Replace the destination so
  // the standalone bundle has one coherent module tree.
  await rm(destination, { recursive: true, force: true });
  await cp(path.join(nestedAppRoot, entry), destination, {
    recursive: true,
    force: true,
  });
}

// Next intentionally leaves static assets and the public directory outside
// standalone output. Copy them into the final server root so the standalone
// server remains runnable outside the App Hosting adapter too.
await cp(path.join(appRoot, ".next", "static"), path.join(standaloneRoot, ".next", "static"), {
  recursive: true,
  force: true,
});

try {
  await stat(path.join(appRoot, "public"));
  await cp(path.join(appRoot, "public"), path.join(standaloneRoot, "public"), {
    recursive: true,
    force: true,
  });
} catch {
  // A Next app may not define public assets.
}

await rm(path.join(standaloneRoot, "apps"), { recursive: true, force: true });
