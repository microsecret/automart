import path from "path"

export const MAX_MESSAGE_ATTACHMENTS = 4
export const MAX_MESSAGE_ATTACHMENT_BYTES = 8 * 1024 * 1024
export const MAX_MESSAGE_MULTIPART_BYTES = MAX_MESSAGE_ATTACHMENTS * MAX_MESSAGE_ATTACHMENT_BYTES + 2 * 1024 * 1024
export const MESSAGE_ATTACHMENT_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function messageAttachmentsDirectory() {
  return process.env.MESSAGE_ATTACHMENTS_PATH || path.join(process.cwd(), "data", "message-attachments")
}

export function isSafeMessageAttachmentStorageKey(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i.test(value)
}

export function messageAttachmentDownloadUrl(conversationId: string, attachmentId: string) {
  return `/api/messages/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachmentId)}`
}
