import esbuild from "esbuild";
import { readFile } from "fs/promises";
import fs from "node:fs";
import { fileURLToPath } from "url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (context.parentURL && (specifier.startsWith(".") || specifier.startsWith("/"))) {
      const parentDir = new URL(".", context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const candidate = new URL(specifier + ext, parentDir);
        if (fs.existsSync(fileURLToPath(candidate))) {
          return {
            url: candidate.href,
            shortCircuit: true,
          };
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const filePath = fileURLToPath(url);
    const source = await readFile(filePath, "utf8");
    const { code } = esbuild.transformSync(source, {
      loader: url.endsWith(".tsx") ? "tsx" : "ts",
      format: "esm",
      sourcefile: filePath,
    });
    return {
      format: "module",
      shortCircuit: true,
      source: code,
    };
  }
  return nextLoad(url, context);
}
