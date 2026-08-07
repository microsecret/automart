import { useState } from "react"
import { useRouter } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import ImageUploader from "@/components/uploads/image-uploader"
import { useSession } from "next-auth/react"

const prisma = new PrismaClient()

export default function CreatePartListingPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    name: "",
    make: "",
    model: "",
    yearFrom: "",
    yearTo: "",
    partType: "", // ENGINE, TRANSMISSION, SUSPENSION, BRAKES, ELECTRICAL, BODY, INTERIOR, WHEELS, ACCESSORIES, OTHER
    condition: "", // NEW, LIKE_NEW, EXCELLENT, GOOD, FAIR, POOR
    location: ""
  })

  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleImageUpload = (urls: string[]) => {
    setImages(urls)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Basic validation
    if (!formData.title.trim()) {
      setError("Title is required")
      setLoading(false)
      return
    }

    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      setError("Valid price is required")
      setLoading(false)
      return
    }

    if (!formData.name.trim()) {
      setError("Part name is required")
      setLoading(false)
      return
    }

    if (!formData.make.trim()) {
      setError("Make is required")
      setLoading(false)
      return
    }

    if (!formData.model.trim()) {
      setError("Model is required")
      setLoading(false)
      return
    }

    try {
      // Create the part first
      const part = await prisma.part.create({
        data: {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: parseInt(formData.price),
          condition: formData.condition.trim() || null,
          make: formData.make.trim(),
          model: formData.model.trim(),
          yearFrom: formData.yearFrom ? parseInt(formData.yearFrom) : null,
          yearTo: formData.yearTo ? parseInt(formData.yearTo) : null,
          partType: formData.partType.trim() || null,
          location: formData.location.trim() || null,
          images: images.length > 0 ? JSON.stringify(images) : null, // Store as JSON string
          userId: session?.user.id || ""
        }
      })

      // Create the listing for this part
      await prisma.listing.create({
        data: {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          price: parseInt(formData.price),
          userId: session?.user.id || "",
          partId: part.id
          // vehicleId will be null by default
        }
      })

      // Redirect to the part listing page or dashboard
      router.push(`/dashboard`)
    } catch (err) {
      console.error("Error creating part listing:", err)
      setError("Failed to create listing. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Добавить запчасть
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Заполните форму ниже, чтобы создать объявление о продаже запчасти
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg shadow p-6">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Название объявления
              </label>
              <input
                id="title"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                Цена (���₽)
              </label>
              <input
                id="price"
                type="number"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
              />
            </div>
          </div>

          {/* Part Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Информация о запчасти
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Название запчасти
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-2">
                  Марка транспортного средства
                </label>
                <input
                  id="make"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.make}
                  onChange={(e) => handleChange('make', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                  Модель транспортного средства
                </label>
                <input
                  id="model"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="yearFrom" className="block text-sm font-medium text-gray-700 mb-2">
                  Год выпуска (от)
                </label>
                <input
                  id="yearFrom"
                  type="number"
                  min="1886"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.yearFrom}
                  onChange={(e) => handleChange('yearFrom', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="yearTo" className="block text-sm font-medium text-gray-700 mb-2">
                  Год выпуска (до)
                </label>
                <input
                  id="yearTo"
                  type="number"
                  min="1886"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.yearTo}
                  onChange={(e) => handleChange('yearTo', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="partType" className="block text-sm font-medium text-gray-700 mb-2">
                  Тип запчасти
                </label>
                <select
                  id="partType"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.partType}
                  onChange={(e) => handleChange('partType', e.target.value)}
                >
                  <option value="">Выберите тип запчасти</option>
                  <option value="ENGINE">Двигатель</option>
                  <option value="TRANSMISSION">Коробка передач</option>
                  <option value="SUSPENSION">Подвеска</option>
                  <option value="BRAKES">Тормоза</option>
                  <option value="ELECTRICAL">Электрика</option>
                  <option value="BODY">Кузов</option>
                  <option value="INTERIOR">Салон</option>
                  <option value="WHEELS">Колеса</option>
                  <option value="ACCESSORIES">Аксессуары</option>
                  <option value="OTHER">Другое</option>
                </select>
              </div>
              <div>
                <label htmlFor="condition" className="block text-sm font-medium text-gray-700 mb-2">
                  Состояние
                </label>
                <select
                  id="condition"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.condition}
                  onChange={(e) => handleChange('condition', e.target.value)}
                >
                  <option value="">Выберите состояние</option>
                  <option value="NEW">Новое</option>
                  <option value="LIKE_NEW">Как новое</option>
                  <option value="EXCELLENT">Отличное</option>
                  <option value="GOOD">Хорошее</option>
                  <option value="FAIR">Удовлетворительное</option>
                  <option value="POOR">Плохое</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Расположение
              </label>
              <input
                id="location"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Описание
            </h2>
            <textarea
              id="description"
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Изображения
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              Вы можете загрузить несколько изображений. Первое изображение будет использовано как главное.
            </p>
            <ImageUploader
              multiple={true}
              onUploadComplete={handleImageUpload}
              acceptedFiles={['image/jpeg', 'image/png', 'image/webp']}
              maxSizeMB={10}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {loading ? "Создание объявления..." : "Опубликовать объявление"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}