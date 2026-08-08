import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const frontendOutput = path.join(repositoryRoot, "dist");
const tauriConfigPath = path.join(repositoryRoot, "src-tauri", "tauri.conf.json");
const rustSourceRoot = path.join(repositoryRoot, "src-tauri", "src");
const modelExtension = /\.(?:pth|pt|ckpt|safetensors|onnx|npy|npz)$/i;
const maximumFrontendFileBytes = 32 * 1024 * 1024;

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function fail(message) {
  throw new Error(`[BiliMaku build guard] ${message}`);
}

const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
const bundledResources = tauriConfig.bundle?.resources;
if (!Array.isArray(bundledResources) || bundledResources.length !== 0) {
  fail("bundle.resources 必须显式保持为空数组；本地 TTS 模型只允许运行时按路径加载。");
}

const frontendFiles = await collectFiles(frontendOutput);
let frontendBytes = 0;
for (const filePath of frontendFiles) {
  const relativePath = path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
  const file = await stat(filePath);
  frontendBytes += file.size;
  if (modelExtension.test(filePath) || relativePath.includes("resources/tss/")) {
    fail(`前端产物中发现模型文件：${relativePath}`);
  }
  if (file.size > maximumFrontendFileBytes) {
    fail(`前端单文件超过 32 MiB，请确认未误带模型：${relativePath}`);
  }
}

for (const rustFile of await collectFiles(rustSourceRoot)) {
  if (path.extname(rustFile) !== ".rs") continue;
  const source = await readFile(rustFile, "utf8");
  if (/include_(?:bytes|str)!\([^)]*(?:resources[\\/]+tss|hoyoTTS)/i.test(source)) {
    fail(`Rust 源码直接嵌入了本地模型目录：${path.relative(repositoryRoot, rustFile)}`);
  }
}

console.log(
  `[BiliMaku build guard] passed: ${frontendFiles.length} frontend files, ` +
    `${(frontendBytes / 1024).toFixed(1)} KiB, 0 bundled TTS resources.`,
);