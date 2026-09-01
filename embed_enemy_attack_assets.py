"""Embed the normal and elite enemy attack sprite sheets into GrimGrind.html."""

from __future__ import annotations

import base64
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HTML_PATH = ROOT / "GrimGrind.html"
ASSETS = ROOT / "enemy_attack_assets" / "webp"

NORMAL = ("runner", "blob", "tank", "shooter")
ELITE = (
    "frostWolf", "toxicRunner", "cursedRogue", "skeletonWarrior",
    "blightGrunt", "boneGargoyle", "fallenPyromancer", "beholderSlave",
    "skeletonCrossbow", "forgottenGuard", "abyssalExecutioner", "plagueOgre",
)


def uri(path: Path) -> str:
    return "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def data_object(name: str, folder: str, keys: tuple[str, ...]) -> str:
    lines = "\n".join(
        f"  {key}:'{uri(ASSETS / folder / f'{key}_attack.webp')}',"
        for key in keys
    )
    return f"const {name} = {{\n{lines}\n}};"


def main() -> None:
    text = HTML_PATH.read_text(encoding="utf-8")
    block = (
        "/* ENEMY_ATTACK_SPRITE_DATA_BEGIN */\n"
        + data_object("ENEMY_ATTACK_SPRITE_DATA", "normal", NORMAL)
        + "\n"
        + data_object("ELITE_ATTACK_SPRITE_DATA", "elite", ELITE)
        + "\n/* ENEMY_ATTACK_SPRITE_DATA_END */"
    )
    pattern = r"/\* ENEMY_ATTACK_SPRITE_DATA_BEGIN \*/[\s\S]*?/\* ENEMY_ATTACK_SPRITE_DATA_END \*/"
    if re.search(pattern, text):
        text = re.sub(pattern, block, text, count=1)
    else:
        anchor = "/* Снаряд Призмы"
        if anchor not in text:
            raise RuntimeError("Shooter projectile anchor not found")
        text = text.replace(anchor, block + "\n" + anchor, 1)
    HTML_PATH.write_text(text, encoding="utf-8", newline="\n")
    print(f"Embedded {len(NORMAL)} normal and {len(ELITE)} elite attack sheets")


if __name__ == "__main__":
    main()
