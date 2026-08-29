"""Детерминированная упаковка растров PolyGrind в автономный HTML.

Приоритеты: минимальный размер текстур/HTML и видеопамяти, затем качество.
Пол намеренно не затрагивается. Все игровые листы сохраняются индексированными
PNG максимум с 16 палитровыми индексами, включая прозрачный индекс.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import re
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter


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


def four_frame_sheet(path: Path, frame_size: int, padding: int) -> bytes:
    """Разделить горизонтальный источник на 4 кадра и упаковать без лишних полей."""
    source = Image.open(path).convert("RGBA")
    sheet = Image.new("RGBA", (frame_size * 4, frame_size))
    for frame_index in range(4):
        x0 = round(frame_index * source.width / 4)
        x1 = round((frame_index + 1) * source.width / 4)
        frame = fit_frame(source.crop((x0, 0, x1, source.height)),
                          (frame_size, frame_size), padding=padding)
        sheet.alpha_composite(frame, (frame_index * frame_size, 0))
    return indexed_png(sheet)


def separated_horizontal_frames(path: Path, count: int = 4) -> list[Image.Image]:
    """Вырезать персонажей по настоящим прозрачным промежуткам листа.

    Присланные листы свиты не используют равные ячейки: широкие позы и оружие
    местами пересекают границы четвертей. Проекция alpha сохраняет силуэт целиком.
    """
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
    occupied = [x for x in range(source.width)
                if alpha.crop((x, 0, x + 1, source.height)).getbbox()]
    runs: list[list[int]] = []
    for x in occupied:
        if not runs or x - runs[-1][1] > 4:
            runs.append([x, x])
        else:
            runs[-1][1] = x
    if len(runs) != count:
        raise SystemExit(f"{path.name}: ожидалось {count} силуэтов, найдено {len(runs)}")
    frames = []
    for left, right in runs:
        box = alpha.crop((left, 0, right + 1, source.height)).getbbox()
        if not box:
            raise SystemExit(f"{path.name}: пустой кадр свиты")
        frames.append(source.crop((left + box[0], box[1], left + box[2], box[3])))
    return frames


def minion_sheet(path: Path, frame_size: int) -> bytes:
    """Стабильный четырёхкадровый лист свиты в её экранном бюджете."""
    subjects = separated_horizontal_frames(path)
    canvas_size = (max(frame.width for frame in subjects),
                   max(frame.height for frame in subjects))
    aligned = []
    for subject in subjects:
        frame = Image.new("RGBA", canvas_size)
        frame.alpha_composite(subject, ((canvas_size[0] - subject.width) // 2,
                                        canvas_size[1] - subject.height))
        aligned.append(frame)
    return indexed_png(compact_stable_sheet(aligned, (frame_size, frame_size), padding=0))


def shooter_sheet(path: Path) -> bytes:
    return four_frame_sheet(path, 40, 1)


def shooter_projectile_sheet(path: Path) -> bytes:
    return four_frame_sheet(path, 8, 0)


def archer_projectile(path: Path) -> bytes:
    """Одна стрела 12×6: чуть сжимаем пропорции ради читаемого оперения в 12 px."""
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
    box = alpha.getbbox()
    if not box:
        raise SystemExit("Источник стрелы не содержит непрозрачных пикселей")
    frame = source.crop(box).resize((12, 6), Image.Resampling.NEAREST)
    return indexed_png(frame)


def mage_projectile_sheet(path: Path) -> bytes:
    return four_frame_sheet(path, 8, 0)


def plague_slime_projectile_sheet(path: Path) -> bytes:
    """Четыре фазы сгустка Чумной мерзости в экранном бюджете 20 px."""
    return four_frame_sheet(path, 20, 0)


def emerald_orb_projectile_sheet(path: Path) -> bytes:
    """Четыре фазы большой сферы Лича в экранном бюджете 32 px."""
    return four_frame_sheet(path, 32, 0)


def greed_spear_projectile_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы длинного Копья жадности по 64×20."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (64, 20), padding=0))


def executioner_axe_projectile_sheet(path: Path) -> bytes:
    """Восемь центрированных фаз вращающегося топора по 56×56."""
    subjects = separated_horizontal_frames(path, 8)
    canvas_size = (max(frame.width for frame in subjects),
                   max(frame.height for frame in subjects))
    centered = []
    for subject in subjects:
        frame = Image.new("RGBA", canvas_size)
        frame.alpha_composite(subject, ((canvas_size[0] - subject.width) // 2,
                                        (canvas_size[1] - subject.height) // 2))
        centered.append(frame)
    return indexed_png(compact_stable_sheet(centered, (56, 56), padding=1))


def minotaur_spear_projectile_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы Копья Минотавра по 64×20."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (64, 20), padding=0))


def seraph_holy_spear_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы Святого Копья по 96×32."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (96, 32), padding=0))


def demon_queen_blob_sheet(path: Path) -> bytes:
    """Четыре центрированные фазы Демонического сгустка по 32×32."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (32, 32), padding=0))


def matriarch_plague_projectile_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы Чумного снаряда Матриархии по 32×32."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (32, 32), padding=0))


def void_ground_rift_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы наземного Разлома Пустоты по 64×64."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (64, 64), padding=0))


