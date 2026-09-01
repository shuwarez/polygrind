"""Normalize approved boss sheets and supplemental attack animation into compact WebP."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw
from prepare_legacy_boss_assets import (
    cells,
    clean_alpha,
    fixed_scale_attack_sheet,
    normalized_sheet,
)


ROOT = Path(__file__).resolve().parent / "boss20_assets"
BASE = ROOT / "sheets"
SOURCE = ROOT / "generated_attack" / "v3_raw"
STANDING_FRAME0 = ROOT / "source_standing_frame0"
OUT = ROOT / "webp"
ATTACK_OUT = ROOT / "generated_attack" / "webp"
EFFECT_SOURCE = ROOT / "generated_effects" / "v3_raw"
EFFECT_OUT = ROOT / "generated_effects" / "webp"
OUT.mkdir(parents=True, exist_ok=True)
ATTACK_OUT.mkdir(parents=True, exist_ok=True)
EFFECT_OUT.mkdir(parents=True, exist_ok=True)

BOSS_KEYS = (
    "funeral_bell_colossus", "star_devourer", "plague_archimandrite",
    "crimson_seamstress", "glass_titan", "rust_king", "mother_empty_masks",
    "ice_psalmist", "heart_collector", "ink_leviathan", "judge_of_chains",
    "ashen_seraph", "bone_astrolabe", "copper_oracle",
    "prince_hungry_ravens", "lunar_butcher", "keeper_last_candle",
    "sand_gravedigger", "bottomless_mnema", "empress_iron_roses",
)

ATTACKS = {
    f"{key}_attack": SOURCE / f"{key}_attack_raw.png" for key in BOSS_KEYS
}

EFFECT_KEYS = (
    "funeral_wave_ring", "star_meteor", "star_meteor_impact",
    "plague_censer_cloud", "crimson_flesh_seam", "glass_blast",
    "glass_shard", "rust_tide_cone", "empty_mask_beam",
    "ice_liturgy_sector", "heart_blood_ring", "ink_pool",
    "judge_chain_hook", "judge_hammer_impact", "ashen_comet",
    "ashen_comet_impact", "bone_orbit_ring", "copper_rewind_explosion",
    "raven_swarm", "lunar_crescent", "candle_safe_halo",
    "sand_shockwave", "sand_ground_strip", "mnema_shadow_pierce",
    "iron_rose_ring",
)


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


def remove_smooth_gradient_background(image: Image.Image) -> Image.Image:
    """Flood only the smooth vignette connected to the outer boundary."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    mask = Image.new("L", image.size, 255)
    alpha = mask.load()
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if seen[index]:
            continue
        seen[index] = 1
        alpha[x, y] = 0
        current = pixels[x, y]
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or nx >= width or ny < 0 or ny >= height:
                continue
            next_index = ny * width + nx
            if seen[next_index]:
                continue
            other = pixels[nx, ny]
            distance = sum((int(a) - int(b)) ** 2 for a, b in zip(current, other))
            if distance <= 36:
                queue.append((nx, ny))
    rgba = image.convert("RGBA")
    rgba.putalpha(mask)
    return rgba


def normalize_attack(key: str, path: Path) -> Image.Image:
    boss_key = key.removesuffix("_attack")
    source = Image.open(path)
    if boss_key in {"plague_archimandrite", "sand_gravedigger"}:
        rgba = remove_smooth_gradient_background(source)
    else:
        rgba = clean_alpha(source)
    reference = clean_alpha(Image.open(STANDING_FRAME0 / f"{boss_key}_frame0.png"))
    return fixed_scale_attack_sheet(cells(rgba, 4, 1), reference)


def save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", lossless=True, method=6, exact=True)
    check = Image.open(path)
    if check.size != image.size or check.mode != "RGBA":
        raise RuntimeError(f"invalid WebP {path}: {check.size} {check.mode}")


for path in sorted(BASE.glob("*.png")):
    save_webp(Image.open(path).convert("RGBA"), OUT / f"{path.stem}.webp")

attack_sheets: list[tuple[str, Image.Image]] = []
for key, path in ATTACKS.items():
    sheet = normalize_attack(key, path)
    save_webp(sheet, ATTACK_OUT / f"{key}.webp")
    sheet.save(ATTACK_OUT / f"{key}.png", optimize=True)
    attack_sheets.append((key, sheet))

contact_columns = 2
contact_cell_w, contact_cell_h = 330, 145
contact_rows = (len(attack_sheets) + contact_columns - 1) // contact_columns
contact = Image.new(
    "RGBA",
    (contact_cell_w * contact_columns, contact_cell_h * contact_rows),
    (9, 12, 17, 255),
)
draw = ImageDraw.Draw(contact)
for index, (key, sheet) in enumerate(attack_sheets):
    x = (index % contact_columns) * contact_cell_w
    y = (index // contact_columns) * contact_cell_h
    preview = sheet.resize((256, 96), Image.Resampling.NEAREST)
    contact.alpha_composite(preview, (x + 8, y + 28))
    draw.text((x + 8, y + 8), key, fill=(220, 226, 235, 255))
contact.save(ROOT / "generated_attack" / "attack_contact_sheet.png", optimize=True)

effect_sheets: list[tuple[str, Image.Image]] = []
for key in EFFECT_KEYS:
    raw = clean_alpha(Image.open(EFFECT_SOURCE / f"{key}_raw.png"))
    sheet = normalized_sheet(cells(raw, 4, 1), 96, 96, 2, 2, 2)
    save_webp(sheet, EFFECT_OUT / f"{key}.webp")
    sheet.save(EFFECT_OUT / f"{key}.png", optimize=True)
    effect_sheets.append((key, sheet))

effect_columns = 2
effect_cell_w, effect_cell_h = 420, 130
effect_rows = (len(effect_sheets) + effect_columns - 1) // effect_columns
effect_contact = Image.new(
    "RGBA",
    (effect_cell_w * effect_columns, effect_cell_h * effect_rows),
    (9, 12, 17, 255),
)
effect_draw = ImageDraw.Draw(effect_contact)
for index, (key, sheet) in enumerate(effect_sheets):
    x = (index % effect_columns) * effect_cell_w
    y = (index // effect_columns) * effect_cell_h
    effect_contact.alpha_composite(sheet, (x + 8, y + 28))
    effect_draw.text((x + 8, y + 8), key, fill=(220, 226, 235, 255))
effect_contact.save(ROOT / "generated_effects" / "effect_contact_sheet.png", optimize=True)

print("base", len(list(OUT.glob("*.webp"))), sum(p.stat().st_size for p in OUT.glob("*.webp")))
print("attack", len(list(ATTACK_OUT.glob("*.webp"))), sum(p.stat().st_size for p in ATTACK_OUT.glob("*.webp")))
print("effects", len(list(EFFECT_OUT.glob("*.webp"))), sum(p.stat().st_size for p in EFFECT_OUT.glob("*.webp")))
