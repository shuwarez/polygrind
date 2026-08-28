"""Детерминированная упаковка растров PolyGrind в автономный HTML.

Приоритеты: минимальный размер текстур/HTML и видеопамяти, затем качество.
Пол намеренно не затрагивается. Все игровые листы сохраняются индексированными
PNG максимум с 16 палитровыми индексами, включая прозрачный индекс.
"""

from __future__ import annotations

import argparse
import base64
import io
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
HTML = ROOT / "PolyGrind.html"
TRANSPARENT_INDEX = 15
PALETTE_COLORS = 15


def indexed_png(image: Image.Image) -> bytes:
    """Свести RGBA к 15 непрозрачным цветам + одному прозрачному индексу."""
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= 64 else 0)
    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(rgba.convert("RGB"), mask=mask)
    pal = rgb.quantize(colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT,
                       dither=Image.Dither.NONE)
    palette = list(pal.getpalette() or [])
    palette.extend([0] * (768 - len(palette)))
    palette[TRANSPARENT_INDEX * 3:TRANSPARENT_INDEX * 3 + 3] = [0, 0, 0]
    pal.putpalette(palette)
    pixels = bytearray(pal.tobytes())
    mask_bytes = mask.tobytes()
    for index, opaque in enumerate(mask_bytes):
        if not opaque:
            pixels[index] = TRANSPARENT_INDEX
    out = Image.frombytes("P", pal.size, bytes(pixels))
    out.putpalette(palette)
    out.info["transparency"] = TRANSPARENT_INDEX
    buffer = io.BytesIO()
    out.save(buffer, "PNG", optimize=True, compress_level=9, bits=4,
             transparency=TRANSPARENT_INDEX)
    return buffer.getvalue()


