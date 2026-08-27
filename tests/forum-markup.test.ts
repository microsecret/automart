import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { applyLinePrefix, applyMarkup, isSafeLinkUrl, renderForumMarkup, stripForumMarkup } from "../src/lib/forum-markup.ts"

// === Безопасность ===

test("теги из сообщения не доходят до разметки", () => {
  // Главная проверка файла: сообщение форума пишет посторонний человек,
  // и <script> в нём означал бы кражу сессий у всех читателей темы.
  const html = renderForumMarkup('<script>alert("украл")</script>')
  assert.doesNotMatch(html, /<script/)
  assert.match(html, /&lt;script&gt;/)
})

test("картинка с обработчиком ошибки обезврежена", () => {
  // Классический обход: тега script нет, а код выполняется. Проверяем
  // отсутствие рабочего тега — сам текст «onerror=» внутри экранированной
  // строки безвреден и виден человеку как написанное.
  const html = renderForumMarkup('<img src=x onerror="alert(1)">')
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img/)
  assert.doesNotMatch(html, /"alert\(1\)"/)
})

test("ссылка с javascript отбрасывается", () => {
  // Ссылка не создаётся вовсе: текст остаётся написанным как есть, и
  // нажать на него нельзя.
  const html = renderForumMarkup("[нажми](javascript:alert(1))")
  assert.doesNotMatch(html, /<a /)
  assert.doesNotMatch(html, /href=/)
})

test("ссылка на данные отбрасывается", () => {
  const html = renderForumMarkup("[смотри](data:text/html,<script>alert(1)</script>)")
  assert.doesNotMatch(html, /<a /)
})

test("перевод строки внутри адреса не обходит проверку", () => {
  // «java\nscript:» — известный приём обхода наивных проверок.
  assert.equal(isSafeLinkUrl("java\nscript:alert(1)"), false)
  assert.equal(isSafeLinkUrl("https://drom.ru"), true)
  assert.equal(isSafeLinkUrl("mailto:ivan@example.com"), true)
})

test("кавычки в тексте не разрывают атрибут", () => {
  const html = renderForumMarkup('Он сказал "привет"')
  assert.doesNotMatch(html, /="привет"/)
  assert.match(html, /&quot;/)
})

test("внешняя ссылка помечена nofollow", () => {
  // Без этого форум за месяц становится площадкой для ссылочного спама.
  const html = renderForumMarkup("[Дром](https://drom.ru)")
  assert.match(html, /rel="nofollow noopener noreferrer"/)
  assert.match(html, /href="https:\/\/drom\.ru"/)
})

// === Разметка ===

test("жирный и курсив", () => {
  assert.match(renderForumMarkup("**важно**"), /<strong>важно<\/strong>/)
  assert.match(renderForumMarkup("*замечание*"), /<em>замечание<\/em>/)
})

test("жирный не путается с курсивом", () => {
  // Одна регулярка на оба случая давала <em>*текст*</em>.
  const html = renderForumMarkup("**точно**")
  assert.match(html, /<strong>точно<\/strong>/)
  assert.doesNotMatch(html, /<em>/)
})

test("зачёркнутый и код", () => {
  assert.match(renderForumMarkup("~~было~~"), /<del>было<\/del>/)
  assert.match(renderForumMarkup("`P0171`"), /<code>P0171<\/code>/)
})

test("звёздочки внутри кода остаются звёздочками", () => {
  // Человек показывает синтаксис, а не форматирует текст.
  const html = renderForumMarkup("`**вот так**`")
  assert.match(html, /<code>\*\*вот так\*\*<\/code>/)
  assert.doesNotMatch(html, /<strong>/)
})

test("маркированный список", () => {
  const html = renderForumMarkup("- масло\n- фильтр\n- свечи")
  assert.match(html, /<ul><li>масло<\/li><li>фильтр<\/li><li>свечи<\/li><\/ul>/)
})

test("нумерованный список", () => {
  const html = renderForumMarkup("1. снять колесо\n2. открутить суппорт")
  assert.match(html, /<ol><li>снять колесо<\/li><li>открутить суппорт<\/li><\/ol>/)
})

