import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import { useSession } from "next-auth/react"
import LoadingSpinner from "@/components/ui/loading-spinner"

const prisma = new PrismaClient()

export default function PromoteListingPage() {
  const { data: session, status } = useSession()
  const { id: listingId } = useParams<{ id: string }>()
  const router = useRouter()

  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // Load listing data
  const loadListing = async () => {
    try {
      setLoading(true)
      setError(null)
      const fetchedListing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          vehicle: true,
          part: true
        }
      })

      if (!fetchedListing) {
        setError("Listing not found")
        return
      }

      // Check if user owns this listing
      if (fetchedListing.userId !== session?.user.id) {
        setError("Unauthorized to access this listing")
        return
      }

      setListing(fetchedListing)
    } catch (err) {
      console.error("Error loading listing:", err)
      setError("Failed to load listing")
    } finally {
      setLoading(false)
    }
  }

  // Simulate componentDidMount
  loadListing()

  const handlePromote = async () => {
    if (!listingId) {
      setError("Invalid listing ID")
      return
    }

    setPaymentProcessing(true)
    setError(null)

    try {
      // Create payment intent
      const response = await fetch("/api/payment/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment intent")
      }

      // In a real implementation, we would use Stripe.js to handle the payment
      // For this example, we'll simulate a successful payment
      // In production, you would integrate with @stripe/stripe-js

      // Simulate payment processing
      setPaymentProcessing(false)
      setPaymentSuccess(true)

      // In a real app, you would wait for the webhook or check payment status
      // For demo purposes, we'll immediately update the listing
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          isFeatured: true
        }
      })

      // Show success message and redirect after delay
      setTimeout(() => {
        router.push(`/listings/${listingId}`)
      }, 2000)
    } catch (err) {
      console.error("Error processing promotion:", err)
      setError(err instanceof Error ? err.message : "Failed to process promotion")
      setPaymentProcessing(false)
    }
  }

  if (!session || status === "loading") {
    return (
      <div className="min-h-flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session) {
    return <div>Redirecting to sign in...</div> // Should be handled by routing
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
        </div>
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
              href="/dashboard"
              className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Вернуться в кабинет
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="max-w-md mx-auto px-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Объявление не найдено</h2>
            <p className="text-gray-500 mb-6">
              Указанное объявление не существует или у вас нет к нему доступа.
            </p>
            <a
              href="/dashboard"
              className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Вернуться в кабинет
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Продвижение объявления
            </h1>
            <p className="text-sm text-gray-600">
              Сделайте ваше объявление более видимым, продвинув его вверх списка поиска
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <img
                src={listing.vehicle ? (
                  listing.vehicle.images && listing.vehicle.images.length > 0
                    ? JSON.parse(listing.vehicle.images)[0]
                    : "/default-vehicle.png"
                ) : (
                  listing.part ? (
                    listing.part.images && listing.part.images.length > 0
                      ? JSON.parse(listing.part.images)[0]
                      : "/default-part.png"
                  ) :
                  "/default-avatar.png"
                )}
                alt="Listing preview"
                className="h-16 w-16 rounded-lg object-cover"
              />
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-gray-900">
                  {listing.title}
                </div>
                <p className="text-sm text-gray-500">
                  {listing.vehicle ? (
                    `${listing.vehicle.year} ${listing.vehicle.make} ${listing.vehicle.model}`
                  ) : (
                    `${listing.part.name} для ${listing.part.make} ${listing.part.model}`
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {listing.price?.toLocaleString()}���₽
                </p>
              </div>
            </div>

            {listing.isFeatured && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.888 9.21l2.782-2.78a1 1 0 00-1.414-1.414L15 6.756V4a1 1 0 00-2 0v2.756L6.722 3.11a1 1 0 00-1.414 1.414l2.782 2.78a1 1 0 000 1.414l-1.379 1.379a1 1 0 001.414 0l1.774-1.775V16a1 1 0 002 0v-4.28l1.379 1.379a1 1 0 001.414 0l2.416-2.416a1 1 0 00.003-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">Это объявление уже продвижено</p>
                    <p className="text-xs text-green-600">
                      Ваше объявление будет показано в верхней части результатов поиска
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!listing.isFeatured && (
              <>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M20 10a8 8 0 11-16 0 8 8 0 0116 0zM8.416 4.48a5.583 5.583 0 00-2.232 7.878h.002C5.004 13.333 4 14.448 4 15.5a2 2 0 002 2h5.216c1.111 0 2-.622 2-1.339V9.338c0-.55.672-1 1.5-1s1.5.45 1.5 1v4.161c0 .55-.672 1-1.5 1s-1.5-.45-1.5-1v-2.162c0-.383.284-.696.681-.902l1.111-.774a5.573 5.573 0 006.69-1.361H14.1c1.104 0 2 .896 2 2s-.896 2-2 2H5.636c-.441 0-.808-.357-.965-.84l2.018-1.404A5.583 5.583 0 008.416 4.48z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">Продвижение объявления</p>
                      <p className="text-xs text-blue-600">
                        За {199}���₽ ваше объявление будет показано в верхней части результатов поиска на 30 дней
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Выберите период продвижения
                  </label>
                  <div className="flex space-x-3">
                    <div className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-center
                      {"cursor-pointer"}
                      >
                      30 дней
                    </div>
                    <div className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-center
                      {"cursor-pointer"}
                      >
                      90 дней
                    </div>
                    <div className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-center
                      {"cursor-pointer"}
                      >
                      180 дней
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 text-center">
                    * В данной версии доступно только продвижение на 30 дней за {199}���₽
                  </p>
                </div>

                {paymentSuccess && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.888 9.21l2.782-2.78a1 1 0 00-1.414-1.414L15 6.756V4a1 1 0 00-2 0v2.756L6.722 3.11a1 1 0 00-1.414 1.414l2.782 2.78a1 1 0 000 1.414l-1.379 1.379a1 1 0 001.414 0l1.774-1.775V16a1 1 0 002 0v-4.28l1.379 1.379a1 1 0 001.414 0l2.416-2.416a1 1 0 00.003-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-green-700">
                          Платёж успешно обработан! Ваше объявление теперь продвижено.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {paymentProcessing && (
                  <div className="text-center py-4">
                    <LoadingSpinner />
                    <p className="mt-2 text-sm text-gray-600">Обработка платежа...</p>
                  </div>
                )}

                {!paymentProcessing && !paymentSuccess && (
                  <div className="mt-6">
                    <button
                      onClick={handlePromote}
                      disabled={paymentProcessing}
                      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                      {paymentProcessing ? "Обработка платежа..." : "Оплатить и продвинуть объявление"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  )
}