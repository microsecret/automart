import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { MessageCircle, ChevronRight, Trash2, RefreshCw, Heart } from "lucide-react"

export default function FavoritesPage() {
  const { data: session, status } = useSession()
  const [favorites, setFavorites] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch favorites
  const fetchFavorites = async () => {
    if (!session) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/favorites")

      if (!response.ok) {
        throw new Error("Failed to fetch favorites")
      }

      const data = await response.json()
      setFavorites(data.favorites || [])
    } catch (err) {
      console.error("Error fetching favorites:", err)
      setError(err.message || "Failed to load favorites")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Remove from favorites
  const removeFromFavorites = async (listingId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/favorites?listingId=${encodeURIComponent(listingId)}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        throw new Error("Failed to remove from favorites")
      }

      // Remove from local state
      setFavorites(favorites.filter(fav => fav.id !== listingId))
    } catch (err) {
      console.error("Error removing from favorites:", err)
      setError(err.message || "Failed to remove from favorites")
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh favorites
  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchFavorites()
  }

  // Fetch favorites when session changes
  useEffect(() => {
    if (session) {
      fetchFavorites()
    }
  }, [session])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent border-l-transparent border-r-primary animate-spin" />
          <span className="text-gray-500">Загрузка...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Избранное</h2>
          <p className="text-gray-600 mb-6">
            Пожалуйста, войдите в систему, чтобы просматривать избранное
          </p>
          <Link href="/auth/signin" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
            Войти
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Избранное</h2>
          <p className="text-red-500 mb-6">{error}</p>
          <Button
            onClick={() => {
              setError(null)
              fetchFavorites()
            }}
          >
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Избранное</h1>
          <p className="text-gray-600">
            Сохраненные объявления
          </p>
        </div>

        {/* Refresh button */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors ${
              isRefreshing ? 'opacity-50' : ''
            }`}
          >
            {isRefreshing ? (
              <div className="h-4 w-4 border-2 border-t-transparent border-l-transparent border-b-primary animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Обновить
          </button>
        </div>

        {/* Favorites list */}
        {isLoading && favorites.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent border-l-transparent border-r-primary animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Загрузка избранного...</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="h-10 w-10 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">
              У вас пока нет избранных объявлений
            </p>
            <p className="text-gray-400">
              Добавьте объявления в избранное, нажав на сердечко на карточке объявления
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {favorites.map(favorite => (
              <div key={favorite.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
                <div className="flex items-center space-x-4">
                  {/* Favorite indicator */}
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 flex items-center justify-center bg-red-50 rounded">
                      <Heart className="h-4 w-4 text-red-500" />
                    </div>
                  </div>

                  {/* Listing info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900">
                        {favorite.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {favorite.isFeatured && (
                          <span className="bg-primary text-white px-1 py-0 text-xs rounded">
                            Рекомендуемое
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        {favorite.vehicle ? (
                          favorite.vehicle.images && favorite.vehicle.images.length > 0 ? (
                            <img
                              src={JSON.parse(favorite.vehicle.images)[0]}
                              alt={favorite.vehicle.make}
                              className="h-24 w-24 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-24 w-24 bg-gray-200 rounded flex items-center justify-center">
                              <div className="text-gray-500">
                                {favorite.vehicle.make} {favorite.vehicle.model}
                              </div>
                            </div>
                          )
                        ) : (
                          favorite.part ? (
                            favorite.part.images && favorite.part.images.length > 0 ? (
                              <img
                                src={JSON.parse(favorite.part.images)[0]}
                                alt={favorite.part.name}
                                className="h-24 w-24 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-24 w-24 bg-gray-200 rounded flex items-center justify-center">
                                <div className="text-gray-500">
                                  {favorite.part.name}
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="h-24 w-24 bg-gray-200 rounded flex items-center justify-center">
                              <div className="text-gray-500">
                                Нет изображения
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 space-y-1">
                        <p className="text-sm text-gray-600">
                          {favorite.vehicle ? (
                            <>
                              {favorite.vehicle.year} {favorite.vehicle.make} {favorite.vehicle.model}
                            </>
                          ) : (
                            <>
                              Для {favorite.part.make} {favorite.part.model}
                            </>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          {favorite.price?.toLocaleString()} ��� � � ₽
                        </p>
                        <p className="text-xs text-gray-500">
                          {favorite.vehicle ? (
                            <>
                              {favorite.vehicle.mileage?.toLocaleString()} км •
                              {favorite.vehicle.fuelType} •
                              {favorite.vehicle.transmission}
                            </>
                          ) : (
                            <>
                              Состояние: {favorite.part.condition}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    {favorite.description && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {favorite.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex-shrink-0 space-x-2">
                    <button
                      onClick={() => {
                        // Navigate to listing detail page
                        // In a real app, we'd link to the listing detail
                        console.log("Navigate to listing:", favorite)
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <MessageCircle className="h-3 w-3 text-gray-400 hover:text-primary" />
                    </button>
                    <button
                      onClick={() => removeFromFavorites(favorite.id)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  )
}

// Simple button component for reuse
function Button({
  children,
  onClick,
  className = ""
}: {
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors ${className}`}
    >
      {children}
    </button>
  )
}