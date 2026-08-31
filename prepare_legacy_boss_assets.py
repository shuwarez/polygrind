"""Normalize generated legacy boss atlases to PolyGrind's canonical sprite sizes."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "legacy_boss_assets"
RAW_BOSSES = ASSETS / "generated" / "raw"
RAW_EFFECTS = ASSETS / "generated" / "effects_raw"
PNG_BASE = ASSETS / "generated" / "base_png"
PNG_ATTACK = ASSETS / "generated" / "attack_png"
PNG_EFFECT = ASSETS / "generated" / "effect_png"
WEBP_BASE = ASSETS / "webp" / "base"
WEBP_ATTACK = ASSETS / "webp" / "attack"
WEBP_EFFECT = ASSETS / "webp" / "effects"

BOSSES = (
    "lich", "goat", "plague", "greed", "executioner", "tyrant", "grave",
    "behemoth", "vampire", "voidwrath", "minotaur", "seraph", "matriarch",
    "demonqueen",
)

EFFECTS = (
    "goat_slam", "behemoth_impact", "minotaur_crash", "tyrant_slash",
    "vampire_cross", "summon_sigil",
)


def remove_light_background(image: Image.Image) -> Image.Image:
    """Remove only near-white pixels connected to the image boundary."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        r, g, b = pixels[x, y]
        return min(r, g, b) >= 225 and max(r, g, b) - min(r, g, b) <= 18

    for x in range(width):
        if is_background(x, 0): queue.append((x, 0))
        if is_background(x, height - 1): queue.append((x, height - 1))
    for y in range(height):
        if is_background(0, y): queue.append((0, y))
        if is_background(width - 1, y): queue.append((width - 1, y))

    mask = Image.new("L", image.size, 255)
    alpha = mask.load()
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if seen[index] or not is_background(x, y):
            continue
        seen[index] = 1
        alpha[x, y] = 0
        if x: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))

    rgba = image.convert("RGBA")
    rgba.putalpha(mask)
    return rgba


def clean_alpha(image: Image.Image) -> Image.Image:
    if image.mode != "RGBA" or image.getchannel("A").getextrema() == (255, 255):
        image = remove_light_background(image)
    rgba = image.convert("RGBA")
    # Generated transparent PNGs sometimes retain almost-black RGB under a tiny alpha.
    alpha = rgba.getchannel("A").point(lambda value: 0 if value < 12 else value)
    rgba.putalpha(alpha)
    return rgba


def cells(image: Image.Image, columns: int, rows: int) -> list[Image.Image]:
    result: list[Image.Image] = []
    for row in range(rows):
        y0 = round(row * image.height / rows)
        y1 = round((row + 1) * image.height / rows)
        for column in range(columns):
            x0 = round(column * image.width / columns)
            x1 = round((column + 1) * image.width / columns)
            result.append(image.crop((x0, y0, x1, y1)))
    return result


def foreground_crop(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= 16 else 0).getbbox()
    return image.crop(bbox) if bbox else Image.new("RGBA", (1, 1))


def normalized_sheet(frames: list[Image.Image], frame_w: int, frame_h: int,
                     pad_x: int, pad_top: int, pad_bottom: int,
                     common_scale: float | None = None) -> Image.Image:
    crops = [foreground_crop(frame) for frame in frames]
    if common_scale is None:
        # Idle frames set the perceived body scale; exceptional attack effects may shrink
        # only their own frame instead of making every idle pose tiny.
        reference = crops[:4] if len(crops) >= 8 else crops
        common_scale = min(
            (frame_w - pad_x * 2) / max(frame.width for frame in reference),
            (frame_h - pad_top - pad_bottom) / max(frame.height for frame in reference),
        )
    output = Image.new("RGBA", (frame_w * len(crops), frame_h))
    for index, crop in enumerate(crops):
        fit = min(
            common_scale,
            (frame_w - pad_x * 2) / crop.width,
            (frame_h - pad_top - pad_bottom) / crop.height,
        )
        size = (max(1, round(crop.width * fit)), max(1, round(crop.height * fit)))
        resized = crop.resize(size, Image.Resampling.LANCZOS)
        x = index * frame_w + (frame_w - resized.width) // 2
        y = frame_h - pad_bottom - resized.height
        output.alpha_composite(resized, (x, y))
    return output


