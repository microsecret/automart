import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { normalizeAuctionModel } from "../src/lib/auction-normalization.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { localizeIautosModel } from "../src/lib/iautos-model.ts"

const normalized = (value: string) => normalizeAuctionModel(localizeIautosModel(value))

test("normalizes real Iautos model titles without a network translator", () => {
  assert.equal(normalized("Cayenne 2013款 3.0T 自动 四驱 美规版平行进口"), "Cayenne 2013 3.0T")
  assert.equal(normalized("轩逸 2022款 1.6L 自动 前驱 经典XE舒适版 (国VI)"), "Sylphy 2022 1.6L")
  assert.equal(normalized("朗逸 2022款 1.4T 自动 前驱 280TSI舒适版 (国VI)"), "Lavida 2022 1.4T")
  assert.equal(normalized("4系四门轿跑 425i 2017款 2.0T 后驱 领先型M运动套装"), "4 Series Gran Coupe 425i 2017 2.0T")
  assert.equal(normalized("4系敞篷 428i 2014款 2.0T 后驱 豪华设计套装"), "4 Series Cabriolet 428i 2014 2.0T")
  assert.equal(normalized("高尔夫 2021款 1.4T 自动 前驱 280TSI-30周年纪念版 (国VI)"), "Golf 2021 1.4T")
  assert.equal(normalized("速腾 2022款 1.4T 自动 前驱 280TSI飞越版 (国VI)"), "Sagitar 2022 1.4T")
  assert.equal(normalized("4系双门轿跑 2017款 2.0T 后驱 M运动套装"), "4 Series Coupe 2017 2.0T")
  assert.equal(normalized("总裁 2016款 3.0T 自动 四驱 美规版平行进口"), "Quattroporte 2016 3.0T")
})
