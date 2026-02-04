import { Clipboard, getSelectedText, showHUD } from "@raycast/api";
import {
  BE_KBD,
  detectLayout,
  EN_KBD,
  selectLine,
  transformText,
} from "./utils";
import { LayoutManager } from "./LayoutManager";

export default async function main() {
  let copiedText = "";

  try {
    try {
      copiedText = await getSelectedText();
    } catch (e: any) {
      try {
        await selectLine();
        copiedText = await getSelectedText();
      } catch (e) {
        console.error(e);
        await showHUD("Please select text");
        return;
      }
    }
    console.log("Copied:", JSON.stringify(copiedText));
    if (!copiedText) {
      await showHUD("Please select text");
      return;
    }
    copiedText = copiedText.replace(/\n$/, "");
    const res = transformText(copiedText, EN_KBD.input, BE_KBD.input);
    const targetLayout = detectLayout(res, EN_KBD, BE_KBD);
    console.log("Transformed:", JSON.stringify(res));
    await LayoutManager.setInput(targetLayout.name);
    await Clipboard.paste(res);
    await showHUD(`✅ ${targetLayout.name}`);
  } catch (e: any) {
    console.error(e);
    await showHUD(e.message);
  }
  // todo switch layouts
}
