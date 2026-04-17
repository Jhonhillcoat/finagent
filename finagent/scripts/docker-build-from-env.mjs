/**
 * Lee NEXT_PUBLIC_* desde .env.local y ejecuta docker build con --build-arg.
 * Uso: node scripts/docker-build-from-env.mjs -t gcr.io/PROJECT_ID/finagent:latest
 */
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";

const envPath = ".env.local";
if (!existsSync(envPath)) {
  console.error("Falta .env.local");
  process.exit(1);
}

const publicVars = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  if (!key.startsWith("NEXT_PUBLIC_")) continue;
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  publicVars[key] = val;
}

const requiredFirebase = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

for (const k of requiredFirebase) {
  if (!publicVars[k]) {
    console.error(`Falta ${k} en .env.local (necesario para el build de Docker).`);
    process.exit(1);
  }
}

for (const k of ["NEXT_PUBLIC_GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_API_KEY"]) {
  if (publicVars[k] === undefined) publicVars[k] = "";
}

let tag = "finagent:local";
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "-t" || argv[i] === "--tag") {
    tag = argv[i + 1];
    i++;
  }
}

const dockerArgs = ["build", "-f", "Dockerfile", "-t", tag, "."];
for (const [k, v] of Object.entries(publicVars)) {
  dockerArgs.push("--build-arg", `${k}=${v}`);
}

const r = spawnSync("docker", dockerArgs, { stdio: "inherit" });
process.exit(r.status ?? 1);
