import { runAppleScript } from "@raycast/utils";

export const selectLine = () =>
  runAppleScript(`
  tell application "System Events"
    tell process (name of first application process whose frontmost is true)
      key code 123 using {command down, shift down}
      delay 0.1
    end tell
  end tell
`);

export interface LayoutKeyMap {
  id: string;
  title: string;
  active: boolean;
  keyMap: string;
}

// Positions 0-95 in keyMap = base layer (unshifted + shift).
// Positions 96-191 = alt layer (option + option+shift).
// Base-layer matches score 4× higher so a layout where the text lives on normal keys
// wins decisively over one where the same chars are only reachable via Option.
const BASE_LAYER_END = 96;
const WEIGHT_BASE = 4;
const WEIGHT_ALT = 1;

/**
 * Detect which layout the text was most likely typed in.
 * Uses weighted scoring: base-layer matches count 4×, alt-layer matches 1×.
 * This prevents a layout whose Option layer contains the target chars from
 * outscoring the layout where those chars live on the normal keys.
 */
export function detectSourceLayout(text: string, layouts: LayoutKeyMap[]): LayoutKeyMap | null {
  if (layouts.length === 0) return null;

  const scored = layouts.map((layout) => {
    let score = 0;
    for (const char of text) {
      if (char === "\u0000") continue;
      const index = layout.keyMap.indexOf(char);
      if (index === -1) continue;
      score += index < BASE_LAYER_END ? WEIGHT_BASE : WEIGHT_ALT;
    }
    return { layout, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].layout;
}

/**
 * Transform text from one layout's key map to another.
 * For each character: find its position in fromMap (= physical key index),
 * then return the character at that position in toMap.
 * Null characters (\u0000) and unrecognized characters pass through unchanged.
 */
export function transformText(text: string, fromMap: string, toMap: string): string {
  return text
    .split("")
    .map((char) => {
      const index = fromMap.indexOf(char);
      if (index !== -1 && index < toMap.length) {
        const mapped = toMap[index];
        return mapped === "\u0000" ? char : mapped;
      }
      return char;
    })
    .join("");
}

export interface PickResult {
  target: LayoutKeyMap;
  transformed: string;
  triedTargetIds: string[];
}

/**
 * Pick the next target layout that produces different text.
 * Skips targets whose transformation is identical to the original.
 * Wraps around when all targets have been tried (infinite cycling).
 * Falls back to the last candidate if every target produces same text.
 */
export function pickNextTarget(
  originalText: string,
  sourceKeyMap: string,
  targetOrder: LayoutKeyMap[],
  triedTargetIds: string[],
): PickResult {
  let tried = [...triedTargetIds];
  let untried = targetOrder.filter((t) => !tried.includes(t.id));
  if (untried.length === 0) {
    tried = [];
    untried = targetOrder;
  }

  let target = untried[untried.length - 1];
  let transformed = originalText;
  for (const candidate of untried) {
    const result = transformText(originalText, sourceKeyMap, candidate.keyMap);
    tried.push(candidate.id);
    if (result !== originalText) {
      target = candidate;
      transformed = result;
      break;
    }
  }

  return { target, transformed, triedTargetIds: tried };
}

/**
 * Return candidate target layouts ordered by preference:
 * history-preferred layouts first (excluding source), then remaining in system order.
 */
export function getTargetOrder(
  layouts: LayoutKeyMap[],
  sourceId: string,
  historyOrder: string[],
): LayoutKeyMap[] {
  const candidates = layouts.filter((l) => l.id !== sourceId);

  const inHistory: LayoutKeyMap[] = [];
  for (const id of historyOrder) {
    const layout = candidates.find((c) => c.id === id);
    if (layout) inHistory.push(layout);
  }

  const notInHistory = candidates.filter((c) => !historyOrder.includes(c.id));
  return [...inHistory, ...notInHistory];
}
