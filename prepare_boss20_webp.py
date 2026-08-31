"""Normalize approved boss sheets and supplemental attack animation into compact WebP."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent / "boss20_assets"
BASE = ROOT / "sheets"
SOURCE = ROOT / "generated_attack" / "source"
OUT = ROOT / "webp"
ATTACK_OUT = ROOT / "generated_attack" / "webp"
OUT.mkdir(parents=True, exist_ok=True)
ATTACK_OUT.mkdir(parents=True, exist_ok=True)

ATTACKS = {
    "funeral_bell_colossus_attack": SOURCE / "funeral_bell_colossus_attack.png",
    "star_devourer_attack": SOURCE / "star_devourer_attack.png",
    "mother_empty_masks_attack": SOURCE / "mother_empty_masks_attack.png",
    "keeper_last_candle_attack": SOURCE / "keeper_last_candle_attack.png",
}


def transparent_star_background(image: Image.Image) -> Image.Image:
    """Remove only near-black pixels connected to a source-image edge."""
    rgba = image.convert("RGBA")
    px = rgba.load()
    width, height = rgba.size
    seen: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        r, g, b, _ = px[x, y]
        if max(r, g, b) > 16:
            continue
        px[x, y] = (r, g, b, 0)
        if x:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))
    return rgba


def normalize_attack(key: str, path: Path) -> Image.Image:
    source = Image.open(path)
    rgba = transparent_star_background(source) if key.startswith("star_") else source.convert("RGBA")
    frame_w = rgba.width / 4
    sheet = Image.new("RGBA", (256, 96), (0, 0, 0, 0))
    for index in range(4):
        left, right = round(index * frame_w), round((index + 1) * frame_w)
        frame = rgba.crop((left, 0, right, rgba.height))
        bbox = frame.getchannel("A").getbbox()
        if not bbox:
            raise RuntimeError(f"{key} frame {index}: empty alpha")
        frame = frame.crop(bbox)
        scale = min(60 / frame.width, 92 / frame.height)
        size = (max(1, round(frame.width * scale)), max(1, round(frame.height * scale)))
        frame = frame.resize(size, Image.Resampling.NEAREST)
        x = index * 64 + (64 - frame.width) // 2
        y = 94 - frame.height
        sheet.alpha_composite(frame, (x, y))
    return sheet


def save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", lossless=True, method=6, exact=True)
    check = Image.open(path)
    if check.size != (256, 96) or check.mode != "RGBA":
        raise RuntimeError(f"invalid WebP {path}: {check.size} {check.mode}")


for path in sorted(BASE.glob("*.png")):
    save_webp(Image.open(path).convert("RGBA"), OUT / f"{path.stem}.webp")

attack_sheets: list[tuple[str, Image.Image]] = []
for key, path in ATTACKS.items():
    sheet = normalize_attack(key, path)
    save_webp(sheet, ATTACK_OUT / f"{key}.webp")
    sheet.save(ATTACK_OUT / f"{key}.png", optimize=True)
    attack_sheets.append((key, sheet))

contact = Image.new("RGBA", (512, 4 * 216), (9, 12, 17, 255))
draw = ImageDraw.Draw(contact)
for index, (key, sheet) in enumerate(attack_sheets):
    y = index * 216
    contact.alpha_composite(sheet.resize((512, 192), Image.Resampling.NEAREST), (0, y))
    draw.text((8, y + 196), key, fill=(220, 226, 235, 255))
contact.save(ROOT / "generated_attack" / "attack_contact_sheet.png", optimize=True)

print("base", len(list(OUT.glob("*.webp"))), sum(p.stat().st_size for p in OUT.glob("*.webp")))
print("attack", len(list(ATTACK_OUT.glob("*.webp"))), sum(p.stat().st_size for p in ATTACK_OUT.glob("*.webp")))
