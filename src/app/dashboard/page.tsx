import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import VehicleCard from "@/components/listings/vehicle-card"
import PartCard from "@/components/listings/part-card"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { MapMarker, useJsApiLoader } from "@react-google-maps/api"

const prisma = new PrismaClient()

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [userVehicles, setUserVehicles] = useState<any[]>([])
  const [userParts, setUserParts] = useState<any[]>([])
  const [favoriteListings, setFavoriteListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [mapMarkers, setMapMarkers] = useState<Array<{ lat: number; lng: number; title: string }>>([])

  useEffect(() => {
    if (status === "loading") {
      setLoading(true)
      return
    }

    if (!session) {
      router.push("/auth/signin")
      return
    }

    loadDashboardData()
  }, [session, status, router])

  const loadDashboardData = async () => {
    try {
      // Загружаем транспортные средства пользователя
      const vehicles = await prisma.vehicle.findMany({
        where: { userId: session.user.id },
        include: {
          category: true,
          _count: {
            select: { listings: true }
          }
        },
        orderBy: { createdAt: "desc" }
      })
      setUserVehicles(vehicles)

      // Загружаем запчасти пользователя
      const parts = await prisma.part.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" }
      })
      setUserParts(parts)

      // Загружаем избранные объявления пользователя
      const favorites = await prisma.listing.findMany({
        where: {
          favoritedBy: {
            some: { id: session.user.id }
          }
        },
        include: {
          vehicle: true,
          part: true
        },
        orderBy: { createdAt: "desc" }
      })
      setFavoriteListings(favorites)

      // Обновляем данные для карты
      updateMapData([...vehicles, ...parts])
    } catch (error) {
      console.error("Ошибка загрузки данных кабинета:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateMapData = (items: any[]) => {
    const markers: Array<{ lat: number; lng: number; title: string }> = []
    let center: { lat: number; lng: number } | null = null

    // Найдем первый элемент с координатами для центра карты
    for (const item of items) {
      if (item.lat !== null && item.lng !== null) {
        if (!center) {
          center = { lat: item.lat, lng: item.lng }
        }
        markers.push({
          lat: item.lat,
          lng: item.lng,
          title: item.vehicleId
            ? `${item.year} ${item.make} ${item.model}`
            : item.name
        })
      }
    }

    // Если нет элементов с координатами, используем центр по умолчанию (Москва)
    if (!center) {
      center = { lat: 55.7558, lng: 37.6176 }
    }

    setMapCenter(center)
    setMapMarkers(markers)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session) {
    return <div>Загрузка...</div> // Это не должно происходить из-за перенаправления выше
  }

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""
  })

  const mapContainerStyle = {
    height: "400px",
    width: "100%"
  }

  const center = mapCenter
    ? { lat: mapCenter.lat, lng: mapCenter.lng }
    : { lat: 55.7558, lng: 37.6176 }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          Личный кабинет, {session.user.name || session.user.email}!
        </h1>

        {/* Statistics and Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {/* Статистика */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Статистика</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Транспортных средств</span>
                <span className="font-medium">{userVehicles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Запчастей</span>
                <span className="font-medium">{userParts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Избранных объявлений</span>
                <span className="font-medium">{favoriteListings.length}</span>
              </div>
            </div>
          </div>

          {/* Быстрые действия */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Быстрые действия</h2>
            <div className="space-y-4">
              <a
                href="/listings/create"
                className="block px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Добавить транспорт
              </a>
              <a
                href="/parts/create"
                className="block px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Добавить запчасть
              </a>
              <a
                href="/favorites"
                className="block px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Избранное
              </a>
            </div>
          </div>

          {/* Последние объявления */}
          <div className="bg-white rounded-lg shadow p-6 col-span-2 md:col-span-1 lg:col-span-2">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Мои объявления</h2>
            {userVehicles.length === 0 && userParts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                У вас пока нет объявлений. Начните с добавления первого!
              </p>
            ) : (
              <div className="space-y-4">
                {/* Транспорт */}
                {userVehicles.map(vehicle => (
                  <div key={vehicle.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                    <h3 className="font-medium text-gray-900">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                    <p className="text-sm text-gray-500">{vehicle.price?.toLocaleString()}���₽ • {vehicle.mileage?.toLocaleString()} км</p>
                    <div className="mt-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {vehicle.category?.name}
                      </span>
                      {vehicle.listings?.[0]?.isFeatured && (
                        <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          В продвижении
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Запчасти */}
                {userParts.map(part => (
                  <div key={part.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                    <h3 className="font-medium text-gray-900">{part.name}</h3>
                    <p className="text-sm text-gray-500">{part.price?.toLocaleString()}���₽</p>
                    <div className="mt-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        {part.partType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map Section */}
        <div className="mb-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            Мои объявления на карте
          </div>
          {loadError ? (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4">
              Ошибка загрузки карты Google Maps. Проверьте ваш API ключ.
            </div>
          ) : !isLoaded ? (
            <div className="flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <div style={mapContainerStyle}>
              {mapMarkers.map((marker, index) => (
                <MapMarker
                  key={index}
                  position={{ lat: marker.lat, lng: marker.lng }}
                  title={marker.title}
                />
              ))}
            </div>
          )}
        </div>

        {/* Избранные объявления */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            Избранные объявления
          </h2>
          {favoriteListings.length === 0 ? (
            <p className="text-center text-gray-500 py-6">
              У вас пока нет избранных объявлений.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favoriteListings.map(listing => (
                <div key={listing.id}>
                  {listing.vehicle ? (
                    <VehicleCard vehicle={listing.vehicle} isSmall={true} />
                  ) : (
                    <PartCard part={listing.part} isSmall={true} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}