# Мой хаб веб-проектов · Neo-Brutalist

Единый портал для веб-игр, экспериментов и Minecraft-скинов. Стиль — Neo-Brutalist: жирные чёрные обводки, offset-тени, кислотные акценты на кремовом фоне.

## Структура

```

/
├── index.html          ← хаб + inline SVG-спрайт иконок проектов
├── hub.css             ← Neo-Brutalist стили
├── hub.js
├── projects.json       ← манифест проектов (icon, iconSvg, color)
├── skins.json          ← манифест скинов
├── icon.svg
├── .nojekyll
├── skins/              ← PNG-файлы скинов (64×64)
└── projects/
├── lux-7/
├── arcanum/
└── orbis/

```

## Как добавить проект

1. Создать папку `projects/<id>/`, положить `index.html` + файлы.
2. Добавить запись в `projects.json`:

```json
{
  "id": "my-game",
  "name": "Моя игра",
  "desc": "Короткое описание.",
  "path": "projects/my-game/",
  "icon": "🎮",
  "iconSvg": "g-my-game",
  "color": "green",
  "tags": ["arcade", "2d"],
  "accent": "#22c55e",
  "added": "2026-11-04"
}
```

Поля:

| Поле ↕▾ | Что это ↕▾ |
|---|---|
| −`id` | Уникальный ID (латиница, без пробелов) |
| `name` | Название |
| `desc` | Описание |
| `path` | Путь до папки с завершающим слэшем |
| `icon` | Fallback: emoji или inline SVG (`<svg>...</svg>`) |
| `iconSvg` | ID `<symbol>` из SVG-спрайта (см. ниже) — приоритетнее `icon` |
| `color` | Цвет карточки: `yellow` `pink` `blue` `green` `orange` `purple` |
| `tags` | Массив тегов |
| `accent` | HEX-акцент (для совместимости) |
| `added` | Дата `YYYY-MM-DD` |
⚙

## SVG-иконки проектов

Иконки лежат в inline-спрайте в начале `<body>` файла `index.html`:

```
<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
     style="position:absolute;width:0;height:0;overflow:hidden">
  <symbol id="g-lux7" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <path d="M11 11 L21 11 L15 22" fill="none" stroke="currentColor"
          stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <!-- ... -->
</svg>
```

**Правила для новых иконок:**

- `viewBox="0 0 32 32"` — обязательно (иначе иконка сломается в карточке)
- `stroke="currentColor"` / `fill="currentColor"` — иконка адаптируется под цвет
- `stroke-width` в диапазоне `2–3` — соответствует бруталистской обводке
- `id` начинается с `g-` — соглашение проекта
- Не более 3–4 элементов на иконку — минимализм работает лучше

**Как использовать:** в `projects.json` пиши `"iconSvg": "g-мой-id"` — значение совпадает с `id` в `<symbol>`.

**Если нужно быстро без SVG:** оставь `icon` (emoji). Он используется как fallback, если `iconSvg` не указан.

## Как обновить проект

Заменить содержимое папки `projects/<id>/`. `projects.json` менять не нужно — хаб делает HEAD-запрос к `index.html`, берёт `Last-Modified` и подставляет `?v=...` в URL iframe.

## Как добавить скин

1. PNG в `skins/`.
2. Запись в `skins.json`:

```
{
  "id": "my-skin",
  "name": "Мой скин",
  "file": "skins/my-skin.png",
  "description": "Описание",
  "skinLink": "https://ely.by/skins/s4498215",
  "author": "BebriK118",
  "authorLink": "https://ely.by/u5114276"
}
```

## Локальная разработка

```
python3 -m http.server 8000
```

Затем `http://localhost:8000/` — по HTTP, не file://, иначе не работает `fetch('projects.json')`.

## Деплой (GitHub Pages)

1. Push в репо
2. Settings → Pages → Branch: `main`, Folder: `/ (root)`
3. Через 30–60 секунд доступно на `https://<юзер>.github.io/<репо>/`

`.nojekyll` в корне нужен, чтобы GitHub Pages не прогонял сайт через Jekyll и не игнорировал папки, начинающиеся с `_`.

## Возможности хаба

- 🔍 Поиск по названию / описанию / тегам
- 🏷️ Фильтр по категориям (авто из `tags`)
- ★ Избранное (`localStorage`)
- 🕒 Недавние (последние 12)
- 🎨 Скины: 3D через `skinview3d`, кнопка скачать, ссылки на ely.by
- ⌨️ Клавиши: `/` — поиск, `Esc` — закрыть, `1–9` — запустить N-й проект
- 🔗 Прямые ссылки: `/#project=lux-7`, `/#skin=bebrik118`
- 🎨 Neo-Brutalist: цветные карточки, SVG-иконки, offset-тени
- 📱 Адаптивно

## Тонкости

- **PWA-установка** внутри iframe не работает — используй «Новая вкладка».
- **Service Worker** в iframe не регистрируется.
- **localStorage** общий на домен, но у проектов разные префиксы (`lux7_*`, `arcanum_*`).
- **skinview3d** загружается с `cdn.jsdelivr.net`; если браузер без WebGL2 — скин показывается как 2D-пиксель-арт.

