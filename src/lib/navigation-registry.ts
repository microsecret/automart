export type NavigationItem<Id extends string = string> = Readonly<{
  id: Id
  label: string
  shortLabel?: string
  href: string
  activePrefixes?: readonly string[]
}>

export type NavigationSection = Readonly<{
  title: string
  items: readonly NavigationItem[]
}>

export const CREATE_VEHICLE_HREF = "/listings/create/vehicle"

export const PRIMARY_NAVIGATION = [
  { id: "listings", label: "Объявления", href: "/", activePrefixes: ["/category", "/search"] },
  { id: "parts", label: "Запчасти", href: "/parts-finder", activePrefixes: ["/listings/part"] },
  { id: "auctions", label: "Аукционы", href: "/auctions" },
  /* Карта АЗС вынесена в главное меню.

     Она лежала третьим пунктом внутри «Сервисов» — до неё доходили
     двумя нажатиями, зная, что искать. При этом в дефицит топлива это
     самый нужный инструмент на сайте, и заходят на него чаще, чем на
     аукционы.

     «Где заправиться», а не «Карта АЗС»: название говорит о задаче
     человека, а не об устройстве раздела. И не «Где бензин» — так
     называется чужой сервис, с которым нас незачем путать. */
  { id: "fuel-map", label: "Где заправиться", shortLabel: "Заправки", href: "/services/fuel-map" },
  { id: "news", label: "Новости", href: "/news" },
  { id: "forum", label: "Форум", href: "/forum" },
] as const satisfies readonly NavigationItem[]

export const PLATFORM_NAVIGATION = [
  { id: "help", label: "Помощь", href: "/help" },
  { id: "services", label: "Сервисы", href: "/services" },
] as const satisfies readonly NavigationItem[]

export const TRANSPORT_NAVIGATION = [
  { id: "cars", label: "Легковые", href: "/category/cars" },
  { id: "moto", label: "Мото", href: "/category/moto" },
  { id: "trucks", label: "Грузовики", href: "/category/trucks" },
  { id: "special", label: "Спецтехника", href: "/category/special" },
  { id: "water", label: "Водный транспорт", href: "/category/water" },
  { id: "air", label: "Воздушный транспорт", href: "/category/air" },
] as const satisfies readonly NavigationItem[]

export const PART_NAVIGATION = [
  { id: "engine", label: "Двигатель", href: "/parts-finder?partType=ENGINE" },
  { id: "brakes", label: "Тормоза", href: "/parts-finder?partType=BRAKES" },
  { id: "suspension", label: "Подвеска и ходовая", shortLabel: "Ходовая / Подвеска", href: "/parts-finder?partType=SUSPENSION" },
  { id: "electrical", label: "Электрика", href: "/parts-finder?partType=ELECTRICAL" },
  { id: "lighting", label: "Оптика", href: "/parts-finder?partType=LIGHTING" },
] as const satisfies readonly NavigationItem[]

export const AUCTION_COUNTRY_NAVIGATION = [
  { id: "JP", label: "Япония", href: "/auctions?country=JP" },
  { id: "KR", label: "Корея", href: "/auctions?country=KR" },
  { id: "CN", label: "Китай", href: "/auctions?country=CN" },
  { id: "US", label: "США", href: "/auctions?country=US" },
  { id: "DE", label: "Европа", href: "/auctions?country=DE" },
] as const satisfies readonly NavigationItem[]

export const SERVICE_NAVIGATION = [
  { id: "fuel-map", label: "Карта АЗС", href: "/services/fuel-map" },
  { id: "history-check", label: "Проверка истории", href: "/services/history-check" },
  { id: "valuation", label: "Оценка стоимости", href: "/services/valuation" },
  { id: "smart-matching", label: "Умный подбор", href: "/services/smart-matching" },
  { id: "safe-deal", label: "Безопасная сделка", href: "/services/safe-deal" },
  { id: "legal-documents", label: "Документы сделки", href: "/services/legal-documents" },
] as const satisfies readonly NavigationItem[]

