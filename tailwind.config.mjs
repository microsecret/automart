/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind используется ТОЛЬКО для layout/spacing/типографики.
  // Стилизация компонентов — через Mantine (theme.ts).
  // Избежание конфликтов: отключаем preflight (Mantine даёт свой reset).
  corePlugins: {
    preflight: false,
  },
  content: ["./src/**/*.{html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo: {
          DEFAULT: "#4f46e5",
          light: "#6366f1",
          dark: "#3730a3",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
