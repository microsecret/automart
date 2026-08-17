// Адреса и подписи направлений «марка + страна». Модуль намеренно не
// импортирует Prisma: он используется и на сервере, и в клиентском каталоге,
// где серверные зависимости недопустимы.

export const AUCTION_LANDING_COUNTRIES: Readonly<Record<string, { slug: string; nominative: string; genitive: string }>> = {
  KR: { slug: "koreya", nominative: "Корея", genitive: "Кореи" },
  JP: { slug: "yaponiya", nominative: "Япония", genitive: "Японии" },
  CN: { slug: "kitay", nominative: "Китай", genitive: "Китая" },
  US: { slug: "ssha", nominative: "США", genitive: "США" },
  DE: { slug: "evropa", nominative: "Европа", genitive: "Европы" },
}

// Страница с одним-двумя лотами не отвечает на запрос и выглядит пустой,
// поэтому в индекс попадают только направления с реальным выбором.
export const MIN_LISTINGS_FOR_LANDING = 5

const COUNTRY_BY_SLUG = new Map(
  Object.entries(AUCTION_LANDING_COUNTRIES).map(([code, meta]) => [meta.slug, code]),
)

/** Превращает название марки в часть URL: «KGM / SsangYong» → «kgm-ssangyong». */
export function makeSlug(make: string) {
  return make
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function countryCodeFromSlug(slug: string) {
  return COUNTRY_BY_SLUG.get(slug) || null
}
