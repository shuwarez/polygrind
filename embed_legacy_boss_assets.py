"""Embed the upgraded legacy boss art into the single-file PolyGrind build."""

from __future__ import annotations

import base64
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HTML_PATH = ROOT / "PolyGrind.html"
ASSETS = ROOT / "legacy_boss_assets" / "webp"

BOSSES = (
    "lich", "goat", "plague", "greed", "executioner", "tyrant", "grave",
    "behemoth", "vampire", "voidwrath", "minotaur", "seraph", "matriarch",
    "demonqueen",
)

EFFECTS = (
    "goat_slam", "behemoth_impact", "minotaur_crash", "tyrant_slash",
    "vampire_cross", "summon_sigil",
)


def uri(path: Path) -> str:
    return "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def replace_property(text: str, key: str, value: str) -> str:
    pattern = rf"(?m)^(\s{{2}}{re.escape(key)}\s*:\s*)'data:image/[^']+'(,?)$"
    text, count = re.subn(pattern, lambda match: f"{match.group(1)}'{value}'{match.group(2)}", text, count=1)
    if count != 1:
        raise RuntimeError(f"Expected one embedded property for {key}, got {count}")
    return text


def main() -> None:
    text = HTML_PATH.read_text(encoding="utf-8")
    # Never replace the build's original standing boss sheets here.  The legacy
    # base export is only an intermediate derivative; attack art is normalized
    # against frame 0 extracted from the actual embedded build instead.

    legacy_attack_lines = "\n".join(
        f"  {key}_attack:'{uri(ASSETS / 'attack' / f'{key}_attack.webp')}',"
        for key in BOSSES
    )
    attack_anchor = "const BOSS_ATTACK_SPRITE_DATA = {\n"
    start_marker = "  /* LEGACY_BOSS_ATTACK_ASSETS_START */\n"
    end_marker = "  /* LEGACY_BOSS_ATTACK_ASSETS_END */\n"
    if start_marker in text:
        text = re.sub(
            re.escape(start_marker) + r"[\s\S]*?" + re.escape(end_marker),
            start_marker + legacy_attack_lines + "\n" + end_marker,
            text,
            count=1,
        )
    else:
        if attack_anchor not in text:
            raise RuntimeError("BOSS_ATTACK_SPRITE_DATA anchor not found")
        text = text.replace(
            attack_anchor,
            attack_anchor + start_marker + legacy_attack_lines + "\n" + end_marker,
            1,
        )

    effect_lines = "\n".join(
        f"  {key}:'{uri(ASSETS / 'effects' / f'{key}.webp')}',"
        for key in EFFECTS
    )
    effect_block = (
        "/* LEGACY_BOSS_EFFECT_ASSETS_START */\n"
        "const LEGACY_BOSS_EFFECT_SPRITE_DATA = {\n"
        f"{effect_lines}\n"
        "};\n"
        "/* LEGACY_BOSS_EFFECT_ASSETS_END */"
    )
    marker_pattern = r"/\* LEGACY_BOSS_EFFECT_ASSETS_START \*/[\s\S]*?/\* LEGACY_BOSS_EFFECT_ASSETS_END \*/"
    if re.search(marker_pattern, text):
        text = re.sub(marker_pattern, effect_block, text, count=1)
    else:
        anchor = "const BOSS_ATTACK_SPRITES = {};\n"
        if anchor not in text:
            raise RuntimeError("BOSS_ATTACK_SPRITES anchor not found")
        text = text.replace(anchor, anchor + effect_block + "\n", 1)

    HTML_PATH.write_text(text, encoding="utf-8", newline="\n")
    print(f"Embedded {len(BOSSES)} attack sheets and {len(EFFECTS)} effects; original base sheets preserved")


if __name__ == "__main__":
    main()
