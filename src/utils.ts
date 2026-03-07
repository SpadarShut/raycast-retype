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

/**
 * Detect which layout the text was most likely typed in by counting
 * how many characters of the text appear in each layout's key map.
 */
export function detectSourceLayout(text: string, layouts: LayoutKeyMap[]): LayoutKeyMap | null {
  if (layouts.length === 0) return null;

  const scored = layouts.map((layout) => ({
    layout,
    score: text
      .split("")
      .filter((c) => c !== "\u0000" && layout.keyMap.includes(c)).length,
  }));

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
