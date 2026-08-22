import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { isTranslationRefusal, isUsableShortTranslation } from "../src/lib/translation-refusal.ts"

test("отказ, попавший на боевой сайт, распознаётся", () => {
  // Ровно этот текст стоял в поле «Местонахождение» у сорока четырёх лотов
  // и уходил в разметку для поисковиков.
  assert.equal(
    isTranslationRefusal("Это не автомобильный текст. Пожалуйста, предоставьте текст для перевода."),
    true,
  )
})

test("другие формы отказа тоже ловятся", () => {
  const refusals = [
    "Не могу перевести данный текст.",
    "К сожалению, текст для перевода отсутствует.",
    "Извините, но это не автомобильный текст.",
    "Пожалуйста, предоставьте текст.",
    "Введите текст для перевода",
    "Это корейский текст, перевод не требуется.",
    "Перевод: Сеул",
  ]
  for (const text of refusals) {
    assert.equal(isTranslationRefusal(text), true, `не распознан отказ: ${text}`)
  }
})

test("настоящий перевод отказом не считается", () => {
  const good = ["Сеул", "Пусан", "Инчхон", "Токио, Япония", "Тёмно-синий", "Гуанчжоу"]
  for (const text of good) {
    assert.equal(isTranslationRefusal(text), false, `ложная тревога: ${text}`)
  }
})

test("пустой ответ отказом не считается — его отсеет другая проверка", () => {
  assert.equal(isTranslationRefusal(""), false)
  assert.equal(isTranslationRefusal(null), false)
  assert.equal(isTranslationRefusal(undefined), false)
})

test("короткая подпись переводится коротко", () => {
  assert.equal(isUsableShortTranslation("서울", "Сеул"), true)
  assert.equal(isUsableShortTranslation("부산광역시", "Пусан"), true)
})

test("абзац вместо подписи города не проходит", () => {
  // Модель иногда вместо перевода описывает: «Сеул — столица Республики
  // Корея, крупнейший город страны...». В поле «Местонахождение» этому
  // не место.
  const essay = "Сеул — столица Республики Корея и крупнейший город страны, расположенный на реке Ханган."
  assert.equal(isUsableShortTranslation("서울", essay), false)
})

test("отказ не проходит как короткий перевод", () => {
  assert.equal(
    isUsableShortTranslation("서울", "Это не автомобильный текст. Пожалуйста, предоставьте текст для перевода."),
    false,
  )
})

test("длинный исходник допускает длинный перевод", () => {
  // Порог считается от длины исходника: адрес из десяти слов переводится
  // в адрес из десяти слов, и это не проза.
  const source = "서울특별시 강남구 테헤란로 152 강남파이낸스센터"
  const translated = "Сеул, район Каннам, Тхэхеран-ро 152, Финансовый центр Каннам"
  assert.equal(isUsableShortTranslation(source, translated), true)
})

test("пустой перевод не годится", () => {
  assert.equal(isUsableShortTranslation("서울", ""), false)
  assert.equal(isUsableShortTranslation("서울", null), false)
})
