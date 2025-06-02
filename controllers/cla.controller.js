const CLAConfig = require("../models/CLAConfig.model");
const CLAResponse = require("../models/CLAResponse.model");
const {
  uploadImageToAzureFromUrl,
} = require("../middleware/avatarToAzure.middleware");
const axios = require("axios");

//This function renders the prompt from the template defined in the config and the answers of the user
const renderPrompt = (template, data) => {
  return template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");
};

// GET /cla/config
// gets the questions, the prompt and the security code for the quiz
exports.getConfig = async (req, res) => {
  try {
    const config = await CLAConfig.findOne();
    if (!config) {
      return res.status(404).json({ error: "Config not found" });
    }
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// POST /cla/config
// updates the config for the quiz
exports.updateConfig = async (req, res) => {
  try {
    const { code, questions, promptTemplate } = req.body;
    console.log("recieved", req.body);
    //check if we send an array of 5 question
    if (!Array.isArray(questions) || questions.length !== 5) {
      return res.status(400).json({
        error: "Le questionnaire doit contenir exactement 5 questions.",
      });
    }

    //Looking for an existing config
    const existingConfig = await CLAConfig.findOne();

    if (existingConfig) {
      //Update existing config
      existingConfig.code = code;
      existingConfig.questions = questions;
      existingConfig.promptTemplate = promptTemplate;
      //saving the config

      await existingConfig.save();
      return res.json({
        message: "Config mise à jour avec succès",
        config: existingConfig,
      });
    } else {
      //Create a new config
      const newConfig = new CLAConfig({
        code,
        questions,
        promptTemplate,
      });
      //saving the config
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
// POST /cla/submit
// submits the answers to the quiz
exports.submitAnswer = async (req, res) => {
  try {
    const { name, gender, code, answers } = req.body;

    //Calling the config
    const config = await CLAConfig.findOne();
    if (!config) {
      return res.status(403).json({ message: "Pas de config disponible" });
    }

    //Checking that the code set in the config and the code sent are the same
    if (config.code !== code) {
      return res.status(403).json({ message: "Code incorrect" });
    }

    //Checking if we have the 5 answers
    if (!Array.isArray(answers) || answers.length !== 5) {
      return res.status(400).json({ message: "5 réponses sont requises" });
    }

    //Mapping of the answers
    const mappedAnswers = config.questions.map((question, i) => {
      const selectedAnswer = question.options.find(
        (option) => option.value === answers[i]
      );
      return selectedAnswer ? selectedAnswer.label : "Réponse inconnue";
    });

    //Data to inject in the prompt
    const promptVariables = {
      name,
      gender,
      answer1: mappedAnswers[0],
      answer2: mappedAnswers[1],
      answer3: mappedAnswers[2],
      answer4: mappedAnswers[3],
      answer4: mappedAnswers[4],
    };

    //Prompt generation
    const prompt = renderPrompt(config.promptTemplate, promptVariables);

    //API call to OpenAi
    const openaiRes = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "dall-e-3",
        prompt,
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

    //Getting the image as a response from openai
    const imageUrl = openaiRes.data.data[0].url;
    const storedAvatarUrl = await uploadImageToAzureFromUrl(imageUrl);

    //Sending the response to the db
    const newResponse = new CLAResponse({
      name,
      gender,
      code,
      answers,
      prompt,
      imageUrl: storedAvatarUrl,
      createdAt: new Date(),
    });

    await newResponse.save();

    res.json({ imageUrl, message: "Image générée avec succès" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /cla/results
// gets the results of the quiz for the admin
exports.getResults = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    //Finding the results
    const results = await CLAResponse.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    //Getting the number of results
    const totalResults = await CLAResponse.countDocuments();

    //Final Response
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
