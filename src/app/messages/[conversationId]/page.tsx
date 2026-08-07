import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { MessageCircle, ChevronRight, X, Send, Search, FileText, Calendar } from "lucide-react"

export default function ConversationPage({ params }: { params: { conversationId: string } }) {
  const { data: session, status: sessionStatus, update: updateSession } = useSession()
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [otherUser, setOtherUser] = useState<any | null>(null)
  const [listing, setListing] = useState<any | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messageListRef = useRef<HTMLDivElement>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Parse conversationId to get the two users and listingId
  // Format: "{userId1}-{userId2}-{listingId}" or "{userId1}-{userId2}-no-listing"
  const [userId1, userId2, listingIdParam = null] = params.conversationId.split('-')
  const listingId = listingIdParam && listingIdParam !== 'no-listing' ? listingIdParam : null

  // Verify that the current user is part of this conversation
  const isParticipant = session?.user.id && (session.user.id === userId1 || session.user.id === userId2)

  // Fetch conversation details
  const fetchConversationDetails = async () => {
    if (!session || !isParticipant) return

    try {
      setIsLoading(true)
      setError(null)

      // Fetch other user info
      const otherUserId = session.user.id === userId1 ? userId2 : userId1
      const userResponse = await fetch(`/api/users/${otherUserId}`)
      if (userResponse.ok) {
        const userData = await userResponse.json()
        setOtherUser(userData)
      }

      // Fetch listing info if applicable
      if (listingId) {
        const listingResponse = await fetch(`/api/listings/${listingId}`)
        if (listingResponse.ok) {
          const listingData = await listingResponse.json()
          setListing(listingData)
        }
      }

      // Fetch messages
      await fetchMessages()
    } catch (err) {
      console.error("Error fetching conversation details:", err)
      setError(err.message || "Failed to load conversation details")
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch messages
  const fetchMessages = async () => {
    if (!session || !isParticipant) return

    try {
      setIsLoading(true)

      const response = await fetch(`/api/messages/${params.conversationId}?page=1&limit=50`)

      if (!response.ok) {
        throw new Error("Failed to fetch messages")
      }

      const data = await response.json()
      setMessages(data.messages || [])

      // Scroll to bottom after messages load
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight
      }
    } catch (err) {
      console.error("Error fetching messages:", err)
      setError(err.message || "Failed to load messages")
    } finally {
      setIsLoading(false)
    }
  }

  // Mark conversation as read
  const markAsRead = async () => {
    if (!session || !isParticipant) return

    try {
      await fetch(`/api/messages/${params.conversationId}`, {
        method: "PUT"
      })
    } catch (err) {
      console.error("Error marking conversation as read:", err)
    }
  }

  // Send a new message
  const sendMessage = async () => {
    if (!session || !isParticipant || !newMessage.trim()) return

    if (isSending) return

    try {
      setIsSending(true)
      setError(null)

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          receiverId: session.user.id === userId1 ? userId2 : userId1,
          listingId: listingId || null
        })
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      const sentMessage = await response.json()

      // Add the sent message to the list
      setMessages(prev => [...prev, sentMessage])

      // Clear input and scroll to bottom
      setNewMessage("")
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight
      }
    } catch (err) {
      console.error("Error sending message:", err)
      setError(err.message || "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  // Handle key press in message input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [messages])

  // Start periodic refresh when component mounts
  useEffect(() => {
    if (session && isParticipant) {
      fetchConversationDetails()

      // Mark as read when viewing
      markAsRead()

      // Refresh every 15 seconds for new messages
      refreshIntervalRef.current = setInterval(() => {
        fetchMessages()
        markAsRead()
      }, 15000)
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [session, isParticipant, params.conversationId])

  if (sessionStatus === "loading") {
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

  if (!isParticipant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Доступ запрещен</h2>
          <p className="text-gray-600 mb-6">
            У вас нет доступа к этому диалогу
          </p>
          <Link href="/messages" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
            Вернуться к сообщениям
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
              fetchConversationDetails()
            }}
          >
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  if (!otherUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center py-12">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent border-l-transparent border-r-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Загрузка собеседника...</p>
        </div>
      )
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="flex items-center space-x-4 p-4 border-b border-gray-200">
            <Link href="/messages" className="text-gray-500 hover:text-gray-700">
              <ChevronRight className="h-4 w-4" />
              Назад к сообщениям
            </Link>

            <div className="flex-1">
              <div className="flex items-center space-x-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    {otherUser.image ? (
                      <img
                        src={otherUser.image}
                        alt={otherUser.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-500">
                        {otherUser.name
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* User info */}
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900">{otherUser.name}</h2>
                  <p className="text-sm text-gray-500">
                    {listing ? `Обсуждение объявления` : `Прямой диалог`}
                  </p>
                </div>
              </div>

              {/* Menu button */}
              <div className="flex-shrink-0">
                <button className="p-2 rounded hover:bg-gray-100">
                  <MessageCircle className="h-4 w-4 text-gray-500 hover:text-primary" />
                </button>
              </div>
            </div>
          </div>

          {/* Listing info if applicable */}
          {listing && (
            <div className="px-4 py-3 bg-blue-50 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-200 rounded flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-blue-800 mb-1">
                    {listing.title}
                  </h3>
                  <p className="text-sm text-blue-600">
                    {listing.vehicle ? (
                      <>
                        {listing.vehicle.year} {listing.vehicle.make} {listing.vehicle.model}
                      </>
                    ) : (
                      <>
                        Сочетается с: {listing.part.make} {listing.part.model}
                      </>
                    )}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    // Navigate to listing detail page
                    // In a real app, we'd link to the listing
                    console.log("Navigate to listing:", listing)
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Посмотреть объявление
                  <ChevronRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent border-l-transparent border-r-primary animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Загрузка сообщений...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-10 w-10 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">
                Начните диалог, отправив первое сообщение
              </p>
              {listing && (
                <p className="text-sm text-gray-400">
                  Вы можете обсудить объявление: {listing.title}
                )
              }}
            </div>
          ) : (
            <div ref={messageListRef} className="space-y-4">
              {messages.map((message, index) => {
                const isOwnMessage = message.senderId === session!.user.id
                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isOwnMessage ? 'bg-primary text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-3 ${isOwnMessage ? 'ml-auto' : 'mr-auto'}`}>
                      <p className="mb-1 whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 text-right">
                        {new Date(message.createdAt).toLocaleString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {!message.isRead && !isOwnMessage && (
                          <span className="ml-2 inline-block h-2 w-2 bg-primary rounded-full" />
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="bg-white px-4 py-3 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            {/* Attachment button */}
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="Прикрепить файл"
            >
              <Search className="h-4 w-4 text-gray-500 hover:text-primary" />
            </button>

            {/* Message input */}
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение..."
              className={`flex-1 min-h-[60px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none ${
                isSending ? 'opacity-50' : ''
              }`}
              disabled={isSending}
              rows={1}
            />

            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={isSending || !newMessage.trim()}
              className={`px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors ${
                isSending ? 'opacity-50' : ''
              }`}
            >
              {isSending ? (
                <>
                  <div className="h-4 w-4 border-2 border-t-transparent border-l-transparent border-b-primary animate-spin" />
                </>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
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