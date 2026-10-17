import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const useDevServer = process.argv.includes("--dev");
const envFile = path.join(root, ".env");
if (!existsSync(envFile)) {
  copyFileSync(path.join(root, ".env.example"), envFile);
  console.log("Created .env from .env.example.");
}

const npmExecPath = process.env.npm_execpath;
const npm = npmExecPath
  ? process.execPath
  : process.platform === "win32" ? "npm.cmd" : "npm";
for (const script of ["db:up", "db:push", "db:seed"]) {
  console.log(`\n> npm run ${script}`);
  const args = npmExecPath ? [npmExecPath, "run", script] : ["run", script];
  const result = spawnSync(npm, args, {
    cwd: root,
    stdio: "inherit",
    shell: !npmExecPath && process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!useDevServer) {
  console.log("\n> npm run build");
  const args = npmExecPath ? [npmExecPath, "run", "build"] : ["run", "build"];
  const result = spawnSync(npm, args, {
    cwd: root,
    stdio: "inherit",
    shell: !npmExecPath && process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const next = spawn(process.execPath, [
  require.resolve("next/dist/bin/next"),
  useDevServer ? "dev" : "start",
  "--hostname",
  "127.0.0.1",
], { cwd: root, stdio: "inherit" });
const worker = spawn(process.execPath, [
  require.resolve("tsx/cli"),
  "src/workers/start.ts",
], { cwd: root, stdio: "inherit" });
let stopping = false;

function stop(exitCode: number) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  if (next.exitCode === null) next.kill();
  if (worker.exitCode === null) worker.kill();
}

next.on("error", (error) => {
  console.error("Could not start Next.js:", error);
  stop(1);
});
worker.on("error", (error) => {
  console.error("Could not start reminder worker:", error);
  stop(1);
});
next.on("exit", (code) => stop(code ?? 1));
worker.on("exit", (code) => stop(code ?? 1));
process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

console.log("\nPayPing demo starting at http://127.0.0.1:3000");
console.log("Press Ctrl+C to stop the web app and worker.");
