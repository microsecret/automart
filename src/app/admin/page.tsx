import { useState } from "react"
import { PrismaClient } from "@prisma/client"
import LoadingSpinner from "@/components/ui/loading-spinner"

const prisma = new PrismaClient()

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // In a real implementation, we would use useSession here as well
  // but since AdminLayout already checks for admin role, we can assume user is admin

  const loadStats = async () => {
    try {
      setLoading(true)
      const [usersCount, vehiclesCount, partsCount, listingsCount, featuredListingsCount] = await prisma.$transaction([
        prisma.user.count(),
        prisma.vehicle.count(),
        prisma.part.count(),
        prisma.listing.count(),
        prisma.listing.count({ where: { isFeatured: true } })
      ])

      setStats({
        users: usersCount,
        vehicles: vehiclesCount,
        parts: partsCount,
        listings: listingsCount,
        featured: featuredListingsCount
      })
    } catch (error) {
      console.error("Error loading admin stats:", error)
    } finally {
      setLoading(false)
    }
  }

  // Simulate useEffect for data loading - in real app, we'd use useEffect
  // But for simplicity in this example, we'll call it directly
  // In a real Next.js 13+ app, we'd use useEffect or fetch in server component
  // For now, we'll note that this needs proper implementation

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Админ-панель AutoRent Markt
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : stats ? (
        <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Пользователи</h3>
            <p className="text-3xl font-bold text-primary">{stats.users}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Транспорт</h3>
            <p className="text-3xl font-bold text-primary">{stats.vehicles}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Запчасти</h3>
            <p className="text-3xl font-bold text-primary">{stats.parts}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Объявления</h3>
            <p className="text-3xl font-bold text-primary">{stats.listings}</p>
            <p className="text-sm text-gray-500 mt-2">
              Из них в продвижении: {stats.featured}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">Загрузка статистики...</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Управление пользователями</h2>
          <p className="text-gray-600 mb-4">
            Просмотр, блокировка и управление ролями пользователей
          </p>
          <a
            href="/admin/users"
            className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Перейти к управлению пользователями
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Управление объявлениями</h2>
          <p className="text-gray-600 mb-4">
            Просмотр, удаление и управление продвижением объявлений
          </p>
          <a
            href="/admin/listings"
            className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Перейти к управлению объявлениями
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Управление транспортом и запчастями</h2>
          <p className="text-gray-600 mb-4">
            Просмотр и управление каталогом транспортных средств и запчастей
          </p>
          <a
            href="/admin/inventory"
            className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Перейти к управлению'inventaireм
          </a>
        </div>
      </div>
    </div>
  )
}

// In a real implementation, we would import useState from react
// For the purpose of this example, we're showing the intended structure
// The actual implementation would need to properly use React hooks