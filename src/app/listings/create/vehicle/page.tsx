"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import ImageUploader from "@/components/uploads/image-uploader"
import { useSession } from "next-auth/react"

const prisma = new PrismaClient()

export default function CreateVehicleListingPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    make: "",
    model: "",
    year: "",
    mileage: "",
    vin: "",
    fuelType: "", // GASOLINE, DIESEL, ELECTRIC, HYBRID, GAS, OTHER
    transmission: "", // MANUAL, AUTOMATIC, VARIATOR, ROBOTIC
    bodyType: "", // SEDAN, HATCHBACK, SUV, COUPE, CONVERTIBLE, WAGON, MINIVAN, PICKUP, OTHER
    color: "",
    doors: "",
    engineVolume: "",
    power: "",
    driveType: "", // FWD, RWD, AWD, FOUR_WD
    condition: "", // NEW, LIKE_NEW, EXCELLENT, GOOD, FAIR, POOR
    location: "",
    categoryId: ""
  })

  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Array<{id: string, name: string}>>([])

  // Load categories on mount (simulated)
  // In real implementation, this would be in useEffect
  const loadCategories = async () => {
    try {
      const cats = await prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      })
      setCategories(cats)
    } catch (err) {
      console.error("Error loading categories:", err)
    }
  }

  // Simulate componentDidMount
  loadCategories()

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

    if (!formData.year || isNaN(Number(formData.year)) || Number(formData.year) < 1886) {
      setError("Valid year is required (after 1886)")
      setLoading(false)
      return
    }

    if (!formData.categoryId) {
      setError("Please select a category")
      setLoading(false)
      return
    }

    try {
      // Create the vehicle first
      const vehicle = await prisma.vehicle.create({
        data: {
          make: formData.make.trim(),
          model: formData.model.trim(),
          year: parseInt(formData.year),
          price: parseInt(formData.price),
          mileage: formData.mileage ? parseInt(formData.mileage) : null,
          vin: formData.vin.trim() || null,
          fuelType: formData.fuelType.trim() || null,
          transmission: formData.transmission.trim() || null,
          bodyType: formData.bodyType.trim() || null,
          color: formData.color.trim() || null,
          doors: formData.doors ? parseInt(formData.doors) : null,
          engineVolume: formData.engineVolume ? parseFloat(formData.engineVolume) : null,
          power: formData.power ? parseInt(formData.power) : null,
          driveType: formData.driveType.trim() || null,
          condition: formData.condition.trim() || null,
          location: formData.location.trim() || null,
          description: formData.description.trim() || null,
          images: images.length > 0 ? JSON.stringify(images) : null, // Store as JSON string
          userId: session?.user.id || "",
          categoryId: formData.categoryId
        }
      })

      // Create the listing for this vehicle
      await prisma.listing.create({
        data: {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          price: parseInt(formData.price),
          userId: session?.user.id || "",
          vehicleId: vehicle.id
          // partId will be null by default
        }
      })

      // Redirect to the vehicle listing page or dashboard
      router.push(`/dashboard`)
    } catch (err) {
      console.error("Error creating vehicle listing:", err)
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
            Добавить транспортное средство
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Заполните форму ниже, чтобы создать объявление о продаже транспортного средства
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
                Цена (�₽)
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

          {/* Vehicle Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Характеристики транспортного средства
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-2">
                  Марка
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
                  Модель
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
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                  Год выпуска
                </label>
                <input
                  id="year"
                  type="number"
                  min="1886"
                  max={new Date().getFullYear()}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.year}
                  onChange={(e) => handleChange('year', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="mileage" className="block text-sm font-medium text-gray-700 mb-2">
                  Пробег (км)
                </label>
                <input
                  id="mileage"
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.mileage}
                  onChange={(e) => handleChange('mileage', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="vin" className="block text-sm font-medium text-gray-700 mb-2">
                  VIN код
                </label>
                <input
                  id="vin"
                  type="text"
                  maxlength="17"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.vin}
                  onChange={(e) => handleChange('vin', e.target.value)}
                />
              </div>
              <div>
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

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="fuelType" className="block text-sm font-medium text-gray-700 mb-2">
                  Тип топлива
                </label>
                <select
                  id="fuelType"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.fuelType}
                  onChange={(e) => handleChange('fuelType', e.target.value)}
                >
                  <option value="">Выберите тип топлива</option>
                  <option value="GASOLINE">Бензин</option>
                  <option value="DIESEL">Дизель</option>
                  <option value="ELECTRIC">Электричество</option>
                  <option value="HYBRID">Гибрид</option>
                  <option value="GAS">Газ</option>
                  <option value="OTHER">Другое</option>
                </select>
              </div>
              <div>
                <label htmlFor="transmission" className="block text-sm font-medium text-gray-700 mb-2">
                  Коробка передач
                </label>
                <select
                  id="transmission"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.transmission}
                  onChange={(e) => handleChange('transmission', e.target.value)}
                >
                  <option value="">Выберите КПП</option>
                  <option value="MANUAL">Механическая</option>
                  <option value="AUTOMATIC">Автоматическая</option>
                  <option value="VARIATOR">Вариатор</option>
                  <option value="ROBOTIC">Роботизированная</option>
                </select>
              </div>
              <div>
                <label htmlFor="bodyType" className="block text-sm font-medium text-gray-700 mb-2">
                  Тип кузова
                </label>
                <select
                  id="bodyType"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.bodyType}
                  onChange={(e) => handleChange('bodyType', e.target.value)}
                >
                  <option value="">Выберите тип кузова</option>
                  <option value="SEDAN">Седан</option>
                  <option value="HATCHBACK">Хетчбэк</option>
                  <option value="SUV">Внедорожник</option>
                  <option value="COUPE">Купе</option>
                  <option value="CONVERTIBLE">Кабриолет</option>
                  <option value="WAGON">Универсал</option>
                  <option value="MINIVAN">Минивэн</option>
                  <option value="PICKUP">Пикап</option>
                  <option value="OTHER">Другое</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-2">
                  Цвет
                </label>
                <input
                  id="color"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="doors" className="block text-sm font-medium text-gray-700 mb-2">
                  Количество дверей
                </label>
                <input
                  id="doors"
                  type="number"
                  min="1"
                  max="6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.doors}
                  onChange={(e) => handleChange('doors', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="engineVolume" className="block text-sm font-medium text-gray-700 mb-2">
                  Объем двигателя (л)
                </label>
                <input
                  id="engineVolume"
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.engineVolume}
                  onChange={(e) => handleChange('engineVolume', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="power" className="block text-sm font-medium text-gray-700 mb-2">
                  Мощность (л.с.)
                </label>
                <input
                  id="power"
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.power}
                  onChange={(e) => handleChange('power', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="driveType" className="block text-sm font-medium text-gray-700 mb-2">
                  Привод
                </label>
                <select
                  id="driveType"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.driveType}
                  onChange={(e) => handleChange('driveType', e.target.value)}
                >
                  <option value="">Выберите привод</option>
                  <option value="FWD">Передний привод (FWD)</option>
                  <option value="RWD">Задний привод (RWD)</option>
                  <option value="AWD">Полный привод (AWD)</option>
                  <option value="FOUR_WD">Полный подключаемый привод (4WD)</option>
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
          </div>

          {/* Category Selection */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Категория
            </h2>
            <div className="relative">
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.categoryId}
                onChange={(e) => handleChange('categoryId', e.target.value)}
              >
                <option value="">Выберите категорию</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {!categories.length && (
                <p className="absolute inset-0 flex items-center justify-center text-gray-500">
                  Загрузка категорий...
                </p>
              )}
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