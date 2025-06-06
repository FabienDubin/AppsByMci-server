const { Schema, model } = require("mongoose");

const adventurerConfigSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      default: "ADVENTURE2024",
    },
    questions: [
      {
        text: {
          type: String,
          required: true,
        },
        options: [
          {
            label: {
              type: String,
              required: true,
            },
            value: {
              type: String,
              required: true,
            },
          },
        ],
      },
    ],
    promptTemplate: {
      type: String,
      required: true,
      default: `Créez un avatar d'aventurier stylisé pour {{name}} ({{gender}}). 
      Basé sur leurs réponses au quiz d'aventurier: {{answers}}.
      Style: illustration numérique moderne, couleurs vives et dynamiques, 
      équipement d'aventure (sac à dos, boussole, carte), 
      environnement naturel en arrière-plan (montagnes, forêts, rivières).
      L'avatar doit refléter l'esprit d'aventure et d'exploration.
      Format portrait, haute qualité, style cartoon réaliste.`,
    },
  },
  {
    timestamps: true,
  }
);

const AdventurerConfig = model("AdventurerConfig", adventurerConfigSchema);

module.exports = AdventurerConfig;
