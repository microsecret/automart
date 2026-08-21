/**
 * Синхронизация прокрутки бокового меню со страницей.
 *
 * Меню закреплено (fixed) и само по себе не двигается: человек прокручивает
 * страницу, а список стоит на месте. Здесь считается, насколько доматывать
 * внутреннюю прокрутку меню, чтобы оно ехало вместе с содержимым.
 *
 * Вынесено отдельно от компонента: это чистая арифметика, её можно проверить
 * тестами, а ошибка здесь ломает навигацию на каждой странице.
 */

export type NavbarScrollInput = {
  /** Полная высота содержимого меню. */
  contentHeight: number
  /** Видимая высота меню. */
  viewportHeight: number
  /** Полная высота документа. */
  pageHeight: number
  /** Высота окна. */
  windowHeight: number
  /** Текущая прокрутка страницы. */
  scrollY: number
}

/**
 * Сколько прокрутить меню внутри себя.
 *
 * Возвращает null, если крутить нечего: список помещается целиком либо
 * страница не прокручивается. В этих случаях трогать scrollTop не нужно —
 * иначе меню дёргалось бы на коротких страницах.
 */
export function navbarScrollTop(input: NavbarScrollInput): number | null {
  const hidden = input.contentHeight - input.viewportHeight
  if (hidden <= 0) return null

  const pageHidden = input.pageHeight - input.windowHeight
  if (pageHidden <= 0) return null

  const progress = Math.min(1, Math.max(0, input.scrollY / pageHidden))
  return hidden * progress
}
