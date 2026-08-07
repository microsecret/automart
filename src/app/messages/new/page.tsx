import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Search, User, MessageCircle, ChevronRight, X } from "lucide-react"

export default function NewMessagePage() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [selectedListing, setSelectedListing] = useState<any | null>(null)

  // Search for users
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setUsers([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)

      if (!response.ok) {
        throw new Error("Failed to search users")
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error("Error searching users:", err)
      setError(err.message || "Failed to search users")
    } finally {
      setIsLoading(false)
    }
  }

  // Search for listings
  const searchListings = async () => {
    if (!searchQuery.trim()) {
      setSelectedListing(null)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/listings?search=${encodeURIComponent(searchQuery)}&limit=5`)

      if (!response.ok) {
        throw new Error("Failed to search listings")
      }

      const data = await response.json()
      setSelectedListing(data.listings?.[0] || null)
      if (data.listings?.[0]) {
        setSelectedListingId(data.listings?.[0].id)
      }
    } catch (err) {
      console.error("Error searching listings:", err)
      setError(err.message || "Failed to search listings")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    // Debounce search
    if (e.target.value.length >= 2) {
      // In a real app, we'd debounce this
      searchUsers()
    } else {
      setUsers([])
    }
  }

  // Handle submitting search with Enter
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      searchUsers()
    }
  }

  // Handle selecting a listing
  const handleSelectListing = (listing: any) => {
    setSelectedListing(listing)
    setSelectedListingId(listing.id)
    setSearchQuery(`Обсуждение объявления: ${listing.title}`)
    // Search for users who might be interested in this listing
    // In a real app, we might want to show the seller or interested buyers
  }

  // Handle starting a conversation
  const handleStartConversation = async (user: any) => {
    try {
      setIsLoading(true)
      setError(null)

      // In a real app, we'd navigate to the conversation page with a pre-filled message
      // For now, let's just show a success message
      alert(`Начат диалог с ${user.name}`)

      // Reset form
      setSearchQuery("")
      setUsers([])
      setSelectedListing(null)
      setSelectedListingId(null)
    } catch (err) {
      console.error("Error starting conversation:", err)
      setError(err.message || "Failed to start conversation")
    } finally {
      setIsLoading(false)
    }
  }

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
          <h2 className="text-2xl font-bold mb-4">Новое сообщение</h2>
          <p className="text-gray-600 mb-6">
            Пожалуйста, войдите в систему, чтобы отправлять сообщения
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
          <h2 className="text-2xl font-bold mb-4">Новое сообщение</h2>
          <p className="text-red-500 mb-6">{error}</p>
          <Button
            onClick={() => {
              setError(null)
              if (searchQuery.trim()) {
                searchUsers()
              }
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
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6">
          <Link href="/messages" className="flex items-center space-x-2 text-gray-600 hover:text-gray-800">
            <ChevronRight className="h-4 w-4" />
            <span>Назад к сообщениям</span>
          </Link>
          <h1 className="text-2xl font-bold mt-4">Новое сообщение</h1>
        </div>

        {/* Tabs for searching users or listings */}
        <div className="mb-6 bg-white rounded-lg shadow-sm">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => {
                setSelectedListingId(null)
                setSelectedListing(null)
                if (searchQuery.trim()) {
                  searchUsers()
                }
              }}
              className={`px-4 py-3 flex-1 text-center font-medium ${
                !selectedListingId ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-600"
              }`}
            >
              Пользователи
            </button>
            <button
              onClick={() => {
                setSelectedListingId(null)
                setSelectedListing(null)
                if (searchQuery.trim()) {
                  searchListings()
                }
              }}
              className={`px-4 py-3 flex-1 text-center font-medium ${
                selectedListingId ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-600"
              }`}
            >
              Объявления
            </button>
          </div>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearchSubmit} className="mb-6 flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск пользователей..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearchSubmit(e as React.FormEvent<HTMLFormElement>)
              }
            }}
            className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              selectedListingId ? 'pointer-events-none opacity-50' : ''
            }`}
            disabled={!!selectedListingId}
          />
          {selectedListingId ? (
            <button
              type="button"
              onClick={() => {
                setSelectedListingId(null)
                setSelectedListing(null)
                setSearchQuery("")
              }}
              className="px-3 py-2 bg-gray-200 text-gray-500 rounded-lg hover:bg-gray-300"
            >
              <X className="h-4 w-4" />
              Очистить
            </button>
          ) : (
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Поиск
            </button>
          )}
        </form>

        {/* Selected listing info */}
        {selectedListingId && selectedListing && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-200 rounded flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-blue-800">
                  Обсуждение объявления
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

        {/* Results */}
        {selectedListingId ? (
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-2">Выберите пользователя для диалога</h2>
            <p className="text-gray-500">
              Кто является продавцом этого объявления или кто может быть заинтересован в покупке?
            </p>
            {/* In a real app, we would fetch the actual seller or interested buyers */}
            <div className="text-center py-8">
              <p className="text-gray-500">
                Выберите пользователя из списка выше или поищите конкретного пользователя
              </p>
            </div>
          </div>
        ) : (
          <div>
            {isLoading && users.length === 0 ? (
              <div className="text-center py-8">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent border-l-transparent border-r-primary animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Поиск пользователей...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  Пользователи не найдены
                </p>
                {searchQuery.trim() ? (
                  <p className="text-sm text-gray-400 mt-2">
                    Попробуйте изменить запрос поиска
                  )
                ) : (
                  <p className="text-sm text-gray-400 mt-2">
                    Начните вводить имя пользователя для поиска
                  )
                }
              </div>
            ) : (
              <div className="space-y-4">
                {users.map(user => (
                  <div key={user.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer"
                    onClick={() => handleStartConversation(user)}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          {user.image ? (
                            <img
                              src={user.image}
                              alt={user.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="text-gray-500">
                              {user.name
                                .split(' ')
                                .map(n => n[0])
                                .join('')
                                .toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* User info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-medium text-gray-900">{user.name}</h3>
                        <p className="text-sm text-gray-600">
                          {user.email}
                        </p>
                      </div>

                      {/* Action button */}
                      <div className="flex-shrink-0">
                        <button className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/90">
                          Написать
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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