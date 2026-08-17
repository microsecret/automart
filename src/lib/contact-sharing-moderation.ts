import {
  contactPolicyMessage,
  inspectContactSharing,
  type ContactReasonCode,
} from "@/lib/contact-sharing-policy"

type ModerationDecision = {
  allowed: boolean
  reasonCodes: ContactReasonCode[]
  provider: "LOCAL_POLICY" | "NVIDIA" | "LOCAL_POLICY+NVIDIA"
  message?: string
}

const NVIDIA_KEYS = (process.env.NVIDIA_KEYS || "").split(",").map((key) => key.trim()).filter(Boolean)
const NVIDIA_MODEL = process.env.NVIDIA_MODERATION_MODEL?.trim() || process.env.NVIDIA_MODEL?.trim() || "meta/llama-3.1-70b-instruct"
let moderationKeyIndex = 0

async function inspectWithNvidia(content: string): Promise<"ALLOW" | "BLOCK" | "UNAVAILABLE"> {
  if (process.env.NVIDIA_CHAT_MODERATION_ENABLED !== "true" || NVIDIA_KEYS.length === 0) return "UNAVAILABLE"
  const key = NVIDIA_KEYS[moderationKeyIndex % NVIDIA_KEYS.length]
  moderationKeyIndex += 1

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(4_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        temperature: 0,
        max_tokens: 8,
        messages: [
          {
            role: "system",
            content: "Classify whether a Russian marketplace chat message attempts to share a phone, email, URL, social handle, messenger contact, or an obfuscated version of them. Reply with exactly BLOCK or ALLOW. Do not repeat the message.",
          },
          { role: "user", content },
        ],
      }),
    })
    if (!response.ok) return "UNAVAILABLE"
    const payload = await response.json().catch(() => null)
    const verdict = payload?.choices?.[0]?.message?.content?.trim().toUpperCase()
    return verdict === "BLOCK" ? "BLOCK" : verdict === "ALLOW" ? "ALLOW" : "UNAVAILABLE"
  } catch {
    return "UNAVAILABLE"
  }
}

export async function moderateProtectedDealMessage(content: string): Promise<ModerationDecision> {
  const local = inspectContactSharing(content)
  if (!local.allowed) {
    return { ...local, provider: "LOCAL_POLICY", message: contactPolicyMessage(local.reasonCodes) }
  }

  const aiVerdict = await inspectWithNvidia(content)
  if (aiVerdict === "BLOCK") {
    const reasonCodes: ContactReasonCode[] = ["SOCIAL_HANDLE"]
    return {
      allowed: false,
      reasonCodes,
      provider: "LOCAL_POLICY+NVIDIA",
      message: "Сообщение не отправлено: проверка обнаружила попытку передать внешний контакт. Переформулируйте вопрос без телефона, почты, ссылок и мессенджеров.",
    }
  }

  return { allowed: true, reasonCodes: [], provider: aiVerdict === "ALLOW" ? "LOCAL_POLICY+NVIDIA" : "LOCAL_POLICY" }
}
