import { NextRequest, NextResponse } from "next/server"
import { uploadImage } from "@/lib/cloudinary"

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Limit file size to 10MB
    },
  },
}

export async function POST(request: NextRequest) {
  try {
    // Check if the request contains a file
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type (optional)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Upload image to Cloudinary
    const imageUrl = await uploadImage(file)

    return NextResponse.json({ url: imageUrl })
  } catch (error) {
    console.error("Error in upload API:", error)
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    )
  }
}