#!/usr/bin/env python3
"""Prepare the ten autonomous PolyGrind floor textures.

The input directory must contain floor_01.png ... floor_10.png.  Every source
is converted to a dark 512x512 indexed PNG, its opposite edges are feathered
into an exact match, and an optional marker block in GrimGrind.html is updated
with the resulting data URIs.
"""

from __future__ import annotations

import argparse
import base64
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageStat


FLOOR_NAMES = (
    "floor_01_slate.png",
    "floor_02_cracked.png",
    "floor_03_damp.png",
    "floor_04_temple.png",
    "floor_05_basalt.png",
    "floor_06_iron.png",
    "floor_07_ash.png",
    "floor_08_crystal.png",
    "floor_09_forge.png",
    "floor_10_frost.png",
)
TARGET_SIZE = 512
TARGET_LUMA = 42.0
EDGE_BLEND = 48
PALETTE_COLORS = 96


def resize_square(source: Image.Image) -> Image.Image:
    image = source.convert("RGB")
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    return image.resize((TARGET_SIZE, TARGET_SIZE), Image.Resampling.NEAREST)


def match_luma(image: Image.Image) -> Image.Image:
    current = ImageStat.Stat(image.convert("L")).mean[0]
    if current <= 0:
        return image
    return ImageEnhance.Brightness(image).enhance(TARGET_LUMA / current)


def _mix(a: tuple[int, ...], b: tuple[int, ...], amount: float) -> tuple[int, ...]:
    return tuple(round(av * (1.0 - amount) + bv * amount) for av, bv in zip(a, b))


def make_edges_periodic(image: Image.Image, band: int = EDGE_BLEND) -> Image.Image:
    """Feather opposite borders together while preserving the interior.

    The outermost opposite pixels become identical, so CanvasPattern has no
    discontinuity.  A raised-cosine falloff hides the correction inside a
    narrow border instead of creating a hard mirrored seam.
    """

    result = image.copy()
    width, height = result.size

    original = result.copy()
    src, dst = original.load(), result.load()
    for x in range(band):
        amount = 0.5 * (1.0 + math.cos(math.pi * x / (band - 1)))
        right_x = width - 1 - x
        for y in range(height):
            average = _mix(src[x, y], src[right_x, y], 0.5)
            dst[x, y] = _mix(src[x, y], average, amount)
            dst[right_x, y] = _mix(src[right_x, y], average, amount)

    original = result.copy()
    src, dst = original.load(), result.load()
    for y in range(band):
        amount = 0.5 * (1.0 + math.cos(math.pi * y / (band - 1)))
        bottom_y = height - 1 - y
        for x in range(width):
            average = _mix(src[x, y], src[x, bottom_y], 0.5)
            dst[x, y] = _mix(src[x, y], average, amount)
            dst[x, bottom_y] = _mix(src[x, bottom_y], average, amount)

    return result


def quantize(image: Image.Image) -> Image.Image:
    return image.quantize(
        colors=PALETTE_COLORS,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )


def edge_error(image: Image.Image) -> int:
    rgb = image.convert("RGB")
    px = rgb.load()
    horizontal = max(
        max(abs(a - b) for a, b in zip(px[0, y], px[rgb.width - 1, y]))
        for y in range(rgb.height)
    )
    vertical = max(
        max(abs(a - b) for a, b in zip(px[x, 0], px[x, rgb.height - 1]))
        for x in range(rgb.width)
    )
    return max(horizontal, vertical)


def make_preview(images: list[Image.Image], names: tuple[str, ...], path: Path) -> None:
    cell = 384
    label_h = 28
    sheet = Image.new("RGB", (cell * 5, (cell + label_h) * 2), "#080b0f")
    draw = ImageDraw.Draw(sheet)
    for index, (image, name) in enumerate(zip(images, names)):
        tile = image.convert("RGB")
        tiled = Image.new("RGB", (TARGET_SIZE * 3, TARGET_SIZE * 3))
        for x in range(3):
            for y in range(3):
                tiled.paste(tile, (x * TARGET_SIZE, y * TARGET_SIZE))
        tiled = tiled.resize((cell, cell), Image.Resampling.NEAREST)
        x = (index % 5) * cell
        y = (index // 5) * (cell + label_h)
        sheet.paste(tiled, (x, y))
        draw.text((x + 8, y + cell + 7), name, fill="#d7dee7")
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, optimize=True)


def embed_data_uris(html_path: Path, output_paths: list[Path]) -> None:
    html = html_path.read_text(encoding="utf-8")
    entries = []
    for path in output_paths:
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        entries.append(f"  'data:image/png;base64,{encoded}', // {path.name}")
    replacement = (
        "/* FLOOR_TEXTURE_DATA_START */\n"
        + "\n".join(entries)
        + "\n  /* FLOOR_TEXTURE_DATA_END */"
    )
    pattern = re.compile(
        r"/\* FLOOR_TEXTURE_DATA_START \*/.*?/\* FLOOR_TEXTURE_DATA_END \*/",
        re.DOTALL,
    )
    html, count = pattern.subn(replacement, html, count=1)
    if count != 1:
        raise RuntimeError("floor texture marker block not found exactly once")
    html_path.write_text(html, encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--preview", type=Path)
    parser.add_argument("--embed-html", type=Path)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    final_images: list[Image.Image] = []
    for index, name in enumerate(FLOOR_NAMES, start=1):
        source_path = args.input_dir / f"floor_{index:02d}.png"
        if not source_path.is_file():
            raise FileNotFoundError(source_path)
        with Image.open(source_path) as source:
            image = resize_square(source)
        image = match_luma(image)
        image = make_edges_periodic(image)
        image = quantize(image)
        output_path = args.output_dir / name
        image.save(output_path, optimize=True)
        if edge_error(image) != 0:
            raise RuntimeError(f"non-periodic edges after quantization: {output_path}")
        outputs.append(output_path)
        final_images.append(image)
        luma = ImageStat.Stat(image.convert("L")).mean[0]
        print(f"{name}: {output_path.stat().st_size} bytes, luma={luma:.2f}, edge_error=0")

    if args.preview:
        make_preview(final_images, FLOOR_NAMES, args.preview)
    if args.embed_html:
        embed_data_uris(args.embed_html, outputs)


if __name__ == "__main__":
    main()
