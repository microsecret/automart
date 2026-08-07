import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ImageUploader({
  multiple = false,
  onUploadComplete,
  acceptedFiles = ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeMB = 10
}: {
  multiple?: boolean,
  onUploadComplete: (urls: string[]) => void,
  acceptedFiles?: string[],
  maxSizeMB?: number
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    // Validate files
    let validFiles: File[] = []
    let validationError = null

    for (const file of files) {
      // Check file type
      if (!acceptedFiles.includes(file.type)) {
        validationError = `Invalid file type: ${file.name}. Allowed types: ${acceptedFiles.join(', ')}`
        break
      }

      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        validationError = `File too large: ${file.name}. Maximum size is ${maxSizeMB}MB.`
        break
      }

      validFiles.push(file)
    }

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSelectedFiles(validFiles)

    // Create previews
    const previews = validFiles.map(file => URL.createObjectURL(file))
    setPreviews(previews)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file to upload")
      return
    }

    setUploading(true)
    setError(null)

    try {
      const urls = await Promise.all(
        selectedFiles.map(file =>
          fetch("/api/upload", {
            method: "POST",
            body: (() => {
              const formData = new FormData()
              formData.append("file", file)
              return formData
            })()
          })
            .then(res => res.json())
            .then(data => data.url)
        )
      )

      setUploading(false)
      setSelectedFiles([])
      setPreviews([])
      onUploadComplete(urls)
    } catch (err) {
      console.error("Error uploading files:", err)
      setError("Failed to upload images. Please try again.")
      setUploading(false)
    }
  }

  const removePreview = (index: number) => {
    const newPreviews = [...previews]
    const newSelectedFiles = [...selectedFiles]

    // Revoke the object URL to free memory
    URL.revokeObjectURL(newPreviews[index])

    newPreviews.splice(index, 1)
    newSelectedFiles.splice(index, 1)

    setPreviews(newPreviews)
    setSelectedFiles(newSelectedFiles)
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700 mb-2">
          {multiple ? "Выберите изображения" : "Выберите изображение"}
        </label>
        <input
          id="image-upload"
          type="file"
          multiple={multiple}
          accept={acceptedFiles.join(",")}
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0 file:text-sm file:font-semibold
            file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
        />
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {previews.length > 0 && (
        <div className="grid gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="rounded-lg w-36 h-36 object-cover"
              />
              <button
                onClick={() => removePreview(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
          {!multiple && previews.length > 1 && (
            <p className="mt-2 text-sm text-gray-500 text-center">
              Note: Only the first image will be used for single image upload
            </p>
          )}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Images"}
          </button>
        </div>
      )}
    </div>
  )
}