export const HELP_NAVIGATION = [
  { id: "sell", label: "Как продать авто", href: "/help/sell" },
  { id: "safety", label: "Безопасность", href: "/help/safety" },
  { id: "rules", label: "Правила", href: "/help/rules" },
  { id: "support", label: "Поддержка", href: "/help/support" },
] as const satisfies readonly NavigationItem[]

export const DASHBOARD_NAVIGATION = [
  { id: "listings", label: "Мои объявления", shortLabel: "Объявления", href: "/dashboard" },
  { id: "favorites", label: "Избранное", href: "/favorites" },
  { id: "garage", label: "Личный гараж", shortLabel: "Гараж", href: "/dashboard?tab=garage" },
  { id: "deliveries", label: "Мои доставки", shortLabel: "Доставки", href: "/dashboard/deliveries" },
  { id: "documents", label: "Мои документы", shortLabel: "Документы", href: "/dashboard/documents" },
  { id: "messages", label: "Сообщения", href: "/messages" },
  { id: "payments", label: "Оплаты", href: "/dashboard?tab=payments" },
  { id: "profile", label: "Профиль и настройки", shortLabel: "Профиль", href: "/dashboard?tab=profile" },
] as const satisfies readonly NavigationItem[]

export type DashboardNavigationId = (typeof DASHBOARD_NAVIGATION)[number]["id"]

export function getDashboardNavigationItem(id: DashboardNavigationId): (typeof DASHBOARD_NAVIGATION)[number] {
  const item = DASHBOARD_NAVIGATION.find((candidate) => candidate.id === id)
  if (!item) throw new Error(`Неизвестный раздел личного кабинета: ${id}`)
  return item
}

export const SITE_MOBILE_NAVIGATION = [
  { id: "home", label: "Главная", href: "/" },
  /* Заправки вместо аукционов.

     На телефоне помещается пять пунктов, и место в них дороже всего.
     Аукционы смотрят вдумчиво, за столом, выбирая машину неделями; на
     заправку человек ищет ответ за рулём и прямо сейчас — и открывает
     карту по нескольку раз за поездку.

     Аукционы остались в шапке и в боковом меню, а карта до этого была
     на телефоне доступна только через боковое меню. */
  { id: "fuel-map", label: "Заправки", href: "/services/fuel-map" },
  { id: "create", label: "Подать", href: CREATE_VEHICLE_HREF },
  /* Форум вместо новостей: новости живут в шапке и читаются разом, а форум
     без входа с телефона не заживёт — именно туда возвращаются за ответом
     на свой вопрос, и именно он приводит людей из поиска. */
  { id: "forum", label: "Форум", href: "/forum" },
  { id: "messages", label: "Чаты", href: "/messages" },
] as const satisfies readonly NavigationItem[]

export const FOOTER_NAVIGATION: readonly NavigationSection[] = [
  {
    title: "Каталог",
    items: [
      { id: "all", label: "Все объявления", href: "/" },
      { id: "brands", label: "Все марки", href: "/brands" },
      { id: "map", label: "Карта объявлений", href: "/map" },
      { id: "compare", label: "Сравнение", href: "/compare" },
      { id: "auctions", label: "Мировые аукционы", href: "/auctions" },
    ],
  },
  {
    title: "Запчасти",
    items: [
      { id: "all-parts", label: "Все запчасти", href: "/parts-finder" },
      ...PART_NAVIGATION.filter((item) => item.id !== "lighting").map((item) => ({
        ...item,
        label: "shortLabel" in item ? item.shortLabel : item.label,
      })),
    ],
  },
  { title: "Сервисы", items: SERVICE_NAVIGATION },
  { title: "Помощь", items: HELP_NAVIGATION },
]

