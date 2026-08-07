import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import LoadingSpinner from "@/components/ui/loading-spinner"
import VehicleCard from "@/components/listings/vehicle-card"
import PartCard from "@/components/listings/part-card"

const prisma = new PrismaClient()

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form state
  const [formData, setFormData] = useState({
    query: "",
    category: "all",
    location: "",
    // Vehicle filters
    make: "",
    model: "",
    yearFrom: "",
    yearTo: "",
    priceFrom: "",
    priceTo: "",
    mileageFrom: "",
    mileageTo: "",
    fuelType: "",
    transmission: "",
    bodyType: "",
    condition: "",
    driveType: "",
    color: "",
    // Part filters
    partName: "",
    compatibleMake: "",
    compatibleModel: "",
    partYearFrom: "",
    partYearTo: "",
    partType: ""
  })

  // Results state
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(12) // Items per page

  // Initialize form from URL params on mount
  useEffect(() => {
    const initializedForm: any = { ...formData }

    // Map URL params to form fields
    const paramMap: { [key: string]: string } = {
      query: "query",
      category: "category",
      location: "location",
      make: "make",
      model: "model",
      yearFrom: "yearFrom",
      yearTo: "yearTo",
      priceFrom: "priceFrom",
      priceTo: "priceTo",
      mileageFrom: "mileageFrom",
      mileageTo: "mileageTo",
      fuelType: "fuelType",
      transmission: "transmission",
      bodyType: "bodyType",
      condition: "condition",
      driveType: "driveType",
      color: "color",
      partName: "partName",
      compatibleMake: "compatibleMake",
      compatibleModel: "compatibleModel",
      partYearFrom: "partYearFrom",
      partYearTo: "partYearTo",
      partType: "partType",
      page: "page"
    }

    Object.entries(paramMap).forEach(([param, field]) => {
      const value = searchParams.get(param)
      if (value !== null) {
        initializedForm[field] = value
      }
    })

    const pageParam = parseInt(searchParams.get("page") || "1")
    if (!isNaN(pageParam) && pageParam > 0) {
      initializedForm.page = pageParam
    }

    setFormData(initializedForm)
  }, [searchParams])

  // Fetch listings when form data changes
  useEffect(() => {
    fetchListings()
  }, [formData, page])

  const fetchListings = async () => {
    setLoading(true)
    setError(null)

    try {
      // Build where clause for API request
      const params = new URLSearchParams()

      // Pagination
      params.append("page", String(page))
      params.append("limit", String(limit))

      // Text search
      if (formData.query.trim()) {
        params.append("query", formData.query.trim())
      }

      // Category
      if (formData.category && formData.category !== "all") {
        params.append("category", formData.category)
      }

      // Location
      if (formData.location.trim()) {
        params.append("location", formData.location.trim())
      }

      // Vehicle filters
      if (formData.make.trim()) {
        params.append("make", formData.make.trim())
      }
      if (formData.model.trim()) {
        params.append("model", formData.model.trim())
      }
      if (formData.yearFrom.trim()) {
        params.append("yearFrom", formData.yearFrom.trim())
      }
      if (formData.yearTo.trim()) {
        params.append("yearTo", formData.yearTo.trim())
      }
      if (formData.priceFrom.trim()) {
        params.append("priceFrom", formData.priceFrom.trim())
      }
      if (formData.priceTo.trim()) {
        params.append("priceTo", formData.priceTo.trim())
      }
      if (formData.mileageFrom.trim()) {
        params.append("mileageFrom", formData.mileageFrom.trim())
      }
      if (formData.mileageTo.trim()) {
        params.append("mileageTo", formData.mileageTo.trim())
      }
      if (formData.fuelType.trim()) {
        params.append("fuelType", formData.fuelType.trim())
      }
      if (formData.transmission.trim()) {
        params.append("transmission", formData.transmission.trim())
      }
      if (formData.bodyType.trim()) {
        params.append("bodyType", formData.bodyType.trim())
      }
      if (formData.condition.trim()) {
        params.append("condition", formData.condition.trim())
      }
      if (formData.driveType.trim()) {
        params.append("driveType", formData.driveType.trim())
      }
      if (formData.color.trim()) {
        params.append("color", formData.color.trim())
      }

      // Part filters
      if (formData.partName.trim()) {
        params.append("partName", formData.partName.trim())
      }
      if (formData.compatibleMake.trim()) {
        params.append("compatibleMake", formData.compatibleMake.trim())
      }
      if (formData.compatibleModel.trim()) {
        params.append("compatibleModel", formData.compatibleModel.trim())
      }
      if (formData.partYearFrom.trim()) {
        params.append("partYearFrom", formData.partYearFrom.trim())
      }
      if (formData.partYearTo.trim()) {
        params.append("partYearTo", formData.partYearTo.trim())
      }
      if (formData.partType.trim()) {
        params.append("partType", formData.partType.trim())
      }

      // Make API request
      const response = await fetch(`/api/listings?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setListings(data.listings)
      setTotal(data.pagination.total)
    } catch (err) {
      console.error("Error fetching search results:", err)
      setError("Failed to load search results. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1) // Reset to first page on new search
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const resetFilters = () => {
    // Reset to initial state except query and location which we might want to keep
    // For simplicity, reset everything
    setFormData({
      query: "",
      category: "all",
      location: "",
      make: "",
      model: "",
      yearFrom: "",
      yearTo: "",
      priceFrom: "",
      priceTo: "",
      mileageFrom: "",
      mileageTo: "",
      fuelType: "",
      transmission: "",
      bodyType: "",
      condition: "",
      driveType: "",
      color: "",
      partName: "",
      compatibleMake: "",
      compatibleModel: "",
      partYearFrom: "",
      partYearTo: "",
      partType: ""
    })
  }

  // Generate URL with current filters for sharing/bookmarking
  useEffect(() => {
    if (router) {
      const params = new URLSearchParams()

      // Add all non-empty form values to URL
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== "" && value !== "all" && key !== "page") {
          params.append(key, value as string)
        }
      })

      // Always add page
      params.append("page", String(page))

      // Update URL without triggering navigation
      // In Next.js 13+, we'd use router.push but that would cause navigation
      // Instead we rely on the useSearchParams hook to read from URL
      // and useEffect above to sync form state with URL
    }
  }, [formData, page, router])

  if (loading && listings.length === 0 && total === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center py-12">
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
            <div className="mt-6">
              <a
                href="/"
                className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Вернуться на главную
              </a>
              <a
                href="/search"
                className="ml-4 inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Попробовать снова
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Расширенный поиск и фильтрация
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Используйте фильтры ниже для точного поиска транспорта и запчастей
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Search and Category */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="search-query" className="block text-sm font-medium text-gray-700 mb-2">
                  Поиск по марке, модели, VIN, названию запчасти
                </label>
                <input
                  id="search-query"
                  type="text"
                  value={formData.query}
                  onChange={(e) => setFormData(prev => ({ ...prev, query: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Введите марку, модель или ключевые слова..."
                />
              </div>
              <div>
                <label htmlFor="search-category" className="block text-sm font-medium text-gray-700 mb-2">
                  Категория
                </label>
                <select
                  id="search-category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Все категории</option>
                  <option value="vehicles">Транспорт</option>
                  <option value="parts">Запчасти</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div className="mb-4">
              <label htmlFor="search-location" className="block text-sm font-medium text-gray-700 mb-2">
                Город, регион
              </label>
              <input
                id="search-location"
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Укажите город или регион..."
              />
            </div>

            {/* Vehicle Filters Section */}
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Фильтры транспорта
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="search-make" className="block text-sm font-medium text-gray-700 mb-2">
                    Марка
                  </label>
                  <input
                    id="search-make"
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Например: Toyota"
                  />
                </div>
                <div>
                  <label htmlFor="search-model" className="block text-sm font-medium text-gray-700 mb-2">
                    Модель
                  </label>
                  <input
                    id="search-model"
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Например: Camry"
                  />
                </div>
                <div>
                  <label htmlFor="search-year-from" className="block text-sm font-medium text-gray-700 mb-2">
                    Год от
                  </label>
                  <input
                    id="search-year-from"
                    type="number"
                    min="1886"
                    max={new Date().getFullYear()}
                    value={formData.yearFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, yearFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="search-year-to" className="block text-sm font-medium text-gray-700 mb-2">
                    Год до
                  </label>
                  <input
                    id="search-year-to"
                    type="number"
                    min="1886"
                    max={new Date().getFullYear()}
                    value={formData.yearTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, yearTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="search-price-from" className="block text-sm font-medium text-gray-700 mb-2">
                    Цена от (�₽)
                  </label>
                  <input
                    id="search-price-from"
                    type="number"
                    min="0"
                    value={formData.priceFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="search-price-to" className="block text-sm font-medium text-gray-700 mb-2">
                    Цена до (�₽)
                  </label>
                  <input
                    id="search-price-to"
                    type="number"
                    min="0"
                    value={formData.priceTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="search-mileage-from" className="block text-sm font-medium text-gray-700 mb-2">
                    Пробег от (км)
                  </label>
                  <input
                    id="search-mileage-from"
                    type="number"
                    min="0"
                    value={formData.mileageFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, mileageFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="search-mileage-to" className="block text-sm font-medium text-gray-700 mb-2">
                    Пробег до (км)
                  </label>
                  <input
                    id="search-mileage-to"
                    type="number"
                    min="0"
                    value={formData.mileageTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, mileageTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="search-fuel-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Тип топлива
                  </label>
                  <select
                    id="search-fuel-type"
                    value={formData.fuelType}
                    onChange={(e) => setFormData(prev => ({ ...prev, fuelType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Любой</option>
                    <option value="GASOLINE">Бензин</option>
                    <option value="DIESEL">Дизель</option>
                    <option value="ELECTRIC">Электричество</option>
                    <option value="HYBRID">Гибрид</option>
                    <option value="GAS">Газ</option>
                    <option value="OTHER">Другое</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="search-transmission" className="block text-sm font-medium text-gray-700 mb-2">
                    Коробка передач
                  </label>
                  <select
                    id="search-transmission"
                    value={formData.transmission}
                    onChange={(e) => setFormData(prev => ({ ...prev, transmission: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Любая</option>
                    <option value="MANUAL">Механическая</option>
                    <option value="AUTOMATIC">Автоматическая</option>
                    <option value="VARIATOR">Вариатор</option>
                    <option value="ROBOTIC">Роботизированная</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="search-body-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Тип кузова
                  </label>
                  <select
                    id="search-body-type"
                    value={formData.bodyType}
                    onChange={(e) => setFormData(prev => ({ ...prev, bodyType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Любой</option>
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
                <div>
                  <label htmlFor="search-condition" className="block text-sm font-medium text-gray-700 mb-2">
                    Состояние
                  </label>
                  <select
                    id="search-condition"
                    value={formData.condition}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Любое</option>
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

            {/* Part Filters Section */}
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Фильтры запчастей
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="search-part-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Название запчасти
                  </label>
                  <input
                    id="search-part-name"
                    type="text"
                    value={formData.partName}
                    onChange={(e) => setFormData(prev => ({ ...prev, partName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Например: Тормозные колодки"
                  />
                </div>
                <div>
                  <label htmlFor="search-compatible-make" className="block text-sm font-medium text-gray-700 mb-2">
                    Совместимая марка
                  </label>
                  <input
                    id="search-compatible-make"
                    type="text"
                    value={formData.compatibleMake}
                    onChange={(e) => setFormData(prev => ({ ...prev, compatibleMake: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Например: Toyota"
                  />
                </div>
                <div>
                  <label htmlFor="search-compatible-model" className="block text-sm font-medium text-gray-700 mb-2">
                    Совместимая модель
                  </label>
                  <input
                    id="search-compatible-model"
                    type="text"
                    value={formData.compatibleModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, compatibleModel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Например: Camry"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="search-part-year-from" className="block text-sm font-medium text-gray-700 mb-2">
                    Год выпуска от
                  </label>
                  <input
                    id="search-part-year-from"
                    type="number"
                    min="1886"
                    value={formData.partYearFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, partYearFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="search-part-year-to" className="block text-sm font-medium text-gray-700 mb-2">
                    Год выпуска до
                  </label>
                  <input
                    id="search-part-year-to"
                    type="number"
                    min="1886"
                    value={formData.partYearTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, partYearTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="search-part-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Тип запчасти
                  </label>
                  <select
                    id="search-part-type"
                    value={formData.partType}
                    onChange={(e) => setFormData(prev => ({ ...prev, partType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Любой тип</option>
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
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Сбросить фильтры
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Применить фильтры
                </button>
              </div>
              <div className="text-sm text-gray-500">
                <a href="#" className="underline">
                  Сохранить поиск
                </a>
              </div>
            </div>
          </form>
        </div>

        {/* Results Section */}
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <h2 className="text-lg font-medium text-gray-900">
              Результаты поиска ({total.toLocaleString()} найдено)
            </h2>
            <div className="flex space-x-2">
              <select
                onChange={(e) => {
                  setLimit(parseInt(e.target.value))
                  setPage(1) // Reset to first page when changing limit
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value={12} {limit === 12 && "selected"}>
                  12 на страницу
                </option>
                <option value={24} {limit === 24 && "selected"}>
                  24 на страницу
                </option>
                <option value={48} {limit === 48 && "selected"}>
                  48 на страницу
                </option>
              </select>
            </div>
          </div>

          {listings.length === 0 && total > 0 ? (
            <p className="text-center py-8 text-gray-500">
              По вашему запросу ничего не найдено. Попробуйте изменить фильтры поиска.
            )
          ) : (
            <>
              {listings.length === 0 && total === 0 && formData.query.trim() !== "" ? (
                <p className="text-center py-8 text-gray-500">
                  По вашему запросу ничего не найдено. Попробуйте изменить ключевые слова или сбросить фильтры.
                )
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map(listing => (
                    <div key={listing.id}>
                      {listing.vehicle ? (
                        <VehicleCard vehicle={listing.vehicle} isSmall={true} />
                      ) : (
                        <PartCard part={listing.part} isSmall={true} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex justify-center items-center py-8">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  if (page > 1) setPage(page - 1)
                }}
                disabled={page === 1}
                className="px-4 py-2 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                ← Пред.
              </button>
              <span className="px-4 py-2 text-gray-600">
                Страница {page} из {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => {
                  if (page < Math.ceil(total / limit)) setPage(page + 1)
                }}
                disabled={page === Math.ceil(total / limit)}
                className="px-4 py-2 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                След. →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}