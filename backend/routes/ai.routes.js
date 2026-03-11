const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { protect } = require('../middleware/auth.middleware');

// POST analyze RFP Document
// Protected to ensure only authenticated users can run expensive AI models
router.post('/analyze-rfp', protect(['SOLUTION_ARCHITECT', 'PROPOSAL_MANAGER']), aiController.analyzeRFP);

module.exports = router;
