import { Clipboard, getSelectedText, showHUD } from "@raycast/api";
import { getLayoutKeyMaps } from "swift:../swift";
import { detectSourceLayout, getTargetOrder, selectLine, transformText } from "./utils";
import { HistoryManager, SessionManager } from "./SessionManager";
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
  let allLayoutMaps;
  try {
    allLayoutMaps = await getLayoutKeyMaps();
  } catch (e: any) {
    await showHUD(`Error loading layouts: ${e.message}`);
    return;
  }

  // Only layouts where we successfully read key data can be transformed
  const transformable = allLayoutMaps.filter((l) => l.keyMap && l.keyMap.length > 0);
  if (transformable.length < 2) {
    await showHUD("Need at least 2 keyboard layouts with key data");
    return;
  }

  // 3. Load session + history in parallel, then decide if this is a repeat
  const [session, history] = await Promise.all([SessionManager.load(), HistoryManager.load()]);

  const isRepeat = SessionManager.isRepeat(session);

  let originalText: string;
  let sourceLayoutId: string;
  let triedTargetIds: string[];

  if (isRepeat && session) {
    // Re-use the original text from the previous run; ignore currently selected text
    originalText = session.originalText;
    sourceLayoutId = session.sourceLayoutId;
    triedTargetIds = session.triedTargetIds;
  } else {
    // Fresh run: detect source layout from selected text
    originalText = selectedText;
    const sourceLayout = detectSourceLayout(originalText, transformable);
    if (!sourceLayout) {
      await showHUD("Could not detect source layout");
      return;
    }
    sourceLayoutId = sourceLayout.id;
    triedTargetIds = [];
  }

  // 4. Build the ordered list of target candidates
  //    History-preferred first (skipping source layout), then remaining in system order.
  //    If the last history entry matches the source layout, it's automatically skipped by getTargetOrder.
  const targetOrder = getTargetOrder(transformable, sourceLayoutId, history.targetOrder);

  // 5. Pick the next untried target
  const nextTarget = targetOrder.find((t) => !triedTargetIds.includes(t.id));
  if (!nextTarget) {
    await showHUD("All layouts tried — no more candidates");
    return;
  }

  const sourceLayout = transformable.find((l) => l.id === sourceLayoutId);
  if (!sourceLayout) {
    await showHUD("Source layout disappeared — try again");
    return;
  }

  // 6. Transform
  const transformed = transformText(originalText, sourceLayout.keyMap, nextTarget.keyMap);
  console.log("Source:", sourceLayout.title, "→ Target:", nextTarget.title);
  console.log("Original:", JSON.stringify(originalText));
  console.log("Transformed:", JSON.stringify(transformed));

  // 7. Paste and switch keyboard layout
  try {
    await Clipboard.paste(transformed);
    await LayoutManager.setInput(nextTarget.title);
    await showHUD(`✅ ${nextTarget.title}`);
  } catch (e: any) {
    await showHUD(e.message);
    return;
  }

  // 8. Persist state for potential repeat
  await Promise.all([
    SessionManager.save({
      timestamp: Date.now(),
      originalText,
      sourceLayoutId,
      triedTargetIds: [...triedTargetIds, nextTarget.id],
    }),
    HistoryManager.recordSuccess(nextTarget.id),
  ]);
}
