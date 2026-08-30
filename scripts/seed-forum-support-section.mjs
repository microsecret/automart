/**
 * Раздел форума про саму площадку и тема о технических ошибках.
 *
 * Человек, у которого что-то не работает, шёл в чат поддержки — и каждый
 * писал оператору одно и то же в отдельной переписке. Никто не видел,
 * что сосед уже спрашивал про это вчера и получил ответ, а исправления
 * оставались невидимыми: о них знал только тот, кто написал.
 *
 * Тема на форуме делает обе стороны видимыми — и жалобы, и починки.
 *
 * Запускается идемпотентно: раздел и тема с теми же адресами
 * обновляются, а не дублируются, поэтому скрипт можно гонять на каждом
 * деплое.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const SECTION = {
  slug: "o-ploshchadke",
  title: "О площадке",
  description: "Технические вопросы, предложения и обсуждение работы LeWheel",
  groupKey: "TOPIC",
  position: 90,
}

const TOPIC = {
  slug: "tehnicheskie-oshibki",
  title: "Технические ошибки: сообщайте здесь",
  /* «Помогите» — из пяти доступных меток ближе всего по смыслу:
     «Отчёт» на форуме означает рассказ о поездке или ремонте. */
  prefix: "HELP",
  isPinned: true,
}

const FIRST_POST = [
  "Если что-то на площадке работает не так — напишите сюда. Тема закреплена: сюда же приходят ответы о том, что уже исправлено.",
  "",
  "**Что помогает починить быстрее**",
  "",
  "1. Где это произошло: сайт на компьютере, сайт на телефоне или приложение в Telegram. Это разные оболочки, и ошибки в них тоже разные.",
  "2. Что вы делали и что ожидали увидеть.",
  "3. Снимок экрана, если ошибку видно глазами.",
  "4. Марка браузера, если дело на компьютере: Chrome, Safari, Firefox.",
  "",
  "**Прежде чем писать**",
  "",
  "• Страница не открывается совсем — обновите её с очисткой кэша: Ctrl+F5 на компьютере. В приложении Telegram закройте и откройте его заново, мессенджер держит страницы в памяти дольше браузера.",
  "• Не загружается фотография — проверьте размер: до 10 МБ, форматы JPG, PNG, WebP. Снимки с iPhone в формате HEIC не примутся, в настройках камеры нужно выбрать «Наиболее совместимый».",
  "• Не приходит письмо — почтовый провайдер на площадке ещё не подключён. Вход работает по номеру телефона и через Telegram-бота.",
  "",
  "**Срочное**",
  "",
  "Если дело касается денег, доступа к аккаунту или чужих данных — не ждите ответа в теме, напишите в чат поддержки: значок наушников в правом нижнем углу. Там переписка видна только вам и оператору.",
].join("\n\n")

async function main() {
  /* Автор темы — администратор площадки: тема закреплённая и говорит от
     имени команды, а не от случайного человека. */
  const author = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  if (!author) {
    console.log("Тема о технических ошибках пропущена: администратора в базе нет")
    return
  }

  const section = await prisma.forumSection.upsert({
    where: { slug: SECTION.slug },
    create: SECTION,
    update: {
      title: SECTION.title,
      description: SECTION.description,
      groupKey: SECTION.groupKey,
      position: SECTION.position,
    },
    select: { id: true },
  })

  const existing = await prisma.forumTopic.findUnique({
    where: { slug: TOPIC.slug },
    select: { id: true },
  })

  if (existing) {
    /* Текст первого сообщения обновляем — в нём инструкция, и она
       меняется вместе с площадкой. Ответы людей при этом не трогаем. */
    const firstPost = await prisma.forumPost.findFirst({
      where: { topicId: existing.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    if (firstPost) {
      await prisma.forumPost.update({ where: { id: firstPost.id }, data: { content: FIRST_POST } })
    }
    await prisma.forumTopic.update({
      where: { id: existing.id },
      data: { title: TOPIC.title, isPinned: true, sectionId: section.id },
    })
    console.log("Тема о технических ошибках обновлена")
    return
  }

  const topic = await prisma.forumTopic.create({
    data: {
      slug: TOPIC.slug,
      title: TOPIC.title,
      sectionId: section.id,
      authorId: author.id,
      isPinned: TOPIC.isPinned,
      prefix: TOPIC.prefix,
    },
    select: { id: true },
  })

  await prisma.forumPost.create({
    data: { topicId: topic.id, authorId: author.id, content: FIRST_POST },
  })

  console.log("Раздел «О площадке» и тема о технических ошибках созданы")
}

main()
  .catch((error) => {
    console.error("Не удалось создать тему форума:", error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
