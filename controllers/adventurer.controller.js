const AdventurerConfig = require("../models/AdventurerConfig.model");
const AdventurerResponse = require("../models/AdventurerResponse.model");
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

// GET /adventurer/config
// gets the security code, questions and prompt template for adventurer
exports.getConfig = async (req, res) => {
  try {
    const config = await AdventurerConfig.findOne();
    if (!config) {
      // Create default config if none exists
      const defaultConfig = new AdventurerConfig({
        code: "Mci",
        promptTemplate: `Create a premium-quality profile image of an adventurer named {{name}}, of gender {{gender}}, based on the provided reference image for facial resemblance. 

Their style and context should be inspired by the following answers:
- Type of adventurer: {{answer1}}
- Companion: {{answer2}}
- Signature item: {{answer3}}
- Setting: {{answer4}}
- Clothing style: {{answer5}}

Use the reference image to ensure that the face, gender, and key physical features of the user are accurately represented. Do not significantly alter the person's apparent age or identity. The rest of the body, outfit, and background can be generated according to the answers to reflect an adventurous, colorful, and cinematic style.

The final image should evoke the spirit of adventure and discovery. Do not include any text in the image.`,
        questions: [
          {
            text: "Si tu étais un type d’aventurier, tu serais…",
            options: [
              {
                label: "Un explorateur polaire en quête de terres inconnues",
                value: "A",
              },
              {
                label: "Un archéologue intrépide à la Indiana Jones",
                value: "B",
              },
              {
                label: "Un navigateur des mers à la recherche de trésors",
                value: "C",
              },
              {
                label: "Un astronaute en mission vers une planète lointaine",
                value: "D",
              },
            ],
          },
          {
            text: "Ton compagnon de route idéal serait…",
            options: [
              { label: "Un loup fidèle et protecteur", value: "A" },
              { label: "Un perroquet bavard et malin", value: "B" },
              { label: "Un singe agile et farceur", value: "C" },
              { label: "Un robot multifonction ultra-connecté", value: "D" },
            ],
          },
          {
            text: "Ton objet fétiche pour partir à l’aventure ?",
            options: [
              {
                label:
                  "Une boussole ancienne transmise de génération en génération",
                value: "A",
              },
              {
                label: "Un carnet de croquis rempli de cartes et de notes",
                value: "B",
              },
              {
                label: "Un sabre ou une machette pour ouvrir la voie",
                value: "C",
              },
              {
                label: "Un drone high-tech pour explorer à distance",
                value: "D",
              },
            ],
          },
          {
            text: "Ton terrain de jeu favori ?",
            options: [
              { label: "Une jungle luxuriante pleine de mystères", value: "A" },
              { label: "Un désert brûlant et infini", value: "B" },
              { label: "Une cité perdue enfouie sous la glace", value: "C" },
              {
                label: "Une station spatiale abandonnée en orbite",
                value: "D",
              },
            ],
          },
          {
            text: "Ton style vestimentaire d’aventurier ?",
            options: [
              {
                label: "Manteau en cuir usé et chapeau à large bord",
                value: "A",
              },
              {
                label: "Tenue camouflage avec sac à dos militaire",
                value: "B",
              },
              { label: "Combinaison spatiale futuriste", value: "C" },
              {
                label: "Vêtements légers et foulard coloré façon globe-trotter",
                value: "D",
              },
            ],
          },
        ],
      });
      await defaultConfig.save();
      return res.json(defaultConfig);
    }
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// POST /adventurer/config
// updates the config for adventurer (admin only)
exports.updateConfig = async (req, res) => {
  try {
    const { code, promptTemplate, questions } = req.body;

    if (!code || !promptTemplate || !questions || questions.length !== 5) {
      return res.status(400).json({
        error: "Le code, le template de prompt et 5 questions sont requis.",
      });
    }

    //Looking for an existing config
    const existingConfig = await AdventurerConfig.findOne();

    if (existingConfig) {
      //Update existing config
      existingConfig.code = code;
      existingConfig.promptTemplate = promptTemplate;
      existingConfig.questions = questions;

      await existingConfig.save();
      return res.json({
        message: "Config mise à jour avec succès",
        config: existingConfig,
      });
    } else {
      //Create a new config
      const newConfig = new AdventurerConfig({
        code,
        promptTemplate,
        questions,
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

// POST /adventurer/submit
// submits a photo and quiz answers for adventurer avatar generation
exports.submitResponse = async (req, res) => {
  try {
    const { name, gender, code, answers } = req.body;
    const imageFile = req.file;

    if (!name || !gender || !code || !imageFile || !answers) {
      return res.status(400).json({
        message: "Nom, genre, code, réponses et image sont requis",
      });
    }

    // Parse answers if it's a string
    let parsedAnswers;
    try {
      parsedAnswers =
        typeof answers === "string" ? JSON.parse(answers) : answers;
    } catch (error) {
      return res.status(400).json({
        message: "Format des réponses invalide",
      });
    }

    if (!Array.isArray(parsedAnswers) || parsedAnswers.length !== 5) {
      return res.status(400).json({
        message: "5 réponses sont requises",
      });
    }

    const config = await AdventurerConfig.findOne();
    if (!config) {
      return res.status(403).json({ message: "Pas de config disponible" });
    }

    if (config.code !== code) {
      return res.status(403).json({ message: "Code incorrect" });
    }

    // Upload original image to Azure
    const originalImageBuffer = imageFile.buffer;
    const originalFilename = `adventurer-original-${Date.now()}.${
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

    //Mapping of the answers
    const mappedAnswers = config.questions.map((question, i) => {
      const selectedAnswer = question.options.find(
        (option) => option.value === answers[i]
      );
      return selectedAnswer ? selectedAnswer.label : "Réponse inconnue";
    });

    // Generate prompt
    const promptVariables = {
      name,
      gender,
      answer1: mappedAnswers[0],
      answer2: mappedAnswers[1],
      answer3: mappedAnswers[2],
      answer4: mappedAnswers[3],
      answer4: mappedAnswers[4],
    };
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
    const generatedFilename = `adventurer-generated-${Date.now()}.png`;
    const generatedBlobClient =
      containerClient.getBlockBlobClient(generatedFilename);

    await generatedBlobClient.uploadData(imageBuffer, {
      blobHTTPHeaders: { blobContentType: "image/png" },
    });

    const storedGeneratedUrl = generatedBlobClient.url;

    // Save response in DB
    const newResponse = new AdventurerResponse({
      name,
      gender,
      code,
      answers: parsedAnswers,
      originalImageUrl,
      generatedImageUrl: storedGeneratedUrl,
      prompt,
    });

    await newResponse.save();

    res.json({
      originalImageUrl,
      generatedImageUrl: storedGeneratedUrl,
      message: "Avatar d'aventurier généré avec succès",
    });

    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
  } catch (error) {
    console.error("Error in submitResponse:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /adventurer/results
// gets all adventurer results for admin
exports.getResults = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    //Find all results
    const results = await AdventurerResponse.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    //Get total count
    const totalResults = await AdventurerResponse.countDocuments();

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

// DELETE /adventurer/results/:id
// deletes an adventurer result by id (admin only)
exports.deleteResult = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await AdventurerResponse.findById(id);
    res.status(200).json({ result, message: "Réponse supprimée avec succès" });
    await result.deleteOne();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Export multer upload middleware
exports.uploadMiddleware = upload.single("image");
