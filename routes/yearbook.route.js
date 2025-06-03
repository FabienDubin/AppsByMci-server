const express = require("express");
const router = express.Router();

//CONTROLLERS
const {
  getConfig,
  updateConfig,
  submitPhoto,
  getResults,
  uploadMiddleware,
} = require("../controllers/yearbook.controller");

// GET /yearbook/config
// gets the security code and prompt template for yearbook
router.get("/config", getConfig);

// POST /yearbook/config
// updates the config for yearbook (admin only)
router.post("/config", updateConfig);

// POST /yearbook/submit
// submits a photo for yearbook transformation
router.post("/submit", uploadMiddleware, submitPhoto);

// GET /yearbook/results
// gets all yearbook results for admin
router.get("/results", getResults);

module.exports = router;
