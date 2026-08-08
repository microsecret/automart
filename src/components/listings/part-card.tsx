"use client"

import Link from "next/link"
import Image from "next/image"
import { MapPin, Wrench } from "lucide-react"

interface PartCardProps {
  part: {
    id: string
    name: string
    price: number
    condition?: string
    partType?: string
    make?: string
    model?: string
    location?: string
    images?: string | null
  }
  isSmall?: boolean
}

export default function PartCard({ part, isSmall = false }: PartCardProps) {
  const images: string[] = part.images ? safeParseImages(part.images) : []
  const image = images[0] || "/placeholder.svg"

  return (
    <Link
      href={`/listings/part/${part.id}`}
      className={`group block overflow-hidden rounded-xl border border-border/50 bg-white hover:shadow-lg transition-shadow`}
    >
      <div className={`relative w-full ${isSmall ? "aspect-video" : "aspect-video"}`}>
        <Image
          src={image}
          alt={part.name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="p-4">
        <h3 className={`font-semibold text-gray-900 line-clamp-1 ${isSmall ? "text-sm" : "text-base"}`}>
          {part.name}
        </h3>
        <p className="mt-1 text-lg font-bold text-primary">
          {formatPrice(part.price)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
          {part.partType && (
            <div className="flex items-center">
              <Wrench className="h-3 w-3 mr-1" />
              <span>{part.partType}</span>
            </div>
          )}
          {part.condition && (
            <div className="flex items-center">
              <span className="text-gray-500">{part.condition}</span>
            </div>
          )}
          {(part.make || part.model) && (
            <div className="col-span-2 text-gray-500">
              {part.make} {part.model}
            </div>
          )}
          {part.location && (
            <div className="flex items-center col-span-2">
              <MapPin className="h-3 w-3 mr-1" />
              <span className="line-clamp-1">{part.location}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function formatPrice(price: number) {
  return price.toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 })
}

function safeParseImages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
