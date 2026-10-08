import esbuild from "esbuild";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

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
