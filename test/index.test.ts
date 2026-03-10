import { describe, expect, it } from "vitest";
import { hello } from "../src/index.js";

describe("hello", () => {
  it("返回问候语", () => {
    expect(hello("Codex")).toBe("Hello, Codex!");
  });
});
