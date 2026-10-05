# Retype

Fix text that you typed in a wrong keyboard layout and switch to the correct layout.

## How to use

1. Select the text. If you select nothing, Retype selects from the cursor to the start of the line.
2. Run **Retype in Correct Layout** (assign a hotkey for best results).
3. Retype pastes the fixed text and switches your keyboard to the correct layout.

Example: `ghbdtn` typed in an English layout becomes `привет` (Russian layout).

## How it works

Retype reads the key maps of all keyboard layouts that you enabled in macOS. It finds the layout that the text was typed in, then maps each character to the same physical key in the target layout. Retype skips targets that give the same text, and it prefers the layouts that you used before.

You need at least 2 keyboard layouts.
