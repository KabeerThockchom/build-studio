import { describe, it, expect } from "vitest";
import { GALLERY } from "./gallery";

describe("idea gallery", () => {
  const apps = GALLERY.flatMap((v) => v.columns.flatMap((c) => c.apps));
  it("keeps the workshop's ideas, each with a unique id and a starter to edit", () => {
    expect(apps.length).toBe(27);
    expect(new Set(apps.map((a) => a.id)).size).toBe(apps.length);
    expect(apps.every((a) => a.starter.split(" ").length > 12)).toBe(true);
  });
  it("never suggests pieces the build no longer uses", () => {
    const text = JSON.stringify(GALLERY).toLowerCase();
    expect(text).not.toMatch(/supervisor agent|knowledge assistant|ai\/bi dashboard/);
  });
});
