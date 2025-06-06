const { Schema, model } = require("mongoose");

const adventurerResponseSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      required: true,
      enum: ["Homme", "Femme", "Autre"],
    },
    code: {
      type: String,
      required: true,
    },
    answers: [
      {
        type: String,
        required: true,
      },
    ],
    originalImageUrl: {
      type: String,
      required: true,
    },
    generatedImageUrl: {
      type: String,
    },
    prompt: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const AdventurerResponse = model(
  "AdventurerResponse",
  adventurerResponseSchema
);

module.exports = AdventurerResponse;
