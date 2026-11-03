import { readFile } from "node:fs/promises"
import path from "node:path"
import { telegramPhotoApi } from "@/lib/telegram"

export type TelegramCampaignKind = "registration" | "seller"

/** Upload bytes: Telegram cannot reliably fetch images from our domain. */
export async function sendTelegramCampaignPhoto(chatId: string, kind: TelegramCampaignKind, caption: string, replyMarkup: unknown) {
  return telegramPhotoApi({ chat_id: chatId, caption, parse_mode: "HTML", reply_markup: replyMarkup }, {
    uploads: [{
      field: "photo", filename: `lewheel-${kind}.jpg`, contentType: "image/jpeg",
      data: await readFile(path.join(process.cwd(), "public/images/telegram/campaign-v1", `${kind}.jpg`)),
    }],
  })
}
