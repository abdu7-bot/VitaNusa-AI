#!/usr/bin/env python3
from pathlib import Path

path = Path("assets/js/mandiri/repositories/memory-repositories.js")
text = path.read_text(encoding="utf-8")

old_start = "  const cartRepository = Object.freeze({"
new_start = "  const cartRepository = {"

if old_start in text:
    text = text.replace(old_start, new_start, 1)
elif new_start not in text:
    raise SystemExit("Pola awal cartRepository tidak ditemukan")

marker = "\n  const inventoryRepository = {"
freeze_line = "\n  Object.freeze(cartRepository);\n"

if freeze_line not in text:
    if marker not in text:
        raise SystemExit("Pola inventoryRepository tidak ditemukan")
    text = text.replace(marker, freeze_line + marker, 1)

path.write_text(text, encoding="utf-8")
print("Perbaikan memory cartRepository diterapkan.")
