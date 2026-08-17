import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { inferNewsTags } from "../src/lib/news-content.ts"

test("adds bounded topic tags for imported automotive news", () => {
  const tags = inferNewsTags(
    "Новый электромобиль привезут из Китая",
    "Стали известны цена, условия импорта и доставки автомобиля в Россию.",
  )

  assert.deepEqual(tags, ["автоновости", "автоизКитая", "электромобили", "импортАвто", "ценыНаАвто", "доставкаАвто"])
  assert.ok(tags.length <= 12)
})

test("keeps supplied tags unique and preserves editorial hashtags", () => {
  const tags = inferNewsTags("Новости рынка", "Обзор #АвтоРынок", ["авторынок", "#LeWheel"])
  assert.deepEqual(tags, ["авторынок", "LeWheel", "автоновости"])
})
