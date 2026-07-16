import { cp, lstat, readlink, readdir, rm, stat, symlink } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const standaloneRoot = path.join(appRoot, ".next", "standalone");
const nestedAppRoot = path.join(standaloneRoot, "apps", "web");

// The Firebase App Hosting adapter owns its production bundle. Rewriting its
// standalone tree strips runtime dependencies from the final image.
if (process.env.FIREBASE_CONFIG) {
  process.exit(0);
}

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

// App Hosting keeps the standalone root but strips the nested workspace tree.
// Move pnpm's package store into that root and retarget package links there.
const nestedModules = path.join(nestedAppRoot, "node_modules");
const standaloneModules = path.join(standaloneRoot, "node_modules");
const nestedStore = path.join(nestedModules, ".pnpm");
try {
  await stat(nestedStore);
  await rm(path.join(standaloneModules, ".pnpm"), { recursive: true, force: true });
  await cp(nestedStore, path.join(standaloneModules, ".pnpm"), {
    recursive: true,
    force: true,
  });

  for (const entry of await readdir(nestedModules, { recursive: true })) {
    if (entry.startsWith(".pnpm/")) {
      continue;
    }

    const source = path.join(nestedModules, entry);
    const destination = path.join(standaloneModules, entry);
    const sourceStats = await lstat(source);
    if (!sourceStats.isSymbolicLink()) {
      continue;
    }

    const target = await readlink(source);
    const resolvedTarget = path.resolve(path.dirname(source), target);
    if (!resolvedTarget.startsWith(nestedModules)) {
      continue;
    }

    const relocatedTarget = path.join(
      standaloneModules,
      path.relative(nestedModules, resolvedTarget),
    );
    await rm(destination, { recursive: true, force: true });
    await symlink(relocatedTarget, destination);
  }
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

// App Hosting removes hidden pnpm stores from the final image. React is loaded
// by Next during bootstrap, so make these runtime packages physical entries.
for (const packageName of ["react", "react-dom"]) {
  const nestedSource = path.join(nestedModules, packageName);
  const source = await stat(nestedSource).then(
    () => nestedSource,
    (error) => {
      if (error?.code === "ENOENT") {
        return path.join(appRoot, "node_modules", packageName);
      }
      throw error;
    },
  );
  const destination = path.join(standaloneModules, packageName);
  try {
    await stat(source);
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true, force: true, dereference: true });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
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

// Keep the nested app tree. pnpm package links in the flattened root module
// tree point into it; deleting it leaves the Cloud Run server without React.
