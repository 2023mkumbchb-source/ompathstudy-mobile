import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("registration-only learner profile dialog", () => {
  const gate = fs.readFileSync(path.resolve("src/components/LearnerProfileGate.tsx"), "utf8");
  const login = fs.readFileSync(path.resolve("src/pages/Login.tsx"), "utf8");

  it("opens only from registration and remains closed when offline", () => {
    expect(login).toContain("markRegistrationProfilePending()");
    expect(gate).toContain("!navigator.onLine || !isRegistrationProfilePending()");
    expect(gate).toContain("if (error) { setOpen(false); return; }");
    expect(gate).toContain("clearRegistrationProfilePending()");
  });
});
