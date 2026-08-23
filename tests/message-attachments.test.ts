import assert from "node:assert/strict"
import test from "node:test"
import {
  isSafeMessageAttachmentStorageKey,
  messageAttachmentDownloadUrl,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/message-attachments.ts"

test("закрытое хранилище принимает только UUID JPEG после оптимизации", () => {
  assert.equal(isSafeMessageAttachmentStorageKey("123e4567-e89b-42d3-a456-426614174000.jpg"), true)
  assert.equal(isSafeMessageAttachmentStorageKey("../../public/photo.jpg"), false)
  assert.equal(isSafeMessageAttachmentStorageKey("123e4567-e89b-42d3-a456-426614174000.pdf"), false)
})

test("ссылка скачивания кодирует непрозрачные идентификаторы", () => {
  assert.equal(
    messageAttachmentDownloadUrl("dialogue/id", "attachment id"),
    "/api/messages/dialogue%2Fid/attachments/attachment%20id",
  )
})
