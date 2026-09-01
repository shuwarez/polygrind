"""Mechanically embed the approved compact boss assets into the one-file game."""

from __future__ import annotations

import base64
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HTML = ROOT / "GrimGrind.html"
BASE = ROOT / "boss20_assets" / "webp"
ATTACK = ROOT / "boss20_assets" / "generated_attack" / "webp"
EFFECT = ROOT / "boss20_assets" / "generated_effects" / "webp"
START = "/* BOSS20_ASSETS_START */"
END = "/* BOSS20_ASSETS_END */"
ANCHOR = "const MINION_SPRITE_DATA = {"


def uri(path: Path) -> str:
    return "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


base_lines = [f"  {path.stem}:'{uri(path)}'," for path in sorted(BASE.glob("*.webp"))]
attack_lines = [f"  {path.stem}:'{uri(path)}'," for path in sorted(ATTACK.glob("*.webp"))]
effect_lines = [f"  {path.stem}:'{uri(path)}'," for path in sorted(EFFECT.glob("*.webp"))]
if len(base_lines) != 20 or len(attack_lines) != 20 or len(effect_lines) != 25:
    raise SystemExit(
        "expected 20 base, 20 attack and 25 effect sheets, "
        f"found {len(base_lines)}, {len(attack_lines)} and {len(effect_lines)}"
    )

block = "\n".join(
    [
        START,
        "Object.assign(BOSS_SPRITE_DATA, {",
        *base_lines,
        "});",
        "const BOSS_ATTACK_SPRITE_DATA = {",
        *attack_lines,
        "};",
        "const BOSS_ATTACK_SPRITES = {};",
        "const BOSS20_EFFECT_SPRITE_DATA = {",
        *effect_lines,
        "};",
        "const BOSS20_EFFECT_SPRITES = {};",
        END,
        "",
    ]
)

text = HTML.read_text(encoding="utf-8")
if START in text:
    before, rest = text.split(START, 1)
    _, after = rest.split(END, 1)
    text = before + block + after.lstrip("\r\n")
else:
    if ANCHOR not in text:
        raise SystemExit("asset insertion anchor not found")
    text = text.replace(ANCHOR, block + ANCHOR, 1)
HTML.write_text(text, encoding="utf-8", newline="\n")
print(
    "embedded", len(base_lines), "base,", len(attack_lines), "attack and",
    len(effect_lines), "effect sheets; bytes", HTML.stat().st_size
)
