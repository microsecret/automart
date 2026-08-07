import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { MessageCircle, UserPlus, Search, ChevronRight } from "lucide-react"

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch conversations
  const fetchConversations = async () => {
    if (!session) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/messages?page=1&limit=20${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`)

      if (!response.ok) {
        throw new Error("Failed to fetch conversations")
      }

      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.error("Error fetching conversations:", err)
      setError(err.message || "Failed to load conversations")
    } finally {
      setIsLoading(false)
    }
  }

  // Start periodic refresh when component mounts
  useEffect(() => {
    if (session) {
      fetchConversations()

      // Refresh every 30 seconds
      refreshIntervalRef.current = setInterval(fetchConversations, 30000)
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [session, searchQuery])

  // Handle search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // Handle submitting search
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    fetchConversations()
  }

  // Handle deleting a conversation (in this case, just marking all messages as read)
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await fetch(`/api/messages/${conversationId}`, {
        method: "PUT"
      })

      // Refresh conversations
      fetchConversations()
    } catch (err) {
      console.error("Error deleting conversation:", err)
      setError("Failed to delete conversation")
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
          <h2 className="text-2xl font-bold mb-4">Сообщения</h2>
          <p className="text-gray-600 mb-6">
            Пожалуйста, войдите в систему, чтобы просматривать сообщения
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
          <h2 className="text-2xl font-bold mb-4">Сообщения</h2>
          <p className="text-red-500 mb-6">{error}</p>
          <Button
            onClick={() => {
              setError(null)
              fetchConversations()
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
          <h1 className="text-2xl font-bold">Сообщения</h1>
          <p className="text-gray-600">
            Общайтесь с покупателями и продавцами
          </p>
        </div>

        {/* Search and filter */}
        <form onSubmit={handleSearchSubmit} className="mb-6 flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по именам..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearchSubmit(e as React.FormEvent<HTMLFormElement>)
              }
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Поиск
          </button>
        </form>

        {/* New conversation button */}
        <div className="mb-6">
          <Link href="/messages/new" className="flex items-center space-x-3 px-4 py-2 bg-white rounded-lg shadow-sm hover:bg-gray-50">
            <UserPlus className="h-4 w-4 text-primary" />
            <span>Новое сообщение</span>
          </Link>
        </div>

        {/* Conversations list */}
        {isLoading && conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent border-l-transparent border-r-primary animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Загрузка диалогов...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-10 w-10 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">
              У вас пока нет диалогов
            </p>
            <p className="text-gray-400">
              Начните диалог, отправив первое сообщение покупателю или продавцу
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map(conversation => (
              <div key={conversation.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  // Navigate to conversation detail page
                  // We'll need to create a proper conversation detail page
                  // For now, let's just log it
                  console.log("Navigate to conversation:", conversation)
                }}
              >
                <div className="flex items-center space-x-4 p-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {conversation.otherUser.image ? (
                        <img
                          src={conversation.otherUser.image}
                          alt={conversation.otherUser.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-500">
                          {conversation.otherUser.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conversation info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900 truncate max-w-xs">
                        {conversation.otherUser.name}
                      </h3>
                      <p className="text-xs text-gray-500 ml-4">
                        {conversation.unreadCount > 0 ? (
                          <span className="bg-primary text-white px-2 py-0.5 rounded textos-xs">
                            {conversation.unreadCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            {new Date(conversation.lastMessage.createdAt).toLocaleString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1 max-w-xs truncate">
                      {conversation.lastMessage.content}
                    </p>
                    {conversation.listing && (
                      <div className="mt-2 text-xs text-gray-500 flex items-center space-x-2">
                        <div className="h-3 w-3 bg-gray-200 rounded flex items-center justify-center">
                          <ChevronRight className="h-2 w-2 text-gray-400" />
                        </div>
                        <span>
                          {conversation.listing.title}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex-shrink-0 space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteConversation(conversation.id)
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <MessageCircle className="h-3 w-3 text-gray-400 hover:text-primary" />
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