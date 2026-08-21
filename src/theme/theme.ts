import { createTheme, MantineColorsTuple } from "@mantine/core"

// Индиго-палитра
const indigo: MantineColorsTuple = [
  "#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8",
  "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81",
]

const gray: MantineColorsTuple = [
  "#fcfcfd", "#f4f4f5", "#e4e4e7", "#d4d4d8", "var(--mantine-color-dimmed)",
  "var(--mantine-color-dimmed)", "var(--mantine-color-gray-6)", "var(--mantine-color-gray-7)", "#27272a", "var(--mantine-color-text)",
]

export const theme = createTheme({
  primaryColor: "indigo",
  // Кнопки брали оттенок 6 (#4f46e5, светлота 59%) — на белом фоне он не
  // держал вес, и интерфейс выглядел блёклым. Оттенок 7 (#4338ca) даёт
  // контраст 7.9 вместо 6.3, оставаясь тем же фирменным индиго.
  primaryShade: { light: 7, dark: 5 },
  white: "#ffffff",
  black: "#09090b",

  // Типографика: два шрифта
  fontFamily:
    "var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace:
    "ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Menlo, monospace",

  headings: {
    // Заголовки — Jakarta Sans (геометричнее, строже)
    fontFamily:
      "var(--font-display), var(--font-sans), -apple-system, sans-serif",
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "2.5rem", lineHeight: "1.1", fontWeight: "800" },
      h2: { fontSize: "1.875rem", lineHeight: "1.15", fontWeight: "700" },
      h3: { fontSize: "1.375rem", lineHeight: "1.2", fontWeight: "700" },
      h4: { fontSize: "1.125rem", lineHeight: "1.3", fontWeight: "600" },
      h5: { fontSize: "1rem", lineHeight: "1.4", fontWeight: "600" },
    },
  },

  // Размеры шрифта — плотнее, точнее
  fontSizes: {
    xs: "0.75rem",   // 12
    sm: "0.8125rem", // 13
    md: "0.9375rem", // 15
    lg: "1.0625rem", // 17
    xl: "1.25rem",   // 20
  },

  lineHeights: {
    xs: "1.15",
    sm: "1.25",
    md: "1.4",
    lg: "1.5",
    xl: "1.65",
  },

  defaultRadius: "md",

  spacing: {
    xs: "0.375rem",
    sm: "0.625rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },

  /* Одна шкала с globals.css: раньше Mantine давал «md» в 8px, а CSS — свои
     значения, и на странице набиралось четырнадцать разных радиусов. Глаз
     читал это как набор чужих друг другу элементов, а не как систему. */
  radius: {
    xs: "6px",
    sm: "10px",
    md: "14px",
    lg: "20px",
    xl: "28px",
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
    Button: {
      defaultProps: { radius: "md", fw: "600" },
      styles: {
        root: {
          height: "38px",
          // Кнопки меняют цвет, тень и положение; `all` заставлял браузер
          // следить и за размерами, а кнопок на странице десятки.
          transition: "background 150ms ease, border-color 150ms ease, box-shadow 200ms ease, color 150ms ease, transform 140ms ease",
          fontFamily: "var(--font-display), var(--font-sans), sans-serif",
          // Кнопка отзывается на курсор: приподнимается под указателем и
          // вдавливается при нажатии. Без этого интерфейс ощущается статичной
          // картинкой, даже когда всё работает.
          "&:hover:not(:disabled):not([data-loading])": {
            transform: "translateY(-1px)",
            boxShadow: "0 6px 16px -8px rgba(31, 26, 92, 0.45)",
          },
          "&:active:not(:disabled)": {
            transform: "translateY(0)",
            boxShadow: "0 2px 6px -4px rgba(31, 26, 92, 0.5)",
          },
          "@media (prefers-reduced-motion: reduce)": {
            transition: "background 150ms ease, color 150ms ease",
            "&:hover:not(:disabled):not([data-loading])": { transform: "none" },
          },
        },
      },
    },
    Card: {
      defaultProps: { radius: "lg", padding: "md" },
      styles: {
        root: {
          // Было `all`: браузер отслеживал каждое свойство, включая размеры,
          // и на списке из десятков карточек это заметно подтормаживало.
          // Тень со смещением и размытием отделяет карточку от подложки —
          // одной границы для этого не хватало.
          transition: "box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms ease",
          boxShadow: "0 1px 2px rgba(23, 23, 25, 0.04), 0 4px 12px -8px rgba(23, 23, 25, 0.12)",
        },
      },
    },
    TextInput: {
      defaultProps: { radius: "md", size: "md" },
      styles: {
        input: {
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          fontFamily: "var(--font-sans), sans-serif",
        },
      },
    },
    Select: {
      defaultProps: { radius: "md", size: "md" },
      styles: {
        input: { fontFamily: "var(--font-sans), sans-serif" },
      },
    },
    Badge: {
      defaultProps: { radius: "sm", size: "md", fw: 600 },
      styles: {
        root: { fontFamily: "var(--font-display), sans-serif", letterSpacing: "0.01em" },
      },
    },
    NavLink: {
      styles: {
        root: { borderRadius: "8px", transition: "background 150ms ease, color 150ms ease, box-shadow 150ms ease" },
        label: { fontFamily: "var(--font-sans), sans-serif" },
      },
    },
    Anchor: {
      styles: { root: { transition: "color 150ms ease" } },
    },
    ActionIcon: { defaultProps: { radius: "md" } },
    Paper: { defaultProps: { radius: "lg" } },
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
