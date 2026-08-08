import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"

// Verify Telegram WebApp data according to official docs
function verifyTelegramData(initData: string, botToken: string): boolean {
  try {
    // Parse the initData string
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')

    if (!hash) {
      return false
    }

    // Remove hash from params for data check string
    urlParams.delete('hash')

    // Create data check string: all fields in alphabetical order
    const dataCheckArray: string[] = []
    urlParams.forEach((value, key) => {
      dataCheckArray.push(`${key}=${value}`)
    })
    dataCheckArray.sort()
    const dataCheckString = dataCheckArray.join('\n')

    // Create secret key: HMAC-SHA256(<bot_token>, "WebAppData")
    const secretKey = crypto.createHmac('sha256', botToken)
      .update('WebAppData')
      .digest()

    // Calculate HMAC-SHA256 of the data check string using the secret key
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString, 'utf8')
      .digest('hex')

    // Compare with received hash
    return calculatedHash === hash
  } catch (err) {
    console.error("Error verifying Telegram data:", err)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData } = body

    if (!initData) {
      return NextResponse.json(
        { error: "Missing initData" },
        { status: 400 }
      )
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: "Server configuration error: TELEGRAM_BOT_TOKEN not set" },
        { status: 500 }
      )
    }

    // Verify the data comes from Telegram
    const isValid = verifyTelegramData(initData, botToken)

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Telegram data: signature verification failed" },
        { status: 401 }
      )
    }

    // Parse initData to get user info
    const urlParams = new URLSearchParams(initData)
    const userJson = urlParams.get('user')

    if (!userJson) {
      return NextResponse.json(
        { error: "No user data in initData" },
        { status: 400 }
      )
    }

    let telegramUser
    try {
      telegramUser = JSON.parse(userJson)
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid user data format" },
        { status: 400 }
      )
    }

    const { id: telegramId, first_name, last_name, username, photo_url } = telegramUser

    // Find or create user based on Telegram ID
    // We'll store Telegram ID in a dedicated field or use a derived email
    // For simplicity and privacy, let's use a special email pattern
    const telegramEmail = `tg_${telegramId}@telegram.local`

    let user = await prisma.user.findFirst({
      where: {
        email: telegramEmail
      }
    })

    if (!user) {
      // Create new user from Telegram data
      user = await prisma.user.create({
        data: {
          email: telegramEmail,
          name: `${first_name} ${last_name || ''}`.trim() || username || `Telegram User ${telegramId}`,
          image: photo_url || null,
          // Set a placeholder password - in reality we'd use a proper auth system
          // For Telegram mini app, we might not need password at all
          hashedPassword: "TELEGRAM_PLACEHOLDER_" + crypto.randomBytes(16).toString('hex'),
          role: "USER"
        }
      })
    } else {
      // Update existing user with latest info from Telegram
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: `${first_name} ${last_name || ''}`.trim() || username || user.name,
          image: photo_url || user.image,
        }
      })
    }

    // Return user data for client-side session handling
    // In production, you might want to create a proper session or token
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role
      }
    })
  } catch (error) {
    console.error("Error in Telegram auth:", error)
    return NextResponse.json(
      { error: "Internal server error during authentication" },
      { status: 500 }
    )
  }
}