import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const seed = JSON.parse(fs.readFileSync(path.join(root, "public/offline-seed.json"), "utf8"));
const imageRoot = path.join(root, "public/images");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
);
const files = walk(imageRoot);
const publicPath = (file) => `/${path.relative(path.join(root, "public"), file).replaceAll(path.sep, "/")}`;
const variants = (file) => {
  const base = path.relative(imageRoot, file).toLowerCase().replaceAll(path.sep, "/")
    .replace(/^year([1-6])\//, "y$1/").replace(/\.[^.]+$/, "").replaceAll("/", "-")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Set([
    base,
    base.replace("aponeurosis-01-cropped-", "cropped-"),
    base.replace("aponeurosis-01-", ""),
    base.replace("anatomy-marathon-1", "marathon1"),
  ]);
};
const indexed = files.map((file) => ({ file, variants: variants(file) }));
const urls = new Set();
for (const item of [...(seed.articles || []), ...(seed.stories || [])]) {
  const text = String(item.content || item.body || "");
  for (const match of text.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|<img[^>]+src=["'](https?:\/\/[^"']+)/gi)) urls.add(match[1] || match[2]);
}
const manifest = {};
for (const url of urls) {
  const stem = path.basename(new URL(url).pathname).replace(/-[0-9a-f]{8}(?=\.[^.]+$)/i, "").replace(/\.[^.]+$/, "").toLowerCase();
  const match = indexed.find((entry) => [...entry.variants].some((value) => stem === value || stem.endsWith(value) || value.endsWith(stem)));
  if (match) manifest[url] = publicPath(match.file);
}
fs.writeFileSync(path.join(root, "public/offline-image-manifest.json"), JSON.stringify({ generated_at: new Date().toISOString(), images: manifest }));
console.log(`Offline image manifest: ${Object.keys(manifest).length}/${urls.size} remote images mapped to packaged files.`);
