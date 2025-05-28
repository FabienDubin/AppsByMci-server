const express = require("express");
const router = express.Router();

//CONTROLLERS
const {
  getConfig,
  updateConfig,
  submitAnswer,
  getResults,
} = require("../controllers/cla.controller");

// GET /cla/config
// gets the questions, the prompt and the security code for the quiz
router.get("/config", getConfig);

// POST /cla/config
// updates the config for the quiz
router.post("/config", updateConfig);

// POST /cla/submit
// submits the answers to the quiz
router.post("/submit", submitAnswer);

// GET /cla/results
// gets the results of the quiz for the admin
router.get("/results", getResults);

module.exports = router;
