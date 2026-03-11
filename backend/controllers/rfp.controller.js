/**
 * RFP Controller
 * Manages RFP lifecycle, risk calculation, and governance
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateRiskLevel, calculateCompletionPercentage, generateMilestones } = require('../utils/riskEngine');

/**
 * Get all RFPs with filtering and search
 * GET /api/rfps
 */
const getAllRFPs = async (req, res) => {
  try {
    const { status, riskLevel, search } = req.query;
    const userId = req.user.id;
    let where = {};
    
    // Only the master admin sees all RFPs
    if (req.user.email !== 'sarah.johnson@gmail.com') {
      // Everyone else only sees what they are assigned to or manage
      where.OR = [
        { proposalManagerId: userId },
        { solutionArchitectId: userId }
      ];
    }

    // Apply filters
    if (status) {
      where.status = status;
    }
    if (riskLevel) {
      where.riskLevel = riskLevel;
    }
    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: 'insensitive' } },
        { rfpNumber: { contains: search, mode: 'insensitive' } },
        { projectTitle: { contains: search, mode: 'insensitive' } }
      ];
    }

    const rfps = await prisma.rFP.findMany({
      where,
      include: {
        proposalManager: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        solutionArchitect: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        tasks: {
          select: { id: true, status: true }
        },
        milestones: {
          select: { id: true, isCompleted: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ rfps });

  } catch (error) {
    console.error('Get RFPs error:', error);
    res.status(500).json({ error: 'Failed to fetch RFPs' });
  }
};

/**
 * Get single RFP with full details
 * GET /api/rfps/:id
 */
const getRFPById = async (req, res) => {
  try {
    const { id } = req.params;

    const rfp = await prisma.rFP.findUnique({
      where: { id },
      include: {
        proposalManager: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true }
        },
        solutionArchitect: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true }
        },
        tasks: {
          include: {
            owner: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          },
          orderBy: { dueDate: 'asc' }
        },
        milestones: {
          orderBy: { targetDate: 'asc' }
        },
        approvals: {
          include: {
            reviewer: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        activityLogs: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!rfp) {
      return res.status(404).json({
        error: 'Not found',
        message: 'RFP not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'SOLUTION_ARCHITECT' && rfp.solutionArchitectId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this RFP'
      });
    }

    res.status(200).json({ rfp });

  } catch (error) {
    console.error('Get RFP error:', error);
    res.status(500).json({ error: 'Failed to fetch RFP' });
  }
};

/**
 * Create new RFP
 * POST /api/rfps
 */
const createRFP = async (req, res) => {
  try {
    const {
      clientName,
      industry,
      projectTitle,
      executiveSummary,
      submissionDeadline,
      estimatedDealValue,
      solutionArchitectId
    } = req.body;

    // Validate required fields
    if (!clientName || !industry || !projectTitle || !submissionDeadline || !estimatedDealValue) {
      const missingFields = [];
      if (!clientName) missingFields.push('clientName');
      if (!industry) missingFields.push('industry');
      if (!projectTitle) missingFields.push('projectTitle');
      if (!submissionDeadline) missingFields.push('submissionDeadline');
      if (!estimatedDealValue) missingFields.push('estimatedDealValue');

      return res.status(400).json({
        error: 'Validation error',
        message: `The following fields are required: ${missingFields.join(', ')}`
      });
    }

    // Generate RFP number
    const count = await prisma.rFP.count();
    const rfpNumber = `RFP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Auto-generate milestones
    const milestoneData = generateMilestones(submissionDeadline);

    // Create RFP with milestones
    const rfp = await prisma.rFP.create({
      data: {
        rfpNumber,
        clientName,
        industry,
        projectTitle,
        executiveSummary,
        submissionDeadline: new Date(submissionDeadline),
        estimatedDealValue,
        proposalManagerId: req.user.id,
        solutionArchitectId,
        milestones: {
          create: milestoneData
        },
        tasks: {
          create: [
            {
              title: 'Review Initial Requirements',
              description: `Review the initial requirements and RFP details for ${clientName}`,
              status: 'NOT_STARTED',
              dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
              ownerId: req.user.id
            },
            {
              title: 'Draft Technical Architecture',
              description: `Prepare the technical solution outline for the proposal`,
              status: 'NOT_STARTED',
              dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
              ownerId: solutionArchitectId || req.user.id
            }
          ]
        }
      },
      include: {
        proposalManager: {
          select: { firstName: true, lastName: true, email: true }
        },
        solutionArchitect: {
          select: { firstName: true, lastName: true, email: true }
        },
        milestones: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'RFP_CREATED',
        description: `RFP ${rfpNumber} created for ${clientName}`,
        entityType: 'RFP',
        entityId: rfp.id,
        userId: req.user.id,
        rfpId: rfp.id
      }
    });

    // Create notification for assigned architect
    if (solutionArchitectId) {
      await prisma.notification.create({
        data: {
          type: 'TASK_ASSIGNED',
          title: 'New RFP Assigned',
          message: `You have been assigned as Solution Architect for ${clientName} - ${projectTitle}`,
          userId: solutionArchitectId,
          rfpId: rfp.id
        }
      });
    }

    res.status(201).json({
      message: 'RFP created successfully',
      rfp
    });

  } catch (error) {
    console.error('Create RFP error:', error);
    res.status(500).json({ error: 'Failed to create RFP' });
  }
};

/**
 * Update RFP
 * PATCH /api/rfps/:id
 */
const updateRFP = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Get current RFP to check permissions
    const currentRFP = await prisma.rFP.findUnique({
      where: { id },
      include: { tasks: true, milestones: true }
    });

    if (!currentRFP) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    // Check permissions
    if (req.user.role === 'LEADERSHIP') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Leadership role has read-only access'
      });
    }

    // Recalculate risk if necessary fields updated
    if (updateData.status || updateData.solutionArchitectId !== undefined) {
      const tasks = await prisma.task.findMany({ where: { rfpId: id } });
      const milestones = await prisma.milestone.findMany({ where: { rfpId: id } });
      updateData.riskLevel = calculateRiskLevel(currentRFP, tasks, milestones);
      updateData.completionPercentage = calculateCompletionPercentage(tasks, milestones);
    }

    // Update RFP
    const rfp = await prisma.rFP.update({
      where: { id },
      data: updateData,
      include: {
        proposalManager: { select: { firstName: true, lastName: true, email: true } },
        solutionArchitect: { select: { firstName: true, lastName: true, email: true } },
        tasks: true,
        milestones: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'RFP_UPDATED',
        description: `RFP ${rfp.rfpNumber} updated`,
        entityType: 'RFP',
        entityId: rfp.id,
        userId: req.user.id,
        rfpId: rfp.id
      }
    });

    res.status(200).json({
      message: 'RFP updated successfully',
      rfp
    });

  } catch (error) {
    console.error('Update RFP error:', error);
    res.status(500).json({ error: 'Failed to update RFP' });
  }
};

/**
 * Delete RFP
 * DELETE /api/rfps/:id
 */
const deleteRFP = async (req, res) => {
  try {
    const { id } = req.params;

    // Only Proposal Managers can delete
    const rfp = await prisma.rFP.findUnique({
      where: { id },
      select: { proposalManagerId: true, rfpNumber: true }
    });

    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    if (rfp.proposalManagerId !== req.user.id && req.user.role !== 'PROPOSAL_MANAGER') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only the assigned Proposal Manager can delete this RFP'
      });
    }

    await prisma.rFP.delete({ where: { id } });

    res.status(200).json({
      message: 'RFP deleted successfully'
    });

  } catch (error) {
    console.error('Delete RFP error:', error);
    res.status(500).json({ error: 'Failed to delete RFP' });
  }
};

/**
 * Recalculate risk for an RFP
 * POST /api/rfps/:id/recalculate-risk
 */
const recalculateRisk = async (req, res) => {
  try {
    const { id } = req.params;

    const rfp = await prisma.rFP.findUnique({
      where: { id },
      include: {
        tasks: true,
        milestones: true
      }
    });

    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    const newRiskLevel = calculateRiskLevel(rfp, rfp.tasks, rfp.milestones);
    const completionPct = calculateCompletionPercentage(rfp.tasks, rfp.milestones);

    const updatedRFP = await prisma.rFP.update({
      where: { id },
      data: {
        riskLevel: newRiskLevel,
        completionPercentage: completionPct
      }
    });

    res.status(200).json({
      message: 'Risk recalculated',
      riskLevel: newRiskLevel,
      completionPercentage: completionPct
    });

  } catch (error) {
    console.error('Recalculate risk error:', error);
    res.status(500).json({ error: 'Failed to recalculate risk' });
  }
};

module.exports = {
  getAllRFPs,
  getRFPById,
  createRFP,
  updateRFP,
  deleteRFP,
  recalculateRisk
};
