import { createTheme, MantineColorsTuple } from "@mantine/core"

/* Фирменная синяя линейка.
   Раньше здесь стояла индиго-палитра Tailwind — фиолетовая. Mantine раздаёт
   её всем компонентам, поэтому кнопки, ссылки и значки были фиолетовыми, а
   фирменный цвет марки — синий #14306b. На одной странице встречались оба, и
   сайт выглядел собранным из разных решений.
   Ступени светлоты сохранены, чтобы существующие оттенки не разъехались. */
const indigo: MantineColorsTuple = [
  "#eef2fb", "#dbe4f7", "#b9caee", "#8fa9de", "#5b82d6",
  "#2b56b0", "#1c4291", "#14306b", "#102a59", "#0b2050",
]

const gray: MantineColorsTuple = [
  "#fcfcfd", "#f4f4f5", "#e4e4e7", "#d4d4d8", "var(--mantine-color-dimmed)",
  "var(--mantine-color-dimmed)", "var(--mantine-color-gray-6)", "var(--mantine-color-gray-7)", "#27272a", "var(--mantine-color-text)",
]

export const theme = createTheme({
  primaryColor: "indigo",
  // Кнопки берут оттенок 7 — это ровно фирменный #14306b: он держит вес на
  // белом фоне, тогда как более светлые ступени выглядят блёкло.
  primaryShade: { light: 7, dark: 5 },
  white: "#ffffff",
  black: "#09090b",

  // Типографика: два шрифта
  fontFamily:
    "var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace:
    "ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Menlo, monospace",

  headings: {
    /* Заголовки — Manrope.

       Отрицательный трекинг обязателен: без него крупный кегль расползается
       и заголовок читается рыхло. Числа взяты из макета, по которому
       выстроен стиль сайта. */
    fontFamily:
      "var(--font-display), var(--font-sans), -apple-system, sans-serif",
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "2.875rem", lineHeight: "1.08", fontWeight: "800" },
      h2: { fontSize: "1.875rem", lineHeight: "1.15", fontWeight: "800" },
      h3: { fontSize: "1.1875rem", lineHeight: "1.25", fontWeight: "700" },
      h4: { fontSize: "1rem", lineHeight: "1.35", fontWeight: "700" },
      h5: { fontSize: "0.875rem", lineHeight: "1.4", fontWeight: "700" },
    },
  },

  /* Размеры шрифта.

     Прежняя шкала шла 12 → 13 → 15 → 17: между соседними ступенями один-два
     пикселя, разницы глаз не различает. При этом 88% подписей на сайте
     написаны xs и sm, поэтому страницы читались как ровное мелкое полотно —
     непонятно, что здесь главное.

     Шаг разведён так, чтобы соседние ступени отличались без сравнения рядом:
     мелкое остаётся мелким (сноски, метки), а основной текст и акценты
     заметно тяжелее. */
  fontSizes: {
    xs: "0.75rem",   // 12 — метки, сноски, единицы измерения
    sm: "0.875rem",  // 14 — основной текст интерфейса
    md: "1rem",      // 16 — акцентный текст, важное в карточке
    lg: "1.1875rem", // 19 — подзаголовки блоков
    xl: "1.5rem",    // 24 — заголовки разделов
  },

  /* Межстрочные интервалы.

     Основной текст интерфейса шёл с интервалом 1.25 — строки лепились друг
     к другу, и страница выглядела тесной независимо от того, какой стоит
     шрифт. В макете, который лёг в основу этого стиля, тот же текст идёт с
     1.6, и именно воздух между строк, а не сам шрифт, читается как
     «дорого».

     Мелкие метки остаются плотными: им воздух не нужен, они не читаются
     построчно. */
  lineHeights: {
    xs: "1.35",
    sm: "1.55",
    md: "1.6",
    lg: "1.5",
    xl: "1.35",
  },

  defaultRadius: "md",

  /* Шкала отступов.

     Крупные ступени были тесноваты: между разделами страницы стояло 32px,
     тогда как в макете — 52px. На узких промежутках блоки читаются как одна
     сплошная масса, и глаз не понимает, где кончается один раздел и
     начинается другой.

     Мелкие ступени не тронуты: внутри карточки лишний воздух только рвёт
     связь между строками. */
  spacing: {
    xs: "0.375rem",  // 6
    sm: "0.625rem",  // 10
    md: "1rem",      // 16
    lg: "1.75rem",   // 28 — между блоками внутри раздела
    xl: "3.25rem",   // 52 — между разделами страницы
  },

  /* Одна шкала с globals.css: раньше Mantine давал «md» в 8px, а CSS — свои
     значения, и на странице набиралось четырнадцать разных радиусов. Глаз
     читал это как набор чужих друг другу элементов, а не как систему. */
  /* Радиусы. Замеры живого CSS премиальных сайтов: Apple держит 8–12px на
     карточках, Lucid — 4px (81 правило), Stripe и Vercel — 6px, Polestar
     обходится без скруглений вовсе. Крупные радиусы 20px+ встречаются как
     раз у массовых шаблонов, а не у премиума: они читаются дружелюбно, но
     не строго. Шкала снижена и синхронизирована с CSS. */
  radius: {
    xs: "4px",
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "20px",
  },

  /* Тени цветные, а не серые. Серая тень на цветном фоне выглядит грязью;
     оттенок основного синего читается как настоящая тень предмета.

     Шаг между ступенями заметный: раньше семнадцать почти одинаковых теней
     не давали понять, что выше, а что ниже. */
  shadows: {
    xs: "0 1px 2px rgba(20, 48, 107, 0.05)",
    sm: "0 1px 2px rgba(20, 48, 107, 0.06), 0 2px 6px -2px rgba(20, 48, 107, 0.08)",
    md: "0 4px 10px -4px rgba(20, 48, 107, 0.14), 0 10px 24px -12px rgba(20, 48, 107, 0.18)",
    lg: "0 12px 28px -12px rgba(20, 48, 107, 0.22), 0 24px 56px -24px rgba(20, 48, 107, 0.26)",
    xl: "0 24px 48px -20px rgba(20, 48, 107, 0.3), 0 40px 80px -40px rgba(20, 48, 107, 0.34)",
  },

  colors: {
    indigo,
    gray,
    dark: [
      "#fafafa", "#c1c2c5", "#909296", "#5c5f66", "#373a40",
      "#2c2e33", "#25262b", "#1a1b1e", "#141517", "#101113",
    ],
  },

  components: {
    /* Кнопка.

       Числа сняты с площадки, которую владелец назвал образцом: высота 36px
       (padding 8×16 при line-height 20), радиус из шкалы, переход 150ms по
       перечисленным свойствам. Прежние 38px выбивались из ритма полей ввода,
       а свои тени при наведении не совпадали с общей глубиной. */
    Button: {
      defaultProps: { radius: "sm", fw: "600" },
      styles: {
        root: {
          height: "36px",
          paddingInline: "16px",
          // Свойства перечислены явно: `all` заставил бы браузер следить и за
          // размерами, а кнопок на странице десятки.
          transition:
            "background 150ms var(--ease-out), border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out), color 150ms var(--ease-out), transform 150ms var(--ease-out)",
          fontFamily: "var(--font-display), var(--font-sans), sans-serif",
          // Кнопка отзывается на курсор: приподнимается под указателем и
          // вдавливается при нажатии. Без этого интерфейс ощущается статичной
          // картинкой, даже когда всё работает.
          "&:hover:not(:disabled):not([data-loading])": {
            transform: "translateY(-1px)",
            boxShadow: "var(--shadow-md)",
          },
          "&:active:not(:disabled)": {
            transform: "translateY(0)",
            boxShadow: "var(--shadow-sm)",
          },
          "@media (prefers-reduced-motion: reduce)": {
            transition: "background 150ms linear, color 150ms linear",
            "&:hover:not(:disabled):not([data-loading])": { transform: "none" },
          },
        },
      },
    },
    /* Карточка.

       Радиус 12px и внутренний отступ 14px — числа образцовой площадки. Тень
       в покое почти незаметна: карточку держит рамка, а тень лишь отрывает
       её от фона. Заметной она становится при наведении. */
    Card: {
      defaultProps: { radius: "md", padding: 14 },
      styles: {
        root: {
          // Свойства перечислены явно: с `all` браузер отслеживал бы и
          // размеры, а на списке из десятков карточек это подтормаживает.
          transition:
            "box-shadow 200ms var(--ease-out), transform 150ms var(--ease-out), border-color 200ms var(--ease-out)",
          boxShadow: "var(--shadow-sm)",
        },
      },
    },
    /* Поля ввода.

       Радиус и высота совпадают с кнопкой — иначе в одном ряду поиска поле
       и кнопка стоят разной формы и высоты, и строка выглядит собранной из
       чужих деталей. Подсветка при фокусе даётся тенью-кольцом, а не сменой
       толщины рамки: толщина сдвигает содержимое на пиксель. */
    TextInput: {
      defaultProps: { radius: "sm", size: "md" },
      styles: {
        input: {
          transition: "border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out)",
          fontFamily: "var(--font-sans), sans-serif",
        },
      },
    },
    Select: {
      defaultProps: { radius: "sm", size: "md" },
      styles: {
        input: {
          transition: "border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out)",
          fontFamily: "var(--font-sans), sans-serif",
        },
      },
    },
    NumberInput: {
      defaultProps: { radius: "sm", size: "md" },
      styles: { input: { fontFamily: "var(--font-sans), sans-serif" } },
    },
    Textarea: {
      defaultProps: { radius: "sm" },
      styles: { input: { fontFamily: "var(--font-sans), sans-serif" } },
    },
    MultiSelect: { defaultProps: { radius: "sm", size: "md" } },
    Autocomplete: { defaultProps: { radius: "sm", size: "md" } },

    /* Бейдж.

       Компактнее прежнего: 12px при отступах 2×8 и радиусе 4px. Крупный
       бейдж спорит с текстом, рядом с которым стоит, — метка должна
       читаться, но не перебивать. */
    Badge: {
      defaultProps: { radius: "xs", size: "sm", fw: 600 },
      styles: {
        root: {
          fontFamily: "var(--font-sans), sans-serif",
          letterSpacing: "0",
          textTransform: "none",
        },
      },
    },
    NavLink: {
      styles: {
        root: {
          borderRadius: "var(--radius-sm)",
          transition: "background 150ms var(--ease-out), color 150ms var(--ease-out)",
        },
        label: { fontFamily: "var(--font-sans), sans-serif" },
      },
    },
    Anchor: {
      styles: { root: { transition: "color 150ms var(--ease-out)" } },
    },
    Tabs: {
      styles: {
        tab: {
          fontFamily: "var(--font-sans), sans-serif",
          fontWeight: 600,
          transition: "color 150ms var(--ease-out), border-color 150ms var(--ease-out)",
        },
      },
    },
    Modal: {
      defaultProps: { radius: "md", centered: true },
      styles: { title: { fontFamily: "var(--font-display), sans-serif", fontWeight: 700 } },
    },
    Drawer: {
      styles: { title: { fontFamily: "var(--font-display), sans-serif", fontWeight: 700 } },
    },
    Menu: { defaultProps: { radius: "sm", shadow: "md" } },
    Popover: { defaultProps: { radius: "sm", shadow: "md" } },
    Tooltip: { defaultProps: { radius: "xs" } },
    SegmentedControl: { defaultProps: { radius: "sm" } },
    Chip: { defaultProps: { radius: "sm" } },
    Notification: { defaultProps: { radius: "sm" } },
    ActionIcon: { defaultProps: { radius: "sm" } },
    ThemeIcon: { defaultProps: { radius: "sm" } },
    Paper: { defaultProps: { radius: "md" } },
    Title: {
      styles: {
        root: { fontFamily: "var(--font-display), var(--font-sans), sans-serif" },
      },
    },
    Text: {
      styles: { root: { fontFamily: "var(--font-sans), sans-serif" } },
    },
  },
})
