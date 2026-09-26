# 001 — Шлифовка движения: частые анимации короче, зум только под курсор, отклик избранного

Коммит на момент аудита: `4d88ea9` · аудит `improve-animations`, 26.09.2026 · статус: выполнен (коммит — см. git log)

## Зачем

Каталог маркетплейса — самое частое место на сайте: фильтр и страницу выдачи
меняют десятки раз за визит. Анимации там должны укладываться в бюджет
интерфейса (до 300 мс), иначе выдача ощущается медленной. Зум фото при
наведении без условия `(hover: hover)` на телефоне «залипает» после касания.
Отметка «в избранное» — эмоциональный момент без всякого отклика.

## Токены проекта (не изобретать новые)

- `--ease-out: cubic-bezier(0.25, 1, 0.5, 1)` — сильный ease-out, globals.css
- `--ease-fast: 120ms`, `--ease-base: 170ms`, `--ease-slow: 260ms`

## Шаги

1. `src/app/refresh.css`, раздел 18: `.catalog-appear > *` — `lw-card-in 260ms var(--ease-out) backwards`;
   задержки `nth-child(2..6)`: 30, 60, 90, 120, 150 мс; `n+7` — 150 мс. Смещение
   в `@keyframes lw-card-in` — `translateY(8px) scale(0.985)`.
2. `src/app/refresh.css`, раздел 3: `.home-quick__item` — `lw-rise 320ms var(--ease-out) backwards`,
   задержки 40/80/120/160 мс.
3. `src/app/globals.css:6029` — правило `.listing-card:hover .listing-card__media img`
   обернуть в `@media (hover: hover) and (pointer: fine)`. То же для
   `src/app/auctions/auctions-page.css:291` (`.auction-card:hover .auction-card__media img`);
   переход там — `var(--ease-slow) var(--ease-out)` вместо `420ms`.
4. `src/app/globals.css:2131` — шестерёнка профиля: `var(--ease-slow) var(--ease-out)` вместо `420ms`.
5. Отклик избранного и сравнения (`.listing-card__favorite[data-on] svg`,
   `.listing-row__tool[data-on] svg`): однократный «пульс» `scale(1) → 1.22 → 1`,
   320 мс, `var(--ease-out)`; в `prefers-reduced-motion: reduce` — без анимации.

## Границы

Не трогать карту АЗС, мини-апп, тур первого визита и `animation-timeline` раздела 9.

## Проверка

- Смена фильтра в каталоге: вся волна встаёт меньше чем за ~0,4 с, без мигания.
- Телефон (эмуляция iPhone): касание карточки и возврат назад — фото не остаётся увеличенным.
- Нажатие сердечка: один короткий пульс; повторное нажатие (снятие) — без пульса.
- DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`: пульса и волны нет.
