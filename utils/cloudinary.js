import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000, // Increase timeout to 60 seconds
});

// Function to upload file to Cloudinary
export const uploadToCloudinary = async (fileUri) => {
  try {
    const response = await cloudinary.uploader.upload(fileUri);
    return response;
  } catch (error) {
    console.log(error);
    throw new Error("Failed to upload image to Cloudinary");
  }
};

// Function to delete file from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId);
};

// Export cloudinary instance (optional, if needed elsewhere)
export { cloudinary };
