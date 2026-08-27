from __future__ import annotations

from collections import deque
import base64
from pathlib import Path
import re

from PIL import Image


ROOT = Path(r"C:\Polygrind\session2026-08-27_22-03-40")
OUT = ROOT / "sprite_work"
OUT.mkdir(exist_ok=True)

SOURCES = {
    "archer": Path(r"C:\Users\alivp\Desktop\CHROME\Emerald hooded archer sprite sheet.png"),
    "mage": Path(r"C:\Users\alivp\Desktop\CHROME\Crimson hooded battle mage sprite sheet.png"),
    "warrior": Path(r"C:\Users\alivp\Desktop\CHROME\Dark steel warrior attack sprites.png"),
}


def remove_checkerboard(source: Image.Image) -> Image.Image:
    """Remove only border-connected near-neutral bright pixels.

    The generated archer/mage sheets contain a rendered transparency grid.
    Flood filling from the border avoids erasing disconnected white highlights
    inside the actual character artwork.
    """
    rgba = source.convert("RGBA")
    px = rgba.load()
    width, height = rgba.size
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        r, g, b, _ = px[x, y]
        return min(r, g, b) >= 205 and max(r, g, b) - min(r, g, b) <= 28

    def push(x: int, y: int) -> None:
        idx = y * width + x
        if not seen[idx] and is_background(x, y):
            seen[idx] = 1
            queue.append((x, y))

    for x in range(width):
        push(x, 0)
        push(x, height - 1)
    for y in range(height):
        push(0, y)
        push(width - 1, y)

    while queue:
        x, y = queue.popleft()
        px[x, y] = (0, 0, 0, 0)
        if x:
            push(x - 1, y)
        if x + 1 < width:
            push(x + 1, y)
        if y:
            push(x, y - 1)
        if y + 1 < height:
            push(x, y + 1)
    return rgba


def compact_sheet(source: Image.Image) -> Image.Image:
    """Convert the source 4x2 layout into a compact 128px-per-frame sheet."""
    source = source.convert("RGBA")
    width, height = source.size
    out = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
    x_edges = [round(width * i / 4) for i in range(5)]
    y_edges = [round(height * i / 2) for i in range(3)]
    for row in range(2):
        for col in range(4):
            frame = source.crop((x_edges[col], y_edges[row], x_edges[col + 1], y_edges[row + 1]))
            frame = frame.resize((128, 128), Image.Resampling.NEAREST)
            out.alpha_composite(frame, (col * 128, row * 128))
    return out


encoded: dict[str, str] = {}
for key, path in SOURCES.items():
    source = Image.open(path)
    prepared = source.convert("RGBA") if key == "warrior" else remove_checkerboard(source)
    sheet = compact_sheet(prepared)
    target = OUT / f"{key}_sheet_512x256.png"
    sheet.save(target, optimize=True, compress_level=9)
    encoded[key] = base64.b64encode(target.read_bytes()).decode("ascii")
    alpha = sheet.getchannel("A")
    visible = sum(1 for value in alpha.getdata() if value)
    print(f"{key}: {target.stat().st_size} bytes, {visible} visible pixels, alpha={alpha.getextrema()}")

html_path = ROOT / "PolyGrind.html"
html = html_path.read_text(encoding="utf-8")
for key, payload in encoded.items():
    pattern = rf"({key}:'data:image/png;base64,)[^']+(')"
    html, count = re.subn(pattern, rf"\g<1>{payload}\2", html, count=1)
    if count != 1:
        raise RuntimeError(f"Expected exactly one embedded {key} sprite, found {count}")
html_path.write_text(html, encoding="utf-8", newline="")
print("Embedded all three compact sheets into PolyGrind.html")
