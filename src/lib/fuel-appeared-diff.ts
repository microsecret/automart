/**
 * Что изменилось на заправке между прогонами сбора.
 *
 * Главное событие сервиса — топливо появилось там, где его не было. За
 * сутки водители оставляют одну-две отметки, а источники приносят
 * изменения по четырнадцати тысячам заправок: именно там это видно.
 *
 * Здесь только сравнение, без базы и сети. То, по чему в чат из двух
 * тысяч человек уходит сообщение, должно проверяться тестами.
 */

/** Марки в наших кодах, как их хранит fuelsNow: «AI95,DT». */
export type FuelChange = {
  /** Появившиеся марки в кодах: AI92, AI95, DT… */
  appeared: string[]
  /** Заправка перешла из «пусто» в «есть» целиком. */
  becameAvailable: boolean
}

function parseFuels(value: string | null | undefined): Set<string> {
  if (!value) return new Set()
  return new Set(
    value
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  )
}

/**
 * Сравнивает прошлое и нынешнее состояние заправки.
 *
 * Появлением считается марка, которой в прошлый раз не было, — и только
 * если заправка сейчас действительно работает. Источник, у которого
 * статус «нет», но список марок непустой, перечисляет ассортимент
 * колонок, а не наличие: сообщать по нему значило бы звать людей туда,
 * где заправиться нечем.
 *
 * Первый прогон по заправке появлением не считается. Иначе при заведении
 * нового города в чат ушла бы тысяча сообщений разом — все заправки
 * «появились» бы одновременно.
 */
export function diffFuelAvailability(
  previous: { status: string | null; fuelsNow: string | null } | null,
  next: { status: string | null; fuelsNow: string | null },
): FuelChange {
  const empty: FuelChange = { appeared: [], becameAvailable: false }

  /* Заправку видим впервые: сравнивать не с чем. */
  if (!previous) return empty

  /* Сейчас топлива нет — сообщать не о чем, даже если список марок
     непустой: там ассортимент колонок, а не наличие. */
  if (next.status !== "yes" && next.status !== "low") return empty

  const before = parseFuels(previous.fuelsNow)
  const after = parseFuels(next.fuelsNow)

  /* Прежде источник о наличии молчал: это не появление, а первое
     сведение. Разница между «не знали» и «не было» здесь принципиальна —
     иначе каждый новый источник давал бы волну ложных сообщений. */
  const wasKnown = previous.status === "yes" || previous.status === "low" || previous.status === "no"
  if (!wasKnown) return empty

  const appeared = [...after].filter((fuel) => !before.has(fuel))

  return {
    appeared,
    /* Заправка ожила целиком: была пустой, стала рабочей. Это отдельная
       новость даже без разбора марок. */
    becameAvailable: previous.status === "no" && (next.status === "yes" || next.status === "low"),
  }
}
