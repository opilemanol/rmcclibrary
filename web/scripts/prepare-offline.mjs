import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../out/", import.meta.url));
const nextDirectory = join(outputDirectory, "_next");
const staticDirectory = join(outputDirectory, "static", "next", "static");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

await mkdir(join(outputDirectory, "static", "next"), { recursive: true });
await rename(nextDirectory, join(outputDirectory, "static", "next"));

const outputFiles = await listFiles(outputDirectory);
for (const path of outputFiles) {
  if (!/\.(html|txt|js|css|json|map)$/.test(path)) continue;
  const contents = await readFile(path, "utf8");
  if (contents.includes("_next/")) {
    await writeFile(path, contents.replaceAll("_next/", "static/next/"));
  }
}

const files = await listFiles(staticDirectory);
const assets = files
  .map((path) => `./${relative(outputDirectory, path).split(sep).join("/")}`)
  .filter((path) => !path.includes("/_not-found/"));
const workerPath = new URL("../out/sw.js", import.meta.url);
const worker = await readFile(workerPath, "utf8");
if (!worker.includes("const BUILD_ASSETS = [];")) {
  throw new Error("Service worker build asset placeholder is missing.");
}
await writeFile(workerPath, worker.replace("const BUILD_ASSETS = [];", `const BUILD_ASSETS = ${JSON.stringify(assets)};`));
console.log(`Prepared offline cache manifest with ${assets.length} static assets.`);
