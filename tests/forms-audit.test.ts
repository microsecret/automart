import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

/**
 * Проверки по итогам аудита форм.
 *
 * Формы — то место, где человек отдаёт площадке свой труд: пятнадцать
 * минут заполнения, десяток фотографий, список совместимости. Потеря
 * этого не просто раздражает, а прекращает попытку насовсем.
 */

test("одна неудачная фотография не отменяет уже загруженные", () => {
  /* Promise.all отменял всё присвоение при первом отказе: человек
     выбирал восемь фотографий, ждал минуту на мобильном интернете и
     получал пустую сетку — при том что часть уже лежала на сервере. */
  const hook = readFileSync(new URL("../src/hooks/useMarketplaceImageUpload.ts", import.meta.url), "utf8")
  assert.match(hook, /Promise\.allSettled/)
  assert.doesNotMatch(hook, /await Promise\.all\(selected/)
  /* Человек должен знать, сколько доложить. */
  assert.match(hook, /Добавлено \$\{urls\.length\} из \$\{outcomes\.length\}/)
})

test("форма запчасти сохраняет черновик", () => {
  /* Название, цена, номер по каталогу, описание и список
     совместимости жили только в памяти вкладки: случайный «назад»
     стирал работу целиком, притом что фотографии уже лежали на
     сервере — терялись даже их адреса. */
  const page = readFileSync(new URL("../src/app/listings/create/part/page.tsx", import.meta.url), "utf8")
  assert.match(page, /PART_DRAFT_STORAGE_KEY/)
  /* Восстанавливается и список совместимости — его собирают дольше
     всего, по одной машине. */
  assert.match(page, /draft\.compat\?\.length/)
  /* После публикации черновик убирается. */
  assert.match(page, /removeItem\(PART_DRAFT_STORAGE_KEY\)/)
})

test("форма запчасти показывает, какое поле не заполнено", () => {
  /* Единственной подсказкой был всплывающий значок в углу экрана: ни
     одно поле не подсвечивалось, страница не прокручивалась к
     пропуску. */
  const page = readFileSync(new URL("../src/app/listings/create/part/page.tsx", import.meta.url), "utf8")
  assert.match(page, /submitAttempted/)
  assert.match(page, /id="part-name"/)
  assert.match(page, /scrollIntoView/)
})

test("числовые поля открывают цифровую клавиатуру", () => {
  /* type="number" на Android даёт цифры вперемешку с «e» и точкой, а
     колесо мыши незаметно меняет введённый год. */
  const part = readFileSync(new URL("../src/app/listings/create/part/page.tsx", import.meta.url), "utf8")
  assert.match(part, /inputMode="numeric" maxLength=\{4\}/)

  const store = readFileSync(new URL("../src/app/dashboard/store/page.tsx", import.meta.url), "utf8")
  assert.match(store, /type="tel" inputMode="tel" autoComplete="tel"/)
  assert.match(store, /type="email" inputMode="email" autoComplete="email"/)
})

test("новый пароль вводится с возможностью его увидеть", () => {
  /* Человек вслепую набирал восемь с лишним символов дважды и узнавал
     о расхождении только после отправки — всплывающим сообщением,
     причём оба поля оставались заполненными. */
  const page = readFileSync(new URL("../src/app/auth/reset-password/page.tsx", import.meta.url), "utf8")
  assert.match(page, /<PasswordInput/)
  assert.match(page, /Пароли не совпадают/)
  assert.match(page, /Минимум 8 символов" : undefined/)
})
