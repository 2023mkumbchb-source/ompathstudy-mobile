import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const app = readFileSync(resolve(root, "App.tsx"), "utf8");
const navbar = readFileSync(resolve(root, "components/Navbar.tsx"), "utf8");
const account = readFileSync(resolve(root, "pages/Account.tsx"), "utf8");

const declaredRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);
const literalLinks = (source: string) => [...source.matchAll(/to:\s*"(\/[^"]+)"|to="(\/[^"]+)"/g)]
  .map((match) => match[1] || match[2]);

const matchesRoute = (link: string) => declaredRoutes.some((route) => {
  if (route === link) return true;
  const prefix = route.split("/:")[0];
  return route.includes(":") && link.startsWith(prefix);
});

describe("mobile navigation", () => {
  it("keeps every Navbar and Account link connected to a route", () => {
    const links = [...literalLinks(navbar), ...literalLinks(account)];
    expect(links.filter((link) => !matchesRoute(link))).toEqual([]);
  });

  it("includes all critical mobile and admin pages", () => {
    expect(declaredRoutes).toEqual(expect.arrayContaining([
      "/about", "/updates", "/notifications", "/account", "/admin",
      "/admin/editor", "/admin/categories", "/admin/notifications", "/admin/study-system", "/admin/contests",
    ]));
  });
});
