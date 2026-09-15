import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Aponeurosis packaged offline coverage", () => {
  it("maps the large majority of the bank to APK-local image files", () => {
    const seed = JSON.parse(readFileSync(resolve("public/offline-seed.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(resolve("public/offline-image-manifest.json"), "utf8")).images;
    const articles = seed.articles.filter((item: { title?: string; category?: string }) => /aponeurosis/i.test(`${item.title} ${item.category}`));
    const urls = new Set<string>();
    for (const article of articles) {
      for (const match of String(article.content || "").matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) urls.add(match[1]);
    }
    const packaged = [...urls].filter((url) => manifest[url]);
    expect(urls.size).toBe(381);
    expect(packaged.length).toBeGreaterThanOrEqual(300);
    for (const url of packaged) expect(readFileSync(resolve(`public${manifest[url]}`)).byteLength).toBeGreaterThan(0);
  });
});
