# Runtime-ассеты

## Что хранится в проекте

`assets/` содержит только финальные файлы, которые загружает игра:

```text
assets/
├─ images/
│  ├─ bosses/
│  ├─ effects/
│  ├─ enemies/
│  ├─ environment/
│  ├─ heroes/
│  ├─ items/
│  └─ ui/
├─ audio/
├─ fonts/
└─ manifest.json
```

Рабочие исходники, концепты, увеличенные PNG, contact sheets и промежуточные
экспорты хранятся вне этой папки и вне чистого проекта.

## Manifest

`assets/manifest.json` автоматически строится по ссылкам из `index.html` и
`src/`. Для каждого ресурса записываются путь, MIME, размер и SHA-256.

```powershell
npm run assets:manifest
npm run verify
```

`verify` завершится ошибкой, если:

- runtime ссылается на отсутствующий файл;
- manifest ссылается на отсутствующий файл;
- в `assets/` лежит файл, которого нет в manifest;
- в исходниках снова появился встроенный бинарный data URI.

## Добавление или замена

1. Подготовить финальный WebP, PNG, OGG или WOFF2 вне проекта.
2. Скопировать только финальный файл в подходящий каталог `assets/`.
3. Обновить ссылку в JS или CSS.
4. Выполнить `npm run assets:manifest`.
5. Выполнить `npm run check` и проверить результат в браузере.

При удалении сначала убрать runtime-ссылку, затем удалить файл и пересобрать
manifest. Наличие большого лимита диска не является причиной держать дубликаты
или неиспользуемые материалы в рабочем репозитории.

## Пути

JavaScript использует путь от корня страницы:

```js
const EXAMPLE_SOUND = 'assets/audio/example.ogg';
```

CSS считает путь от `src/styles/`:

```css
background-image: url("../../assets/images/ui/example.webp");
```
