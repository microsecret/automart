import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { ageWeight, calculateConfidence, describeConfidence } from "../src/lib/fuel-confidence.ts"

const NOW = new Date("2026-08-29T12:00:00Z")
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

test("свежая отметка весит полностью", () => {
  assert.equal(ageWeight(ago(5), NOW), 1)
  assert.equal(ageWeight(ago(30), NOW), 1)
})

test("вес падает с возрастом", () => {
  /* Топливо разбирают за час-два: отметка получаса и отметка пяти часов
     не могут стоить одинаково. */
  const fresh = ageWeight(ago(60), NOW)
  const old = ageWeight(ago(300), NOW)
  assert.ok(fresh > old, `свежая ${fresh}, старая ${old}`)
  assert.ok(old > 0 && old < 0.3)
})

test("шестичасовая отметка не весит ничего", () => {
  assert.equal(ageWeight(ago(360), NOW), 0)
  assert.equal(ageWeight(ago(600), NOW), 0)
})

test("одна старая отметка даёт низкую уверенность", () => {
  /* Ровно случай, который ломал доверие: карта говорила «есть 92» по
     одной метке восьмичасовой давности, человек ехал и возвращался ни с
     чем. */
  const confidence = calculateConfidence([{ state: "YES", createdAt: ago(300) }], NOW)
  assert.ok(confidence.percent < 40, `получилось ${confidence.percent}%`)
  assert.equal(confidence.label, "низкая")
})

test("несколько свежих согласных отметок дают высокую уверенность", () => {
  const confidence = calculateConfidence([
    { state: "YES", createdAt: ago(10), authorized: true },
    { state: "YES", createdAt: ago(20), authorized: true },
    { state: "YES", createdAt: ago(25), authorized: true },
  ], NOW)
  assert.ok(confidence.percent >= 70, `получилось ${confidence.percent}%`)
  assert.equal(confidence.label, "высокая")
})

test("разногласие роняет уверенность даже при обилии отметок", () => {
  /* Десять отметок пополам не значат ничего: человек не должен ехать по
     такой карте, не проверив. */
  const split = calculateConfidence([
    ...Array.from({ length: 5 }, () => ({ state: "YES" as const, createdAt: ago(15) })),
    ...Array.from({ length: 5 }, () => ({ state: "NO" as const, createdAt: ago(15) })),
  ], NOW)
  const agreed = calculateConfidence([
    { state: "YES", createdAt: ago(15) },
    { state: "YES", createdAt: ago(15) },
  ], NOW)
  assert.ok(split.percent < agreed.percent, `спорных ${split.percent}%, согласных ${agreed.percent}%`)
})

test("отметка вошедшего весит больше анонимной", () => {
  /* Анонимную накрутить проще, и она чаще случайна. */
  const authorized = calculateConfidence([{ state: "YES", createdAt: ago(10), authorized: true }], NOW)
  const anonymous = calculateConfidence([{ state: "YES", createdAt: ago(10) }], NOW)
  assert.ok(authorized.percent > anonymous.percent)
})

test("анонимные отметки всё же учитываются", () => {
  /* Их большая часть: обесценить значило бы получить пустую карту там,
     где мало зарегистрированных. */
  const anonymous = calculateConfidence([
    { state: "YES", createdAt: ago(10) },
    { state: "YES", createdAt: ago(12) },
    { state: "YES", createdAt: ago(15) },
    { state: "YES", createdAt: ago(20) },
  ], NOW)
  assert.ok(anonymous.percent >= 70, `получилось ${anonymous.percent}%`)
})

test("без отметок уверенности нет", () => {
  const confidence = calculateConfidence([], NOW)
  assert.equal(confidence.percent, 0)
  assert.equal(confidence.reports, 0)
  assert.equal(confidence.hours, null)
})

test("совсем старые отметки дают ноль, но остаются в счёте", () => {
  /* Их видно на карте как «давно не отмечали», и число меток человеку
     полезно: оно говорит, что заправку вообще смотрят. */
  const confidence = calculateConfidence([
    { state: "YES", createdAt: ago(600) },
    { state: "YES", createdAt: ago(700) },
  ], NOW)
  assert.equal(confidence.percent, 0)
  assert.equal(confidence.reports, 2)
})

test("строка объясняет, из чего сложилось число", () => {
  /* «Пятьдесят процентов» само по себе непонятно — процентов чего? */
  assert.equal(
    describeConfidence(calculateConfidence([{ state: "YES", createdAt: ago(480) }], NOW)),
    "1 метка за 8 ч",
  )
  assert.equal(
    describeConfidence(calculateConfidence([
      { state: "YES", createdAt: ago(60) },
      { state: "YES", createdAt: ago(90) },
    ], NOW)),
    "2 метки за 2 ч",
  )
  assert.equal(describeConfidence(calculateConfidence([], NOW)), "никто не отмечал")
})

test("склонение меток не хромает", () => {
  const five = calculateConfidence(
    Array.from({ length: 5 }, () => ({ state: "YES" as const, createdAt: ago(30) })),
    NOW,
  )
  assert.match(describeConfidence(five), /5 меток/)
})

// === Как это показано человеку ===

test("уверенность доходит до карточки", () => {
  const summary = readFileSync(new URL("../src/lib/fuel-availability.ts", import.meta.url), "utf8")
  assert.match(summary, /confidencePercent/)
  assert.match(summary, /calculateConfidence/)
})

test("число показывается только при слабых сведениях", () => {
  /* При высокой уверенности оно лишний шум, при низкой —
     предупреждение. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /confidenceLabel !== "высокая"/)
})

test("чужую отметку можно подтвердить одним нажатием", () => {
  /* Сделать свою — выбрать марку, потом «есть» или «нет». Подтвердить
     чужую — одно нажатие, и человек соглашается охотнее. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /Да, подтверждаю/)
  assert.match(reporter, /Уже нет/)
})

test("вес отметки зависит от того, кто отметил", () => {
  // Анонимную накрутить проще, и она чаще случайна.
  const summary = readFileSync(new URL("../src/lib/fuel-availability.ts", import.meta.url), "utf8")
  assert.match(summary, /authorized: Boolean\(row\.userId\)/)
})

test("кластер красится по доле заправок с топливом", () => {
  /* Кружок показывал только число — «5 АЗС», и человек не знал, стоит ли
     туда приближаться. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /clusterState/)
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  assert.match(css, /data-cluster-state="yes"/)
})
