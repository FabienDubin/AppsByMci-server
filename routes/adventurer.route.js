const express = require("express");
const router = express.Router();
const adventurerController = require("../controllers/adventurer.controller");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { isAdmin } = require("../middleware/role.middleware");

// GET /adventurer/config - Get adventurer configuration
router.get("/config", adventurerController.getConfig);

// POST /adventurer/config - Update adventurer configuration (admin only)
router.post(
  "/config",

  adventurerController.updateConfig
);

// POST /adventurer/submit - Submit photo and quiz answers for avatar generation
router.post(
  "/submit",
  adventurerController.uploadMiddleware,
  adventurerController.submitResponse
);

// GET /adventurer/results - Get all adventurer results (admin only)
router.get(
  "/results",

  adventurerController.getResults
);

// DELETE /adventurer/results/:id - Delete an adventurer result (admin only)
router.delete(
  "/results/:id",

  adventurerController.deleteResult
);

module.exports = router;
