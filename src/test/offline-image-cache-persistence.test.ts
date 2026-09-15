import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("offline image cache persistence", () => {
  const worker = fs.readFileSync(path.resolve("public/sw.js"), "utf8");
  const startup = fs.readFileSync(path.resolve("src/main.tsx"), "utf8");

  it("preserves downloaded medical images during worker activation", () => {
    expect(worker).toContain('const OFFLINE_IMAGE_CACHE = "ompath-offline-images-v1"');
    expect(worker).toContain("PRESERVED_CACHES.has(k)");
  });

  it("preserves downloaded medical images during stale-bundle recovery", () => {
    expect(startup).toContain('key !== "ompath-offline-images-v1"');
  });
});
