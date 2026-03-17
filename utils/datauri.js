import path from "path";

const getDataUri = (file) => {
  const ext = path.extname(file.originalname).slice(1); // remove the dot
  const base64 = file.buffer.toString("base64");
  return `data:image/${ext};base64,${base64}`;
};

export default getDataUri;
