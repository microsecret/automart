export const MAX_AUCTION_INTEGER = 2_147_483_647

type AuctionPriceStorageInput = {
  sourcePrice: number
  exchangeRate: number
  markup?: number
}

export function auctionPriceStorageError({ sourcePrice, exchangeRate, markup = 0 }: AuctionPriceStorageInput) {
  if (!Number.isSafeInteger(sourcePrice) || sourcePrice < 0 || sourcePrice > MAX_AUCTION_INTEGER) {
    return "цена источника не помещается в хранилище"
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return "некорректный курс валюты"
  if (!Number.isSafeInteger(markup) || markup < 0 || markup > MAX_AUCTION_INTEGER) return "некорректная наценка"

  const priceRub = Math.round(sourcePrice * exchangeRate)
  const finalPrice = priceRub + markup
  if (!Number.isSafeInteger(priceRub) || priceRub < 0 || priceRub > MAX_AUCTION_INTEGER) {
    return "рублёвая цена не помещается в хранилище"
  }
  if (!Number.isSafeInteger(finalPrice) || finalPrice < 0 || finalPrice > MAX_AUCTION_INTEGER) {
    return "итоговая цена не помещается в хранилище"
  }
  return null
}
