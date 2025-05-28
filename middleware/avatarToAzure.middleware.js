const { BlobServiceClient } = require("@azure/storage-blob");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "avatars";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(containerName);

async function uploadImageToAzureFromUrl(imageUrl) {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);
  const filename = `avatar-${uuidv4()}.png`;

  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: "image/png" },
  });

  return blockBlobClient.url;
}

module.exports = { uploadImageToAzureFromUrl };
