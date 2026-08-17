import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { extractIautosImages } from "../src/lib/iautos-images.ts"

test("extracts IAUTOS images from lazy attributes and escaped JSON", () => {
  const html = [
    "<img data-src='//s1.iautos.cn/cars/front.jpg'>",
    '<script>{"photo":"https:\\/\\/qimg.iautos.cn\\/cars\\/rear.png-large"}</script>',
    '<img data-original="https://s3.iautos.cn/cars/interior.webp?size=large">',
  ].join("\n")

  assert.deepEqual(extractIautosImages(html), [
    "https://s1.iautos.cn/cars/front.jpg",
    "https://qimg.iautos.cn/cars/rear.png-large",
    "https://s3.iautos.cn/cars/interior.webp?size=large",
  ])
})

test("rejects unrelated hosts and non-image resources", () => {
  const html = [
    '<img src="https://example.com/not-allowed.jpg">',
    '<script src="https://s2.iautos.cn/assets/app.js"></script>',
  ].join("\n")

  assert.deepEqual(extractIautosImages(html), [])
})
