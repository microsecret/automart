export default function LoadingSpinner() {
  return (
    <div className="flex items-center space-x-2">
      <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-600">Загрузка...</span>
    </div>
  )
}