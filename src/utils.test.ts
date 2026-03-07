import { describe, expect, it, vi } from "vitest";

// Mock @raycast/utils so the import in utils.ts doesn't break in Node
vi.mock("@raycast/utils", () => ({ runAppleScript: vi.fn() }));

import { detectSourceLayout, getTargetOrder, transformText } from "./utils";
import type { LayoutKeyMap } from "./utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a 192-char keyMap: positions 0-95 = base layer, 96-191 = alt layer. */
function makeLayout(id: string, baseChars: string, altChars = ""): LayoutKeyMap {
  const base = baseChars.padEnd(96, "\u0000").slice(0, 96);
  const alt = altChars.padEnd(96, "\u0000").slice(0, 96);
  return { id, title: id, active: false, keyMap: base + alt };
}

// ---------------------------------------------------------------------------
// detectSourceLayout
// ---------------------------------------------------------------------------

describe("detectSourceLayout", () => {
  const EN = makeLayout("en", "qwertyuiop");

  // Simulates the real Belarusian/Russian overlap:
  //   - RU: Russian chars in base layer only
  //   - BE: Belarusian-unique chars in base; Russian chars in alt layer
  //
  // Flat scoring (no weights) would score BE higher than RU for Russian text,
  // because BE also has extra chars in alt that happen to match the text.
  //
  // Example: text = "АБ" + "extra chars only in BE alt"
  //   Flat:     RU=2 (base), BE=2(alt)+N(extra in alt) → BE wins (WRONG)
  //   Weighted: RU=2×4=8,    BE=(2+N)×1               → RU wins if N<6 (CORRECT)
  const RU = makeLayout("ru", "АБ"); // 'А','Б' in RU base only
  const BE = makeLayout(
    "be",
    "ЎІ", // Belarusian-unique chars in BE base
    "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклм", // Russian chars in BE alt (many!)
  );

  it("flat scoring would pick BE, weighted scoring correctly picks RU (key regression test)", () => {
    // Text: 'А','Б' (both in RU base and BE alt) → flat: RU=2, BE=2 → tie/wrong order possible
    // Adding chars ONLY in BE alt makes flat even worse: flat BE > RU, weighted RU > BE.
    // Here: text = "АБ" → flat RU=2, BE=2 → tie; but "АБВГ" → flat RU=2, BE=4 → flat picks BE
    const russianText = "АБВГ"; // 'А','Б' in RU base; 'В','Г' only in BE alt
    // flat: RU=2, BE=4 → flat INCORRECTLY picks BE
    // weighted: RU=2×4=8, BE=4×1=4 → weighted CORRECTLY picks RU
    expect(detectSourceLayout(russianText, [BE, RU])?.id).toBe("ru");
  });

  it("detects Belarusian when text has Belarusian-unique base chars", () => {
    // 'Ў','І' are only in BE base
    expect(detectSourceLayout("ЎІ", [RU, BE])?.id).toBe("be");
  });

  it("detects English for English text", () => {
    expect(detectSourceLayout("qwerty", [EN, RU, BE])?.id).toBe("en");
  });

  it("returns null for empty layout list", () => {
    expect(detectSourceLayout("hello", [])).toBeNull();
  });

  it("ignores null chars (\\u0000) in scoring", () => {
    const result = detectSourceLayout("\u0000\u0000", [EN]);
    expect(result).toBe(EN);
  });
});

// ---------------------------------------------------------------------------
// transformText
// ---------------------------------------------------------------------------

describe("transformText", () => {
  const from192 = "abcd".padEnd(192, "\u0000");
  const to192 = "ABCD".padEnd(192, "\u0000");

  // Alt-layer: 'e' at position 96, 'f' at position 97
  const fromWithAlt = "ab".padEnd(96, "\u0000") + "ef".padEnd(96, "\u0000");
  const toWithAlt = "AB".padEnd(96, "\u0000") + "EF".padEnd(96, "\u0000");

  it("maps base-layer chars correctly", () => {
    expect(transformText("ab", from192, to192)).toBe("AB");
  });

  it("passes through chars not found in fromMap", () => {
    expect(transformText("xyz", from192, to192)).toBe("xyz");
  });

  it("maps alt-layer chars (e.g. Polish special chars) correctly", () => {
    // 'e' is only in alt layer of fromWithAlt → should map to 'E' in toWithAlt
    expect(transformText("e", fromWithAlt, toWithAlt)).toBe("E");
  });

  it("passes \\u0000 placeholder chars through unchanged", () => {
    expect(transformText("\u0000", from192, to192)).toBe("\u0000");
  });

  it("handles mixed base and alt chars in one string", () => {
    expect(transformText("ae", fromWithAlt, toWithAlt)).toBe("AE");
  });
});

// ---------------------------------------------------------------------------
// getTargetOrder
// ---------------------------------------------------------------------------

describe("getTargetOrder", () => {
  const A = makeLayout("a", "a");
  const B = makeLayout("b", "b");
  const C = makeLayout("c", "c");

  it("excludes the source layout from candidates", () => {
    const result = getTargetOrder([A, B, C], "a", []);
    expect(result.map((l) => l.id)).not.toContain("a");
  });

  it("puts history-preferred layouts first", () => {
    const result = getTargetOrder([A, B, C], "a", ["c", "b"]);
    expect(result.map((l) => l.id)).toEqual(["c", "b"]);
  });

  it("appends non-history layouts after history ones", () => {
    const result = getTargetOrder([A, B, C], "a", ["b"]);
    // b first (history), then c (not in history)
    expect(result.map((l) => l.id)).toEqual(["b", "c"]);
  });

  it("returns all non-source layouts in system order when history is empty", () => {
    const result = getTargetOrder([A, B, C], "a", []);
    expect(result.map((l) => l.id)).toEqual(["b", "c"]);
  });
});
