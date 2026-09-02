# Архитектура Grim Grind

## Принцип

Игра является статическим многофайловым сайтом без обязательного bundler.
`index.html` только создаёт DOM и подключает стили и игровые скрипты. Код,
оформление и бинарные ресурсы всегда хранятся отдельно.

```text
index.html
├─ src/styles/*.css
│  └─ assets/fonts + assets/images
└─ src/game/*.js (порядок задаёт index.html)
   ├─ данные и инфраструктура
   ├─ состояние и механики
   ├─ update/render/UI
   └─ input-and-bootstrap.js → Store.load() → startScreen() → loop()
```

Скрипты пока подключаются как classic scripts и используют общий глобальный
контекст. Это сохраняет рабочие связи старого runtime. Переход на ES modules
нужно выполнять по одной подсистеме с явным API и профильными тестами.

## Подсистемы

- `localization-and-audio.js` — локализация и звук.
- `core-and-assets.js` — каталоги URL, геометрия, Canvas helpers и preload.
- `inventory-and-progression.js` — предметы и прогресс.
- `game-state.js` — создание забега и производные характеристики.
- `world-generation.js` — этажи и существа.
- `combat.js` — общий путь урона, лечения и состояний.
- `minions-and-orbs.js`, `player-attacks.js` — классовая боевая логика.
- `game-loop.js` — порядок обновления симуляции.
- `rendering.js` — Canvas-представление.
- `interface.js` — DOM HUD и игровые окна.
- `metagame.js`, `start-screen.js` — экраны вне боя.
- `input-and-bootstrap.js` — ввод и запуск приложения.

## Инварианты

1. Таймеры симуляции используют `dt`, а не количество кадров.
2. Canvas world и DOM HUD имеют разные координатные пространства.
3. Производные характеристики `D` пересчитываются через `recalc()`.
4. Пользовательский текст существует одновременно в EN/RU.
5. Runtime не содержит base64/data URI и сетевых CDN.
6. Каждый файл из `assets/` упомянут runtime и перечислен в manifest.
7. Порядок JS в `index.html` совпадает с порядком Node-harness.

## Как искать код

```powershell
rg -n "function hurt|function damage|const MODS" src/game
rg -n "#pauseov|\.card" src/styles
rg -n "assets/" src index.html
```

Ориентируйтесь по именам функций, констант и подсистем, а не по номерам строк.
