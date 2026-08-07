import SignUpForm from "@/components/auth/SignUpForm"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-center h1 font-bold text-gray-900">
            Регистрация в AutoRent Markt
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Создайте новый аккаунт чтобы начать покупать и продавать
          </p>
        </div>
        <div className="space-y-6">
          <SignUpForm />
        </div>
      </div>
    </div>
  )
}