def save_lossless(image: Image.Image, png: Path, webp: Path) -> None:
    png.parent.mkdir(parents=True, exist_ok=True)
    webp.parent.mkdir(parents=True, exist_ok=True)
    image.save(png, optimize=True)
    image.save(webp, "WEBP", lossless=True, method=6, exact=True)


def build_bosses() -> tuple[list[tuple[str, Image.Image]], list[tuple[str, Image.Image]]]:
    base_entries: list[tuple[str, Image.Image]] = []
    attack_entries: list[tuple[str, Image.Image]] = []
    for key in BOSSES:
        atlas = clean_alpha(Image.open(RAW_BOSSES / f"{key}_atlas.png"))
        atlas_cells = cells(atlas, 4, 2)
        base = normalized_sheet(atlas_cells[:4], 64, 96, 2, 4, 6)
        # Match the attack row's body scale to the finished idle row reference.
        idle_crops = [foreground_crop(frame) for frame in atlas_cells[:4]]
        scale = min(60 / max(frame.width for frame in idle_crops), 86 / max(frame.height for frame in idle_crops))
        attack = normalized_sheet(atlas_cells[4:], 64, 96, 2, 4, 6, scale)
        save_lossless(base, PNG_BASE / f"{key}.png", WEBP_BASE / f"{key}.webp")
        save_lossless(attack, PNG_ATTACK / f"{key}_attack.png", WEBP_ATTACK / f"{key}_attack.webp")
        base_entries.append((key, base))
        attack_entries.append((key, attack))
    return base_entries, attack_entries


def build_effects() -> list[tuple[str, Image.Image]]:
    entries: list[tuple[str, Image.Image]] = []
    for key in EFFECTS:
        atlas = clean_alpha(Image.open(RAW_EFFECTS / f"{key}.png"))
        effect = normalized_sheet(cells(atlas, 4, 1), 96, 96, 2, 2, 2)
        save_lossless(effect, PNG_EFFECT / f"{key}.png", WEBP_EFFECT / f"{key}.webp")
        entries.append((key, effect))
    return entries


def contact_sheet(entries: list[tuple[str, Image.Image]], path: Path, columns: int = 2) -> None:
    cell_w, cell_h = 330, 145
    rows = (len(entries) + columns - 1) // columns
    sheet = Image.new("RGBA", (cell_w * columns, cell_h * rows), (9, 12, 17, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(entries):
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        draw.text((x + 12, y + 8), name, fill=(232, 239, 247, 255))
        preview = image.resize((image.width * 2, image.height * 2), Image.Resampling.NEAREST)
        checker = Image.new("RGBA", preview.size, (25, 31, 40, 255))
        checks = ImageDraw.Draw(checker)
        for cy in range(0, preview.height, 16):
            for cx in range(0, preview.width, 16):
                if (cx // 16 + cy // 16) % 2:
                    checks.rectangle((cx, cy, cx + 15, cy + 15), fill=(20, 25, 33, 255))
        checker.alpha_composite(preview)
        checker.thumbnail((cell_w - 24, cell_h - 32), Image.Resampling.NEAREST)
        sheet.alpha_composite(checker, (x + 12, y + 27))
    sheet.convert("RGB").save(path, quality=94)


def main() -> None:
    bases, attacks = build_bosses()
    effects = build_effects()
    contact_sheet(bases, ASSETS / "legacy_boss_base_v2_contact.png")
    contact_sheet(attacks, ASSETS / "legacy_boss_attack_contact.png")
    contact_sheet(effects, ASSETS / "legacy_boss_effect_v2_contact.png")
    total = sum(path.stat().st_size for path in (WEBP_BASE, WEBP_ATTACK, WEBP_EFFECT) for path in path.glob("*.webp"))
    print(f"Prepared {len(bases)} base, {len(attacks)} attack, {len(effects)} effect sheets ({total} bytes WebP)")


if __name__ == "__main__":
    main()
