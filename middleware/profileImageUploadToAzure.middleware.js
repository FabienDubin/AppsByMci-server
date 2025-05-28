const multer = require("multer");
const { BlobServiceClient } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "profiles"; // ou avatars, selon ton organisation

const blobServiceClient = BlobServiceClient.fromConnectionString(
  AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(containerName);

// Multer memory storage to process the file in RAM before upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToAzure = async (file) => {
  const extension = path.extname(file.originalname);
  const filename = `profile-${uuidv4()}${extension}`;

  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  return blockBlobClient.url;
};

module.exports = {
  upload,
  uploadToAzure,
};
