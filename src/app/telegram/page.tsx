import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { PrismaClient } from "@prisma/client"
import VehicleCard from "@/components/listings/vehicle-card"
import PartCard from "@/components/listings/part-card"
import LoadingSpinner from "@/components/ui/loading-spinner"
import { MessageCircle, Heart, Bell, Plus } from 'lucide-react'

const prisma = new PrismaClient()

export default function TelegramMiniApp() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listings, setListings] = useState<any[]>([])
  // Состояние для пользователя Telegram
  const [telegramUser, setTelegramUser] = useState<any | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  // Счетчики уведомлений
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  // Состояние для формы создания объявления
  const [showCreateListingForm, setShowCreateListingForm] = useState(false);
  const [listingType, setListingType] = useState<'vehicle' | 'part' | null>(null);
  const [createListingLoading, setCreateListingLoading] = useState(false);
  const [createListingError, setCreateListingError] = useState<string | null>(null);
  // Форма для транспортного средства
  const [vehicleForm, setVehicleForm] = useState({
    title: '',
    description: '',
    price: '',
    year: '',
    make: '',
    model: '',
    mileage: '',
    vin: '',
    fuelType: '',
    transmission: '',
    driveType: '',
    bodyType: '',
    color: '',
    condition: '',
    images: [] as string[]
  });
  // Форма для запчасти
  const [partForm, setPartForm] = useState({
    title: '',
    description: '',
    price: '',
    name: '',
    make: '',
    model: '',
    condition: '',
    images: [] as string[]
  });

  // Инициализация Telegram WebApp
  useEffect(() => {
    // Проверяем, находимся ли мы в контексте Telegram WebApp
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp

      // Инициализируем WebApp
      tg.ready()

      // Попытка загрузить пользователя Telegram из localStorage для сохранения состояния входа
      const savedUser = localStorage.getItem('telegramUser')
      if (savedUser) {
        setTelegramUser(JSON.parse(savedUser))
      }

      // Устанавливаем цвет фона, соответствующий теме Telegram
      tg.BackgroundColor = '#fff'

      // Включаем свайп жесты при необходимости
      tg.enableSwipeGesture(true)

      // Обрабатываем изменения темы
      tg.onEvent('themeChanged', (params) => {
        // Обновляем цвета на основе темы Telegram
        document.documentElement.style.setProperty('--bg-color', params.background_color)
        document.documentElement.style.setProperty('--text-color', params.text_color)
        document.documentElement.style.setProperty('--hint-color', params.hint_color)
        document.documentElement.style.setProperty('--link-color', params.link_color)
        document.documentElement.style.setProperty('--button-color', params.button_color)
        document.documentElement.style.setProperty('--button-text-color', params.button_text_color)
      })

      // Обрабатываем изменения области просмотра
      tg.onEvent('viewportChanged', () => {
        // При необходимости корректируем layout
        console.log('Viewport changed:', tg.viewport)
      })

      // Получаем данные пользователя Telegram, если доступны
      const initData = tg.initData
      if (initData) {
        try {
          const urlParams = new URLSearchParams(initData)
          const userJson = urlParams.get('user')
          if (userJson) {
            const telegramUser = JSON.parse(userJson)
            setTelegramUser({
              id: telegramUser.id,
              name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim() || telegramUser.username || `Telegram User ${telegramUser.id}`,
              image: telegramUser.photo_url || null,
              // Мы не имеем доступа к email из initData по соображениям конфиденциальности
              // Но мы могли бы использовать специальный паттерн, как в нашем API эндпоинте
              email: `tg_${telegramUser.id}@telegram.local`
            });
            // Сохраняем пользователя в localStorage для сохранения состояния входа
            localStorage.setItem('telegramUser', JSON.stringify({
              id: telegramUser.id,
              name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim() || telegramUser.username || `Telegram User ${telegramUser.id}`,
              image: telegramUser.photo_url || null,
              email: `tg_${telegramUser.id}@telegram.local`
            }));
          }
        } catch (err) {
          console.error("Ошибка при парсинге данных пользователя Telegram:", err)
        }
      }

      setIsReady(true)
    } else {
      // Не в Telegram, перенаправляем в основное приложение или показываем сообщение
      setIsReady(true) // Все равно показываем контент для тестирования
    }

    // Загружаем начальные данные
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setIsLoading(true)

      // Получаем рекомендуемые объявления или популярные товары
      const featuredListings = await prisma.listing.findMany({
        where: {
          isFeatured: true
        },
        include: {
          vehicle: true,
          part: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true
            }
          }
        },
        take: 10
      })

      setListings(featuredListings)
    } catch (err) {
      console.error("Ошибка загрузки начальных данных:", err)
      setError("Не удалось загрузить данные")
    } finally {
      setIsLoading(false)
    }
  }

  // Обработка кнопки назад в Telegram
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const backButton = window.Telegram.WebApp.BackButton

      backButton.onClick(() => {
        // Обрабатываем нажатие кнопки назад - переход назад или закрытие
        if (router.pathname !== '/telegram') {
          router.back()
        } else {
          window.Telegram.WebApp.close()
        }
      })

      // Показываем кнопку назад, если мы не в корне
      if (router.pathname !== '/telegram') {
        backButton.show()
      } else {
        backButton.hide()
      }

      return () => {
        backButton.hide()
        backButton.offClick(() => {})
      }
    }
  }, [router.pathname])

  // Получаем данные инициализации Telegram для аутентификации
  const getTelegramInitData = async () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      return tg.initData
    }
    return null
  }

  // Обновляем счетчики уведомлений
  useEffect(() => {
    // Обновляем счетчики, если у нас есть пользователь (либо Telegram, либо основная сессия)
    const updateCounts = async () => {
      const userId = telegramUser?.id || session?.user?.id;
      if (!userId) return;

      try {
        // Получаем количество непрочитанных сообщений
        const messagesResponse = await fetch(`/api/messages?unreadCountOnly=true`);
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setUnreadMessagesCount(messagesData.count || 0);
        }

        // Получаем количество избранного
        const favoritesResponse = await fetch(`/api/favorites?countOnly=true`);
        if (favoritesResponse.ok) {
          const favoritesData = await favoritesResponse.json();
          setFavoritesCount(favoritesData.count || 0);
        }

        // Получаем количество непрочитанных уведомлений
        const notificationsResponse = await fetch(`/api/notifications?unreadCountOnly=true`);
        if (notificationsResponse.ok) {
          const notificationsData = await notificationsResponse.json();
          setUnreadNotificationsCount(notificationsData.count || 0);
        }
      } catch (err) {
        console.error("Ошибка при обновлении счетчиков:", err);
      }
    };

    // Обновляем при монтировании и когда меняется пользователь
    updateCounts();

    // Также можно обновлять периодически
    const interval = setInterval(updateCounts, 30000); // Каждые 30 секунд
    return () => clearInterval(interval);
  }, [telegramUser, session]);

  // Вход через Telegram
  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreateListingLoading(true);
    setCreateListingError(null);
    try {
      // Prepare data for API request
      let apiData = {};
      let apiEndpoint = '';

      if (listingType === 'vehicle') {
        // Validate required fields matching web form validation
        if (!vehicleForm.make || !vehicleForm.make.trim()) {
          throw new Error('Марка обязательна');
        }
        if (!vehicleForm.model || !vehicleForm.model.trim()) {
          throw new Error('Модель обязательна');
        }
        if (!vehicleForm.year || isNaN(Number(vehicleForm.year)) || Number(vehicleForm.year) < 1886) {
          throw new Error('Год должен быть после 1886');
        }
        if (vehicleForm.price === '' || vehicleForm.price === null || isNaN(Number(vehicleForm.price)) || Number(vehicleForm.price) < 0) {
          throw new Error('Цена обязательна и должна быть положительной');
        }

        // Prepare vehicle data matching API endpoint
        apiData = {
          make: vehicleForm.make.trim(),
          model: vehicleForm.model.trim(),
          year: parseInt(vehicleForm.year),
          price: parseInt(vehicleForm.price),
          mileage: vehicleForm.mileage ? parseInt(vehicleForm.mileage) : null,
          vin: vehicleForm.vin ? vehicleForm.vin.trim() : null,
          fuelType: vehicleForm.fuelType ? vehicleForm.fuelType.trim() : null,
          transmission: vehicleForm.transmission ? vehicleForm.transmission.trim() : null,
          bodyType: vehicleForm.bodyType ? vehicleForm.bodyType.trim() : null,
          color: vehicleForm.color ? vehicleForm.color.trim() : null,
          doors: null, // Not in form, setting to null (API allows null)
          engineVolume: null, // Not in form, setting to null (API allows null)
          power: null, // Not in form, setting to null (API allows null)
          driveType: vehicleForm.driveType ? vehicleForm.driveType.trim() : null,
          condition: vehicleForm.condition ? vehicleForm.condition.trim() : null,
          location: '', // Not in form, setting to empty string (API allows empty string)
          description: vehicleForm.description ? vehicleForm.description.trim() : null,
          images: vehicleForm.images.length > 0 ? JSON.stringify(vehicleForm.images) : null,
          categoryId: 1 // Default category - in a real app this would come from a category selector
        };
        apiEndpoint = '/api/vehicles';
      } else if (listingType === 'part') {
        // Validate required fields matching web form validation
        if (!partForm.name || !partForm.name.trim()) {
          throw new Error('Название запчасти обязательно');
        }
        if (partForm.price === '' || partForm.price === null || isNaN(Number(partForm.price)) || Number(partForm.price) < 0) {
          throw new Error('Цена обязательна и должна быть положительной');
        }

        // Prepare part data matching API endpoint
        apiData = {
          name: partForm.name.trim(),
          description: partForm.description ? partForm.description.trim() : null,
          price: parseInt(partForm.price),
          condition: partForm.condition ? partForm.condition.trim() : null,
          make: partForm.make ? partForm.make.trim() : null,
          model: partForm.model ? partForm.model.trim() : null,
          yearFrom: null, // Not in form, setting to null (API allows null)
          yearTo: null, // Not in form, setting to null (API allows null)
          partType: '', // Not in form, setting to empty string (API allows empty string)
          location: '', // Not in form, setting to empty string (API allows empty string)
          images: partForm.images.length > 0 ? JSON.stringify(partForm.images) : null
          // userId is obtained from session by the API route
        };
        apiEndpoint = '/api/parts';
      }

      // Note: userId is obtained from session by the API routes, so we don't need to send it in the request body

      // Show loading state in Telegram
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showLoadingIndicator();
      }

      // Make actual API request
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при создании объявления');
      }

      // Hide loading indicator
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.hideLoadingIndicator();
      }

      // Show success
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showPopup({
          title: 'Успех',
          message: 'Объявление успешно создано',
          buttons: [
            { type: 'default', text: 'OK' }
          ]
        });
      }

      // Reset form
      setShowCreateListingForm(false);
      setListingType(null);
      if (listingType === 'vehicle') {
        setVehicleForm({
          title: '',
          description: '',
          price: '',
          year: '',
          make: '',
          model: '',
          mileage: '',
          vin: '',
          fuelType: '',
          transmission: '',
          driveType: '',
          bodyType: '',
          color: '',
          condition: '',
          images: []
        });
      } else {
        setPartForm({
          title: '',
          description: '',
          price: '',
          name: '',
          make: '',
          model: '',
          condition: '',
          images: []
        });
      }
    } catch (err) {
      console.error('Error creating listing:', err);
      // Hide loading indicator on error
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.hideLoadingIndicator();
      }
      setCreateListingError(err.message || 'Не удалось создать объявление');
    } finally {
      setCreateListingLoading(false);
    }
  };

  const loginWithTelegram = async () => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      setError("Telegram WebApp недоступен")
      return
    }

    setIsLoggingIn(true)
    setError(null)

    try {
      const initData = window.Telegram.WebApp.initData
      if (!initData) {
        setError("Не удалось получить данные инициализации Telegram")
        return
      }

      const response = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ initData }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ошибка авторизации")
      }

      // Сохраняем данные пользователя Telegram
      setTelegramUser(data.user)

      // Показываем сообщение об успешном входе
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showPopup({
          title: 'Успех',
          message: 'Вы успешно вошли в систему',
          buttons: [
            { type: 'default', text: 'OK' }
          ]
        })
      }

      // Также можно обновить сессию NextAuth, если нужно
      // Для простоты пока храним отдельно

      // Закрываем любые popup
      window.Telegram.WebApp.closePopup()
    } catch (err) {
      console.error("Ошибка входа через Telegram:", err)
      setError(err.message || "Неизвестная ошибка")
    } finally {
      setIsLoggingIn(false)
    }
  }

  if (isLoading && listings.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center text-red-500">
          <p className="font-bold">Ошибка загрузки</p>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: typeof window !== 'undefined' && window.Telegram?.WebApp
          ? window.Telegram.WebApp.backgroundColor
          : '#ffffff',
        color: typeof window !== 'undefined' && window.Telegram?.WebApp
          ? window.Telegram.WebApp.textColor
          : '#000000'
      }}
    >
      {/* Header */}
      <div className="bg-primary text-white px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-xl font-bold">
              AutoRent Markt
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {telegramUser ? (
              <>
                <img
                  src={telegramUser.image || "/default-avatar.png"}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full"
                />
                <span className="hidden ml-2">
                  {telegramUser.name.split(' ')[0]} // First name only
                </span>
                {/* Счетчики уведомлений */}
                <div className="relative ml-3 space-x-3">
                  {/* Сообщения */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                          window.Telegram.WebApp.openLink('http://localhost:3000/messages')
                        } else {
                          router.push('/messages')
                        }
                      }}
                      className="p-1 rounded hover:bg-primary/20"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                        </span>
                      )}
                    </button>
                  </div>
                  {/* Избранное */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                          window.Telegram.WebApp.openLink('http://localhost:3000/favorites')
                        } else {
                          router.push('/favorites')
                        }
                      }}
                      className="p-1 rounded hover:bg-primary/20"
                    >
                      <Heart className="h-4 w-4" />
                      {favoritesCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                          {favoritesCount > 99 ? "99+" : favoritesCount}
                        </span>
                      )}
                    </button>
                  </div>
                  {/* Уведомления */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                          window.Telegram.WebApp.openLink('http://localhost:3000/notifications')
                        } else {
                          router.push('/notifications')
                        }
                      }}
                      className="p-1 rounded hover:bg-primary/20"
                    >
                      <Bell className="h-4 w-4" />
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setTelegramUser(null)
                    // Также можно показать уведомление
                    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                      window.Telegram.WebApp.showPopup({
                        title: 'Выход',
                        message: 'Вы successfully вышли из системы',
                        buttons: [
                          { type: 'default', text: 'OK' }
                        ]
                      })
                    }
                    // Также пытаемся выйти из основной сессии, если возможно
                    try {
                      const response = await fetch("/api/auth/signout", {
                        method: "POST",
                      })
                      if (response.ok) {
                        // Перенаправляем на главную после успешного выхода
                        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                          window.Telegram.WebApp.openLink('http://localhost:3000')
                        }
                      }
                    } catch (err) {
                      console.error("Ошибка при выходе из основной сессии:", err)
                    }
                  }}
                  className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200"
                >
                  Выход
                </button>
              </>
            ) : session ? (
              <>
                <img
                  src={session.user.image || "/default-avatar.png"}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full"
                />
                <span className="hidden ml-2">
                  {session.user.name.split(' ')[0]} // First name only
                </span>
                {/* Счетчики уведомлений для основной сессии */}
                <div className="relative ml-3 space-x-3">
                  {/* Сообщения */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        router.push('/messages')
                      }}
                      className="p-1 rounded hover:bg-primary/20"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                        </span>
                      )}
                    </button>
                  </div>
                  {/* Избранное */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        router.push('/favorites')
                      }}
                      className="p-1 rounded hover:bg-primary/20"
                    >
                      <Heart className="h-4 w-4" />
                      {favoritesCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                          {favoritesCount > 99 ? "99+" : favoritesCount}
                        </span>
                      )}
                    </button>
                  </div>
                  {/* Уведомления */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        router.push('/notifications')
                      }}
                      className="p-1 rounded hover:bg-primary/20"
                    >
                      <Bell className="h-4 w-4" />
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <button
                onClick={loginWithTelegram}
                disabled={isLoggingIn}
                className={`px-3 py-1 bg-white text-primary rounded hover:bg-primary/20 ${
                  isLoggingIn ? "opacity-50" : ""
                }`}
              >
                {isLoggingIn ? "Вход..." : "Войти через Telegram"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">Рекомендуемые объявления</h2>

        {listings.length === 0 ? (
          <p className="text-center py-8 text-gray-500">
            Пока нет рекомендуемых объявлений
          )
        ) : (
          <div className="space-y-4">
            {listings.map(listing => (
              <div key={listing.id} className="border rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  {listing.vehicle ? (
                    <>
                      <div className="flex-shrink-0">
                        <img
                          src={listing.vehicle.images && listing.vehicle.images.length > 0
                            ? JSON.parse(listing.vehicle.images)[0]
                            : "/default-vehicle.png"}
                          alt="Vehicle"
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h3 className="font-medium">{listing.vehicle.year} {listing.vehicle.make} {listing.vehicle.model}</h3>
                        <p className="text-sm text-gray-600">
                          {listing.vehicle.price?.toLocaleString()} � ₽
                        </p>
                        <p className="text-xs text-gray-500">
                          {listing.vehicle.mileage?.toLocaleString()} км •
                          {listing.vehicle.fuelType} •
                          {listing.vehicle.transmission}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-shrink-0">
                        <img
                          src={listing.part.images && listing.part.images.length > 0
                            ? JSON.parse(listing.part.images)[0]
                            : "/default-part.png"}
                          alt="Part"
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h3 className="font-medium">{listing.part.name}</h3>
                        <p className="text-sm text-gray-600">
                          Для {listing.part.make} {listing.part.model}
                        </p>
                        <p className="text-xs text-gray-500">
                          {listing.part.price?.toLocaleString()} � ₽
                        </p>
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => {
                      // Handle item click - in Telegram we might open a detail view
                      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                        window.Telegram.WebApp.showPopup({
                          title: listing.vehicle ?
                            `${listing.vehicle.year} ${listing.vehicle.make} ${listing.vehicle.model}` :
                            listing.part.name,
                          message: listing.vehicle ?
                            `Цена: ${listing.vehicle.price?.toLocaleString()} � ₽\n` +
                            `Пробег: ${listing.vehicle.mileage?.toLocaleString()} км\n` +
                            `Состояние: ${listing.vehicle.condition}` :
                            `Цена: ${listing.part.price?.toLocaleString()} � ₽\n` +
                            `Совместимо с: ${listing.part.make} ${listing.part.model}\n` +
                            `Состояние: ${listing.part.condition}`,
                          buttons: [
                            { type: 'default', text: 'Закрыть' }
                          ]
                        })
                      }
                    }}
                    className="w-full flex justify-center px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    Посмотреть детали
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => {
              // Проверяем, авторизован ли пользователь
              const isAuthenticated = telegramUser || session?.user;
              if (!isAuthenticated) {
                // Показываем уведомление о необходимости войти
                if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                  window.Telegram.WebApp.showPopup({
                    title: 'Вход требуется',
                    message: 'Для создания объявления необходимо войти в систему',
                    buttons: [
                      { type: 'default', text: 'OK' }
                    ]
                  })
                }
                return;
              }

              // Показываем выбор типа объявления внутри Telegram Mini App
              // Если мы хотим упростить, можно сразу показывать форму для транспортного средства
              // Но давайте дадим выбор
              if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                window.Telegram.WebApp.showPopup({
                  title: 'Выберите тип объявления',
                  message: 'Что вы хотите разместить?',
                  buttons: [
                    { type: 'default', text: 'Транспортное средство', onClick: () => { setListingType('vehicle'); setShowCreateListingForm(true); } },
                    { type: 'default', text: 'Запчасть', onClick: () => { setListingType('part'); setShowCreateListingForm(true); } },
                    { type: 'cancel', text: 'Отмена' }
                  ]
                });
              } else {
                // Для обычного веба перенаправляем
                router.push('/listings/create')
              }
            }}
            className="w-full flex justify-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Создать объявление
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                window.Telegram.WebApp.openLink('http://localhost:3000')
              } else {
                router.push('/')
              }
            }}
            className="w-full flex justify-center px-4 py-2 bg-white border border-primary rounded-lg hover:bg-primary/50"
          >
            Открыть полную версию
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                window.Telegram.WebApp.showPopup({
                  title: 'Поделиться приложением',
                  message: 'Пригласите друзей пользоваться AutoRent Markt в Telegram',
                  buttons: [
                    { type: 'default', text: 'Поделиться',
                      onClick: () => {
                        window.Telegram.WebApp.switchInlineQuery('AutoRent Markt - лучшие объявления')
                      }
                    },
                    { type: 'cancel', text: 'Закрыть' }
                  ]
                })
              }
            }}
            className="w-full flex justify-center px-4 py-2 bg-white border border-primary rounded-lg hover:bg-primary/50"
          >
            Поделиться в Telegram
          </button>
        </div>
      </div>

      {/* Create Listing Form */}
  {showCreateListingForm && (
    <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-bold mb-4">
        {listingType === 'vehicle' ? 'Создать объявление о транспортном средстве' : 'Создать объявление о запчасти'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {listingType === 'vehicle' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                value={vehicleForm.title}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, title: e.target.value }))}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                placeholder="Введите название"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={vehicleForm.description}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, description: e.target.value }))}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                placeholder="Введите описание"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Цена</label>
                <input
                  type="number"
                  value={vehicleForm.price}
                  onChange={(e) => setVehicleForm(prev => ({ ...prev, price: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Год</label>
                <input
                  type="number"
                  value={vehicleForm.year}
                  onChange={(e) => setVehicleForm(prev => ({ ...prev, year: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="2020"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Марка</label>
                <input
                  value={vehicleForm.make}
                  onChange={(e) => setVehicleForm(prev => ({ ...prev, make: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="Toyota"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Модель</label>
                <input
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm(prev => ({ ...prev, model: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="Camry"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пробег</label>
                <input
                  type="number"
                  value={vehicleForm.mileage}
                  onChange={(e) => setVehicleForm(prev => ({ ...prev, mileage: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                <input
                  value={vehicleForm.vin}
                  onChange={(e) => setVehicleForm(prev => ({ ...prev, vin: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="Введите VIN"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                value={partForm.title}
                onChange={(e) => setPartForm(prev => ({ ...prev, title: e.target.value }))}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                placeholder="Название запчасти"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={partForm.description}
                onChange={(e) => setPartForm(prev => ({ ...prev, description: e.target.value }))}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                placeholder="Описание запчасти"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Цена</label>
                <input
                  type="number"
                  value={partForm.price}
                  onChange={(e) => setPartForm(prev => ({ ...prev, price: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Совместимая марка</label>
                <input
                  value={partForm.make}
                  onChange={(e) => setPartForm(prev => ({ ...prev, make: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="Toyota"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Совместимая модель</label>
                <input
                  value={partForm.model}
                  onChange={(e) => setPartForm(prev => ({ ...prev, model: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="Camry"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Год выпуска</label>
                <input
                  type="number"
                  value={partForm.year}
                  onChange={(e) => setPartForm(prev => ({ ...prev, year: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
                  placeholder="2020"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Состояние</label>
              <select
                value={partForm.condition}
                onChange={(e) => setPartForm(prev => ({ ...prev, condition: e.target.value }))}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight"
              >
                <option value="">Выберите состояние</option>
                <option value="new">Новое</option>
                <option value="used">Б/у</option>
                <option value="refurbished">Отремонтированное</option>
              </select>
            </div>
          </>
        )}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setShowCreateListingForm(false);
              setListingType(null);
            }}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={createListingLoading}
            className={`px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 ${createListingLoading ? 'opacity-50' : ''}`}
          >
            {createListingLoading ? 'Создание...' : 'Создать объявление'}
          </button>
        </div>
      </form>
    </div>
  )}

{/* Footer */}
      <div className="mt-auto border-t border-gray-200 py-3 text-center text-xs text-gray-500">
        AutoRent Markt © {new Date().getFullYear()}
      </div>
    </div>
  )
}