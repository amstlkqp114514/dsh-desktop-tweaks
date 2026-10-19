#!/usr/bin/env node
/**
 * 生成插件市场索引（format 1）。
 *
 * 用法：
 *   node scripts/make-index.mjs                 # npm 源，版本取 package.json
 *   node scripts/make-index.mjs --source git    # git 源，commit 取当前 HEAD
 *   node scripts/make-index.mjs --timestamp 1760000000
 *   node scripts/make-index.mjs --out site      # 输出目录（默认 site）
 *
 * 索引规则见 https://deepseek-harness.github.io/deepseek-harness/guide/plugin-market
 */
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const sourceType = arg("--source", "npm");
const timestamp = Number(arg("--timestamp", Math.floor(Date.now() / 1000)));
const outDir = resolve(root, arg("--out", "site"));

if (!Number.isInteger(timestamp) || timestamp < 0) {
  throw new Error("--timestamp must be a Unix timestamp in seconds");
}
if (sourceType !== "npm" && sourceType !== "git") {
  throw new Error("--source must be npm or git");
}

const repositoryUrl = (pkg.repository?.url ?? "")
  .replace(/^git\+/, "")
  .replace(/\.git$/, "");

let commit = arg("--commit", null);
if (sourceType === "git" && !commit) {
  commit = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
}
if (commit !== null && !/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error("--commit must be a full 40-character hex commit hash");
}

const source = sourceType === "git"
  ? { type: "git", url: repositoryUrl, commit }
  : { type: "npm" };

const engines = pkg.engines?.dsh;

const index = {
  format: 1,
  title: { en: "DSH Desktop Tweaks", zh: "DSH 桌面增强" },
  description: {
    en: "DeepSeek Harness desktop tweaks: F11 fullscreen toggle, and Ctrl+C / Ctrl+V copy and paste in the terminal.",
    zh: "DeepSeek Harness 桌面端修改：F11 全屏切换，终端内使用 Ctrl+C/V 复制粘贴。",
  },
  plugins: [
    {
      name: pkg.name,
      title: { en: "Desktop Tweaks", zh: "桌面增强" },
      description: {
        en: "F11 fullscreen toggle, and Ctrl+C / Ctrl+V copy and paste in the terminal.",
        zh: "F11 全屏切换，终端内使用 Ctrl+C/V 复制粘贴。",
      },
      icon: "icons/icon.svg",
      author: pkg.author,
      homepage: pkg.homepage,
      ...(repositoryUrl ? { repository: { url: repositoryUrl } } : {}),
      versions: [
        {
          version: pkg.version,
          publishTimestamp: timestamp,
          source,
          ...(engines ? { engines: { dsh: engines } } : {}),
        },
      ],
    },
  ],
};

mkdirSync(join(outDir, "icons"), { recursive: true });
copyFileSync(join(root, "icon.svg"), join(outDir, "icons", "icon.svg"));
writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");

console.log(`wrote ${join(outDir, "index.json")} (${sourceType}, ${pkg.name}@${pkg.version})`);
