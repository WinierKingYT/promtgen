import { glob } from "glob";
import { readFileSync } from "fs";
import { resolve, relative, dirname, basename } from "path";

function isTransparentTypeScriptCompatibilityAdapter(file: string, targetBasename: string): boolean {
  if (!file.endsWith(".js")) {
    return false;
  }

  const source = readFileSync(file, "utf8").trim();
  const escapedTarget = targetBasename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reExportPattern = new RegExp(
    `^export\\s+\\{[^}]+\\}\\s+from\\s+['"]\\./${escapedTarget}\\.ts['"];?$`
  );
  return reExportPattern.test(source);
}

async function checkDuplicateModules() {
  const projectRoot = process.cwd();
  const srcDir = resolve(projectRoot, "src");

  // Find all .ts and .js files in src/
  const tsFiles = await glob("**/*.ts", { cwd: srcDir, absolute: true });
  const jsFiles = await glob("**/*.js", { cwd: srcDir, absolute: true });

  // Group by basename (without extension)
  const byBasename = new Map<string, string[]>();

  for (const file of [...tsFiles, ...jsFiles]) {
    // Skip test files and generated files
    if (file.includes(".test.") || file.includes(".spec.") || file.includes("/.graphify")) {
      continue;
    }
    const name = basename(file).replace(/\.(ts|js)$/, "");
    const existing = byBasename.get(name) || [];
    existing.push(file);
    byBasename.set(name, existing);
  }

  let hasErrors = false;
  const errors: string[] = [];

  // Check for duplicates
  for (const [name, files] of byBasename) {
    if (files.length > 1) {
      // Check if it's a legitimate TS/JS pair (same directory)
      const dirs = new Set(files.map(f => dirname(f)));
      if (dirs.size === 1) {
        // Same directory - likely TS/JS duplicate
        const tsFiles = files.filter(f => f.endsWith(".ts"));
        const jsFiles = files.filter(f => f.endsWith(".js"));
        if (tsFiles.length > 0 && jsFiles.length > 0) {
          const adaptersOnly = jsFiles.every(file =>
            isTransparentTypeScriptCompatibilityAdapter(file, name)
          );
          if (adaptersOnly) {
            continue;
          }
          hasErrors = true;
          const relFiles = files.map(f => relative(projectRoot, f));
          errors.push(`Duplicate module: ${name}\n  ${relFiles.join("\n  ")}`);
        }
      } else if (dirs.size > 1) {
        // Different directories - might be intentional, but warn
        const relFiles = files.map(f => relative(projectRoot, f));
        console.warn(`⚠ Same basename in different dirs: ${name}`);
        relFiles.forEach(f => console.warn(`  ${f}`));
      }
    }
  }

  if (hasErrors) {
    console.error("\n❌ Duplicate modules found (JS/TS pairs in same directory):");
    errors.forEach(e => console.error(e));
    console.error("\nFix: Keep TypeScript as source, remove .js or make .js re-export from .ts");
    process.exit(1);
  }

  console.log("✅ No duplicate JS/TS modules found");
}

checkDuplicateModules().catch(err => {
  console.error(err);
  process.exit(1);
});
