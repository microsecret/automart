import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeWheel — авторынок и авто из-за рубежа",
    short_name: "LeWheel",
    description: "Транспорт, запчасти и проверенные предложения зарубежных автомобильных площадок.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "var(--market-primary)",
    lang: "ru",
    categories: ["automotive", "shopping"],
  }
}
