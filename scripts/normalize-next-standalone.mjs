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
  await cp(path.join(nestedAppRoot, entry), path.join(standaloneRoot, entry), {
    recursive: true,
    force: true,
  });
}

await rm(path.join(standaloneRoot, "apps"), { recursive: true, force: true });
