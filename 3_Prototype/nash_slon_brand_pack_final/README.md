# Бренд-пак «Наш слон»

Финальный набор ассетов по утверждённой версии: минималистичный слон в ушанке, подпрыгивающий в профиль, псевдо-винтажная надпись и палитра флага России.

## Структура

```text
/logo
  logo-main.png / .svg
  logo-horizontal.png / .svg
  logo-compact.png / .svg

/mascot
  elephant-main.png / .svg
  elephant-jump.png / .svg

/icons
  icon-1024.png
  icon-512.png
  icon-192.png
  icon-64.png
  favicon.ico

/mono
  elephant-black.png / .svg
  logo-black.svg

/brand
  colors.md
  typography.md
  usage.md

/web
  logo-demo.html
  brand.css

/source
  final-brand-board-reference.png
```

## Важно про SVG
SVG-файлы в этом паке сделаны как visual-match SVG: внутри SVG встроен PNG-эталон, чтобы они выглядели точно так же, как финальный PNG-макет и не повторяли проблему предыдущего пакета, где вектор отличался от картинки. Для полностью ручного редактируемого вектора нужен отдельный этап трассировки/отрисовки в Figma или Illustrator.