test("списки разных видов не сливаются", () => {
  const html = renderForumMarkup("- первый\n1. второй")
  assert.match(html, /<ul>/)
  assert.match(html, /<ol>/)
})

test("цитата", () => {
  const html = renderForumMarkup("> так писал автор темы")
  assert.match(html, /<blockquote>так писал автор темы<\/blockquote>/)
})

test("абзацы разделяются пустой строкой", () => {
  const html = renderForumMarkup("Первый абзац.\n\nВторой абзац.")
  assert.equal((html.match(/<p>/g) || []).length, 2)
})

test("перенос внутри абзаца сохраняется", () => {
  const html = renderForumMarkup("строка один\nстрока два")
  assert.match(html, /<br \/>/)
  assert.equal((html.match(/<p>/g) || []).length, 1)
})

test("пустое сообщение не даёт пустых тегов", () => {
  assert.equal(renderForumMarkup(""), "")
  assert.equal(renderForumMarkup("\n\n\n"), "")
})

// === Пересказ без разметки ===

test("пересказ убирает пометки", () => {
  const text = stripForumMarkup("**Важно**: смотрите `код` и [ссылку](https://drom.ru)")
  assert.equal(text, "Важно: смотрите код и ссылку")
})

test("пересказ убирает списки и цитаты", () => {
  assert.equal(stripForumMarkup("> цитата\n- пункт"), "цитата пункт")
})

// === Панель ===

test("кнопка оборачивает выделенное", () => {
  const result = applyMarkup("это важно очень", 4, 9, "**")
  assert.equal(result.value, "это **важно** очень")
  assert.equal(result.selectionStart, 6)
  assert.equal(result.selectionEnd, 11)
})

test("повторное нажатие снимает пометку", () => {
  // Иначе получаются ****двойные звёздочки****.
  const result = applyMarkup("это **важно** очень", 6, 11, "**")
  assert.equal(result.value, "это важно очень")
})

test("без выделения курсор встаёт внутрь пометки", () => {
  const result = applyMarkup("текст ", 6, 6, "**")
  assert.equal(result.value, "текст ****")
  assert.equal(result.selectionStart, 8)
  assert.equal(result.selectionEnd, 8)
})

test("пометка строк ставится в начало каждой", () => {
  const result = applyLinePrefix("масло\nфильтр", 0, 12, "- ")
  assert.equal(result.value, "- масло\n- фильтр")
})

test("повторное нажатие снимает пометку строк", () => {
  const result = applyLinePrefix("- масло\n- фильтр", 0, 16, "- ")
  assert.equal(result.value, "масло\nфильтр")
})

// === Картинки ===

test("картинка с нашего сервера превращается в изображение", () => {
  const html = renderForumMarkup("![Стук в подвеске](/uploads/abc-123.jpg)")
  assert.match(html, /<img src="\/uploads\/abc-123\.jpg"/)
  assert.match(html, /alt="Стук в подвеске"/)
  // Без отложенной загрузки тема с двумя десятками фотографий грузится минуту.
  assert.match(html, /loading="lazy"/)
})

test("картинка с чужого адреса не вставляется", () => {
  /* Чужой адрес — счётчик посещений в руках постороннего: владелец видит
     IP и время захода каждого, кто открыл тему. */
  const html = renderForumMarkup("![вот](https://example.com/spy.png)")
  assert.doesNotMatch(html, /<img/)
})

test("выход из папки загрузок закрыт", () => {
  const html = renderForumMarkup("![подмена](/uploads/../../etc/passwd.png)")
  assert.doesNotMatch(html, /<img/)
})

