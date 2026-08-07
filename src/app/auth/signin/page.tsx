import SignInForm from "@/components/auth/SignInForm"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-center h1 font-bold text-gray-900">
            Вход в AutoRent Markt
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Войдите в свой аккаунт или создайте новый
          </p>
        </div>
        <div className="space-y-6">
          <SignInForm />
        </div>
      </div>
    </div>
  )
}