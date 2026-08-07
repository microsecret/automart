import { useState } from "react"
import { PrismaClient } from "@prisma/client"
import { useRouter } from "next/navigation"
import LoadingSpinner from "@/components/ui/loading-spinner"

const prisma = new PrismaClient()

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const fetchedUsers = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      })
      setUsers(fetchedUsers)
    } catch (err) {
      console.error("Error fetching users:", err)
      setError("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  // Simulate componentDidMount
  // In a real implementation, this would be in useEffect
  loadUsers()

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { role: newRole }
      })
      // Refresh the user list
      loadUsers()
    } catch (err) {
      console.error("Error updating user role:", err)
      setError("Failed to update user role")
    }
  }

  const handleToggleBan = async (userId: string, isBanned: boolean) => {
    // In a real implementation, we would have a banned field or similar mechanism
    // For now, we'll just show a toast or notification
    alert(`User ${userId} would be ${isBanned ? 'unbanned' : 'banned'} (feature coming soon)`)
  }

  if (loading) {
    return (
      <div className="min-h-flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-red-600 mb-4">Ошибка</h2>
        <p className="text-red-500">{error}</p>
        <a href="/admin" className="mt-4 inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          Вернуться в админ-панель
        </a>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Управление пользователями</h1>
        <a
          href="/admin"
          className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Назад к админ-панели
        </a>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-500">
          Всего пользователей: {users.length}
        </p>
      </div>

      {users.length === 0 ? (
        <p className="text-center py-12 text-gray-500">
          Пользователей не найдено
        </p>
      ) : (
        <div className="divide-y divide-gray-200">
          {users.map(user => (
            <div key={user.id} className="py-6">
              <div className="flex items-center space-x-4">
                <img
                  src={user.image || "/default-avatar.png"}
                  alt={`${user.name || user.email}'s avatar`}
                  className="h-10 w-10 rounded-full"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-gray-900">{user.name || user.email}</h3>
                    <span className="px-2 py-1 text-xs rounded-full
                      {user.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                       user.role === 'MODERATOR' ? 'bg-purple-100 text-purple-800' :
                       'bg-gray-100 text-gray-700'}"
                    >
                      {user.role === 'ADMIN' ? 'Администратор' :
                       user.role === 'MODERATOR' ? 'Модератор' :
                       'Пользователь'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <p className="text-xs text-gray-400">
                    Член с: {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex space-x-3">
                <select
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="USER">Пользователь</option>
                  <option value="MODERATOR">Модератор</option>
                  <option value="ADMIN">Администратор</option>
                </select>
                <button
                  onClick={() => handleToggleBan(user.id, false)} // Simplified
                  className="px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Бан
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}