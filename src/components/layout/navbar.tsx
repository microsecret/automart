'use client';

import Link from 'next/link';
import { Menu, Moon, Sun, Search, UserCircle, LogIn, ShoppingCart, Plus, LogOut, MessageCircle, Heart, Bell, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession } from "next-auth/react"

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const { data: session, status } = useSession();

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Fetch unread messages count
  useEffect(() => {
    if (session) {
      const fetchUnreadCount = async () => {
        try {
          const response = await fetch("/api/messages?unreadCountOnly=true");
          if (response.ok) {
            const data = await response.json();
            setUnreadMessagesCount(data.count || 0);
          }
        } catch (err) {
          console.error("Error fetching unread messages count:", err);
        }
      }

      fetchUnreadCount();

      // Refresh every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Fetch favorites count
  useEffect(() => {
    if (session) {
      const fetchFavoritesCount = async () => {
        try {
          const response = await fetch("/api/favorites?countOnly=true");
          if (response.ok) {
            const data = await response.json();
            setFavoritesCount(data.count || 0);
          }
        } catch (err) {
          console.error("Error fetching favorites count:", err);
        }
      }

      fetchFavoritesCount();

      // Refresh every 5 minutes (less frequent than messages)
      const interval = setInterval(fetchFavoritesCount, 300000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Fetch unread notifications count
  useEffect(() => {
    if (session) {
      const fetchUnreadNotificationsCount = async () => {
        try {
          const response = await fetch("/api/notifications?unreadCountOnly=true");
          if (response.ok) {
            const data = await response.json();
            setUnreadNotificationsCount(data.count || 0);
          }
        } catch (err) {
          console.error("Error fetching unread notifications count:", err);
        }
      }

      fetchUnreadNotificationsCount();

      // Refresh every 5 minutes
      const interval = setInterval(fetchUnreadNotificationsCount, 300000);
      return () => clearInterval(interval);
    }
  }, [session]);

  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b border-border/200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center space-x-3">
              <span className="gradient-text text-2xl font-bold">
                AutoRent
              </span>
              <span className="text-primary">Markt</span>
            </Link>
          </div>

          <div className="hidden md:flex md:items-center md:space-x-6">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Главная
            </Link>
            <Link href="/listings" className="text-muted-foreground hover:text-foreground">
              Транспорт
            </Link>
            <Link href="/parts" className="text-muted-foreground hover:text-foreground">
              Запчасти
            </Link>
            <Link href="/services" className="text-muted-foreground hover:text-foreground">
              Услуги
            </Link>
            <Link href="/ai-services" className="text-muted-foreground hover:text-foreground">
              AI-Сервисы
            </Link>
            <Link href="/messages" className="text-muted-foreground hover:text-foreground relative">
              Сообщения
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                </span>
              )}
            </Link>
            <Link href="/favorites" className="text-muted-foreground hover:text-foreground relative">
              Избранное
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {favoritesCount > 99 ? "99+" : favoritesCount}
                </span>
              )}
            </Link>
            <Link href="/notifications" className="text-muted-foreground hover:text-foreground relative">
              Уведомления
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                </span>
              )}
            </Link>
            <Link href="/reviews" className="text-muted-foreground hover:text-foreground">
              Отзывы
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Поиск..."
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 bg-white/90 backdrop-blur-sm
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all
                         w-full md:w-48"
              />
            </div>

            <Link
              href="/search"
              className="ml-3 p-2 rounded-lg hover:bg-muted transition-colors text-sm font-medium"
            >
              Расширенный поиск
            </Link>

            {status === "loading" ? (
              <div className="p-2 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-gray-300 rounded animate-pulse" />
                  <div className="h-3 w-3 bg-gray-300 rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <>
                {session ? (
                  <>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <img
                        src={session.user.image || "/default-avatar.png"}
                        alt={`${session.user.name}'s avatar`}
                        className="h-8 w-8 rounded-full"
                      />
                      <div className="space-x-2">
                        <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch("/api/auth/signout", { method: "POST" });
                        window.location.href = "/"
                      }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/auth/signin" className="flex-1 px-3 py-2 rounded-lg text-center text-white bg-primary hover:bg-primary/90 transition-colors">
                      <LogIn className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </>
            )}

            <Link href="/cart" className="p-2 rounded-lg hover:bg-transition-colors relative">
              <ShoppingCart className="h-4 w-4" />
              <span className="absolute -top-2 -right-2 bg-primary text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                0
              </span>
            </Link>

            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-muted transition-colors md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            </div>
          </div>
          </div>
        </nav>
      );
}