def fit_frame(source: Image.Image, size: tuple[int, int], padding: int = 1) -> Image.Image:
    """Обрезать прозрачные поля и вписать силуэт в маленький фиксированный кадр."""
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
    box = alpha.getbbox()
    if not box:
        return Image.new("RGBA", size)
    crop = rgba.crop(box)
    max_w, max_h = size[0] - padding * 2, size[1] - padding * 2
    ratio = min(max_w / crop.width, max_h / crop.height)
    new_size = (max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio)))
    crop = crop.resize(new_size, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", size)
    x = (size[0] - new_size[0]) // 2
    y = size[1] - padding - new_size[1]
    frame.alpha_composite(crop, (x, y))
    return frame


def hero_sheet(path: Path) -> bytes:
    source = Image.open(path).convert("RGBA")
    sheet = Image.new("RGBA", (128, 32))
    for frame_index in range(4):
        x0 = round(frame_index * source.width / 4)
        x1 = round((frame_index + 1) * source.width / 4)
        frame = fit_frame(source.crop((x0, 0, x1, source.height)), (32, 32))
        sheet.alpha_composite(frame, (frame_index * 32, 0))
    return indexed_png(sheet)


ENEMY_FRAMES = {
    "runner": [(20, 115, 555, 455), (665, 115, 370, 455),
               (1070, 115, 575, 455), (1755, 115, 370, 455)],
    "blob": [(41, 170, 398, 490), (491, 170, 415, 490),
             (954, 170, 400, 490), (1411, 170, 418, 490)],
    "tank": [(14, 216, 396, 470), (448, 216, 377, 470),
             (875, 216, 399, 470), (1319, 216, 378, 470)],
}
ENEMY_FRAME_SIZE = {"runner": 40, "blob": 40, "tank": 48}


def enemy_sheet(source: Image.Image, key: str) -> bytes:
    size = ENEMY_FRAME_SIZE[key]
    sheet = Image.new("RGBA", (size * 4, size))
    for index, (x, y, width, height) in enumerate(ENEMY_FRAMES[key]):
        frame = fit_frame(source.crop((x, y, x + width, y + height)), (size, size))
        sheet.alpha_composite(frame, (index * size, 0))
    return indexed_png(sheet)


def boss_sheet(source: Image.Image) -> bytes:
    sheet = Image.new("RGBA", (256, 96))
    for index in range(4):
        frame = source.crop((index * 128, 0, (index + 1) * 128, 192))
        frame = frame.resize((64, 96), Image.Resampling.LANCZOS)
        sheet.alpha_composite(frame, (index * 64, 0))
    return indexed_png(sheet)


def coin_sheet(source: Image.Image) -> bytes:
    sheet = Image.new("RGBA", (32, 8))
    for index in range(4):
        frame = source.crop((index * 24, 0, (index + 1) * 24, 24))
        frame = fit_frame(frame, (8, 8), padding=0)
        sheet.alpha_composite(frame, (index * 8, 0))
    return indexed_png(sheet)


def uri_bytes(html: str, key: str) -> bytes:
    match = re.search(rf"{re.escape(key)}\s*[:=]\s*'data:image/png;base64,([^']+)'", html)
    if not match:
        raise SystemExit(f"Не найден PNG-ключ {key}")
    return base64.b64decode(match.group(1))


def replace_uri(html: str, key: str, png: bytes) -> str:
    pattern = rf"({re.escape(key)}:'data:image/png;base64,)[^']+(')"
    replacement = rf"\g<1>{base64.b64encode(png).decode('ascii')}\2"
    updated, count = re.subn(pattern, replacement, html)
    if count != 1:
        raise SystemExit(f"Ключ {key}: ожидалась одна замена, получено {count}")
    return updated


def exact_replace(html: str, old: str, new: str, note: str) -> str:
    count = html.count(old)
    if count != 1:
        raise SystemExit(f"{note}: якорь встретился {count} раз")
    return html.replace(old, new)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archer", type=Path, required=True)
    parser.add_argument("--mage", type=Path, required=True)
    parser.add_argument("--warrior", type=Path, required=True)
    parser.add_argument("--necromancer", type=Path, required=True)
    args = parser.parse_args()

    html = HTML.read_text(encoding="utf-8")
    original_size = len(html.encode("utf-8"))
    original_floor = uri_bytes(html, "FLOOR_TILE_DATA")

    hero_sources = {
        "archer": args.archer,
        "mage": args.mage,
        "warrior": args.warrior,
        "necromancer": args.necromancer,
    }
    generated: dict[str, bytes] = {key: hero_sheet(path) for key, path in hero_sources.items()}

    for key in ENEMY_FRAMES:
        source = Image.open(io.BytesIO(uri_bytes(html, key))).convert("RGBA")
        generated[key] = enemy_sheet(source, key)
    for key in ("lich", "goat", "plague", "greed", "executioner", "tyrant", "grave", "behemoth"):
        source = Image.open(io.BytesIO(uri_bytes(html, key))).convert("RGBA")
        generated[key] = boss_sheet(source)
    coin = Image.open(io.BytesIO(re.search(
        r"COIN_STRIP\.src = 'data:image/png;base64,([^']+)'", html
    ).group(1).encode() and base64.b64decode(re.search(
        r"COIN_STRIP\.src = 'data:image/png;base64,([^']+)'", html
    ).group(1)))).convert("RGBA")
    generated["COIN_STRIP"] = coin_sheet(coin)

    for key in ("archer", "mage", "warrior", "necromancer", "runner", "blob", "tank",
                "lich", "goat", "plague", "greed", "executioner", "tyrant", "grave", "behemoth"):
        html = replace_uri(html, key, generated[key])

    coin_b64 = base64.b64encode(generated["COIN_STRIP"]).decode("ascii")
    html, count = re.subn(
        r"(COIN_STRIP\.src = 'data:image/png;base64,)[^']+(')",
        rf"\g<1>{coin_b64}\2", html
    )
    if count != 1:
        raise SystemExit(f"Монеты: ожидалась одна замена, получено {count}")

    html = exact_replace(html,
        "/* Четырёхкадровые листы Бегуна, Ядра и Бастиона встроены ниже как data URI.\n"
        "   Исходные рисунки смотрят вправо;\n"
        "   как и герои, враги только зеркалятся по X и никогда не вращаются за целью.\n"
        "   Индивидуальные прямоугольники сохраняют длинные шаги Бегуна без растяжения\n"
        "   его коротких сгруппированных кадров. ax/ay — точка тела, стоящая на e.x/e.y. */",
        "/* Обычные враги упакованы в фиксированные кадры 40/48 px и палитру 16 цветов.\n"
        "   Все смотрят вправо и только зеркалятся по X; одинаковые прямоугольники кадров\n"
        "   уменьшают объём текстур, HTML и стоимость выбора области drawImage(). */",
        "комментарий обычных врагов")

    old_enemy_meta = """const ENEMY_SPRITE_META = {
  // Яркий Бегун намеренно компактнее остальных: 2.99 = прежние 4.6 * 0.65.
  // 20 px пути на кадр вместо 14 делают его быстрый цикл легче для глаза.
  runner:{src:ENEMY_SPRITE_DATA.runner, scale:2.99, stride:20, frames:[
    {x:20,  y:115,w:555,h:455,ax:374,ay:227}, {x:665, y:115,w:370,h:455,ax:178,ay:227},
    {x:1070,y:115,w:575,h:455,ax:337,ay:227}, {x:1755,y:115,w:370,h:455,ax:142,ay:227},
  ]},
  blob:{src:ENEMY_SPRITE_DATA.blob, scale:3.55, stride:18, frames:[
    {x:41,  y:170,w:398,h:490,ax:199,ay:245}, {x:491, y:170,w:415,h:490,ax:207,ay:245},
    {x:954, y:170,w:400,h:490,ax:200,ay:245}, {x:1411,y:170,w:418,h:490,ax:209,ay:245},
  ]},
  tank:{src:ENEMY_SPRITE_DATA.tank, scale:3.2, stride:18, frames:[
    {x:14,  y:216,w:396,h:470,ax:196,ay:234}, {x:448, y:216,w:377,h:470,ax:202,ay:234},
    {x:875, y:216,w:399,h:470,ax:200,ay:234}, {x:1319,y:216,w:378,h:470,ax:196,ay:234},
  ]},
};"""
    new_enemy_meta = """const ENEMY_SPRITE_META = {
  runner:{src:ENEMY_SPRITE_DATA.runner, scale:3.3333333333, stride:24, frames:[]},
  blob:  {src:ENEMY_SPRITE_DATA.blob,   scale:2.8571428571, stride:24, frames:[]},
  tank:  {src:ENEMY_SPRITE_DATA.tank,   scale:2.5263157895, stride:24, frames:[]},
};
for (const [key,meta] of Object.entries(ENEMY_SPRITE_META)){
  const size = key === 'tank' ? 48 : 40;
  for (let i=0;i<4;i++) meta.frames.push({x:i*size,y:0,w:size,h:size,ax:size/2,ay:size/2});
}"""
    html = exact_replace(html, old_enemy_meta, new_enemy_meta, "метаданные обычных врагов")

    html = exact_replace(html,
        "/* Четыре босса хранятся в том же автономном HTML. Исходные многомегабайтные\n"
        "   листы уменьшены до 512×192 и переведены в индексированную палитру: все четыре\n"
        "   вместе весят меньше 85 КБ до Base64. */",
        "/* Боссы хранятся в автономном HTML: четыре кадра 64×96 и 16 цветов.\n"
        "   Маленькая исходная текстура выводится крупно без сглаживания: экранный силуэт\n"
        "   не меньше 2.5 высоты героя, но видеопамять и Base64 остаются минимальными. */",
        "комментарий боссов")
    html = html.replace("scale:2.05, stride:20", "scale:2.5, stride:28")
    if html.count("scale:2.5, stride:28") != 8:
        raise SystemExit("Ожидалось восемь метаданных боссов")
    html = exact_replace(html,
        "for (let i = 0; i < 4; i++) meta.frames.push({x:i*128,y:0,w:128,h:192,ax:64,ay:145});",
        "for (let i = 0; i < 4; i++) meta.frames.push({x:i*64,y:0,w:64,h:96,ax:32,ay:72});",
        "кадры боссов")

    old_hero = """/* Новые листы: верхний ряд — четыре кадра ходьбы, нижний — четыре кадра действия.
   Для Лучника, Мага и Воина это атака, для Некроманта — призыв свиты. */
const HERO_SPRITE_META = {
  archer:{frameW:128,frameH:128,drawW:72,drawH:72},
  mage:{frameW:128,frameH:128,drawW:72,drawH:72},
  warrior:{frameW:128,frameH:128,drawW:72,drawH:72},
  necromancer:{frameW:128,frameH:128,drawW:72,drawH:72},
};"""
    new_hero = """/* Листы героев содержат только четыре кадра ходьбы 32×32: анимации атак
   и призыва удалены, потому что они создавали лишние кадры и визуальный шум. */
const HERO_SPRITE_META = {
  archer:{frameW:32,frameH:32,drawW:48,drawH:48},
  mage:{frameW:32,frameH:32,drawW:48,drawH:48},
  warrior:{frameW:32,frameH:32,drawW:48,drawH:48},
  necromancer:{frameW:32,frameH:32,drawW:48,drawH:48},
};"""
    html = exact_replace(html, old_hero, new_hero, "метаданные героев")
    html = exact_replace(html, ".hero-preview.sheet{background-position:0 0;background-size:400% 200%}",
                         ".hero-preview.sheet{background-position:0 0;background-size:400% 100%}",
                         "CSS превью героев")
    html = exact_replace(html,
        "    player:{x:0,y:0,vx:0,vy:0,r:13,hp:100,inv:0,dash:0,dashCd:0,dashN:0,\n"
        "            atkCd:0, aim:0, dashHits:[], leechPool:0, leechFlows:[], dreadShield:0, barrier:0, hitN:0, bladeN:0, guardianCd:0, berserkLow:false,\n"
        "            kills:0, reaper:false, trailT:0, bossSlowT:0, bossBurnT:0, bossBurnTick:0, bossBurnCause:'', bossTrailCd:0,\n"
        "            moveT:0, predT:0, critChain:0, riposte:false, swiftT:0, lowHp:false, moving:false, faceX:1, faceY:0, spriteFace:1,\n"
        "            heroWalkT:0, heroAttackT:0, heroAttackDur:0, heroSummonT:0, heroSummonDur:0,",
        "    player:{x:0,y:0,vx:0,vy:0,r:13,hp:100,inv:0,dash:0,dashCd:0,dashN:0,\n"
        "            atkCd:0, aim:0, dashHits:[], leechPool:0, leechFlows:[], dreadShield:0, barrier:0, hitN:0, bladeN:0, guardianCd:0, berserkLow:false,\n"
        "            kills:0, reaper:false, trailT:0, bossSlowT:0, bossBurnT:0, bossBurnTick:0, bossBurnCause:'', bossTrailCd:0,\n"
        "            moveT:0, predT:0, critChain:0, riposte:false, swiftT:0, lowHp:false, moving:false, faceX:1, faceY:0, spriteFace:1, heroWalkT:0,",
        "состояние анимации героя")
    html = exact_replace(html,
        "const MINION_LIFE_MIN = 10, MINION_LIFE_MAX = 15;\nfunction triggerHeroSummon(){\n  const p = G && G.player;\n  if (!p || G.weapon.id !== 'wpn.scythe' || p.heroSummonT > 0) return;\n  p.heroSummonDur = 0.48;\n  p.heroSummonT = p.heroSummonDur;\n}\n",
        "const MINION_LIFE_MIN = 10, MINION_LIFE_MAX = 15;\n",
        "таймер призыва героя")
    html = exact_replace(html, "  triggerHeroSummon();\n", "", "вызов анимации призыва")
    html = exact_replace(html,
        "  if (!src){\n    p.atkCd = D.atkCd;\n    /* Анимация должна читаться и на быстрых билдах: короткий минимум не даёт\n       четырём кадрам схлопнуться в один, повторный выстрел просто начинает цикл заново. */\n    p.heroAttackDur = Math.max(0.22, Math.min(0.42, D.atkCd * 0.75));\n    p.heroAttackT = p.heroAttackDur;\n  }",
        "  if (!src) p.atkCd = D.atkCd;",
        "таймер атаки героя")
    html = exact_replace(html,
        "  if (heroMoved > 0.01) p.heroWalkT = ((p.heroWalkT||0) + heroMoved/18) % 4;\n"
        "  p.heroAttackT = Math.max(0, (p.heroAttackT||0) - dt);\n"
        "  p.heroSummonT = Math.max(0, (p.heroSummonT||0) - dt);",
        "  // 36 единиц пути на кадр: походка читается спокойно и не дёргается.\n"
        "  if (heroMoved > 0.01) p.heroWalkT = ((p.heroWalkT||0) + heroMoved/36) % 4;",
        "скорость и таймеры анимации героя")
    old_draw = """    if (meta){
      const summoning = spriteKey === 'necromancer' && p.heroSummonT > 0;
      const attacking = spriteKey !== 'necromancer' && p.heroAttackT > 0;
      const acting = summoning || attacking;
      const actionT = summoning ? p.heroSummonT : p.heroAttackT;
      const actionDur = summoning ? p.heroSummonDur : p.heroAttackDur;
      const progress = acting ? 1 - actionT/Math.max(0.001, actionDur||0.3) : 0;
      const frame = acting ? Math.min(3, Math.floor(clamp(progress,0,0.9999)*4)) :
                    (p.moving ? Math.floor(p.heroWalkT||0)%4 : 0);
      ctx.drawImage(sprite, frame*meta.frameW, acting ? meta.frameH : 0,
        meta.frameW, meta.frameH, -meta.drawW/2, -meta.drawH/2, meta.drawW, meta.drawH);
    } else ctx.drawImage(sprite, -24, -24, 48, 48);"""
    new_draw = """    if (meta){
      const frame = p.moving ? Math.floor(p.heroWalkT||0)%4 : 0;
      ctx.drawImage(sprite, frame*meta.frameW, 0, meta.frameW, meta.frameH,
        -meta.drawW/2, -meta.drawH/2, meta.drawW, meta.drawH);
    } else ctx.drawImage(sprite, -24, -24, 48, 48);"""
    html = exact_replace(html, old_draw, new_draw, "рендер героя")

    html = exact_replace(html,
        "g.drawImage(COIN_STRIP, frame*24, 0, 24, 24, 0, 0, 48, 48);",
        "g.drawImage(COIN_STRIP, frame*8, 0, 8, 8, 0, 0, 48, 48);",
        "кадры монеты")
    html = exact_replace(html,
        "if (SHOP_COINS[i].c !== cv2 || cv2.width !== 48*d){\n      cv2.width = cv2.height = 48*d;",
        "if (SHOP_COINS[i].c !== cv2 || cv2.width !== 24*d){\n      cv2.width = cv2.height = 24*d;",
        "буфер монет")
    html = exact_replace(html,
        "g.clearRect(0,0,48,48); g.imageSmoothingEnabled = false;\n"
        "    g.drawImage(COIN_STRIP, frame*8, 0, 8, 8, 0, 0, 48, 48);",
        "g.clearRect(0,0,24,24); g.imageSmoothingEnabled = false;\n"
        "    g.drawImage(COIN_STRIP, frame*8, 0, 8, 8, 0, 0, 24, 24);",
        "отрисовка монет")
    html = exact_replace(html,
        "const g = cv3.getContext('2d'); g.clearRect(0,0,768,128); g.imageSmoothingEnabled = false;\n"
        "  g.drawImage(tiny, 0,0,192,32, 0,0,768,128);",
        "const g = cv3.getContext('2d'); g.clearRect(0,0,384,64); g.imageSmoothingEnabled = false;\n"
        "  g.drawImage(tiny, 0,0,192,32, 0,0,384,64);",
        "буфер заголовка")
    html = exact_replace(html,
        "'<div id=\"brand\"><canvas id=\"brandnm\" width=\"768\" height=\"128\"></canvas></div>';",
        "'<div id=\"brand\"><canvas id=\"brandnm\" width=\"384\" height=\"64\"></canvas></div>';",
        "canvas заголовка")
    html = exact_replace(html,
        "/* ---------- ЧАСТИЦЫ ----------\n"
        "   Мелкие квадратные пиксели, разлетающиеся из точки. Живут недолго,\n"
        "   тормозят трением и гаснут. Потолок в 700 штук держит кадр стабильным. */\n"
        "function burst(x, y, n, col, spd, size, life){\n"
        "  if (G.parts.length > 700) n = Math.min(n, 4);",
        "/* ---------- ЧАСТИЦЫ ----------\n"
        "   Декоративный поток намеренно прорежен вдвое и ограничен 300 объектами:\n"
        "   качество эффектов уступает стабильному кадру в большой толпе. */\n"
        "function burst(x, y, n, col, spd, size, life){\n"
        "  n = Math.max(1, Math.ceil(n*0.5));\n"
        "  if (G.parts.length > 300) n = Math.min(n, 2);",
        "потолок частиц")
    html = exact_replace(html,
        "    const K = MKIND[m.kind], golem = m.kind.startsWith('golem');",
        "    const K = MKIND[m.kind], golem = m.kind.startsWith('golem');\n"
        "    // Хитбокс механики остаётся m.r, но обычный приспешник рисуется 12×12.\n"
        "    const visualR = golem ? (m.kind === 'golemB' ? 12 : 9) : 6;",
        "визуальный размер свиты")
    html = exact_replace(html,
        "drawPoly(m.x, m.y, m.r, K.sides, m.rot); ctx.fill(); ctx.stroke();",
        "drawPoly(m.x, m.y, visualR, K.sides, m.rot); ctx.fill(); ctx.stroke();",
        "рендер свиты")
    html = exact_replace(html, "ctx.arc(m.x, m.y, m.r + 5, 0, 6.29)",
                         "ctx.arc(m.x, m.y, visualR + 4, 0, 6.29)", "ореол свиты")
    html = exact_replace(html,
        "      const w = m.r*2;\n"
        "      ctx.fillStyle = '#000a'; ctx.fillRect(m.x-w/2, m.y-m.r-7, w, 2);\n"
        "      ctx.fillStyle = K.col;   ctx.fillRect(m.x-w/2, m.y-m.r-7, w*clamp(m.hp/m.max,0,1), 2);",
        "      const w = visualR*2;\n"
        "      ctx.fillStyle = '#000a'; ctx.fillRect(m.x-w/2, m.y-visualR-7, w, 2);\n"
        "      ctx.fillStyle = K.col;   ctx.fillRect(m.x-w/2, m.y-visualR-7, w*clamp(m.hp/m.max,0,1), 2);",
        "полоса здоровья свиты")

    if uri_bytes(html, "FLOOR_TILE_DATA") != original_floor:
        raise SystemExit("Пол изменился, хотя исключён из оптимизации")
    HTML.write_text(html, encoding="utf-8", newline="\n")
    final_size = len(html.encode("utf-8"))
    print(f"HTML: {original_size} -> {final_size} bytes ({final_size/original_size:.1%})")
    for key, png in generated.items():
        image = Image.open(io.BytesIO(png))
        print(f"{key:13} {image.width}x{image.height} {len(png)} bytes mode={image.mode}")


if __name__ == "__main__":
    main()
