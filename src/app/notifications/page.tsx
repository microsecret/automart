import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { MessageCircle, ChevronRight, Trash2, RefreshCw, Bell, X } from "lucide-react"

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const [notifications, setNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!session) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/notifications")

      if (!response.ok) {
        throw new Error("Failed to fetch notifications")
      }

      const data = await response.json()
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error("Error fetching notifications:", err)
      setError(err.message || "Failed to load notifications")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Mark notification as read
  const markAsRead = async (notificationId: string) {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT"
      })

      // Update local state
      setNotifications(notifications.map(notif =>
        notif.id === notificationId
          ? { ...notif, isRead: true }
          : notif
      ))
    } catch (err) {
      console.error("Error marking notification as read:", err)
      setError(err.message || "Failed to mark as read")
    }
  }

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE"
      })

      // Remove from local state
      setNotifications(notifications.filter(notif => notif.id !== notificationId))
    } catch (err) {
      console.error("Error deleting notification:", err)
      setError(err.message || "Failed to delete notification")
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "PUT"
      })

      // Update local state
      setNotifications(notifications.map(notif => ({
        ...notif,
        isRead: true
      })))
    } catch (err) {
      console.error("Error marking all as read:", err)
      setError(err.message || "Failed to mark all as read")
    }
  }

  // Clear all notifications
  const clearAll = async () => {
    try {
      // In a real app, we might want to delete all notifications
      // For now, we'll just mark them all as read
      await markAllAsRead()
    } catch (err) {
      console.error("Error clearing all notifications:", err)
      setError(err.message || "Failed to clear all")
    }
  }

  // Refresh notifications
  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchNotifications()
  }

  // Fetch notifications when session changes
  useEffect(() => {
    if (session) {
      fetchNotifications()
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
          <h2 className="text-2xl font-bold mb-4">Уведомления</h2>
          <p className="text-gray-600 mb-6">
            Пожалуйста, войдите в систему, чтобы просматривать уведомления
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
          <h2 className="text-2xl font-bold mb-4">Уведомления</h2>
          <p className="text-red-500 mb-6">{error}</p>
          <Button
            onClick={() => {
              setError(null)
              fetchNotifications()
            }}
          >
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Уведомления</h1>
          <p className="text-gray-600">
            Ваши уведомления и оповещения
          </p>
        </div>

        {/* Header actions */}
        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              {unreadCount} непрочитанных
            </span>
            <button
              onClick={markAllAsRead}
              disabled=unreadCount === 0
              className={`px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 ${
                unreadCount === 0 ? 'opacity-50' : ''
              }`}
            >
              Отметить всё как прочитанное
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-50 transition-colors ${
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
        </div>

        {/* Notifications list */}
        {isLoading && notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent border-l-transparent border-r-primary animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Загрузка уведомлений...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-10 w-10 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">
              У вас пока нет уведомлений
            </p>
            <p className="text-gray-400">
              Вы будете получать уведомления о новых сообщениях, обновлениях объявлений и других событиях
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(notification => (
              <div key={notification.id} className={`border-l-4 border-l-2 ${notification.isRead ? 'border-gray-200' : 'border-primary'} bg-white rounded-lg shadow-sm p-4`}>
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 flex items-center justify-center rounded-md ${notification.type === 'ERROR' ? 'bg-red-100' : notification.type === 'WARNING' ? 'bg-yellow-100' : notification.type === 'SUCCESS' ? 'bg-green-100' : 'bg-blue-100'}">
                      {notification.type === 'ERROR' ? (
                        <MessageCircle className="h-4 w-4 text-red-500" />
                      ) : notification.type === 'WARNING' ? (
                        <Search className="h-4 w-4 text-yellow-500" />
                      ) : notification.type === 'SUCCESS' ? (
                        <MessageCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Bell className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {notification.createdAt ? new Date(notification.createdAt).toLocaleString('ru-RU', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : ''}
                      </p>
                    </div>

                    <p className="text-sm text-gray-600">
                      {notification.content}
                    </p>

                    {notification.relatedId && notification.relatedType && (
                      <div className="mt-2 text-xs text-gray-500">
                        <span className="font-medium">{notification.relatedType}:</span> {notification.relatedId}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 space-x-2">
                    <button
                      onClick={() => markAsRead(notification.id)}
                      disabled={notification.isRead}
                      className={`p-1 rounded hover:bg-gray-100 ${notification.isRead ? 'opacity-50' : ''}`}
                    >
                      {notification.isRead ? (
                        <MessageCircle className="h-3 w-3 text-gray-400" />
                      ) : (
                        <MessageCircle className="h-3 w-3 text-gray-600" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteNotification(notification.id)}
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