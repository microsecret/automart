import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { extractIautosImages } from "../src/lib/iautos-images.ts"

test("extracts IAUTOS images from lazy attributes and escaped JSON", () => {
  const html = [
    "<img data-src='//qimg2.iautos.cn/cars/front.jpg'>",
    '<script>{"photo":"https:\\/\\/qimg.iautos.cn\\/cars\\/rear.png-large"}</script>',
    '<img data-original="https://qimg6.iautos.cn/cars/interior.webp?size=large">',
  ].join("\n")

  assert.deepEqual(extractIautosImages(html), [
    "https://qimg2.iautos.cn/cars/front.jpg",
    "https://qimg.iautos.cn/cars/rear.png-large",
    "https://qimg6.iautos.cn/cars/interior.webp?size=large",
  ])
})

test("rejects unrelated hosts and non-image resources", () => {
  const html = [
    '<img src="https://example.com/not-allowed.jpg">',
    '<script src="https://s2.iautos.cn/assets/app.js"></script>',
  ].join("\n")

  assert.deepEqual(extractIautosImages(html), [])
})

test("снимки с партнёрского CDN taocheche попадают в галерею", () => {
  // Основной массив фотографий лота лежит там: у карточки сорок шесть ссылок
  // на taocheche против двадцати восьми на qimg6. Пока домена не было в
  // списке, лоты сохранялись почти без фотографий.
  const html = `
    <img src="//img5.taocheche.com.cn/00/37370993-102708geeq.jpg">
    <img src="https://img5.taocheche.com.cn/00/724b49ca-102708geet.jpg">
    <img src="//qimg6.iautos.cn/cp/2607/0618/X0502BsPQYMc7.jpg">
  `
  const images = extractIautosImages(html)
  assert.equal(images.length, 3)
  assert.ok(images.some((url) => url.includes("taocheche.com.cn")), "CDN taocheche пропущен")
  assert.ok(images.some((url) => url.includes("qimg6.iautos.cn")), "прежний домен потерян")
  assert.ok(images.every((url) => url.startsWith("https://")), "остались небезопасные ссылки")
})

test("вёрстка сайта не попадает в галерею вместо машины", () => {
  // static.iautos.cn раздаёт логотипы, иконки и заглушки — в галерее лота
  // им не место.
  const html = `
    <img src="//static.iautos.cn/images/logo.png">
    <img src="//static.iautos.cn/css/sprite-icons.jpg">
    <img src="//img5.taocheche.com.cn/00/1ab35ab8-102708gf23.jpg">
  `
  const images = extractIautosImages(html)
  assert.equal(images.length, 1)
  assert.ok(images[0].includes("taocheche.com.cn"))
})

test("узлы s1/s2/s3 не считаются хранилищем снимков", () => {
  // Живая проверка показала: они отдают {"error":"Document not found"} и 404.
  // Раньше оттуда набралось 1475 битых ссылок, и в галерее лота вместо машины
  // показывались пустые кадры.
  const html = [
    "<img data-src='//s1.iautos.cn/cars/front.jpg'>",
    '<img data-original="https://s3.iautos.cn/cars/interior.webp">',
    '<img src="//qimg6.iautos.cn/cars/real.jpg">',
  ].join("\n")

  const images = extractIautosImages(html)
  assert.equal(images.length, 1)
  assert.ok(images[0].includes("qimg6.iautos.cn"))
})
