import { useState } from "react"
import { useParams } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import { useSession } from "next-auth/react"
import ImageUploader from "@/components/uploads/image-uploader"
import LoadingSpinner from "@/components/ui/loading-spinner"

const prisma = new PrismaClient()

export default function VehicleDetailPage() {
  const { id: vehicleId } = useParams<{ id: string }>()
  const { data: session } = useSession()

  const [vehicle, setVehicle] = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isMessagingOpen, setIsMessagingOpen] = useState(false)

  // Load vehicle data
  const loadVehicleData = async () => {
    try {
      setLoading(true)
      setError(null)
      const fetchedVehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          category: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          listings: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          }
        }
      })

      if (!fetchedVehicle) {
        setError("Vehicle not found")
        return
      }

      setVehicle(fetchedVehicle)
      setListings(fetchedVehicle.listings || [])

      // Check if current user has favorited this vehicle's listings
      if (session) {
        const favoriteListings = await prisma.listing.findMany({
          where: {
            favoritedBy: {
              some: { id: session.user.id }
            },
            OR: [
              { vehicleId: vehicleId },
              { partId: null } // We'll check vehicle listings specifically
            ]
          },
          select: { id: true }
        })
        setIsFavorite(favoriteListings.length > 0)
      }
    } catch (err) {
      console.error("Error loading vehicle data:", err)
      setError("Failed to load vehicle data")
    } finally {
      setLoading(false)
    }
  }

  // Simulate componentDidMount
  loadVehicleData()

  const handleToggleFavorite = async () => {
    if (!session) {
      // Redirect to sign in
      return
    }

    try {
      if (isFavorite) {
        // Remove from favorites
        await prisma.listing.updateMany({
          where: {
            vehicleId: vehicleId,
            favoritedBy: {
              some: { id: session.user.id }
            }
          },
          data: {
            favoritedBy: {
              disconnect: { id: session.user.id }
            }
          }
        })
      } else {
        // Add to favorites - we need to find or create a listing for this vehicle
        // For simplicity, we'll add to the first listing or create a virtual one
        // In a real implementation, we'd have a specific listing to favorite
        const vehicleListing = await prisma.listing.findFirst({
          where: { vehicleId: vehicleId }
        })

        if (vehicleListing) {
          await prisma.listing.update({
            where: { id: vehicleListing.id },
            data: {
              favoritedBy: {
                connect: { id: session.user.id }
              }
            }
          })
        }
      }

      setIsFavorite(!isFavorite)
    } catch (err) {
      console.error("Error toggling favorite:", err)
      setError("Failed to update favorites")
    }
  }

  const handleContactSeller = () => {
    // Open messaging interface or redirect to messaging page
    setIsMessagingOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="max-w-md mx-auto px-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-600 mb-4">Ошибка</h2>
            <p className="text-red-500 mb-6">{error}</p>
            <a
              href="/"
              className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Вернуться на главную
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="max-w-md mx-auto px-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Транспортное средство не найдено</h2>
            <p className="text-gray-500 mb-6">
              Указанное транспортное средство не существует или было удалено.
            </p>
            <a
              href="/"
              className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Вернуться на главную
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Messaging Interface (simplified) */}
      {isMessagingOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                Связь с продавцом
              </button>
              <button
                onClick={() => setIsMessagingOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-200"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Это упрощенный интерфейс для демонстрации. В реальном приложении
                здесь был бы полноценный чат с продавцом.
              </p>
              <p className="text-sm text-gray-600">
                Продавец: {vehicle.user?.name || 'Анонимный продавец'}
              </p>
              <textarea
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Напишите сообщение..."
              />
              <div className="mt-4 text-right">
                <button
                  onClick={() => setIsMessagingOpen(false)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Отправить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                <div className="flex items-center space-x-3 mt-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {vehicle.category?.name}
                  </span>
                  {vehicle.price !== null && (
                    <span className="text-2xl font-bold text-gray-900">
                      {vehicle.price.toLocaleString()}�������₽
                    </span>
                  )}
                </div>
              </div>
              <div className="space-x-4">
                {isFavorite ? (
                  <button
                    onClick={handleToggleFavorite}
                    className="p-3 rounded-lg hover:bg-red-100 text-red-600"
                  >
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 10-2 2v3.586l-3.293 3.293a1 1 0 101.414 1.414L10 14.586l4.293 4.293a1 1 0 001.414-1.414L14 9.586V12a1 1 0 100-2v-3.586l1.707-1.707a1 1 0 002-2z" clipRule="evenodd" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleToggleFavorite}
                    className="p-3 rounded-lg hover:bg-red-100 text-red-600"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-5-4a1 1 0 10-2 2v3.586l3.293 3.293a1 1 0 10-1.414 1.414L10 14.586l-4.293 4.293a1 1 0 001.414 1.414L6 9.586V12a1 1 0 100-2v-3.586l-1.707-1.707a1 1 0 10-2-2z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={handleContactSeller}
                  className="p-3 rounded-lg hover:bg-blue-100 text-blue-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.1a1 1 0 01-.897 1.983l-1.639 7.414a1 1 0 01-1.976.417L10 13l-3.532-2.347a1 1 0 01-.47-1.586L12 9v1H9v-2c0-.61.216-1.124.578-1.571l2.45-1.216a1 1 0 012.116-1.008l1.242 1.22A1 1 0 0118 8.1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="space-y-6">
              {/* Images */}
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Изображения
                </h2>
                {vehicle.images ? (
                  <div className="grid gap-4">
                    {[...JSON.parse(vehicle.images)].map((img, index) => (
                      <div key={index} className="aspect-w-16 aspect-h-9">
                        <img
                          src={img}
                          alt={`Vehicle image ${index + 1}`}
                          className="rounded-lg h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-w-16 aspect-h-9 bg-gray-200 flex items-center justify-center">
                    <p className="text-gray-500">Нет изображений</p>
                  </div>
                )}
              </div>

              {/* Specifications */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Технические характеристики
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Марка</h3>
                    <p className="text-gray-900">{vehicle.make}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Модель</h3>
                    <p className="text-gray-900">{vehicle.model}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Год выпуска</h3>
                    <p className="text-gray-900">{vehicle.year}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Пробег</h3>
                    <p className="text-gray-900">
                      {vehicle.mileage !== null ? vehicle.mileage.toLocaleString() + " км" : "Не указано"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Тип топлива</h3>
                    <p className="text-gray-900">{vehicle.fuelType || "Не указано"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Коробка передач</h3>
                    <p className="text-gray-900">{vehicle.transmission || "Не указано"}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Объем двигателя</h3>
                    <p className="text-gray-900">
                      {vehicle.engineVolume !== null ? vehicle.engineVolume + " л" : "Не указано"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Мощность</h3>
                    <p className="text-gray-900">
                      {vehicle.power !== null ? vehicle.power + " л.с." : "Не указано"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Привод</h3>
                    <p className="text-gray-900">{vehicle.driveType || "Не указано"}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Цвет</h3>
                    <p className="text-gray-900">{vehicle.color || "Не указано"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Количество дверей</h3>
                    <p className="text-gray-900">{vehicle.doors !== null ? vehicle.doors : "Не указано"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Состояние</h3>
                    <p className="text-gray-900">{vehicle.condition || "Не указано"}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">VIN</h3>
                  <p className="text-gray-900">{vehicle.vin || "Не указанo"}</p>
                </div>

                {vehicle.description && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Описание</h3>
                    <p className="text-gray-900">{vehicle.description}</p>
                  </div>
                )}
              </div>

              {/* Listings */}
              <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Активные объявления ({listings.length})
                </h2>
                {listings.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">
                    Активных объявлений для этого транспортного средства нет
                  </p>
                ) : (
                  <div className="space-y-4">
                    {listings.map(listing => (
                      <div key={listing.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{listing.title}</h3>
                            <p className="text-sm text-gray-500">
                              {listing.price?.toLocaleString()}�������₽
                            </p>
                          </div>
                          <div className="space-x-2">
                            {listing.isFeatured && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                В продвижении
                              </span>
                            )}
                            <button
                              onClick={() => {
                                // In a real app, this would navigate to the listing detail page
                                alert("Переход к деталям объявления")
                              }}
                              className="text-sm text-blue-600 hover:text-blue-800 underline"
                            >
                              Посмотреть объявление
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                          {listing.description || "Нет описания"}
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                          Опубликовано: {new Date(listing.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  )
}