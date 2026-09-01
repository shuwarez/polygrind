"""Extract the embedded legacy-boss art for visual QA and ImageGen references."""

from __future__ import annotations

import base64
import io
import re
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
HTML = (ROOT / "GrimGrind.html").read_text(encoding="utf-8")
OUT = ROOT / "legacy_boss_assets"
BASE = OUT / "reference" / "base"
EFFECTS = OUT / "reference" / "effects"

LEGACY_BOSSES = (
    "lich", "goat", "plague", "greed", "executioner", "tyrant", "grave",
    "behemoth", "vampire", "voidwrath", "minotaur", "seraph", "matriarch",
    "demonqueen",
)

EFFECT_CONSTANTS = (
    "PLAGUE_SLIME_PROJECTILE_DATA", "EMERALD_ORB_PROJECTILE_DATA",
    "GREED_SPEAR_PROJECTILE_DATA", "EXECUTIONER_AXE_PROJECTILE_DATA",
    "MINOTAUR_SPEAR_PROJECTILE_DATA", "SERAPH_HOLY_SPEAR_DATA",
    "DEMON_QUEEN_BLOB_DATA", "MATRIARCH_PLAGUE_PROJECTILE_DATA",
    "VOID_GROUND_RIFT_DATA",
)

POOL_KEYS = ("bossAcid", "tyrantFire")


def decode_uri(uri: str) -> Image.Image:
    payload = uri.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(payload))).convert("RGBA")


def property_uri(key: str) -> str:
    match = re.search(
        rf"(?m)^\s*{re.escape(key)}\s*:\s*'(data:image/[^']+)'", HTML
    )
    if not match:
        raise RuntimeError(f"Embedded property not found: {key}")
    return match.group(1)


def constant_uri(key: str) -> str:
    match = re.search(
        rf"(?m)^const\s+{re.escape(key)}\s*=\s*'(data:image/[^']+)'", HTML
    )
    if not match:
        raise RuntimeError(f"Embedded constant not found: {key}")
    return match.group(1)


def save_assets() -> tuple[list[tuple[str, Image.Image]], list[tuple[str, Image.Image]]]:
    BASE.mkdir(parents=True, exist_ok=True)
    EFFECTS.mkdir(parents=True, exist_ok=True)
    bases: list[tuple[str, Image.Image]] = []
    effects: list[tuple[str, Image.Image]] = []
    for key in LEGACY_BOSSES:
        image = decode_uri(property_uri(key))
        image.save(BASE / f"{key}.png")
        bases.append((key, image))
    for key in EFFECT_CONSTANTS:
        image = decode_uri(constant_uri(key))
        name = key.removesuffix("_DATA").lower()
        image.save(EFFECTS / f"{name}.png")
        effects.append((name, image))
    for key in POOL_KEYS:
        image = decode_uri(property_uri(key))
        image.save(EFFECTS / f"{key}.png")
        effects.append((key, image))
    return bases, effects


def contact_sheet(entries: list[tuple[str, Image.Image]], path: Path, columns: int) -> None:
    cell_w, cell_h = 320, 150
    rows = (len(entries) + columns - 1) // columns
    sheet = Image.new("RGBA", (cell_w * columns, cell_h * rows), (10, 13, 18, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(entries):
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        checker = Image.new("RGBA", (288, 110), (24, 30, 39, 255))
        cd = ImageDraw.Draw(checker)
        for cy in range(0, 110, 12):
            for cx in range(0, 288, 12):
                if (cx // 12 + cy // 12) % 2:
                    cd.rectangle((cx, cy, cx + 11, cy + 11), fill=(18, 23, 31, 255))
        preview = image.copy()
        preview.thumbnail((280, 100), Image.Resampling.NEAREST)
        checker.alpha_composite(preview, ((288 - preview.width) // 2, (110 - preview.height) // 2))
        sheet.alpha_composite(checker, (x + 16, y + 28))
        draw.text((x + 16, y + 8), f"{name}  {image.width}x{image.height}", fill=(230, 238, 247, 255))
    sheet.convert("RGB").save(path, quality=94)


def main() -> None:
    bases, effects = save_assets()
    contact_sheet(bases, OUT / "legacy_boss_base_contact.png", 2)
    contact_sheet(effects, OUT / "legacy_boss_effect_contact.png", 2)
    print(f"Extracted {len(bases)} boss sheets and {len(effects)} effect sheets to {OUT}")


if __name__ == "__main__":
    main()
