import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

/**
 * Проверки самого файла стилей.
 *
 * Появились после того, как правка блока записала селектор дважды в одну
 * строку — «.fuel-map-marker {.fuel-map-marker {». CSS перестал
 * разбираться, сборка упала с «Unclosed block», и обнаружилось это только
 * на продакшене: остальные тесты проверяют содержимое файла, а не его
 * разбираемость.
 *
 * Полноценный разбор здесь не нужен — достаточно поймать поломки,
 * которые возникают при правках текстом.
 */

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")

/** Убирает комментарии: скобки и кавычки внутри них считать нельзя. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "")
}

test("скобки в стилях парные", () => {
  /* Лишняя открывающая — это «Unclosed block» при сборке, и весь сайт
     остаётся на прежней версии. */
  const clean = withoutComments(css)
  const open = (clean.match(/\{/g) || []).length
  const close = (clean.match(/\}/g) || []).length
  assert.equal(open, close, `открывающих ${open}, закрывающих ${close}`)
})

test("нет задвоенных селекторов в одной строке", () => {
  /* Ровно та поломка, ради которой написан файл: при замене блока
     селектор записался дважды подряд. */
  const lines = withoutComments(css).split("\n")
  for (const [index, line] of lines.entries()) {
    const braces = (line.match(/\{/g) || []).length
    assert.ok(
      braces <= 1,
      `строка ${index + 1}: две открывающие скобки — «${line.trim().slice(0, 70)}»`,
    )
  }
})

test("нет незакрытых комментариев", () => {
  /* Незакрытый комментарий съедает весь остаток файла молча: стили
     пропадают, а сборка проходит. */
  const opens = (css.match(/\/\*/g) || []).length
  const closes = (css.match(/\*\//g) || []).length
  assert.equal(opens, closes, `открыто ${opens} комментариев, закрыто ${closes}`)
})

test("нет пустых правил", () => {
  /* Пустое правило почти всегда след неудачной правки: блок вырезали, а
     селектор забыли. */
  const empty = withoutComments(css).match(/[^{}]+\{\s*\}/g)
  assert.equal(empty, null, `пустые правила: ${empty?.slice(0, 3).join(", ")}`)
})
