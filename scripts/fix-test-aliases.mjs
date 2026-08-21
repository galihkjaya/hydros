/**
 * Rewrites `@/…` path-alias imports to relative paths inside the compiled test
 * output.
 *
 * `tsc` type-checks the alias but emits it verbatim, and Node cannot resolve it.
 * Rewriting after compilation keeps the source using the project-wide alias
 * without adding a bundler or loader just to run tests.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const ROOT = ".test-build";

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".js")) rewrite(path);
  }
}

function rewrite(path) {
  const source = readFileSync(path, "utf8");
  // `from "@/lib/x.js"` and `import("@/lib/x.js")`
  const next = source.replace(/(["'])@\/([^"']+)\1/g, (_match, quote, target) => {
    let rel = relative(dirname(path), join(ROOT, target)).replaceAll("\\", "/");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return `${quote}${rel}${quote}`;
  });
  if (next !== source) writeFileSync(path, next);
}

walk(ROOT);
