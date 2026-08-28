import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

/* Модуль читается как текст: он тянет Prisma через псевдоним «@/»,
   которого запускатель тестов не разбирает. */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

const backfill = read("../src/lib/listing-chat-backfill.ts")
const route = read("../src/app/api/telegram/listing-backfill/route.ts")
const cron = read("../scripts/install-listing-backfill-cron.sh")
const deploy = read("../scripts/deploy-production.sh")

test("за раз уходит одно объявление", () => {
  /* Десять постов подряд в чат читаются как захват группы, даже когда
     каждое объявление по делу. */
  assert.match(backfill, /PER_RUN = 1/)
  assert.match(backfill, /take: PER_RUN/)
})

test("уже разосланное не повторяется", () => {
  // Два одинаковых поста раздражают сильнее, чем их отсутствие.
  assert.match(backfill, /chatPosts: \{ none: \{\} \}/)
})

test("свежее объявление досылка не перехватывает", () => {
  /* Оно уходит в чат само, при одобрении. Без паузы досылка гонялась бы
     с автопубликацией наперегонки и слала бы то же объявление дважды. */
  assert.match(backfill, /SETTLE_MS/)
  assert.match(backfill, /publishedAt: \{ lt: settledBefore \}/)
})

test("снятое и удалённое в чат не уходит", () => {
  assert.match(backfill, /status: "ACTIVE"/)
  assert.match(backfill, /deletedAt: null/)
})

test("запчасти не рассылаются", () => {
  // У запчасти своя карточка, и пост объявления её не описывает.
  assert.match(backfill, /vehicle: \{ isNot: null \}/)
})

test("маршрут закрыт ключом бота", () => {
  // Иначе разослать объявления в сто пятнадцать тысяч подписчиков смог
  // бы любой, кто знает адрес.
  assert.match(route, /createTelegramWorkerRoute/)
})

test("задание ставится деплоем и не задваивается", () => {
  assert.match(deploy, /install-listing-backfill-cron\.sh/)
  assert.match(cron, /replace_cron_job "# automart-listing-backfill"/)
})

test("час запуска не совпадает с другими рассылками", () => {
  /* Одновременный запуск двух рассылок дал бы два поста подряд в один
     чат. Занятые минуты: 8, 13, 15, 17, 20, 27, 35, 41. */
  const minute = cron.match(/JOB="(\d+) /)?.[1]
  assert.ok(minute, "минута запуска не найдена")
  assert.ok(!["8", "13", "15", "17", "20", "27", "35", "41"].includes(minute))
})
