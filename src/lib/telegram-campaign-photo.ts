import { readFile } from "node:fs/promises"
import path from "node:path"
import { telegramPhotoApi } from "@/lib/telegram"

export type TelegramCampaignKind = "registration" | "seller"
const telegramFileIds: Partial<Record<TelegramCampaignKind, string>> = {}
type PhotoMessage = { photo?: Array<{ file_id: string }> }

export async function sendTelegramCampaignPhoto(chatId: string, kind: TelegramCampaignKind, caption: string, replyMarkup: unknown) {
  const payload = { chat_id: chatId, caption, parse_mode: "HTML", reply_markup: replyMarkup }
  const photo = telegramFileIds[kind]
  if (photo) {
    try {
      return await telegramPhotoApi<PhotoMessage>({ ...payload, photo }, { uploads: [] })
    } catch (error) {
      if (!(error instanceof Error) || !/wrong file identifier|invalid file[_ ]?id|file[_ ]?id.*invalid/i.test(error.message)) throw error
      delete telegramFileIds[kind]
    }
  }
  const sent = await telegramPhotoApi<PhotoMessage>(payload, {
    uploads: [{
      field: "photo", filename: `lewheel-${kind}.jpg`, contentType: "image/jpeg",
      data: await readFile(path.join(process.cwd(), "public/images/telegram/campaign-v1", `${kind}.jpg`)),
    }],
  })
  telegramFileIds[kind] = sent.photo?.at(-1)?.file_id
  return sent
}
