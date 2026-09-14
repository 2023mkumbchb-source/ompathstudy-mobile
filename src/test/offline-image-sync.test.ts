import { describe, expect, it } from "vitest";
import { extractArticleImageUrls, extractImageUrls } from "@/lib/offlineImageStore";

describe("complete offline image discovery", () => {
  it("finds markdown and HTML images", () => {
    expect(extractImageUrls('![slide](https://cdn.test/slide.png) <img src="https://cdn.test/photo.jpg">'))
      .toEqual(["https://cdn.test/slide.png", "https://cdn.test/photo.jpg"]);
  });

  it("includes article and story cover images without duplicates", () => {
    expect(extractArticleImageUrls({
      cover_image_url: "https://cdn.test/cover.webp",
      og_image_url: "https://cdn.test/cover.webp",
      content: "![figure](https://cdn.test/figure.png)",
    })).toEqual(["https://cdn.test/cover.webp", "https://cdn.test/figure.png"]);
  });
});
