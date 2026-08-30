"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Box, Button, Loader, Stack, Text } from "@mantine/core"
import { IconAlertTriangle, IconBrandTelegram } from "@tabler/icons-react"
import { tapFeedback, waitForTelegramWebApp } from "@/lib/telegram-webapp"
import { CREATE_VEHICLE_HREF } from "@/lib/navigation-registry"
import TelegramShell from "./TelegramShell"
import TelegramFeed from "./TelegramFeed"
import TelegramAuctions from "./TelegramAuctions"
import TelegramNews from "./TelegramNews"
import TelegramMessages from "./TelegramMessages"

/**
 * Приложение LeWheel внутри Telegram.
 *
 * Раньше человек, открывший приложение, видел экран приветствия и четыре
 * группы ссылок — «Найти автомобиль», «Продать», «Мой кабинет»,
 * «Сервисы». Ни одной машины. Продавец не понимал, что здесь продают, а
 * покупатель закрывал, не пролистав.
 *
 * Теперь это лента машин с первого экрана и навигация внизу, как в
 * мобильном приложении. Вход по подписи Telegram остаётся прежним и
 * проходит незаметно: он не должен стоять между человеком и товаром.
 */

/* Куда вести, если человек пришёл по кнопке из бота.

   Кнопки передают цель через startapp: «разместить объявление» — create.
   Без разбора все попадали на главную приложения, то есть жали
   «разместить», а оказывались не там.

   Только известные значения: чужой параметр стал бы открытым
   перенаправлением внутри приложения. */
const START_PARAM_ROUTES: Record<string, string> = {
  create: `${CREATE_VEHICLE_HREF}?source=telegram`,
  promo: "/auctions?from=telegram",
}

/* Объявление из поста в чате: listing_<идентификатор>.

   Идентификатор проверяется по набору символов, а не подставляется как
   есть: без проверки чужая строка в параметре увела бы человека на
   произвольный адрес внутри приложения. */
const LISTING_PARAM = /^listing_([0-9a-f-]{16,40})$/i

/* Тема форума: forum_<раздел>__<тема>.

   Раздел и тема вместе, потому что адрес темы содержит раздел и без него
   страница отвечает «не найдено». Разделитель двойной: в самих адресах
   встречаются дефисы, но не подчёркивания, и одинарное могло бы попасться
   внутри. Набор символов проверяется — иначе чужая строка в параметре
   увела бы человека на произвольный адрес внутри приложения. */
const FORUM_PARAM = /^forum_([a-z0-9-]{1,80})__([a-z0-9-]{1,120})$/i

function resolveStartRoute(initData: string): string | null {
  try {
    const startParam = (
      new URLSearchParams(initData).get("start_param")
      || new URLSearchParams(window.location.search).get("start")
    )?.trim()
    if (!startParam) return null

    const known = START_PARAM_ROUTES[startParam]
    if (known) return known

    const listing = startParam.match(LISTING_PARAM)
    if (listing) return `/listings/vehicle/${listing[1]}?from=telegram`

    const forum = startParam.match(FORUM_PARAM)
    if (forum) return `/forum/${forum[1]}/${forum[2]}?from=telegram`

    return null
  } catch {
    return null
  }
}

/* Состояния входа.

   «browser» — человек открыл ссылку в обычном браузере, вне Telegram.
   «signup» — он внутри Telegram, но боту незнаком: приглашение, а не
   ошибка. «error» — вход сорвался по-настоящему. Раньше два последних
   были одним, и новому человеку показывали тревожный значок с текстом
   «Регистрация не завершена» за действие, которого он не совершал. */
type Status = "loading" | "ready" | "browser" | "signup" | "error"

