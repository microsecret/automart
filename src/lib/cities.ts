export type CityCoordinates = { latitude: number; longitude: number }

/**
 * Единый справочник для карт и ограниченных гео-запросов.
 * Он намеренно не принимает произвольные координаты из URL: так публичные
 * картографические источники не используются как неограниченный proxy.
 */
export const CITY_COORDINATES: Record<string, CityCoordinates> = {
  "Москва": { latitude: 55.7558, longitude: 37.6173 },
  "Санкт-Петербург": { latitude: 59.9343, longitude: 30.3351 },
  "Новосибирск": { latitude: 55.0084, longitude: 82.9357 },
  "Екатеринбург": { latitude: 56.8389, longitude: 60.6057 },
  "Казань": { latitude: 55.8304, longitude: 49.0661 },
  "Краснодар": { latitude: 45.0355, longitude: 38.9753 },
  "Самара": { latitude: 53.1959, longitude: 50.1002 },
  "Уфа": { latitude: 54.7388, longitude: 55.9721 },
  "Воронеж": { latitude: 51.6755, longitude: 39.2089 },
  "Ростов-на-Дону": { latitude: 47.2357, longitude: 39.7015 },
}

export const FUEL_MAP_CITIES = Object.keys(CITY_COORDINATES)

