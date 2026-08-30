import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

/**
 * Проверки по итогам аудита фронтенда и бэкенда.
 *
 * Каждый тест закрепляет исправление, найденное при разборе проекта, —
 * чтобы дефект не вернулся при следующей правке рядом.
 */

test("лента в мини-приложении не ждёт входа", () => {
  /* Человек открывал мини-приложение и вместо машин видел «Открываем
     ваш аккаунт…» до конца авторизации. Смотреть машины можно и без
     входа: он нужен для избранного и переписки. */
  const app = readFileSync(new URL("../src/components/telegram/TelegramMiniApp.tsx", import.meta.url), "utf8")
  const feedAt = app.indexOf("<TelegramFeed />")
  const loaderGuard = app.indexOf('status === "loading" && (')
  assert.ok(loaderGuard > 0, "состояние входа должно быть неблокирующим")
  assert.ok(feedAt > 0, "лента должна рендериться")
  /* Переписка — исключение: без входа там показывать нечего. */
  assert.match(app, /Открываем переписку/)
})

test("счётчик диалогов не выгружает весь почтовый ящик", () => {
  /* groupBy без ограничения возвращал по строке на каждый диалог, в
     котором человек когда-либо участвовал, — ради одного числа в
     пагинации. Ящик открывался тем медленнее, чем дольше человек
     пользуется сервисом. */
  const route = readFileSync(new URL("../src/app/api/messages/route.ts", import.meta.url), "utf8")
  assert.match(route, /COUNT\(DISTINCT "conversationId"\)/)
  /* Приведения типов PostgreSQL здесь быть не должно: база — SQLite. */
  assert.doesNotMatch(route, /::bigint/)
})

test("справочники марок и категорий кэшируются", () => {
  /* Марки и модели лежат в коде: ответ байт в байт одинаков и меняется
     только с выкатом. Заголовка не было, и каждый выпадающий список
     шёл до сервера заново. */
  for (const file of ["../src/app/api/v1/brands/route.ts", "../src/app/api/v1/models/route.ts", "../src/app/api/categories/route.ts"]) {
    const route = readFileSync(new URL(file, import.meta.url), "utf8")
    assert.match(route, /Cache-Control/, `нет заголовка кэша: ${file}`)
    assert.match(route, /stale-while-revalidate/, `нет фонового обновления: ${file}`)
  }
})

test("поиск запчастей не бьёт по серверу на каждую букву", () => {
  /* Поле входило в ключ запроса напрямую: набирая «тормозной диск»,
     человек отправлял тринадцать запросов подряд. */
  const page = readFileSync(new URL("../src/app/parts-finder/page.tsx", import.meta.url), "utf8")
  assert.match(page, /debouncedQ/)
  assert.match(page, /setDebouncedQ\(q\), 350/)
  assert.match(page, /u\.set\("q", debouncedQ\)/)
})

