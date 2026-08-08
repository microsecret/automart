"use client"

import Link from "next/link"
import Image from "next/image"
import { MapPin, Calendar, Gauge, Fuel } from "lucide-react"

interface VehicleCardProps {
  vehicle: {
    id: string
    make: string
    model: string
    year: number
    price: number
    mileage: number
    fuelType?: string
    transmission?: string
    location?: string
    images?: string | null
  }
  isSmall?: boolean
}

export default function VehicleCard({ vehicle, isSmall = false }: VehicleCardProps) {
  const images: string[] = vehicle.images ? safeParseImages(vehicle.images) : []
  const image = images[0] || "/placeholder.svg"
  const title = `${vehicle.make} ${vehicle.model}`

  return (
    <Link
      href={`/listings/vehicle/${vehicle.id}`}
      className={`group block overflow-hidden rounded-xl border border-border/50 bg-white hover:shadow-lg transition-shadow ${
        isSmall ? "" : ""
      }`}
    >
      <div className={`relative w-full ${isSmall ? "aspect-video" : "aspect-video"}`}>
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="p-4">
        <h3 className={`font-semibold text-gray-900 line-clamp-1 ${isSmall ? "text-sm" : "text-base"}`}>
          {title}
        </h3>
        <p className="mt-1 text-lg font-bold text-primary">
          {formatPrice(vehicle.price)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            <span>{vehicle.year}</span>
          </div>
          <div className="flex items-center">
            <Gauge className="h-3 w-3 mr-1" />
            <span>{formatMileage(vehicle.mileage)}</span>
          </div>
          {vehicle.fuelType && (
            <div className="flex items-center">
              <Fuel className="h-3 w-3 mr-1" />
              <span>{vehicle.fuelType}</span>
            </div>
          )}
          {vehicle.location && (
            <div className="flex items-center">
              <MapPin className="h-3 w-3 mr-1" />
              <span className="line-clamp-1">{vehicle.location}</span>
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

function formatMileage(mileage: number) {
  return mileage.toLocaleString("ru-RU") + " км"
}

function safeParseImages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
