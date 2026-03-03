/**
 * RFP Routes
 */

const express = require('express');
const router = express.Router();
const rfpController = require('../controllers/rfp.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// GET all RFPs
router.get('/', rfpController.getAllRFPs);

// GET single RFP
router.get('/:id', rfpController.getRFPById);

// POST create RFP (Proposal Managers and Solution Architects)
router.post('/',
  authorize('PROPOSAL_MANAGER', 'SOLUTION_ARCHITECT'),
  rfpController.createRFP
);

// PATCH update RFP
router.patch('/:id',
  authorize('PROPOSAL_MANAGER', 'SOLUTION_ARCHITECT', 'BID_REVIEWER'),
  rfpController.updateRFP
);

// DELETE RFP (Proposal Managers only)
router.delete('/:id',
  authorize('PROPOSAL_MANAGER'),
  rfpController.deleteRFP
);

// POST recalculate risk
router.post('/:id/recalculate-risk', rfpController.recalculateRisk);

module.exports = router;