export const TELEGRAM_MENU_NAVIGATION = [
  {
    title: "Каталог",
    items: [
      { id: "vehicles", label: "Свежие объявления", href: "/telegram" },
      { id: "auctions", label: "Мировые аукционы", href: "/telegram?tab=auctions" },
      { id: "news", label: "Новости авторынка", href: "/telegram?tab=news" },
      /* Форум есть и в нижней панели, и здесь. Панель прячется при
         прокрутке, а меню открывают осознанно: без этой строки человек,
         закрывший панель, форум в приложении не находил вовсе. */
      { id: "forum", label: "Форум автолюбителей", href: "/forum?from=telegram" },
      { id: "parts", label: "Запчасти", href: "/parts-finder?from=telegram" },
    ],
  },
  {
    title: "Личный кабинет",
    items: [
      { id: "favorites", label: "Избранное", href: "/favorites?from=telegram" },
      { id: "messages", label: "Сообщения", href: "/telegram?tab=chats" },
      { id: "listings", label: "Мои объявления", href: "/dashboard?from=telegram" },
      { id: "garage", label: "Личный гараж", href: "/dashboard?tab=garage&from=telegram" },
      { id: "deliveries", label: "Мои доставки", href: "/dashboard/deliveries?from=telegram" },
      { id: "documents", label: "Мои документы", href: "/dashboard/documents?from=telegram" },
    ],
  },
  {
    /* Услуги были только на сайте: человек, зашедший через приложение,
       не знал ни про карту АЗС, ни про проверку истории — а это ровно то,
       за чем он пришёл бы второй раз.

       Список берётся из общего SERVICE_NAVIGATION, а не переписывается:
       иначе новая услуга появилась бы на сайте и не появилась здесь. */
    title: "Сервисы",
    items: SERVICE_NAVIGATION.map((item) => ({ ...item, href: `${item.href}?from=telegram` })),
  },
  {
    title: "Аукционы по странам",
    items: AUCTION_COUNTRY_NAVIGATION
      .filter((item) => item.id !== "US")
      .map((item) => ({ ...item, href: `${item.href}&from=telegram` })),
  },
] as const satisfies readonly NavigationSection[]

/**
 * Нижние вкладки приложения — пять, больше не помещается на телефоне.
 *
 * Отбор идёт по частоте возвращения, а не по важности раздела:
 *
 * • «Бензин» вместо «Профиля». В дефицит топлива человек открывает карту
 *   АЗС по нескольку раз в день, тогда как в кабинет заходит раз в
 *   неделю — и попадает туда из выезжающего меню, где ему и место.
 *
 * • «Новости» вместо «Аукционов». Аукционы — большой раздел для тех, кто
 *   уже решил везти машину из-за границы: таких единицы, и они доходят
 *   до него из меню. Новости открывают между делом, как ленту.
 *
 * • Форум остался: место, куда человек приходит за ответом на свой
 *   вопрос и возвращается за ним.
 */
/* Нижняя панель мини-приложения ведёт только внутрь него самого.

   Прежний состав уводил человека наружу и оставлял там: «Бензин» и
   «Форум» открывали обычный сайт с десктопной шапкой, подвалом и
   боковым каталогом во вьюпорте телефона, а вернуться в ленту было
   нечем — панели там уже нет.

   «Продать» дублировала главную кнопку Telegram, которая стоит ровно в
   том же нижнем краю экрана: две одинаковые цели друг на друге.
   Подача осталась за главной кнопкой — она заметнее и всегда под рукой.

   Вместо них — «Аукционы» и «Сообщения». Обе вкладки давно написаны и
   работают, но попасть в них можно было только через выезжающее меню:
   человек не знал, что они есть. */
export const TELEGRAM_TAB_NAVIGATION = [
  { id: "vehicles", label: "Свежее", href: "/telegram" },
  { id: "auctions", label: "Аукционы", href: "/telegram?tab=auctions" },
  { id: "chats", label: "Сообщения", href: "/telegram?tab=chats" },
  { id: "news", label: "Новости", href: "/telegram?tab=news" },
  { id: "fuel", label: "Бензин", href: "/services/fuel-map?from=telegram" },
] as const satisfies readonly NavigationItem[]

function navigationPath(href: string): string {
  return href.split(/[?#]/, 1)[0] || "/"
}

export function isNavigationItemActive(pathname: string, item: NavigationItem): boolean {
  const itemPath = navigationPath(item.href)
  if (itemPath === "/") return pathname === "/" || Boolean(item.activePrefixes?.some((prefix) => pathname.startsWith(prefix)))
  return pathname === itemPath
    || pathname.startsWith(`${itemPath}/`)
    || Boolean(item.activePrefixes?.some((prefix) => pathname.startsWith(prefix)))
}