def arcane_mine_sprite(path: Path) -> bytes:
    """Свести присланную мину к маленькому читаемому кадру 32×32."""
    source = Image.open(path).convert("RGBA")
    return indexed_png(fit_frame(source, (32, 32), padding=1))


def arcane_mine_explosion_sheet(path: Path) -> bytes:
    """Упаковать восемь фаз взрыва с единым масштабом и неподвижным центром."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 8)
    return indexed_png(compact_stable_sheet(frames, (64, 64)))


def remove_dark_background(source: Image.Image) -> Image.Image:
    """Убрать непрозрачный чёрный фон, сохранив цветные пиксели свечения."""
    rgba = source.convert("RGBA")
    pixels = []
    for red, green, blue, _ in rgba.get_flattened_data():
        high = max(red, green, blue)
        alpha = 0 if high < 30 else min(255, max(0, round((high - 24) * 5)))
        pixels.append((red, green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def compact_centered_sheet(frames: list[Image.Image],
                           frame_size: tuple[int, int], padding: int = 2) -> Image.Image:
    """Один масштаб и неподвижный центр для фаз кругового взрыва."""
    boxes = [frame.getchannel("A").point(
        lambda value: 255 if value >= 16 else 0).getbbox() for frame in frames]
    if any(box is None for box in boxes):
        raise SystemExit("Пустой кадр магического эффекта")
    shared = (min(box[0] for box in boxes), min(box[1] for box in boxes),
              max(box[2] for box in boxes), max(box[3] for box in boxes))
    width, height = shared[2] - shared[0], shared[3] - shared[1]
    ratio = min((frame_size[0] - padding * 2) / width,
                (frame_size[1] - padding * 2) / height, 1)
    size = (max(1, round(width * ratio)), max(1, round(height * ratio)))
    x = (frame_size[0] - size[0]) // 2
    y = (frame_size[1] - size[1]) // 2
    sheet = Image.new("RGBA", (frame_size[0] * len(frames), frame_size[1]))
    for index, frame in enumerate(frames):
        crop = frame.crop(shared)
        if crop.size != size:
            crop = crop.resize(size, Image.Resampling.LANCZOS)
        sheet.alpha_composite(crop, (index * frame_size[0] + x, y))
    return sheet


def mage_ability_sheet(path: Path, count: int, light_background: bool = False,
                       saturation: float = 1.0) -> bytes:
    """Очистить фон и собрать центрированный лист взрыва 64 px на кадр."""
    source = Image.open(path)
    source = remove_logo_checker(source) if light_background else remove_dark_background(source)
    if saturation != 1:
        alpha = source.getchannel("A")
        source = ImageEnhance.Color(source.convert("RGB")).enhance(saturation).convert("RGBA")
        source.putalpha(alpha)
    frames = split_horizontal_frames(source, count)
    return indexed_png(compact_centered_sheet(frames, (64, 64)))


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


def new_boss_sheet(path: Path) -> bytes:
    """Четыре больших прозрачных кадра из горизонтального исходника → 64×96 каждый."""
    source = Image.open(path).convert("RGBA")
    sheet = Image.new("RGBA", (256, 96))
    for index in range(4):
        x0 = round(index * source.width / 4)
        x1 = round((index + 1) * source.width / 4)
        frame = fit_frame(source.crop((x0, 0, x1, source.height)), (64, 96), padding=1)
        sheet.alpha_composite(frame, (index * 64, 0))
    return indexed_png(sheet)


def coin_sheet(source: Image.Image) -> bytes:
    sheet = Image.new("RGBA", (32, 8))
    for index in range(4):
        frame = source.crop((index * 24, 0, (index + 1) * 24, 24))
        frame = fit_frame(frame, (8, 8), padding=0)
        sheet.alpha_composite(frame, (index * 8, 0))
    return indexed_png(sheet)


def remove_baked_checker(source: Image.Image) -> Image.Image:
    """Удалить светлую шахматную подложку, связанную с краями кадра.

    Flood fill важен: белые зубы и блики внутри тёмного контура остаются частью
    силуэта, хотя по цвету похожи на клетки фона.
    """
    rgba = source.convert("RGBA")
    if source.mode in ("RGBA", "LA") and rgba.getchannel("A").getextrema()[0] < 255:
        return rgba
    width, height = rgba.size
    pixels = rgba.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def background(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return min(red, green, blue) >= 225 and max(red, green, blue) - min(red, green, blue) <= 14

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not outside[index] and background(x, y):
            outside[index] = 1
            queue.append((x, y))

    for x in range(width):
        seed(x, 0); seed(x, height - 1)
    for y in range(height):
        seed(0, y); seed(width - 1, y)
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            index = ny * width + nx
            if not outside[index] and background(nx, ny):
                outside[index] = 1
                queue.append((nx, ny))
    alpha = Image.new("L", rgba.size, 255)
    alpha.putdata([0 if value else 255 for value in outside])
    rgba.putalpha(alpha)
    return rgba


def remove_logo_checker(source: Image.Image) -> Image.Image:
    """Превратить светлую нарисованную шахматку логотипа в настоящую альфу.

    Тёмный металл и насыщенные огненные оттенки всегда остаются непрозрачными.
    Только нейтральные светлые пиксели считаются подложкой; промежуточные серые
    пиксели получают мягкую альфу, чтобы после очистки не осталось белого ореола.
    """
    rgba = source.convert("RGBA")
    # Новые листы приходят с настоящей прозрачностью; повторная очистка их RGB
    # превратила бы прозрачный чёрный фон в непрозрачный. Шахматку удаляем только
    # у старых полностью непрозрачных исходников.
    if rgba.getchannel("A").getextrema()[0] < 255:
        return rgba
    alpha = bytearray()
    for red, green, blue, _ in rgba.get_flattened_data():
        low, high = min(red, green, blue), max(red, green, blue)
        chroma = high - low
        if chroma > 18 or low <= 180:
            value = 255
        elif low >= 235:
            value = 0
        else:
            value = round((235 - low) / 55 * 255)
        alpha.append(value)
    rgba.putalpha(Image.frombytes("L", rgba.size, bytes(alpha)))
    return rgba


def compact_horizontal_sheet(source: Image.Image, count: int,
                             frame_size: tuple[int, int]) -> Image.Image:
    """Упаковать равноширинные кадры с общим масштабом и привязкой к низу."""
    frames: list[Image.Image] = []
    boxes: list[tuple[int, int, int, int]] = []
    for index in range(count):
        x0 = round(index * source.width / count)
        x1 = round((index + 1) * source.width / count)
        frame = source.crop((x0, 0, x1, source.height)).convert("RGBA")
        box = frame.getchannel("A").point(lambda value: 255 if value >= 16 else 0).getbbox()
        if not box:
            raise SystemExit(f"Пустой кадр меню: {index}")
        frames.append(frame)
        boxes.append(box)
    max_width = max(box[2] - box[0] for box in boxes)
    max_height = max(box[3] - box[1] for box in boxes)
    ratio = min((frame_size[0] - 4) / max_width, (frame_size[1] - 4) / max_height, 1)
    sheet = Image.new("RGBA", (frame_size[0] * count, frame_size[1]))
    for index, (frame, box) in enumerate(zip(frames, boxes)):
        crop = frame.crop(box)
        size = (max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio)))
        if size != crop.size:
            crop = crop.resize(size, Image.Resampling.LANCZOS)
        x = index * frame_size[0] + (frame_size[0] - size[0]) // 2
        y = frame_size[1] - 2 - size[1]
        sheet.alpha_composite(crop, (x, y))
    return sheet


def split_horizontal_frames(source: Image.Image, count: int) -> list[Image.Image]:
    """Разрезать горизонтальный лист, сохранив исходные координаты кадров."""
    frames = []
    width = max(round((index + 1) * source.width / count) -
                round(index * source.width / count) for index in range(count))
    for index in range(count):
        x0 = round(index * source.width / count)
        x1 = round((index + 1) * source.width / count)
        frame = Image.new("RGBA", (width, source.height))
        frame.alpha_composite(source.crop((x0, 0, x1, source.height)).convert("RGBA"))
        frames.append(frame)
    return frames


def align_frames(frames: list[Image.Image], anchor_box) -> list[Image.Image]:
    """Совместить кадры по центру и низу неподвижной части изображения."""
    boxes = [anchor_box(frame) for frame in frames]
    if any(box is None for box in boxes):
        raise SystemExit("Не найдена неподвижная часть кадра меню")
    reference = boxes[0]
    reference_x = (reference[0] + reference[2]) / 2
    aligned = []
    for frame, box in zip(frames, boxes):
        x = round(reference_x - (box[0] + box[2]) / 2)
        y = reference[3] - box[3]
        placed = Image.new("RGBA", frame.size)
        placed.alpha_composite(frame, (x, y))
        aligned.append(placed)
    return aligned


def compact_stable_sheet(frames: list[Image.Image],
                         frame_size: tuple[int, int], padding: int = 2) -> Image.Image:
    """Уменьшить все кадры через одну общую рамку и один transform.

    Разная высота пламени или подсветки больше не меняет масштаб и положение
    корпуса факела либо букв логотипа между соседними кадрами.
    """
    boxes = [frame.getchannel("A").point(
        lambda value: 255 if value >= 16 else 0).getbbox() for frame in frames]
    if any(box is None for box in boxes):
        raise SystemExit("Пустой стабилизированный кадр меню")
    shared = (min(box[0] for box in boxes), min(box[1] for box in boxes),
              max(box[2] for box in boxes), max(box[3] for box in boxes))
    width, height = shared[2] - shared[0], shared[3] - shared[1]
    ratio = min((frame_size[0] - padding * 2) / width,
                (frame_size[1] - padding * 2) / height, 1)
    size = (max(1, round(width * ratio)), max(1, round(height * ratio)))
    x = (frame_size[0] - size[0]) // 2
    y = frame_size[1] - padding - size[1]
    sheet = Image.new("RGBA", (frame_size[0] * len(frames), frame_size[1]))
    for index, frame in enumerate(frames):
        crop = frame.crop(shared)
        if crop.size != size:
            crop = crop.resize(size, Image.Resampling.LANCZOS)
        sheet.alpha_composite(crop, (index * frame_size[0] + x, y))
    return sheet


def stable_logo_frames(source: Image.Image) -> list[Image.Image]:
    """Оставить геометрию вывески неподвижной, перенеся лишь свет кадров."""
    frames = split_horizontal_frames(source, 8)
    alpha_box = lambda frame: frame.getchannel("A").point(
        lambda value: 255 if value >= 16 else 0).getbbox()
    frames = align_frames(frames, alpha_box)
    master = frames[0]
    master_blur = master.filter(ImageFilter.GaussianBlur(radius=10)).convert("RGB")
    master_pixels = list(master.get_flattened_data())
    master_light = list(master_blur.get_flattened_data())
    stable = []
    for frame in frames:
        source_light = list(frame.filter(ImageFilter.GaussianBlur(
            radius=10)).convert("RGB").get_flattened_data())
        pixels = []
        for base, dark, lit in zip(master_pixels, master_light, source_light):
            red, green, blue, alpha = base
            if alpha == 0:
                pixels.append((0, 0, 0, 0))
                continue
            channels = []
            for value, base_light, frame_light in zip((red, green, blue), dark, lit):
                ratio = max(0.55, min(2.35, (frame_light + 12) / (base_light + 12)))
                channels.append(max(0, min(255, round(value * ratio))))
            pixels.append((*channels, alpha))
        result = Image.new("RGBA", master.size)
        result.putdata(pixels)
        stable.append(result)
    return stable


def stable_torch_frames(source: Image.Image) -> list[Image.Image]:
    """Повторить один корпус факела и анимировать только пламя и его жар."""
    frames = split_horizontal_frames(source, 8)
    lower_start = round(source.height * 0.55)

    def body_box(frame: Image.Image):
        alpha = frame.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
        mask = Image.new("L", frame.size)
        mask.paste(alpha.crop((0, lower_start, frame.width, frame.height)),
                   (0, lower_start))
        return mask.getbbox()

    frames = align_frames(frames, body_box)
    flame_top = round(source.height * 0.30)
    flame_bottom = round(source.height * 0.56)

    def fire_mask(frame: Image.Image) -> Image.Image:
        mask = Image.new("L", frame.size)
        source_pixels = frame.load()
        target_pixels = mask.load()
        for y in range(frame.height):
            for x in range(frame.width):
                red, green, blue, alpha = source_pixels[x, y]
                warm = (y < flame_bottom and red >= 45 and
                        red > green * 1.10 and green > blue * 1.04)
                if alpha >= 16 and (y < flame_top or warm):
                    target_pixels[x, y] = alpha
        return mask

    master = frames[0]
    master_fire = fire_mask(master)
    body = master.copy()
    body.putalpha(ImageChops.subtract(master.getchannel("A"), master_fire))
    stable = []
    for frame in frames:
        result = body.copy()
        flame = Image.new("RGBA", frame.size)
        flame.paste(frame, mask=fire_mask(frame))
        result.alpha_composite(flame)
        stable.append(result)
    return stable


def menu_logo_sheet(path: Path) -> bytes:
    source = remove_logo_checker(Image.open(path))
    return indexed_png(compact_stable_sheet(stable_logo_frames(source), (256, 96)))


def menu_torch_sheet(path: Path) -> bytes:
    source = Image.open(path).convert("RGBA")
    return indexed_png(compact_stable_sheet(stable_torch_frames(source), (72, 192)))


def elite_variant_sheet(path: Path) -> bytes:
    """Четыре кадра элитной разновидности → компактный лист 192×48."""
    source = remove_baked_checker(Image.open(path))
    sheet = Image.new("RGBA", (192, 48))
    for index in range(4):
        x0 = round(index * source.width / 4)
        x1 = round((index + 1) * source.width / 4)
        frame = fit_frame(source.crop((x0, 0, x1, source.height)), (48, 48), padding=1)
        sheet.alpha_composite(frame, (index * 48, 0))
    return indexed_png(sheet)


def install_object_payloads(html: str, object_name: str, payload: dict[str, str]) -> str:
    """Добавить или заменить data URI внутри автономного JS-объекта."""
    match = re.search(rf"const {re.escape(object_name)} = \{{.*?\n\}};", html, flags=re.S)
    if not match:
        raise SystemExit(f"Не найден объект {object_name}")
    body = match.group(0)
    for key, value in payload.items():
        entry = f"  {key}:'data:image/png;base64,{value}',"
        pattern = rf"^\s*{re.escape(key)}:'data:image/png;base64,[^']+',\s*$"
        if re.search(pattern, body, flags=re.M):
            body = re.sub(pattern, entry, body, count=1, flags=re.M)
        else:
            body = body[:-3] + entry + "\n};"
    return html[:match.start()] + body + html[match.end():]


def constellation_sheets(path: Path) -> dict[str, bytes]:
    """Два ряда по четыре кадра: убрать тёмный фон и собрать 4×48 для UI."""
    source = Image.open(path).convert("RGBA")
    if source.size != (1536, 1024):
        raise SystemExit("Лист созвездий должен быть 1536×1024")
    result = {}
    for key, row in (("elite", 0), ("boss", 1)):
        sheet = Image.new("RGBA", (192, 48))
        for index in range(4):
            cell = source.crop((index * 384, row * 512, (index + 1) * 384, (row + 1) * 512))
            red, green, blue, _ = cell.split()
            luminance = ImageChops.lighter(ImageChops.lighter(red, green), blue)
            mask = luminance.point(lambda value: 255 if value >= 105 else 0).filter(ImageFilter.MaxFilter(17))
            box = mask.getbbox()
            if not box:
                raise SystemExit(f"Пустой кадр созвездия: {key} {index}")
            crop, crop_mask = cell.crop(box), mask.crop(box)
            crop.putalpha(crop_mask)
            ratio = min(46 / crop.width, 46 / crop.height)
            size = (max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio)))
            crop = crop.resize(size, Image.Resampling.NEAREST)
            frame = Image.new("RGBA", (48, 48))
            frame.alpha_composite(crop, ((48 - size[0]) // 2, 47 - size[1]))
            sheet.alpha_composite(frame, (index * 48, 0))
        result[key] = indexed_png(sheet)
    return result


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
    parser.add_argument("--archer", type=Path)
    parser.add_argument("--mage", type=Path)
    parser.add_argument("--warrior", type=Path)
    parser.add_argument("--necromancer", type=Path)
    parser.add_argument("--shooter", type=Path)
    parser.add_argument("--shooter-projectile", type=Path)
    parser.add_argument("--archer-projectile", type=Path)
    parser.add_argument("--mage-projectile", type=Path)
    parser.add_argument("--plague-slime-projectile", type=Path)
    parser.add_argument("--emerald-orb-projectile", type=Path)
    parser.add_argument("--greed-spear-projectile", type=Path)
    parser.add_argument("--executioner-axe-projectile", type=Path)
    parser.add_argument("--minotaur-spear-projectile", type=Path)
    parser.add_argument("--seraph-holy-spear", type=Path)
    parser.add_argument("--demon-queen-blob", type=Path)
    parser.add_argument("--matriarch-plague-projectile", type=Path)
    parser.add_argument("--void-ground-rift", type=Path)
    parser.add_argument("--arcane-mine", type=Path)
    parser.add_argument("--arcane-mine-explosion", type=Path)
    parser.add_argument("--necro-skeleton", type=Path)
    parser.add_argument("--necro-hunter", type=Path)
    parser.add_argument("--necro-mage", type=Path)
    parser.add_argument("--necro-blood-golem", type=Path)
    parser.add_argument("--necro-bone-golem", type=Path)
    parser.add_argument("--mage-explosion-normal", type=Path)
    parser.add_argument("--mage-explosion-remote", type=Path)
    parser.add_argument("--mage-explosion-mini", type=Path)
    parser.add_argument("--mage-residual-arcana", type=Path)
    parser.add_argument("--mage-elemental-explosion", type=Path)
    parser.add_argument("--mage-blast-heart", type=Path)
    parser.add_argument("--vampire-boss", type=Path)
    parser.add_argument("--void-wrath-boss", type=Path)
    parser.add_argument("--minotaur-boss", type=Path)
    parser.add_argument("--seraph-boss", type=Path)
    parser.add_argument("--matriarch-boss", type=Path)
    parser.add_argument("--demon-queen-boss", type=Path)
    parser.add_argument("--constellation-sheet", type=Path)
    parser.add_argument("--ice-wolf", type=Path)
    parser.add_argument("--toxic-runner", type=Path)
    parser.add_argument("--cursed-rogue", type=Path)
    parser.add_argument("--skeleton-warrior", type=Path)
    parser.add_argument("--blight-grunt", type=Path)
    parser.add_argument("--bone-gargoyle", type=Path)
    parser.add_argument("--pyromancer-cultist", type=Path)
    parser.add_argument("--beholder-slave", type=Path)
    parser.add_argument("--skeleton-crossbow", type=Path)
    parser.add_argument("--forgotten-guard", type=Path)
    parser.add_argument("--abyssal-warden", type=Path)
    parser.add_argument("--acid-carrier", type=Path)
    parser.add_argument("--menu-logo", type=Path)
    parser.add_argument("--menu-torch", type=Path)
    parser.add_argument("--build-menu-assets", action="store_true",
                        help="записать компактные прозрачные листы логотипа и факела в outputs")
    parser.add_argument("--install-menu-assets", action="store_true",
                        help="собрать листы меню и встроить их data URI в автономный HTML")
    parser.add_argument("--emit-shooter-base64", action="store_true",
                        help="вывести JSON двух оптимизированных data payload без изменения HTML")
    parser.add_argument("--emit-player-projectile-base64", action="store_true",
                        help="вывести JSON стрелы и сферы без изменения HTML")
    parser.add_argument("--build-plague-slime-projectile", action="store_true",
                        help="записать четырёхкадровый сгусток Чумной мерзости в outputs")
    parser.add_argument("--install-plague-slime-projectile", action="store_true",
                        help="упаковать и встроить сгусток Чумной мерзости в HTML")
    parser.add_argument("--build-emerald-orb-projectile", action="store_true",
                        help="записать четырёхкадровую Изумрудную сферу в outputs")
    parser.add_argument("--install-emerald-orb-projectile", action="store_true",
                        help="упаковать и встроить Изумрудную сферу Лича в HTML")
    parser.add_argument("--build-greed-spear-projectile", action="store_true",
                        help="записать четырёхкадровое Копьё жадности в outputs")
    parser.add_argument("--install-greed-spear-projectile", action="store_true",
                        help="упаковать и встроить Копьё жадности Алчного громилы в HTML")
    parser.add_argument("--build-executioner-axe-projectile", action="store_true",
                        help="записать восьмикадровый вращающийся топор в outputs")
    parser.add_argument("--install-executioner-axe-projectile", action="store_true",
                        help="упаковать и встроить топор Короля палачей в HTML")
    parser.add_argument("--build-minotaur-spear-projectile", action="store_true",
                        help="записать четырёхкадровое Копьё Минотавра в outputs")
    parser.add_argument("--install-minotaur-spear-projectile", action="store_true",
                        help="упаковать и встроить копьё Ужасающего Минотавра в HTML")
    parser.add_argument("--build-seraph-holy-spear", action="store_true",
                        help="записать четырёхкадровое Святое Копьё в outputs")
    parser.add_argument("--install-seraph-holy-spear", action="store_true",
                        help="упаковать и встроить Святое Копьё Падшего Серафима в HTML")
    parser.add_argument("--build-demon-queen-blob", action="store_true",
                        help="записать четырёхкадровый Демонический сгусток в outputs")
    parser.add_argument("--install-demon-queen-blob", action="store_true",
                        help="упаковать и встроить сгусток Демонической Королевы в HTML")
    parser.add_argument("--build-matriarch-plague-projectile", action="store_true",
                        help="записать четырёхкадровый Чумной снаряд в outputs")
    parser.add_argument("--install-matriarch-plague-projectile", action="store_true",
                        help="упаковать и встроить Чумной снаряд Матриархии в HTML")
    parser.add_argument("--build-void-ground-rift", action="store_true",
                        help="записать четырёхкадровый наземный Разлом Пустоты в outputs")
    parser.add_argument("--install-void-ground-rift", action="store_true",
                        help="упаковать и встроить разломы Гнева Пустоты в HTML")
    parser.add_argument("--build-arcane-mine-assets", action="store_true",
                        help="записать компактные кадры Арканной мины в outputs")
    parser.add_argument("--build-minion-assets", action="store_true",
                        help="записать пять компактных листов свиты в outputs")
    parser.add_argument("--install-minion-assets", action="store_true",
                        help="упаковать и встроить пять листов свиты в автономный HTML")
    parser.add_argument("--build-mage-ability-assets", action="store_true",
                        help="записать шесть компактных листов взрывов Мага в outputs")
    parser.add_argument("--install-mage-ability-assets", action="store_true",
                        help="упаковать и встроить шесть листов взрывов Мага в HTML")
    parser.add_argument("--emit-new-boss-base64", action="store_true",
                        help="вывести JSON шести новых листов боссов без изменения HTML")
    parser.add_argument("--emit-constellation-base64", action="store_true",
                        help="вывести JSON листов элиты и босса для созвездий")
    parser.add_argument("--emit-elite-variant-base64", action="store_true",
                        help="вывести JSON шести оптимизированных разновидностей элиты")
    parser.add_argument("--install-elite-variants", action="store_true",
                        help="упаковать шесть разновидностей элиты прямо в автономный HTML")
    parser.add_argument("--emit-elite-ranged-tank-base64", action="store_true",
                        help="вывести JSON шести оптимизированных ranged/tank разновидностей элиты")
    parser.add_argument("--install-elite-ranged-tank", action="store_true",
                        help="добавить шесть ranged/tank разновидностей элиты в автономный HTML")
    args = parser.parse_args()

    if args.build_void_ground_rift or args.install_void_ground_rift:
        if not args.void_ground_rift:
            parser.error("Наземный Разлом Пустоты требует --void-ground-rift")
        generated = void_ground_rift_sheet(args.void_ground_rift)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "void-wrath-ground-rift-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_void_ground_rift:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const VOID_GROUND_RIFT_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"VOID_GROUND_RIFT_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_matriarch_plague_projectile or args.install_matriarch_plague_projectile:
        if not args.matriarch_plague_projectile:
            parser.error("Чумной снаряд требует --matriarch-plague-projectile")
        generated = matriarch_plague_projectile_sheet(args.matriarch_plague_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "plague-matriarch-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_matriarch_plague_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const MATRIARCH_PLAGUE_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"MATRIARCH_PLAGUE_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_demon_queen_blob or args.install_demon_queen_blob:
        if not args.demon_queen_blob:
            parser.error("Демонический сгусток требует --demon-queen-blob")
        generated = demon_queen_blob_sheet(args.demon_queen_blob)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "demon-queen-blob-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_demon_queen_blob:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const DEMON_QUEEN_BLOB_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"DEMON_QUEEN_BLOB_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_seraph_holy_spear or args.install_seraph_holy_spear:
        if not args.seraph_holy_spear:
            parser.error("Святое Копьё требует --seraph-holy-spear")
        generated = seraph_holy_spear_sheet(args.seraph_holy_spear)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "fallen-seraph-holy-spear-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_seraph_holy_spear:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const SERAPH_HOLY_SPEAR_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"SERAPH_HOLY_SPEAR_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_minotaur_spear_projectile or args.install_minotaur_spear_projectile:
        if not args.minotaur_spear_projectile:
            parser.error("Копьё Минотавра требует --minotaur-spear-projectile")
        generated = minotaur_spear_projectile_sheet(args.minotaur_spear_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "dread-minotaur-spear-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_minotaur_spear_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const MINOTAUR_SPEAR_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"MINOTAUR_SPEAR_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_executioner_axe_projectile or args.install_executioner_axe_projectile:
        if not args.executioner_axe_projectile:
            parser.error("Вращающийся топор требует --executioner-axe-projectile")
        generated = executioner_axe_projectile_sheet(args.executioner_axe_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "executioner-king-spinning-axe-8f-optimized.png"
        path.write_bytes(generated)
        if args.install_executioner_axe_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const EXECUTIONER_AXE_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"EXECUTIONER_AXE_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_greed_spear_projectile or args.install_greed_spear_projectile:
        if not args.greed_spear_projectile:
            parser.error("Копьё жадности требует --greed-spear-projectile")
        generated = greed_spear_projectile_sheet(args.greed_spear_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "greed-brute-spear-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_greed_spear_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const GREED_SPEAR_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"GREED_SPEAR_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_emerald_orb_projectile or args.install_emerald_orb_projectile:
        if not args.emerald_orb_projectile:
            parser.error("Изумрудная сфера требует --emerald-orb-projectile")
        generated = emerald_orb_projectile_sheet(args.emerald_orb_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "emerald-lich-orb-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_emerald_orb_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const EMERALD_ORB_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"EMERALD_ORB_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_plague_slime_projectile or args.install_plague_slime_projectile:
        if not args.plague_slime_projectile:
            parser.error("сгусток Чумной мерзости требует --plague-slime-projectile")
        generated = plague_slime_projectile_sheet(args.plague_slime_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "plague-abomination-slime-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_plague_slime_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const PLAGUE_SLIME_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"PLAGUE_SLIME_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_mage_ability_assets or args.install_mage_ability_assets:
        sources = {
            "normal": (args.mage_explosion_normal, 6, False, 1.0),
            "remote": (args.mage_explosion_remote, 6, True, 1.0),
            "mini": (args.mage_explosion_mini, 6, False, 1.0),
            "residual": (args.mage_residual_arcana, 4, True, 1.0),
            # Цвет специально приглушён; умеренная прозрачность задаётся renderer-ом.
            "elemental": (args.mage_elemental_explosion, 8, False, 0.45),
            "heart": (args.mage_blast_heart, 4, True, 1.0),
        }
        missing = [key for key, (path, _, _, _) in sources.items() if not path]
        if missing:
            parser.error("листы взрывов Мага: отсутствуют " + ", ".join(missing))
        generated = {key: mage_ability_sheet(path, count, light, saturation)
                     for key, (path, count, light, saturation) in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"mage-{key}-explosion-optimized.png"
                 for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_mage_ability_assets:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            body = "const MAGE_ABILITY_SPRITE_DATA = {\n" + "\n".join(
                f"  {key}:'data:image/png;base64,{value}',"
                for key, value in payload.items()) + "\n};"
            html, count = re.subn(r"const MAGE_ABILITY_SPRITE_DATA = \{.*?\n\};",
                                  body, html, flags=re.S)
            if count != 1:
                raise SystemExit(f"MAGE_ABILITY_SPRITE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({key: {"path": str(paths[key]), "bytes": len(data),
                                "size": Image.open(io.BytesIO(data)).size}
                          for key, data in generated.items()}, separators=(",", ":")))
        return

    if args.build_minion_assets or args.install_minion_assets:
        sources = {
            "skeleton": (args.necro_skeleton, 24),
            "hunter": (args.necro_hunter, 24),
            "warlock": (args.necro_mage, 24),
            "golemB": (args.necro_blood_golem, 24),
            "golemN": (args.necro_bone_golem, 18),
        }
        missing = [key for key, (path, _) in sources.items() if not path]
        if missing:
            parser.error("листы свиты: отсутствуют " + ", ".join(missing))
        generated = {key: minion_sheet(path, size)
                     for key, (path, size) in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"necro-{key}-4f-optimized.png"
                 for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_minion_assets:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            body = "const MINION_SPRITE_DATA = {\n" + "\n".join(
                f"  {key}:'data:image/png;base64,{value}',"
                for key, value in payload.items()) + "\n};"
            html, count = re.subn(r"const MINION_SPRITE_DATA = \{.*?\n\};",
                                  body, html, flags=re.S)
            if count != 1:
                raise SystemExit(f"MINION_SPRITE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({key: {"path": str(paths[key]), "bytes": len(data),
                                "size": Image.open(io.BytesIO(data)).size}
                          for key, data in generated.items()}, separators=(",", ":")))
        return

    if args.build_arcane_mine_assets:
        if not args.arcane_mine or not args.arcane_mine_explosion:
            parser.error("--build-arcane-mine-assets требует оба ассета мины")
        generated = {
            "mine": arcane_mine_sprite(args.arcane_mine),
            "explosion": arcane_mine_explosion_sheet(args.arcane_mine_explosion),
        }
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {
            "mine": output_dir / "mage-arcane-mine-optimized.png",
            "explosion": output_dir / "mage-arcane-mine-explosion-8f-optimized.png",
        }
        for key, path in paths.items():
            path.write_bytes(generated[key])
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_menu_assets or args.install_menu_assets:
        if not args.menu_logo or not args.menu_torch:
            parser.error("ассеты меню требуют --menu-logo и --menu-torch")
        generated = {
            "logo": menu_logo_sheet(args.menu_logo),
            "torch": menu_torch_sheet(args.menu_torch),
        }
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {
            "logo": output_dir / "grim-grind-title-spritesheet-optimized.png",
            "torch": output_dir / "grim-grind-torch-spritesheet-optimized.png",
        }
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_menu_assets:
            html = HTML.read_text(encoding="utf-8")
            for key, js_name in (("logo", "GRIM_GRIND_LOGO_STRIP"),
                                 ("torch", "GRIM_GRIND_TORCH_STRIP")):
                pattern = rf"({js_name}\.src = 'data:image/png;base64,)[^']+(')"
                value = base64.b64encode(generated[key]).decode("ascii")
                html, count = re.subn(pattern, rf"\g<1>{value}\2", html, count=1)
                if count != 1:
                    raise SystemExit(f"{js_name}: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    elite_sources = {
        "frostWolf": args.ice_wolf,
        "toxicRunner": args.toxic_runner,
        "cursedRogue": args.cursed_rogue,
        "skeletonWarrior": args.skeleton_warrior,
        "blightGrunt": args.blight_grunt,
        "boneGargoyle": args.bone_gargoyle,
    }
    if args.emit_elite_variant_base64 or args.install_elite_variants:
        missing = [key for key, path in elite_sources.items() if not path]
        if missing:
            parser.error("elite variants: отсутствуют " + ", ".join(missing))
        generated = {key: elite_variant_sheet(path) for key, path in elite_sources.items()}
        payload = {key: base64.b64encode(data).decode("ascii") for key, data in generated.items()}
        if args.emit_elite_variant_base64:
            print(json.dumps(payload, separators=(",", ":")))
            return
        html = HTML.read_text(encoding="utf-8")
        body = "const ELITE_SPRITE_DATA = {\n" + "\n".join(
            f"  {key}:'data:image/png;base64,{value}'," for key, value in payload.items()
        ) + "\n};"
        html, count = re.subn(r"const ELITE_SPRITE_DATA = \{.*?\n\};", body, html, flags=re.S)
        if count != 1:
            raise SystemExit(f"ELITE_SPRITE_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8")
        print(json.dumps({key: len(data) for key, data in generated.items()}, separators=(",", ":")))
        return

    ranged_tank_sources = {
        "fallenPyromancer": args.pyromancer_cultist,
        "beholderSlave": args.beholder_slave,
        "skeletonCrossbow": args.skeleton_crossbow,
        "forgottenGuard": args.forgotten_guard,
        "abyssalExecutioner": args.abyssal_warden,
        "plagueOgre": args.acid_carrier,
    }
    if args.emit_elite_ranged_tank_base64 or args.install_elite_ranged_tank:
        missing = [key for key, path in ranged_tank_sources.items() if not path]
        if missing:
            parser.error("elite ranged/tank: отсутствуют " + ", ".join(missing))
        generated = {key: elite_variant_sheet(path) for key, path in ranged_tank_sources.items()}
        payload = {key: base64.b64encode(data).decode("ascii") for key, data in generated.items()}
        if args.emit_elite_ranged_tank_base64:
            print(json.dumps(payload, separators=(",", ":")))
            return
        html = HTML.read_text(encoding="utf-8")
        html = install_object_payloads(html, "ELITE_SPRITE_DATA", payload)
        HTML.write_text(html, encoding="utf-8")
        print(json.dumps({key: len(data) for key, data in generated.items()}, separators=(",", ":")))
        return

    if args.emit_shooter_base64:
        if not args.shooter or not args.shooter_projectile:
            parser.error("--emit-shooter-base64 требует --shooter и --shooter-projectile")
        payload = {
            "shooter": base64.b64encode(shooter_sheet(args.shooter)).decode("ascii"),
            "shooterProjectile": base64.b64encode(
                shooter_projectile_sheet(args.shooter_projectile)).decode("ascii"),
        }
        print(json.dumps(payload, separators=(",", ":")))
        return

    if args.emit_player_projectile_base64:
        if not args.archer_projectile or not args.mage_projectile:
            parser.error("--emit-player-projectile-base64 требует --archer-projectile и --mage-projectile")
        payload = {
            "archerProjectile": base64.b64encode(
                archer_projectile(args.archer_projectile)).decode("ascii"),
            "mageProjectile": base64.b64encode(
                mage_projectile_sheet(args.mage_projectile)).decode("ascii"),
        }
        print(json.dumps(payload, separators=(",", ":")))
        return

    if args.emit_new_boss_base64:
        sources = {
            "vampire": args.vampire_boss,
            "voidwrath": args.void_wrath_boss,
            "minotaur": args.minotaur_boss,
            "seraph": args.seraph_boss,
            "matriarch": args.matriarch_boss,
            "demonqueen": args.demon_queen_boss,
        }
        missing = [key for key, path in sources.items() if not path]
        if missing:
            parser.error("--emit-new-boss-base64: отсутствуют " + ", ".join(missing))
        payload = {key: base64.b64encode(new_boss_sheet(path)).decode("ascii")
                   for key, path in sources.items()}
        print(json.dumps(payload, separators=(",", ":")))
        return

    if args.emit_constellation_base64:
        if not args.constellation_sheet:
            parser.error("--emit-constellation-base64 требует --constellation-sheet")
        payload = {key: base64.b64encode(data).decode("ascii")
                   for key, data in constellation_sheets(args.constellation_sheet).items()}
        print(json.dumps(payload, separators=(",", ":")))
        return

    if not all((args.archer, args.mage, args.warrior, args.necromancer)):
        parser.error("полный прогон требует --archer, --mage, --warrior и --necromancer")

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
