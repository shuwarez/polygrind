"""Extract the approved boss concept sprites from the handoff DOCX.

The first inline image is the overview montage. The following twenty images are
4x nearest-neighbour previews with a baked two-colour checkerboard. This helper
preserves those previews and reconstructs the canonical 256x96 RGBA sheets.
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

from docx import Document
from PIL import Image, ImageDraw


BOSS_KEYS = (
    "funeral_bell_colossus",
    "star_devourer",
    "plague_archimandrite",
    "crimson_seamstress",
    "glass_titan",
    "rust_king",
    "mother_empty_masks",
    "ice_psalmist",
    "heart_collector",
    "ink_leviathan",
    "judge_of_chains",
    "ashen_seraph",
    "bone_astrolabe",
    "copper_oracle",
    "prince_hungry_ravens",
    "lunar_butcher",
    "keeper_last_candle",
    "sand_gravedigger",
    "bottomless_mnema",
    "empress_iron_roses",
)

CHECKER_COLORS = {(25, 31, 40), (20, 25, 33)}


def inline_blobs(doc: Document) -> list[bytes]:
    blobs: list[bytes] = []
    for shape in doc.inline_shapes:
        blip = shape._inline.graphic.graphicData.pic.blipFill.blip
        blobs.append(doc.part.related_parts[blip.embed].blob)
    return blobs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("docx", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    doc = Document(args.docx)
    blobs = inline_blobs(doc)
    if len(blobs) != len(BOSS_KEYS) + 1:
        raise SystemExit(f"expected 21 inline images, found {len(blobs)}")

    preview_dir = args.output / "previews"
    sheet_dir = args.output / "sheets"
    preview_dir.mkdir(parents=True, exist_ok=True)
    sheet_dir.mkdir(parents=True, exist_ok=True)
    outputs = [("overview", blobs[0]), *zip(BOSS_KEYS, blobs[1:])]
    for key, blob in outputs:
        with Image.open(io.BytesIO(blob)) as image:
            rgba = image.convert("RGBA")
            path = preview_dir / f"{key}.png"
            rgba.save(path, optimize=True)
            alpha = rgba.getchannel("A")
            print(
                f"preview {key}: {rgba.width}x{rgba.height} {rgba.mode} "
                f"alpha={alpha.getextrema()} bytes={path.stat().st_size}"
            )
            if key == "overview":
                continue
            if rgba.size != (1024, 384):
                raise SystemExit(f"{key}: expected 1024x384 preview, found {rgba.size}")
            sheet = rgba.resize((256, 96), Image.Resampling.NEAREST)
            pixels = sheet.load()
            for y in range(sheet.height):
                for x in range(sheet.width):
                    r, g, b, a = pixels[x, y]
                    if (r, g, b) in CHECKER_COLORS:
                        pixels[x, y] = (r, g, b, 0)
            sheet_path = sheet_dir / f"{key}.png"
            sheet.save(sheet_path, optimize=True)
            alpha = sheet.getchannel("A")
            if alpha.getextrema() != (0, 255) or sheet.getpixel((0, 0))[3] != 0:
                raise SystemExit(f"{key}: checkerboard transparency reconstruction failed")
            print(
                f"sheet   {key}: 256x96 RGBA alpha={alpha.getextrema()} "
                f"bytes={sheet_path.stat().st_size}"
            )

    cell_w, cell_h, label_h = 512, 192, 24
    contact = Image.new("RGBA", (cell_w * 2, (cell_h + label_h) * 10), (9, 12, 17, 255))
    draw = ImageDraw.Draw(contact)
    for idx, key in enumerate(BOSS_KEYS):
        with Image.open(sheet_dir / f"{key}.png") as image:
            sprite = image.convert("RGBA").resize((cell_w, cell_h), Image.Resampling.NEAREST)
        x = idx % 2 * cell_w
        y = idx // 2 * (cell_h + label_h)
        contact.alpha_composite(sprite, (x, y))
        draw.text((x + 8, y + cell_h + 4), f"{idx + 1:02d}  {key}", fill=(220, 226, 235, 255))
    contact_path = args.output / "boss20_contact_sheet.png"
    contact.save(contact_path, optimize=True)
    print(f"contact {contact_path}: {contact.width}x{contact.height}")


if __name__ == "__main__":
    main()
