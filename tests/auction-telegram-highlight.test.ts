import assert from "node:assert/strict"
import test from "node:test"
import {
  auctionHighlightMinimumFields,
  auctionHighlightReadiness,
  parseAuctionHighlightListingId,
} from "../src/lib/auction-telegram-highlight.mjs"

const completeListing = {
  make: "Hyundai", model: "Tucson", year: 2024, mileage: 12_000,
  fuelType: "DIESEL", transmission: "AUTOMATIC", bodyType: "SUV",
  color: "Белый", driveType: "AWD", engineVolume: 1998, power: 180,
  lotNumber: "K-123", location: "Сеул", sourcePrice: 25_000_000,
  imageUrl: "https://images.example/vehicle.jpg",
}

test("админский ввод принимает UUID и ссылку LeWheel, но не произвольный путь", () => {
  const id = "f00717cd-e1ba-4e9c-b083-e725152b711f"
  assert.equal(parseAuctionHighlightListingId(id), id)
  assert.equal(parseAuctionHighlightListingId(`https://lewheel.ru/auctions/${id}?utm_source=admin`), id)
  assert.equal(parseAuctionHighlightListingId(`/listings/${id}`), null)
  assert.equal(parseAuctionHighlightListingId("../../scripts/publish"), null)
})

test("полная карточка допускается в Telegram-подборку", () => {
  assert.deepEqual(auctionHighlightReadiness(completeListing), {
    ready: true, filled: 15, total: 15, required: 12, percent: 100, missing: [],
  })
})

test("неполная карточка показывает точные пробелы и не публикуется", () => {
  const readiness = auctionHighlightReadiness({ ...completeListing, color: null, lotNumber: null, sourcePrice: null, power: null })
  assert.equal(readiness.ready, false)
  assert.deepEqual(readiness.missing, ["Цвет", "Мощность", "Номер лота", "Цена источника"])
})

test("электромобилю не выдумывается объём ДВС", () => {
  const readiness = auctionHighlightReadiness({ ...completeListing, fuelType: "ELECTRIC", engineVolume: null })
  assert.equal(readiness.ready, true)
  assert.equal(readiness.missing.includes("Объём двигателя"), false)
})

test("порог полноты ограничен безопасным диапазоном", () => {
  assert.equal(auctionHighlightMinimumFields("2"), 8)
  assert.equal(auctionHighlightMinimumFields("99"), 15)
  assert.equal(auctionHighlightMinimumFields("12.5"), 12)
})
