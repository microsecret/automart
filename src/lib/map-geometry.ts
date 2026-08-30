/**
 * Геометрия карты: перевод координат в пиксели плиток и обратно.
 *
 * Проекция Меркатора — та же, в которой нарезаны плитки OpenStreetMap:
 * иначе метки разъехались бы с картинкой под ними. Ошибка здесь не
 * ломает страницу, а тихо сдвигает все точки на карте — заметить это
 * глазами почти нельзя, поэтому математика вынесена отдельно и проверена
 * по известным координатам.
 */

/** Плитки OpenStreetMap нарезаны по 256 пикселей. */
export const TILE_SIZE = 256

/** Координаты в пиксели мировой сетки на заданном увеличении. */
export function coordinatesToWorld(latitude: number, longitude: number, zoom: number) {
  const worldSize = TILE_SIZE * (2 ** zoom)
  const latitudeRadians = latitude * Math.PI / 180
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * worldSize,
  }
}

/** Обратный перевод: пиксели сетки в широту и долготу. */
export function worldToCoordinates(x: number, y: number, zoom: number) {
  const worldSize = TILE_SIZE * (2 ** zoom)
  /* Долгота заворачивается по кругу: карту можно тянуть вправо
     бесконечно, и на пятом обороте она должна показывать то же место. */
  const normalizedX = ((x % worldSize) + worldSize) % worldSize
  /* Широта — нет: за полюсом карты нет, и тянуть туда бессмысленно. */
  const boundedY = Math.max(0, Math.min(worldSize, y))
  const latitudeRadians = Math.PI - (2 * Math.PI * boundedY) / worldSize

  return {
    latitude: (180 / Math.PI) * Math.atan(Math.sinh(latitudeRadians)),
    longitude: (normalizedX / worldSize) * 360 - 180,
  }
}

/**
 * Расстояние между точками по поверхности Земли, в километрах.
 *
 * Формула гаверсинусов: на расстояниях городской карты плоская
 * геометрия ошибается заметно, а человек читает «1,2 км» как обещание.
 */
export function getDistanceInKilometers(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radians = (value: number) => value * Math.PI / 180
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const latitudeFrom = radians(from.latitude)
  const latitudeTo = radians(to.latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeFrom) * Math.cos(latitudeTo) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}
