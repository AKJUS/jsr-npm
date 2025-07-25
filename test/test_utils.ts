import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as module from "node:module";
import { isMainThread } from "node:worker_threads";
import { exec, writeJson } from "../src/utils.ts";

export interface DenoJson {
  name: string;
  version: string;
  exports: string | Record<string, string>;
  license: string;
}

/**
 * By default when node run ts file it's in ESM context so __dirname is not defined.
 * But we use it in source code and `tsc` transpiles to ESM/CJS
 * So we need to deifnefpr test context.
 */
if (isMainThread && "register" in module) {
  const __dirname = import.meta.dirname;
  globalThis.__dirname = __dirname;
}

/**
 * This sets the `packageManager` field in the `package.json` of the
 * specified directory to be the latest modern stable version of yarn.
 */
export async function enableYarnBerry(cwd: string) {
  await exec("yarn", ["set", "version", "berry"], cwd);
}

export async function runJsr(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
  captureOutput = false,
) {
  const bin = path.resolve("src", "bin.ts");

  return await exec(
    "node",
    [
      "--no-warnings",
      "--import",
      import.meta.resolve("./test_utils.ts"),
      "--experimental-strip-types",
      bin,
      ...args,
    ],
    cwd,
    {
      ...process.env,
      npm_config_user_agent: undefined,
      ...env,
    },
    captureOutput,
  );
}

export async function runInTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "jsr-cli"));

  await writeJson(path.join(dir, "package.json"), {
    name: "jsr-test-package",
    version: "0.0.1",
    license: "MIT",
  });
  try {
    await fn(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

export async function withTempEnv(
  args: string[],
  fn: (dir: string) => Promise<void>,
  options: { env?: Record<string, string> } = {},
): Promise<void> {
  await runInTempDir(async (dir) => {
    await runJsr(args, dir, options.env);
    await fn(dir);
  });
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(path)).isDirectory();
  } catch (err) {
    return false;
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(path)).isFile();
  } catch (err) {
    return false;
  }
}
