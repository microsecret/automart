/**
 * Человеческие названия площадок-источников.
 *
 * В админке и на карточках лота источник печатался кодом: «ENCAR»,
 * «BOBAEDREAM», «YOUXINPAI». Модератор, разбирающий заявку, читает их как
 * набор букв — а за ними стоят разные страны, разные правила выкупа и
 * разная надёжность данных.
 *
 * Страна названа рядом с площадкой: по коду её не угадать, а решение о
 * пошлине и сроках доставки зависит именно от неё.
 */

export const AUCTION_SOURCE_LABELS: Readonly<Record<string, string>> = {
  ENCAR: "Encar · Корея",
  KCAR: "KCar · Корея",
  BOBAEDREAM: "Bobaedream · Корея",
  CARSENSOR: "Carsensor · Япония",
  BEFORWARD: "BeForward · Япония",
  GOONET: "Goo-net · Япония",
  YOUXINPAI: "Youxinpai · Китай",
  IAUTOS: "iAutos · Китай",
  CARVAGO: "Carvago · Европа",
  AUTOSALE: "Autosale · Европа",
}

/**
 * Название площадки для показа человеку.
 *
 * Незнакомый код возвращается как есть: новый источник лучше показать
 * кодом, чем спрятать за пустотой — модератор хотя бы поймёт, что данные
 * пришли откуда-то ещё.
 */
export function auctionSourceLabel(source: string | null | undefined): string {
  if (!source) return "—"
  return AUCTION_SOURCE_LABELS[source] || source
}
