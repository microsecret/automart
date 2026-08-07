import { useState } from "react"
import { useRouter } from "next/navigation"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

export default function SignUpForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!name || !email || !password) {
      setError("Пожалуйста, заполните все поля")
      setLoading(false)
      return
    }

    try {
      // Проверяем, существует ли уже пользователь с таким email
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        setError("Пользователь с таким email уже существует")
        setLoading(false)
        return
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(password, 10)

      // Создаем пользователя
      await prisma.user.create({
        data: {
          name,
          email,
          hashedPassword,
        }
      })

      // Перенаправляем на страницу входа
      router.push("/auth/signin")
    } catch (err) {
      console.error("Ошибка регистрации:", err)
      setError("Ошибка регистрации. Пожалуйста, попробуйте снова.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Имя
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      </div>

      <div className="text-sm">
        <a
          href="/auth/signin"
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          Уже есть аккаунт? Войти
        </a>
      </div>
    </form>
  )
}