test("прокрутка не пересчитывает раскладку на каждое событие", () => {
  /* Браузер шлёт до сотни событий в секунду, и на каждом читались
     getBoundingClientRect и scrollHeight — то есть раскладка страницы
     пересчитывалась заново. */
  const layout = readFileSync(new URL("../src/components/layout/AppShellLayout.tsx", import.meta.url), "utf8")
  assert.match(layout, /requestAnimationFrame/)
  assert.match(layout, /addEventListener\("scroll", scheduleUpdate/)
  assert.match(layout, /cancelAnimationFrame/)
})

test("кабинет не передёргивает тяжёлую статистику при возврате на вкладку", () => {
  /* Шапка и меню просят тот же адрес с паузой в двадцать секунд; из-за
     расхождения кабинет сбрасывал общий кэш. */
  const page = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8")
  const call = page.slice(page.indexOf('"/api/dashboard/stats"'), page.indexOf('"/api/dashboard/stats"') + 260)
  assert.match(call, /revalidateOnFocus: false/)
  assert.match(call, /dedupingInterval: 20_000/)
})

test("цена похожего лота подписана тем же смыслом, что в списке", () => {
  /* Поле finalPrice было подписано «предварительно под ключ», хотя
     пошлины и доставки в этой сумме нет: на живых лотах разница
     доходила до четырёхсот тысяч рублей. */
  const page = readFileSync(new URL("../src/app/auctions/[id]/page.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(page, /предварительно под ключ/)
})

test("кнопки категорий запчастей дорастают до пальца на телефоне", () => {
  /* Тридцать пикселей — половина от того, во что человек уверенно
     попадает на ходу, а кнопки стоят в ряду с прокруткой: промах
     утаскивает ленту вбок. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const mobile = css.slice(css.indexOf(".parts-category-bar .mantine-Button-root"))
  assert.match(mobile.slice(0, 900), /min-height: 44px/)
})

test("рассылка сохранённых поисков не делает запрос на каждую подписку", () => {
  /* countNewMatches вызывался внутри цикла по всем подпискам, а сама
     выборка шла без ограничения: при десяти тысячах подписок это
     десять тысяч одинаковых запросов подряд в одном прогоне. */
  const notify = readFileSync(new URL("../src/lib/saved-search-notify.ts", import.meta.url), "utf8")
  assert.match(notify, /countCache/)
  assert.match(notify, /countNewMatchesCached/)
  /* Выборка ограничена, а первыми идут те, кого дольше не уведомляли:
     иначе при обрезании списка одни и те же подписки всегда
     оставались бы в хвосте. */
  assert.match(notify, /MAX_SEARCHES_PER_RUN/)
  assert.match(notify, /orderBy: \{ lastNotifiedAt: "asc" \}/)
})

test("каталог получил индексы под свои сортировки", () => {
  /* Фильтр «активное и не удалённое» с сортировкой по цене или дате
     покрывался индексами наполовину: строки отбирались по одному
     условию, а сортировались уже в памяти. */
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
  assert.match(schema, /@@index\(\[status, deletedAt, price, id\]\)/)
  assert.match(schema, /@@index\(\[status, deletedAt, createdAt, id\]\)/)
  /* Дедупликация просмотра ищет по паре «объявление и отпечаток». */
  assert.match(schema, /@@index\(\[listingId, ipHash, createdAt\]\)/)

  const migration = readFileSync(
    new URL("../prisma/migrations/20260830140000_catalog_sort_indexes/migration.sql", import.meta.url),
    "utf8",
  )
  assert.match(migration, /Listing_status_deletedAt_price_id_idx/)
  assert.match(migration, /ListingViewEvent_listingId_ipHash_createdAt_idx/)
})

test("галерея лота не обрывает загрузку своих же снимков", () => {
  /* Список загруженных был и в зависимостях эффекта, и менялся внутри
     него: каждая догруженная картинка перезапускала эффект, а уборка
     обнуляла onload у ещё летящих запросов — часть снимков навсегда
     оставалась в состоянии «грузится». */
  const page = readFileSync(new URL("../src/app/auctions/[id]/page.tsx", import.meta.url), "utf8")
  assert.match(page, /loadedImageUrlsRef/)
  const deps = page.slice(page.indexOf("}, [activeImageHighQuality, activeImageIndex, galleryImages"))
  assert.doesNotMatch(deps.slice(0, 120), /loadedImageUrls\]/)
})

test("разбивка отзывов считается одной группировкой", () => {
  /* Пять отдельных count заново прогоняли тот же фильтр со связью:
     семь запросов на один просмотр публичной страницы отзывов. */
  const route = readFileSync(new URL("../src/app/api/reviews/route.ts", import.meta.url), "utf8")
  assert.match(route, /groupBy\(\{ by: \["rating"\]/)
  assert.doesNotMatch(route, /ratings\.map\(\(rating\) => prisma\.review\.count/)
})

test("гараж не отдаётся целиком", () => {
  /* Выборка шла без ограничения, с тридцатью полями на машину, и по
     каждой считалась готовность к публикации. */
  const route = readFileSync(new URL("../src/app/api/garage/route.ts", import.meta.url), "utf8")
  const list = route.slice(route.indexOf('const vehicles = await prisma.vehicle.findMany'))
  assert.match(list.slice(0, 320), /take: 200/)
})

test("полоса заказа не висит в пустоте на планшете", () => {
  /* Полоса рисуется до 992 пикселей, а нижнее меню появляется только
     до 640: в промежутке она стояла на 92 пикселях над пустотой, а
     кнопка поддержки оказывалась под ней — нажатие открывало чат
     вместо заявки. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const bar = css.slice(css.indexOf(".auction-action-bar {"))
  assert.match(bar.slice(0, 900), /bottom: 0;/)
  /* Подъём над меню перенесён туда, где меню действительно есть. */
  assert.match(css, /@media \(max-width: 640px\) \{\s*\.auction-action-bar \{\s*bottom: calc\(92px/)
  /* Кнопка поддержки поднимается над полосой и на планшете. */
  assert.match(css, /@media \(min-width: 641px\) and \(max-width: 61\.99em\)/)
})

test("фильтр запчастей не теряет параметр из ссылки меню", () => {
  /* Два эффекта работают со строкой запроса: один раскладывает её в
     состояния, другой собирает обратно. Запись успевала сработать
     раньше чтения, и заход по /parts-finder?partType=ENGINE мог
     потерять параметр. */
  const page = readFileSync(new URL("../src/app/parts-finder/page.tsx", import.meta.url), "utf8")
  assert.match(page, /const \[urlRead, setUrlRead\]/)
  assert.match(page, /if \(!urlRead\) return/)
  assert.match(page, /setUrlRead\(true\)/)
})

test("карточка лота разбирает список снимков один раз", () => {
  /* Разбор JSON стоял прямо в разметке дважды подряд: сначала чтобы
     узнать, больше ли одного снимка, потом чтобы вывести число. */
  const page = readFileSync(new URL("../src/app/auctions/page.tsx", import.meta.url), "utf8")
  assert.match(page, /const imageCount = parseAuctionImages\(l\.images\)/)
  assert.doesNotMatch(page, /\(parseAuctionImages\(l\.images\)\?\.length \|\| 0\) > 1/)
})

test("список марок в фильтре запчастей не пересобирается на каждый символ", () => {
  /* Он строится из постоянного справочника, но стоял в теле
     компонента: каждый набранный символ создавал новый массив, и
     выпадающий список пересобирался заново. */
  const page = readFileSync(new URL("../src/app/parts-finder/page.tsx", import.meta.url), "utf8")
  assert.match(page, /const partBrandOptions = useMemo\(/)
})

test("лимитер не перебирает всю карту на каждый запрос", () => {
  /* Полный перебор ради самой старой записи шёл на каждую новую после
     заполнения — ровно тогда, когда лимитер нужен больше всего, он сам
     становился узким местом. */
  const limiter = readFileSync(new URL("../src/lib/rate-limit.ts", import.meta.url), "utf8")
  assert.match(limiter, /evictCount/)
  assert.doesNotMatch(limiter, /earliestReset/)
})

test("прогон парсера mobile.de ограничен по времени", () => {
  /* Тридцать карточек по двадцать секунд таймаута — до десяти минут,
     за которые cron успевает запустить следующий прогон поверх. */
  const route = readFileSync(new URL("../src/app/api/parser/mobile-de/refresh/route.ts", import.meta.url), "utf8")
  assert.match(route, /RUN_DEADLINE_MS/)
  assert.match(route, /skippedByDeadline/)
})

test("модальные окна на телефоне открываются нижним листом", () => {
  /* centered: true ставит окно по центру экрана: на настольном
     мониторе это верно, на телефоне форма упиралась в клавиатуру —
     поле ввода уходило под неё, а закрыть окно можно было только
     мелким крестиком в углу. */
  const theme = readFileSync(new URL("../src/theme/theme.ts", import.meta.url), "utf8")
  assert.match(theme, /app-modal__content/)

  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const sheet = css.slice(css.indexOf(".app-modal__inner"))
  assert.match(sheet.slice(0, 900), /align-items: flex-end/)
  assert.match(sheet.slice(0, 1400), /border-radius: 18px 18px 0 0/)
  /* Вырез снизу у телефонов без кнопки: без запаса кнопка «Сохранить»
     попадала бы под системную полосу. */
  assert.match(sheet.slice(0, 1400), /env\(safe-area-inset-bottom/)
  /* Модалка, задающая свой класс содержимого, тоже становится листом:
     иначе форма партнёрской заявки осталась бы по центру. */
  assert.match(sheet.slice(0, 1400), /\.partner-application-modal/)
})

test("область отрисовки доходит до краёв экрана", () => {
  /* Без viewportFit браузер отдаёт env(safe-area-inset-*) равным нулю,
     и все отступы под вырез экрана по проекту не делают ничего: на
     айфоне нижнее меню и полосы действий уезжают под системную полосу
     жестов, и вместо нажатия срабатывает свайп «домой». */
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8")
  assert.match(layout, /export const viewport: Viewport/)
  assert.match(layout, /viewportFit: "cover"/)
})

test("нижнее меню учитывает вырез экрана", () => {
  /* Меню стояло на двенадцати пикселях от края, а полоса жестов на
     айфоне занимает тридцать четыре: кнопка «Подать объявление»
     оказывалась под ней. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  /* Правило живёт в мобильном медиазапросе, а не в общем блоке. */
  assert.match(css, /\.mobile-bottom-nav \{[^}]*bottom: calc\(12px \+ env\(safe-area-inset-bottom/)
})

test("модальное окно не перекрывается нижним меню", () => {
  /* Mantine ставит окну двухсотый слой, меню — на двухсот пятидесятом:
     нижний лист терял свои нижние восемьдесят пикселей, ровно там, где
     стоит главная кнопка. */
  const theme = readFileSync(new URL("../src/theme/theme.ts", import.meta.url), "utf8")
  assert.match(theme, /zIndex: 300/)

  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  assert.match(css, /body:has\(\.app-modal__inner\) \.mobile-bottom-nav/)
})

test("поле ввода переписки не уезжает под клавиатуру", () => {
  /* Стояло 100vh и жёсткие 620 пикселей минимума: поле с кнопкой
     «Отправить» оказывалось за нижним краем, и до него надо было
     прокручивать страницу, борясь с прокруткой самой переписки. */
  const page = readFileSync(new URL("../src/app/messages/[conversationId]/page.tsx", import.meta.url), "utf8")
  assert.match(page, /100dvh/)
  assert.doesNotMatch(page, /minHeight: 620/)
  assert.doesNotMatch(page, /calc\(100vh/)
})

test("кнопка поддержки не перехватывает «Написать продавцу»", () => {
  /* Защита была написана только для аукциона: на странице объявления
     круглая кнопка ложилась на самую правую кнопку полосы, и нажатие
     открывало чат поддержки вместо письма продавцу. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  assert.match(css, /body:has\(\.listing-action-bar\) \.support-chat__launcher/)
  /* И последние пиксели страницы больше не прячутся под полосой. */
  assert.match(css, /body:has\(\.listing-action-bar\) \{\s*padding-bottom/)
})

test("объявление и карту можно переслать из сообщения бота", () => {
  /* Продавец получал поздравление с публикацией и две кнопки — обе для
     него самого. Чтобы отправить машину в семейный чат, надо было
     копировать ссылку руками, и почти никто этого не делал. */
  const message = readFileSync(new URL("../src/lib/listing-published-message.ts", import.meta.url), "utf8")
  assert.match(message, /Отправить друзьям/)
  assert.match(message, /t\.me\/share\/url/)

  /* Пост про карту живёт в городском чате, где его читают сотни
     человек, и каждый второй знает кого-то, кому карта нужнее. */
  const invite = readFileSync(new URL("../src/lib/fuel-invite-post.ts", import.meta.url), "utf8")
  assert.match(invite, /Переслать другу/)
  assert.match(invite, /t\.me\/share\/url/)
})

test("главная кнопка мини-аппа не ведёт в форму пароля", () => {
  /* Кнопка «Разместить объявление» вела прямо на форму подачи, а она
     закрыта входом: пришедший из бота человек упирался в форму почты и
     пароля, которых у него нет. Тупик на самой заметной кнопке. */
  const shell = readFileSync(new URL("../src/components/telegram/TelegramShell.tsx", import.meta.url), "utf8")
  assert.match(shell, /signedIn\?: boolean/)
  assert.match(shell, /mainAction === false \|\| !signedIn/)

  const app = readFileSync(new URL("../src/components/telegram/TelegramMiniApp.tsx", import.meta.url), "utf8")
  assert.match(app, /signedIn=\{status === "ready"\}/)
})

test("сбой загрузки в мини-аппе не выглядит пустым разделом", () => {
  /* Ошибка из SWR не бралась вовсе: упавший запрос давал пустые данные,
     и человек читал «Пока пусто. В этом разделе ещё нет объявлений».
     В мобильной сети это регулярно, и вывод получался противоположный
     правде — «площадка пустая». */
  for (const file of ["TelegramFeed", "TelegramAuctions", "TelegramNews"]) {
    const source = readFileSync(new URL(`../src/components/telegram/${file}.tsx`, import.meta.url), "utf8")
    assert.match(source, /Не удалось загрузить/, `нет состояния ошибки: ${file}`)
    assert.match(source, /Повторить/, `нечем повторить: ${file}`)
    assert.match(source, /mutate\(\)/, `нет обновления: ${file}`)
  }
})
