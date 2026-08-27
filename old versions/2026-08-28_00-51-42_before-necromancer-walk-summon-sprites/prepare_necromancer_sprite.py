from __future__ import annotations

from collections import deque
import base64
from pathlib import Path
import re

from PIL import Image


SOURCE = Path(r"C:\Users\alivp\Desktop\CHROME\Ivory-robed necromancer summoning sprite sheet.png")
OUT = Path(__file__).parent / "necromancer_sheet_512x256.png"


def remove_checkerboard(source: Image.Image) -> Image.Image:
    """Remove only border-connected bright neutral checkerboard pixels."""
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


source = remove_checkerboard(Image.open(SOURCE))
sheet = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
for row in range(2):
    for col in range(4):
        frame = source.crop((col * 384, row * 512, (col + 1) * 384, (row + 1) * 512))
        frame = frame.resize((96, 128), Image.Resampling.NEAREST)
        sheet.alpha_composite(frame, (col * 128 + 16, row * 128))

sheet.save(OUT, optimize=True, compress_level=9)
alpha = sheet.getchannel("A")
visible = sum(1 for value in alpha.getdata() if value)
print(f"{OUT}\n{OUT.stat().st_size} bytes, {visible} visible pixels, alpha={alpha.getextrema()}")

html_path = Path(r"C:\Polygrind\session2026-08-27_22-03-40\PolyGrind.html")
html = html_path.read_text(encoding="utf-8")
payload = base64.b64encode(OUT.read_bytes()).decode("ascii")
html, count = re.subn(
    r"(necromancer:'data:image/png;base64,)[^']+(')",
    rf"\g<1>{payload}\2",
    html,
    count=1,
)
if count != 1:
    raise RuntimeError(f"Expected exactly one embedded necromancer sprite, found {count}")
html_path.write_text(html, encoding="utf-8", newline="")
print("Embedded the compact necromancer sheet into PolyGrind.html")
