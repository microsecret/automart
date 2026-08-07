import { useState } from "react"
import { useParams } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import { useSession } from "next-auth/react"
import LoadingSpinner from "@/components/ui/loading-spinner"

const prisma = new PrismaClient()

export default function PartDetailPage() {
  const { id: partId } = useParams<{ id: string }>()
  const { data: session } = useSession()

  const [part, setPart] = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)

  // Load part data
  const loadPartData = async () => {
    try {
      setLoading(true)
      setError(null)
      const fetchedPart = await prisma.part.findUnique({
        where: { id: partId },
        include: {
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

      if (!fetchedPart) {
        setError("Part not found")
        return
      }

      setPart(fetchedPart)
      setListings(fetchedPart.listings || [])

      // Check if current user has favorited this part's listings
      if (session) {
        const favoriteListings = await prisma.listing.findMany({
          where: {
            favoritedBy: {
              some: { id: session.user.id }
            },
            OR: [
              { vehicleId: null }, // We'll check part listings specifically
              { partId: partId }
            ]
          },
          select: { id: true }
        })
        setIsFavorite(favoriteListings.length > 0)
      }
    } catch (err) {
      console.error("Error loading part data:", err)
      setError("Failed to load part data")
    } finally {
      setLoading(false)
    }
  }

  // Simulate componentDidMount
  loadPartData()

  const handleToggleFavorite = () => {
    if (!session) {
      // Redirect to sign in
      return
    }

    // Simplified favorite toggle logic
    setIsFavorite(!isFavorite)
  }

  const handleContactSeller = () => {
    // Open messaging interface
    alert("Messaging interface would open here")
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

  if (!part) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="max-w-md mx-auto px-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Запчасть не найдена</h2>
            <p className="text-gray-500 mb-6">
              Указанная запчасть не существует или была удалена.
            </p>
            <a
              href="/"
              className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Вернуться на главную
            </a>
          </div>
        </div>
      )
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {part.name}
                </h1>
                <div className="flex items-center space-x-3 mt-2">
                  {part.price !== null && (
                    <span className="text-2xl font-bold text-gray-900">
                      {part.price.toLocaleString()}���������������₽
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
                {part.images ? (
                  <div className="grid gap-4">
                    {[...JSON.parse(part.images)].map((img, index) => (
                      <div key={index} className="aspect-w-16 aspect-h-9">
                        <img
                          src={img}
                          alt={`Part image ${index + 1}`}
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
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Название</h3>
                    <p className="text-gray-900">{part.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Совместимая марка</h3>
                    <p className="text-gray-900">{part.make}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Совместимая модель</h3>
                    <p className="text-gray-900">{part.model}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Год выпуска (от)</h3>
                    <p className="text-gray-900">
                      {part.yearFrom !== null ? part.yearFrom : "Не указано"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Год выпуска (до)</h3>
                    <p className="text-gray-900">
                      {part.yearTo !== null ? part.yearTo : "Не указано"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Тип запчасти</h3>
                    <p className="text-gray-900">{part.partType || "Не указано"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Состояние</h3>
                    <p className="text-gray-900">{part.condition || "Не указано"}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Совместимый диапазон годов</h3>
                  <p className="text-gray-900">
                    {({from: part.yearFrom, to: part.yearTo}) => {
                      const from = part.yearFrom !== null ? part.yearFrom.toString() : "Не указано"
                      const to = part.yearTo !== null ? part.yearTo.toString() : "Не указано"
                      return `${from} - ${to}`
                    }}
                  </p>
                </div>

                {part.description && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Описание</h3>
                    <p className="text-gray-900">{part.description}</p>
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
                    Активных объявлений для этой запчасти нет
                  </p>
                ) : (
                  <div className="space-y-4">
                    {listings.map(listing => (
                      <div key={listing.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{listing.title}</h3>
                            <p className="text-sm text-gray-500">
                              {listing.price?.toLocaleString()}���������������₽
                            </p>
                          </div>
                          <div className="space-x-2">
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
                        </p>
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