import { getSelectedText, showHUD, Clipboard } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";

const EN = `qwertyuiop[]asdfghjkl;'\\\`zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:"|~ZXCVBNM<>?§1234567890-=±!@#$%^&*()_+`;
const BE = `йцукенгшўзх'фывапролджэё"ячсмітьбю/ЙЦУКЕНГШЎЗХЪФЫВАПРОЛДЖЭЁ~ЯЧСМІТЬБЮ?§1234567890-=±!"№%:,.;()_+`;

const EN_KBD = {
  name: "English",
  input: EN,
};
const BE_KBD = {
  name: "Belarusian+",
  input: BE,
};

const selectLine = () =>
  runAppleScript(`
  tell application "System Events"
    tell process (name of first application process whose frontmost is true)
      key code 123 using {command down, shift down}
      delay 0.1
    end tell
  end tell
`);

export default async function main() {
  let copiedText = "";

  try {
    try {
      copiedText = await getSelectedText();
    } catch (e: any) {
      try {
        await selectLine();
        copiedText = await getSelectedText();
        console.log("selected line");
        await showHUD("selected line");
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
    const res = transformText(copiedText, EN_KBD.input, BE_KBD.input);
    console.log("Transformed:", JSON.stringify(res));
    await Clipboard.paste(res);
    await showHUD(`${copiedText} -> ${res}`);
  } catch (e: any) {
    console.error(e);
    await showHUD(e.message);
  }
  // todo switch layouts?
}

const transformText = (text: string, from: string, to: string) => {
  let newMessage = "";
  const messageArr = text.split("");
  for (const i in messageArr) {
    const char = messageArr[i];
    let index = from.indexOf(char);
    if (index !== -1) {
      newMessage += to.charAt(index);
    } else {
      index = to.indexOf(char);
      if (index !== -1) {
        newMessage += from.charAt(index);
      } else {
        newMessage += char;
      }
    }
  }
  return newMessage;
};
