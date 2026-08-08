import { NextRequest, NextResponse } from "next/server"
import { translateToRussian } from "@/lib/nvidia-translate"

export const dynamic = "force-dynamic"

const KEYS = (process.env.NVIDIA_KEYS || "").split(",").filter(Boolean)
let keyIdx = 0

const SYSTEM_PROMPT = `Ты — помощник сайта Авторынок (automart.ru). 
Помогаешь пользователям с вопросами о покупке/продаже авто, запчастей, аукционах.
Отвечай кратко, дружелюбно, на русском языке. Максимум 3-4 предложения.
Если не знаешь точный ответ — направь к разделу помощи /help/support.`

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()
    if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 })

    // Простой fallback если нет ключей
    if (KEYS.length === 0) {
      return NextResponse.json({
        reply: "Спасибо за обращение! Наш менеджер ответит вам в течение 15 минут. Вы также можете написать на support@automart.ru",
      })
    }

    const apiKey = KEYS[keyIdx % KEYS.length]
    keyIdx++

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/llama-3.1-nemotron-70b-instruct",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        temperature: 0.5,
        max_tokens: 300,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({
        reply: "Спасибо за вопрос! Наш менеджер ответит в течение 15 минут.",
      })
    }

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content?.trim()

    return NextResponse.json({ reply: reply || "Спасибо за обращение!" })
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json({
      reply: "Произошла ошибка. Наш менеджер свяжется с вами в течение 15 минут.",
    })
  }
}
