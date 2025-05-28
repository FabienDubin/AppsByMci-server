const { Schema, model } = require("mongoose");

const CLAResponseSchema = new Schema(
  {
    name: String,
    gender: String,
    code: String,
    answers: [String],
    prompt: String,
    imageUrl: String,
  },
  {
    timestamps: true,
  }
);

const CLAResponse = model("CLAResponse", CLAResponseSchema);

module.exports = CLAResponse;
