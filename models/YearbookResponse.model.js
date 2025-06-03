const { Schema, model } = require("mongoose");

const YearbookResponseSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    originalImageUrl: {
      type: String,
      required: true,
    },
    generatedImageUrl: {
      type: String,
      required: true,
    },
    prompt: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const YearbookResponse = model("YearbookResponse", YearbookResponseSchema);

module.exports = YearbookResponse;
