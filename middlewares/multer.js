import multer from "multer";

// Multer configuration for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

export default upload;
