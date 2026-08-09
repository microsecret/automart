import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload an image to Cloudinary
 * @param file - File object or base64 string
 * @param folder - Optional folder to store the image in
 * @returns Promise with the secure URL of the uploaded image
 */
export async function uploadImage(file: File | string, folder = "autorent-markt"): Promise<string> {
  try {
    let uploadResult;

    if (typeof file === 'string') {
      // Base64 string
      uploadResult = await cloudinary.uploader.upload(file, {
        folder,
        resource_type: "auto"
      });
    } else if (file instanceof File) {
      // File object
      const buffer = Buffer.from(await file.arrayBuffer());
      uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "auto" },
          (error, result) => error || !result ? reject(error || new Error("Cloudinary upload failed")) : resolve(result)
        )
        stream.end(buffer)
      });
    } else {
      throw new Error("Invalid file type");
    }

    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error);
    throw error;
  }
}

/**
 * Delete an image from Cloudinary
 * @param publicId - Public ID of the image to delete
 * @returns Promise with the result of the deletion
 */
export async function deleteImage(publicId: string): Promise<any> {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    throw error;
  }
}

/**
 * Upload multiple images to Cloudinary
 * @param files - Array of File objects or base64 strings
 * @param folder - Optional folder to store the images in
 * @returns Promise with array of secure URLs of the uploaded images
 */
export async function uploadImages(files: (File | string)[], folder = "autorent-markt"): Promise<string[]> {
  const uploadPromises = files.map(file => uploadImage(file, folder));
  return Promise.all(uploadPromises);
}

export default {
  uploadImage,
  deleteImage,
  uploadImages
};