export default function TelegramMiniApp() {
  /* Раздел читается из адреса, а не хранится в состоянии.

     Тогда кнопка «назад» в Telegram возвращает к предыдущей вкладке, а
     не закрывает приложение — как в любом мобильном приложении. */
  const rawTab = useSearchParams().get("tab")
  const tab = rawTab === "auctions" || rawTab === "news" || rawTab === "chats" ? rawTab : "vehicles"
  /* Смена вкладки начинается сверху.

     Вкладки переключаются сменой параметра в адресе, а не переходом на
     другую страницу: React не размонтирует оболочку, и позиция
     прокрутки сохраняется. Человек долистывал ленту до двадцатой
     машины, нажимал «Новости» — и оказывался в середине списка
     новостей, не понимая, куда попал.

     Первая отрисовка пропускается: на ней прокрутка и так наверху, а
     лишний вызов сбил бы возврат по кнопке «назад», когда браузер
     восстанавливает прежнее положение. */
  const previousTabRef = useRef(tab)
  useEffect(() => {
    if (previousTabRef.current === tab) return
    previousTabRef.current = tab
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [tab])

  const [status, setStatus] = useState<Status>("loading")
  const [message, setMessage] = useState("")
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    let disposed = false

    async function authorize() {
      const webApp = await waitForTelegramWebApp()
      if (disposed) return

      if (!webApp) {
        setStatus("browser")
        setMessage("Это приложение открывается кнопкой внутри Telegram.")
        return
      }

      if (!webApp.initData) {
        /* Платформа есть, а данных нет: человек внутри Telegram, но
           открыл приложение по прямой ссылке или в старом клиенте.
           Раньше ему советовали «откройте внутри Telegram» — там, где
           он уже находится, — и предлагали уйти на сайт. */
        setStatus("signup")
        setMessage("Откройте приложение кнопкой в боте — так Telegram передаст ваш профиль.")
        return
      }

      try {
        const result = await signIn("telegram", { initData: webApp.initData, redirect: false })
        if (disposed) return

        if (!result?.ok) {
          /* Вход не прошёл по двум разным причинам, и человеку они
             видятся по-разному: одному сервис незнаком вовсе, другой
             начал регистрацию и бросил. Обоим показывали одинаковый
             текст «Регистрация не завершена» с тревожным значком —
             первый читал это как обвинение в том, чего не делал.

             Различить их здесь нельзя: сервер отвечает одинаково. Но
             приглашение подходит обоим — тот, кто начал, поймёт, куда
             вернуться, а новый не испугается. */
          setStatus("signup")
          setMessage("Чтобы отмечать и писать продавцам, нужен профиль — бот заведёт его за три шага.")
          return
        }

        /* Пришёл по кнопке с целью — ведём сразу, не задерживая на ленте. */
        const startRoute = resolveStartRoute(webApp.initData)
        if (startRoute) {
          window.location.assign(startRoute)
          return
        }

        setStatus("ready")
      } catch {
        if (disposed) return
        setStatus("error")
        setMessage("Сервис входа временно недоступен. Откройте приложение ещё раз.")
      }
    }

    void authorize()
    return () => {
      disposed = true
    }
  }, [])

  /* Лента показывается, не дожидаясь входа.

     Вход нужен, чтобы сохранять избранное и подавать объявления, но
     смотреть машины можно и без него. Экран ожидания перед лентой — то
     самое, от чего мы уходим: человек пришёл за товаром, а видит
     служебное сообщение. */
  const HEADINGS = {
    vehicles: { title: "Свежие объявления", subtitle: "Транспорт с проверкой и доставкой", href: "/telegram" },
    auctions: { title: "Мировые аукционы", subtitle: "Корея, Япония и Китай с расчётом под ключ", href: "/telegram?tab=auctions" },
    news: { title: "Новости авторынка", subtitle: "Что происходит с ценами и рынком", href: "/telegram?tab=news" },
    chats: { title: "Сообщения", subtitle: "Переписка с продавцами", href: "/telegram?tab=chats" },
  } as const
  const heading = HEADINGS[tab]

  if (status === "browser" || status === "signup" || status === "error") {
    return (
      <TelegramShell title={heading.title} subtitle={heading.subtitle} activeTab={heading.href} signedIn={false}>
        <Stack gap="md">
          {/* Тревожный вид — только настоящей ошибке.

              Приглашение зарегистрироваться и сорвавшийся вход
              выглядели одинаково: красная плашка со значком
              предупреждения. Человек, впервые открывший приложение,
              видел её на первом же экране. */}
          <Box className="tg-notice" data-tone={status === "error" ? "error" : undefined}>
            {status === "error" ? <IconAlertTriangle size={18} /> : <IconBrandTelegram size={18} />}
            <Text size="sm">{message}</Text>
          </Box>
          {(status === "error" || status === "signup") && botUsername && (
            <Button
              component="a"
              href={`https://t.me/${botUsername}`}
              onClick={() => tapFeedback()}
              className="tg-button"
              fullWidth
            >
              {status === "signup" ? "Открыть бот и завести профиль" : "Открыть бот"}
            </Button>
          )}
          {status === "browser" && (
            <Button component={Link} href="/" onClick={() => tapFeedback()} className="tg-button" fullWidth>
              Перейти на сайт
            </Button>
          )}
          {tab === "auctions" ? <TelegramAuctions />
            : tab === "news" ? <TelegramNews />
            : tab === "chats" ? <TelegramMessages />
            : <TelegramFeed />}
        </Stack>
      </TelegramShell>
    )
  }

  return (
    <TelegramShell
      title={heading.title}
      subtitle={heading.subtitle}
      activeTab={heading.href}
      /* Кнопка «Разместить объявление» появляется только после входа:
         иначе она вела в форму пароля, которой у пришедшего из бота
         нет. */
      signedIn={status === "ready"}
    >
      {/* Лента показывается сразу, вход подтягивается сбоку.

          Здесь стоял экран ожидания со спиннером: человек открывал
          мини-приложение и вместо машин видел «Открываем ваш аккаунт…»
          до тех пор, пока не отработает вход. Это ровно то, от чего
          сказано уходить в комментарии выше, — а код делал наоборот.

          Вход нужен, чтобы сохранять избранное и писать продавцам;
          смотреть машины можно и без него. Поэтому лента рисуется
          сразу, а состояние входа занимает одну тонкую строку и
          исчезает, как только вход прошёл.

          Переписка — исключение: без входа показывать нечего, и там
          ожидание честнее пустого экрана. */}
      {status === "loading" && (
        <Box className="tg-notice" data-tone="muted" mb="sm">
          <Loader size="xs" color="var(--tg-accent)" />
          <Text size="xs">Открываем ваш аккаунт…</Text>
        </Box>
      )}

      {tab === "auctions" ? (
        <TelegramAuctions />
      ) : tab === "news" ? (
        <TelegramNews />
      ) : tab === "chats" ? (
        status === "loading" ? (
          <Stack align="center" py={40} gap="xs">
            <Loader size="sm" color="var(--tg-accent)" />
            <Text size="xs" c="var(--tg-hint)">Открываем переписку…</Text>
          </Stack>
        ) : (
          <TelegramMessages />
        )
      ) : (
        <TelegramFeed />
      )}
    </TelegramShell>
  )
}
