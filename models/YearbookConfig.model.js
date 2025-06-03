const { Schema, model } = require("mongoose");

const YearbookConfigSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
    },
    promptTemplate: {
      type: String,
      required: true,
      default:
        "Transform this portrait photo of {{name}} ({{gender}}) into a classic American high school yearbook style photo from the 1980s-1990s. Create a nostalgic prom night yearbook aesthetic with soft lighting, formal pose, clean background, and that timeless yearbook look. Maintain {{name}}'s facial features while giving them a youthful, student-like appearance suitable for a prom night yearbook page.",
    },
  },
  {
    timestamps: true,
  }
);

const YearbookConfig = model("YearbookConfig", YearbookConfigSchema);

module.exports = YearbookConfig;
