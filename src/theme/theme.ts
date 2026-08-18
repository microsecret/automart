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

  radius: {
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
  },

  shadows: {
    xs: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.04)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.04)",
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
          transition: "all 150ms ease",
          fontFamily: "var(--font-display), var(--font-sans), sans-serif",
        },
      },
    },
    Card: {
      defaultProps: { radius: "lg", padding: "md" },
      styles: {
        root: { transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)" },
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
        root: { borderRadius: "8px", transition: "all 150ms ease" },
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
