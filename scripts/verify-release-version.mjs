import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tag = process.env.GITHUB_REF_NAME ?? process.argv[2];

if (typeof tag !== "string" || !/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag)) {
  throw new Error(`Expected a vMAJOR.MINOR.PATCH tag, received ${JSON.stringify(tag)}`);
}

const expected = tag.slice(1);
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const tauriConfig = JSON.parse(
  await readFile(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
);
const cargoToml = await readFile(join(root, "src-tauri", "Cargo.toml"), "utf8");
const cargoLock = await readFile(join(root, "src-tauri", "Cargo.lock"), "utf8");

const cargoVersion = /^version = "([^"]+)"$/m.exec(cargoToml)?.[1];
const cargoLockVersion = /\[\[package\]\]\r?\nname = "bilimaku"\r?\nversion = "([^"]+)"/m.exec(cargoLock)?.[1];
const versions = {
  "package.json": packageJson.version,
  "package-lock.json": packageLock.version,
  "package-lock.json root package": packageLock.packages?.[""]?.version,
  "src-tauri/tauri.conf.json": tauriConfig.version,
  "src-tauri/Cargo.toml": cargoVersion,
  "src-tauri/Cargo.lock": cargoLockVersion,
};

for (const [source, version] of Object.entries(versions)) {
  if (version !== expected) {
    throw new Error(`${source} version ${JSON.stringify(version)} does not match ${tag}`);
  }
}

console.log(`[release] ${tag} matches every application version source.`);
