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

    //Get the config
    const config = await YearbookConfig.findOne();
    if (!config) {
      return res.status(403).json({ message: "Pas de config disponible" });
    }

    //Check security code
    if (config.code !== code) {
      return res.status(403).json({ message: "Code incorrect" });
    }

    // Upload original image to Azure
    const originalImageBuffer = imageFile.buffer;
    const originalFilename = `yearbook-original-${Date.now()}.${
      imageFile.mimetype.split("/")[1]
    }`;

    // Create a blob client and upload the original image
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

    //Prepare prompt variables
    const promptVariables = {
      name,
      gender,
    };

    //Generate prompt
    const prompt = renderPrompt(config.promptTemplate, promptVariables);

    //API call to OpenAI for image generation based on prompt
    const openaiRes = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    //Get the generated image URL from OpenAI
    const generatedImageUrl = openaiRes.data.data[0].url;
    const storedGeneratedUrl = await uploadImageToAzureFromUrl(
      generatedImageUrl
    );

    //Save the response to database
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

// Export multer upload middleware
exports.uploadMiddleware = upload.single("image");
