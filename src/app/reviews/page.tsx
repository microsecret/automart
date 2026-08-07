import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { MessageCircle, ChevronRight, Trash2, RefreshCw, Bell, Star, Plus, X } from "lucide-react"

export default function ReviewsPage() {
  const { data: session, status } = useSession()
  const [reviews, setReviews] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [selectedListing, setSelectedListing] = useState<any | null>(null)
  const [userRating, setUserRating] = useState(0)
  const [userComment, setUserComment] = useState("")

  // Fetch reviews
  const fetchReviews = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const url = new URL("/api/reviews", window.location.origin)
      if (selectedListingId) {
        url.searchParams.set("listingId", selectedListingId)
      }

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error("Failed to fetch reviews")
      }

      const data = await response.json()
      setReviews(data.reviews || [])
    } catch (err) {
      console.error("Error fetching reviews:", err)
      setError(err.message || "Failed to load reviews")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Create a review
  const createReview = async () => {
    if (!session) {
      setError("Please log in to leave a review")
      return
    }

    if (userRating === 0) {
      setError("Please select a rating")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: userRating,
          comment: userComment.trim(),
          listingId: selectedListingId
        })
      })

      if (!response.ok) {
        throw new Error("Failed to create review")
      }

      const newReview = await response.json()

      // Add to local state
      setReviews(prev => [newReview, ...prev])

      // Reset form
      setUserRating(0)
      setUserComment("")
      setSelectedListingId(null)
      setSelectedListing(null)

      // Show success message
      alert("Ваш отзыв успешно опубликован!")
    } catch (err) {
      console.error("Error creating review:", err)
      setError(err.message || "Failed to create review")
    } finally {
      setIsLoading(false)
    }
  }

  // Delete a review
  const deleteReview = async (reviewId: string) => {
    if (!session) {
      setError("Please log in to delete a review")
      return
    }

    try {
      await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE"
      })

      // Remove from local state
      setReviews(reviews.filter(rev => rev.id !== reviewId))
    } catch (err) {
      console.error("Error deleting review:", err)
      setError(err.message || "Failed to delete review")
    }
  }

  // Refresh reviews
  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchReviews()
  }

  // Fetch reviews when session or selected listing changes
  useEffect(() => {
    fetchReviews()
  }, [session, selectedListingId])

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
          <h2 className="text-2xl font-bold mb-4">Отзывы</h2>
          <p className="text-gray-600 mb-6">
            Пожалуйста, войдите в систему, чтобы оставлять отзывы
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
          <h2 className="text-2xl font-bold mb-4">Отзывы</h2>
          <p className="text-red-500 mb-6">{error}</p>
          <Button
            onClick={() => {
              setError(null)
              fetchReviews()
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
          <h1 className="text-2xl font-bold">Отзывы</h1>
          <p className="text-gray-600">
            Читайте и оставляйте отзывы о объявлениях и сделках
          </p>
        </div>

        {/* Listing selector */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-2">Выберите объявление для отзыва</h2>
          <div className="mb-4">
            {/* In a real app, we would fetch the user's listings or allow searching */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-200">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">
                    Выберите объявление
                  </h3>
                  <p className="text-sm text-gray-600">
                    Для оставления отзыва о конкретном объявлении, пожалуйста, выберите его из списка ваших объявлений или используйте поиск
                  </p>
                </div>
              </div>
              {selectedListingId && selectedListing && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-blue-200 rounded flex items-center justify-center">
                        <Star className="h-4 w-4 text-blue-500" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-blue-800">
                        Отзыв для объявления
                      </h3>
                      <p className="text-sm text-blue-600">
                        {selectedListing.title}
                      </p>
                      {selectedListing.vehicle && (
                        <p className="text-xs text-blue-500 truncate">
                          {selectedListing.vehicle.year} {selectedListing.vehicle.make} {selectedListing.vehicle.model}
                        )
                      )}
                      {selectedListing.part && (
                        <p className="text-xs text-blue-500 truncate">
                          Сочетается с: {selectedListing.part.make} {selectedListing.part.model}
                        )
                      }}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Review form */}
        {selectedListingId ? (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-bold mb-4">Оставьте свой отзыв</h3>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-200">
                  {Array(5).fill(0).map((_, index) => (
                    <Star
                      key={index}
                      className={`h-4 w-4 ${index < userRating ? 'text-yellow-400' : 'text-gray-300'} hover:cursor-pointer`}
                      onClick={() => setUserRating(index + 1)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-gray-600">
                  Ваша оценка: {userRating}/5
                </p>
                <textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="Напишите свой отзыв здесь..."
                  className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                />
                <button
                  onClick={createReview}
                  className="w-full mt-3 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Опубликовать отзыв
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-bold mb-4">Выберите объявление для отзыва</h2>
            <p className="text-gray-600">
              Чтобы оставить отзыв, сначала выберите объявление, о котором вы хотите написать отзыв
            </p>
          </div>
        )}

        {/* Reviews list */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-4">Недавние отзывы</h2>
          {isLoading && reviews.length === 0 ? (
            <div className="text-center py-8">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent border-l-transparent border-r-primary animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Загрузка отзывов...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8">
              <Star className="h-8 w-8 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">
                Пока нет отзывов
              </p>
              <p className="text-sm text-gray-400">
                Будьте первым, кто оставит отзыв!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex items-start space-x-3">
                    {/* Reviewer info */}
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-200">
                        {review.user.image ? (
                          <img
                            src={review.user.image}
                            alt={review.user.name}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="text-gray-500">
                            {review.user.name
                              .split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Review content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-gray-900">
                          {review.user.name}
                        </p>
                        <div className="flex items-center space-x-2">
                          {Array(5).fill(0).map((_, index) => (
                            <Star
                              key={index}
                              className={`h-3 w-3 ${index < review.rating ? 'text-yellow-400' : 'text-gray-300'}`
                            />
                          ))}
                        </span>
                        <span className="ml-2 text-xs">
                          ({review.rating}/5)
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {review.comment || "Оценка без комментария"}
                      </p>
                      {review.listing && (
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="font-medium">Объявление:</span> {review.listing.title}
                        </div>
                      )}
                      {review.createdAt && (
                        <p className="text-xs text-gray-500">
                          {new Date(review.createdAt).toLocaleString('ru-RU', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 space-x-2">
                      {session && review.userId === session.user.id && (
                        <>
                          <button
                            onClick={() => {
                              // In a real app, we would navigate to an edit review page
                              console.log("Edit review:", review)
                            }}
                            className="p-1 rounded hover:bg-gray-100"
                          >
                            <MessageCircle className="h-3 w-3 text-gray-400" />
                          </button>
                          <button
                            onClick={() => deleteReview(review.id)}
                            className="p-1 rounded hover:bg-gray-100"
                          >
                            <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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