test("подпись картинки не выносит из атрибута", () => {
  const html = renderForumMarkup('![" onerror="alert(1)](/uploads/a.png)')
  assert.doesNotMatch(html, /onerror="alert/)
})

test("картинка разбирается раньше ссылки", () => {
  // Иначе от «![подпись](адрес)» остаётся висящий восклицательный знак.
  const html = renderForumMarkup("![фото](/uploads/x.webp)")
  assert.doesNotMatch(html, /!\s*<a/)
  assert.match(html, /<img/)
})

// === Видео ===

test("ссылка на YouTube становится проигрывателем", () => {
  const html = renderForumMarkup("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.match(html, /<iframe/)
  // Домен без слежения: обычный youtube.com ставит счётчики до нажатия.
  assert.match(html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/)
})

test("короткая ссылка YouTube тоже распознаётся", () => {
  const html = renderForumMarkup("https://youtu.be/dQw4w9WgXcQ")
  assert.match(html, /embed\/dQw4w9WgXcQ/)
})

test("RuTube и VK распознаются", () => {
  // YouTube в России открывается не у всех: без этих площадок половина
  // читателей увидит пустую рамку.
  const rutube = renderForumMarkup(`https://rutube.ru/video/${"a1b2c3d4".repeat(4)}/`)
  assert.match(rutube, /rutube\.ru\/play\/embed/)

  const vk = renderForumMarkup("https://vkvideo.ru/video-12345_678")
  assert.match(vk, /video_ext\.php\?oid=-12345&id=678/)
})

test("чужая площадка видео не вставляется рамкой", () => {
  /* Рамка исполняет чужой код в нашем окне, поэтому список площадок
     закрытый. */
  const html = renderForumMarkup("https://evil.example/video/1")
  assert.doesNotMatch(html, /<iframe/)
})

test("поддельный адрес с именем площадки внутри отбрасывается", () => {
  const html = renderForumMarkup("https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ")
  assert.doesNotMatch(html, /<iframe/)
})

test("рамка видео ограничена песочницей", () => {
  const html = renderForumMarkup("https://youtu.be/dQw4w9WgXcQ")
  assert.match(html, /sandbox="/)
  // Без этого чужая страница видит, откуда пришёл посетитель, целиком.
  assert.match(html, /referrerpolicy="strict-origin-when-cross-origin"/)
})

// === Заголовки, разделитель, спойлер ===

test("заголовки второго и третьего уровня", () => {
  const html = renderForumMarkup("## Что менял\n### Расходники")
  assert.match(html, /<h2>Что менял<\/h2>/)
  assert.match(html, /<h3>Расходники<\/h3>/)
})

test("заголовка первого уровня нет", () => {
  // Заголовок страницы один, и это название темы.
  const html = renderForumMarkup("# Название")
  assert.doesNotMatch(html, /<h1>/)
})

test("разделитель из дефисов", () => {
  const html = renderForumMarkup("Первое\n\n---\n\nВторое")
  assert.match(html, /<hr \/>/)
})

test("спойлер скрывает ответ", () => {
  const html = renderForumMarkup("Ответ: ||задний ступичный||")
  assert.match(html, /class="forum-spoiler"/)
  assert.match(html, /задний ступичный/)
})

// === Блок кода ===

test("блок кода не разбирает разметку внутри", () => {
  /* Вставленный кусок конфига со звёздочками не должен превращаться в
     курсив. */
  const html = renderForumMarkup("```\nCHECK *ALL* --flags\n```")
  assert.match(html, /<pre class="forum-code">/)
  assert.doesNotMatch(html, /<em>/)
  assert.match(html, /\*ALL\*/)
})

test("теги внутри блока кода остаются безопасными", () => {
  const html = renderForumMarkup("```\n<script>alert(1)</script>\n```")
  assert.doesNotMatch(html, /<script/)
  assert.match(html, /&lt;script&gt;/)
})

test("незакрытый блок кода не теряет написанное", () => {
  const html = renderForumMarkup("```\nP0301 misfire")
  assert.match(html, /P0301 misfire/)
})

// === Таблицы ===

test("таблица собирается с шапкой", () => {
  const html = renderForumMarkup("| Модель | Цена |\n| --- | --- |\n| Jolion | 2 100 000 |")
  assert.match(html, /<th>Модель<\/th>/)
  assert.match(html, /<td>Jolion<\/td>/)
  // На телефоне таблица на пять столбцов не помещается в экран.
  assert.match(html, /forum-table-wrap/)
})

test("разделительная строка таблицы не становится рядом", () => {
  const html = renderForumMarkup("| А | Б |\n| --- | --- |\n| 1 | 2 |")
  assert.doesNotMatch(html, /<td>---<\/td>/)
})

// === Упоминания ===

test("упоминание ведёт на участника, а не на чужой адрес", () => {
  const html = renderForumMarkup("Спасибо, @Механик77")
  assert.match(html, /href="\/forum\/users\/[^"]*"/)
  assert.match(html, /class="forum-mention"/)
})

test("почта не превращается в упоминание", () => {
  // Иначе адрес «ivan@mail.ru» распался бы на текст и ссылку на участника.
  const html = renderForumMarkup("Пишите ivan@mail.ru")
  assert.doesNotMatch(html, /forum-mention/)
})

// === Очистка разметки для поиска ===

test("новые пометки не попадают в описание для поиска", () => {
  const text = stripForumMarkup("## Итог\n\n||секрет||\n\n| А | Б |\n| --- | --- |\n| 1 | 2 |\n\n![фото](/uploads/a.jpg)")
  assert.doesNotMatch(text, /##|\|\||---/)
  assert.match(text, /Итог/)
  assert.match(text, /секрет/)
  assert.match(text, /фото/)
})

test("содержимое блока кода не идёт в описание страницы", () => {
  const text = stripForumMarkup("Смотрите лог:\n```\nP0301 P0302 P0303\n```\nВот так.")
  assert.doesNotMatch(text, /P0301/)
  assert.match(text, /Смотрите лог/)
})

test("спойлер в начале строки не превращается в таблицу", () => {
  /* Строка «||секрет||» начинается и кончается вертикальной чертой, как
     строка таблицы. Разбор таблицы стоял раньше и съедал её, выдавая
     таблицу из пустых ячеек вместо скрытого текста. */
  const html = renderForumMarkup("||задний ступичный||")
  assert.match(html, /forum-spoiler/)
  assert.doesNotMatch(html, /forum-table/)
})

test("несколько спойлеров в строке остаются спойлерами", () => {
  const html = renderForumMarkup("||первый|| и ||второй||")
  assert.doesNotMatch(html, /forum-table/)
  assert.match(html, /первый/)
  assert.match(html, /второй/)
})

test("таблица из одного столбца всё ещё собирается", () => {
  // Проверка, что защита от спойлера не сломала обычные таблицы.
  const html = renderForumMarkup("| Пробег |\n| --- |\n| 120000 |")
  assert.match(html, /<th>Пробег<\/th>/)
  assert.match(html, /<td>120000<\/td>/)
})

test("исполняемого кода не проходит ни в одной новой конструкции", () => {
  /* Общая проверка поверх частных: экранированный текст безвреден, а вот
     рабочий тег с обработчиком — нет. Ищем именно исполняемое. */
  const attacks = [
    '![a](/uploads/a.jpg" onerror="alert(1))',
    "![a](javascript:alert(1))",
    "![a](//evil.example/x.png)",
    '@a"onmouseover="alert(1)',
    "||<img src=x onerror=alert(1)>||",
    "## <img src=x onerror=alert(1)>",
    "| <script>alert(1)</script> | б |",
    "```\n</code></pre><script>alert(1)</script>\n```",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
  ]

  for (const attack of attacks) {
    const html = renderForumMarkup(attack)
    // Экранированные последовательности прячем, чтобы не считать их кодом.
    const stripped = html.replace(/&lt;/g, "\u0001").replace(/&quot;/g, "\u0002").replace(/&#39;/g, "\u0003")
    assert.doesNotMatch(stripped, /<script/i, attack)
    assert.doesNotMatch(stripped, /<img[^>]+on\w+=/i, attack)
    assert.doesNotMatch(stripped, /<iframe(?![^>]*sandbox=)/i, attack)
    assert.doesNotMatch(stripped, /(?:href|src)="(?:javascript|data):/i, attack)
  }
})
