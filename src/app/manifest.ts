import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeWheel — авторынок и авто из-за рубежа",
    short_name: "LeWheel",
    description: "Транспорт, запчасти и проверенные предложения зарубежных автомобильных площадок.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f2",
    theme_color: "#1d4ed8",
    lang: "ru",
    categories: ["automotive", "shopping"],
  }
}
