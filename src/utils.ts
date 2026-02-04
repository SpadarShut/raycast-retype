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

const EN = `qwertyuiop[]asdfghjkl;'\\\`zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:"|~ZXCVBNM<>?§1234567890-=±!@#$%^&*()_+`;
const BE = `йцукенгшўзх'фывапролджэё"ячсмітьбю/ЙЦУКЕНГШЎЗХЪФЫВАПРОЛДЖЭЁ~ЯЧСМІТЬБЮ?§1234567890-=±!"№%:,.;()_+`;

type Keyboard = { name: string; input: string };

export const EN_KBD: Keyboard = {
  name: "ABC",
  input: EN,
};

export const BE_KBD: Keyboard = {
  name: "Belarusian+",
  input: BE,
};

export function detectLayout(
  input: string,
  kbdA: Keyboard,
  kbdB: Keyboard,
): Keyboard {
  const array = input.split("");
  const aChars = array.filter((char) => kbdA.input.includes(char)).length;
  const bChars = array.filter((char) => kbdB.input.includes(char)).length;

  let targetLayout: Keyboard;
  if (aChars > bChars) {
    targetLayout = kbdA;
  } else {
    targetLayout = kbdB;
  }
  return targetLayout;
}

export const transformText = (text: string, from: string, to: string) => {
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
