import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(root, "../KunWuGodot");
const sourceDir = path.join(sourceRoot, "Docs/1.0策划案/地图");
const destination = path.join(root, "Docs/地图策划");
const files = (await readdir(sourceDir)).filter(name => /^(27|28|29|30|31|32)_.*\.md$/.test(name)).sort();
if (files.length !== 6) throw new Error("应找到27–32分册共6份新版地图文档");
const sha = value => createHash("sha256").update(value).digest("hex");
const records = [];
let changed = 0;
async function writeChanged(file, content) {
  const previous = await readFile(file, "utf8").catch(error => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (previous !== content) { await writeFile(file, content); changed++; }
}
// Validate and prepare all inputs before replacing generated documents.
const prepared = [];
for (const name of files) {
  const source = path.join(sourceDir, name);
  const text = await readFile(source, "utf8");
  const links = [...text.matchAll(/\]\(([^)]+)\)/g)];
  for (const [, target] of links) {
    if (/^(?:[a-z]+:|#|\/)/i.test(target)) continue;
    await access(path.resolve(sourceDir, target.split("#")[0]));
  }
  const rewritten = text.replace(/\]\(([^)]+)\)/g, (match, target) => {
    if (/^(?:[a-z]+:|#|\/)/i.test(target)) return match;
    const [relative, anchor] = target.split("#");
    const full = path.resolve(sourceDir, relative);
    const local = path.dirname(full) === sourceDir && files.includes(path.basename(full));
    const resolved = local ? path.basename(full) : full;
    return `](<${resolved}${anchor ? `#${anchor}` : ""}>)`;
  });
  const content = `> 自动同步自 KunWuGodot；正文保留来源版本，链接已适配本项目。修改源文档后运行 \`node tools/sync-map-docs.mjs\`。\n> 当前工程差异和用户覆盖规则见 [同步说明](../16_地图文档同步说明.md)，本文不作为已发布运行配置。\n\n${rewritten}`;
  prepared.push({ name, content });
  records.push({ file: name, source: path.relative(sourceRoot, source), sourceSha256: sha(text), snapshotSha256: sha(content), version: text.match(/^版本：(.+)$/m)?.[1]?.trim() ?? null });
}
await mkdir(destination, { recursive: true });
for (const file of prepared) await writeChanged(path.join(destination, file.name), file.content);
await writeChanged(path.join(destination, "sources.json"), `${JSON.stringify({ sourceProject: "KunWuGodot", policy: "用户最新确认 > 1.0策划 > PRD；运行路径以当前工程为准", records }, null, 2)}\n`);
console.log(JSON.stringify({ documents: records.length, changed, destination: path.relative(root, destination) }));
