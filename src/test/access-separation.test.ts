import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

describe("public, learner and administrator access separation", () => {
  const app = read("src/App.tsx");
  const bottom = read("src/components/MobileBottomNav.tsx");
  const navbar = read("src/components/Navbar.tsx");

  it("protects personal and administrator routes centrally", () => {
    expect(app).toContain('path="/notifications" element={<SignedInRoute>');
    expect(app).toContain('path="/account" element={<SignedInRoute>');
    expect(app).toContain('path="/admin" element={<AdminRoute>');
    expect(app).toContain('path="/source-library" element={<AdminRoute>');
  });

  it("keeps alerts in the signed-in header and out of bottom navigation", () => {
    expect(bottom).not.toContain('label: "Alerts"');
    expect(navbar).toContain("{user && <NotificationBell />}");
  });
});
