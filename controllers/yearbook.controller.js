const YearbookConfig = require("../models/YearbookConfig.model");
const YearbookResponse = require("../models/YearbookResponse.model");
const {
  uploadImageToAzureFromUrl,
} = require("../middleware/avatarToAzure.middleware");
const axios = require("axios");
const multer = require("multer");

// Configuration multer pour l'upload d'images
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Seuls les fichiers image sont autorisés"), false);
    }
  },
});

const OpenAI = require("openai");
const { toFile } = require("openai/uploads");
const fs = require("fs");
const path = require("path");
const os = require("os");

const client = new OpenAI();

//This function renders the prompt from the template and the user data
const renderPrompt = (template, data) => {
  return template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");
};

// GET /yearbook/config
// gets the security code and prompt template for yearbook
exports.getConfig = async (req, res) => {
  try {
    const config = await YearbookConfig.findOne();
    if (!config) {
      return res.status(404).json({ error: "Config not found" });
    }
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// POST /yearbook/config
// updates the config for yearbook (admin only)
exports.updateConfig = async (req, res) => {
  try {
    const { code, promptTemplate } = req.body;

    if (!code || !promptTemplate) {
      return res.status(400).json({
        error: "Le code et le template de prompt sont requis.",
      });
    }

    //Looking for an existing config
    const existingConfig = await YearbookConfig.findOne();

    if (existingConfig) {
      //Update existing config
      existingConfig.code = code;
      existingConfig.promptTemplate = promptTemplate;

      await existingConfig.save();
      return res.json({
        message: "Config mise à jour avec succès",
        config: existingConfig,
      });
    } else {
      //Create a new config
      const newConfig = new YearbookConfig({
        code,
        promptTemplate,
      });

      await newConfig.save();
      return res.json({
        message: "Nouvelle config créée avec succès",
        config: newConfig,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// POST /yearbook/submit
// submits a photo for yearbook transformation
exports.submitPhoto = async (req, res) => {
  try {
    const { name, gender, code } = req.body;
    const imageFile = req.file;

    if (!name || !gender || !code || !imageFile) {
      return res.status(400).json({
        message: "Nom, genre, code et image sont requis",
      });
    }

    const config = await YearbookConfig.findOne();
    if (!config) {
      return res.status(403).json({ message: "Pas de config disponible" });
    }

    if (config.code !== code) {
      return res.status(403).json({ message: "Code incorrect" });
    }

    // Upload original image to Azure
    const originalImageBuffer = imageFile.buffer;
    const originalFilename = `yearbook-original-${Date.now()}.${
      imageFile.mimetype.split("/")[1]
    }`;

    const { BlobServiceClient } = require("@azure/storage-blob");
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient("avatars");
    const originalBlobClient =
      containerClient.getBlockBlobClient(originalFilename);

    await originalBlobClient.uploadData(originalImageBuffer, {
      blobHTTPHeaders: { blobContentType: imageFile.mimetype },
    });

    const originalImageUrl = originalBlobClient.url;

    // Generate prompt
    const promptVariables = { name, gender };
    const prompt = renderPrompt(config.promptTemplate, promptVariables);

    // Write image to a temporary file
    const tempFilePath = path.join(os.tmpdir(), originalFilename);
    fs.writeFileSync(tempFilePath, originalImageBuffer);

    // Convert image to OpenAI-compatible file
    const openAiImageFile = await toFile(
      fs.createReadStream(tempFilePath),
      originalFilename,
      { type: imageFile.mimetype }
    );

    // Call OpenAI image edit endpoint
    const response = await client.images.edit({
      model: "gpt-image-1",
      image: openAiImageFile,
      prompt,
    });

    // Get base64 image and convert to buffer
    const image_base64 = response.data[0].b64_json;
    const imageBuffer = Buffer.from(image_base64, "base64");

    // Upload generated image to Azure
    const generatedFilename = `yearbook-generated-${Date.now()}.png`;
    const generatedBlobClient =
      containerClient.getBlockBlobClient(generatedFilename);

    await generatedBlobClient.uploadData(imageBuffer, {
      blobHTTPHeaders: { blobContentType: "image/png" },
    });

    const storedGeneratedUrl = generatedBlobClient.url;

    // Save response in DB
    const newResponse = new YearbookResponse({
      name,
      gender,
      code,
      originalImageUrl,
      generatedImageUrl: storedGeneratedUrl,
      prompt,
    });

    await newResponse.save();

    res.json({
      originalImageUrl,
      generatedImageUrl: storedGeneratedUrl,
      message: "Image yearbook générée avec succès",
    });

    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
  } catch (error) {
    console.error("Error in submitPhoto:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /yearbook/results
// gets all yearbook results for admin
exports.getResults = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    //Find all results
    const results = await YearbookResponse.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    //Get total count
    const totalResults = await YearbookResponse.countDocuments();

    //Response
    res.status(200).json({
      results,
      currentPage: Number(page),
      totalPages: Math.ceil(totalResults / limit),
      totalResults,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /yearbook/delete/:id
// deletes a yearbook result by id (admin only)
exports.deleteResult = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await YearbookResponse.findById(id);
    res.status(200).json({ result, message: "Réponse supprimée avec succès" });
    await result.deleteOne();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Export multer upload middleware
exports.uploadMiddleware = upload.single("image");
