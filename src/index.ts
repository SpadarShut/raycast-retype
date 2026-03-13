import { Clipboard, getSelectedText, showHUD } from "@raycast/api";
import { getLayoutKeyMaps } from "swift:../swift";
import {
  detectSourceLayout,
  getTargetOrder,
  pickNextTarget,
  selectLine,
} from "./utils";
import { HistoryManager } from "./SessionManager";
import { LayoutManager } from "./LayoutManager";

export default async function main() {
  // 1. Get selected text (fall back to selecting the whole line)
  let selectedText = "";
  try {
    selectedText = await getSelectedText();
  } catch {
    try {
      await selectLine();
      selectedText = await getSelectedText();
    } catch {
      await showHUD("Please select text");
      return;
    }
  }

  if (!selectedText) {
    await showHUD("Please select text");
    return;
  }
  selectedText = selectedText.replace(/\n$/, "");

  // 2. Load layout key maps from the system (via Swift / UCKeyTranslate)
  let layouts;
  try {
    layouts = (await getLayoutKeyMaps()).filter(
      (l) => l.keyMap && l.keyMap.length > 0,
    );
  } catch (e: any) {
    await showHUD(`Error loading layouts: ${e.message}`);
    return;
  }

  if (layouts.length < 2) {
    await showHUD("Need at least 2 keyboard layouts with key data");
    return;
  }

  // 3. Detect source layout (prefer active layout, then history as tiebreakers)
  const activeId = layouts.find((l) => l.active)?.id;
  const history = await HistoryManager.load();
  const sourceLayout = detectSourceLayout({
    text: selectedText,
    layouts: layouts,
    activeId,
    historyOrder: history.targetOrder,
  });
  if (!sourceLayout) {
    await showHUD("Could not detect source layout");
    return;
  }

  // 4. Pick target and transform (prefer the currently active layout first)
  const targetOrder = getTargetOrder({
    layouts: layouts,
    sourceId: sourceLayout.id,
    historyOrder: history.targetOrder,
    activeId,
  });

  const pick = pickNextTarget(
    selectedText,
    sourceLayout.keyMap,
    targetOrder,
    [],
  );

  console.log("Source:", sourceLayout.title, "→ Target:", pick.target.title);
  console.log("Original:", JSON.stringify(selectedText));
  console.log("Transformed:", JSON.stringify(pick.transformed));

  // 5. Paste and switch keyboard layout
  try {
    await Clipboard.paste(pick.transformed);
    await LayoutManager.setInput(pick.target.title);
    await showHUD(`✅ ${pick.target.title}`);
  } catch (e: any) {
    await showHUD(e.message);
    return;
  }

  await HistoryManager.recordSuccess(pick.target.id);
}
