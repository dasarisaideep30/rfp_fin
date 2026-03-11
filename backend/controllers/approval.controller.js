/**
 * Approval Controller
 * Manages approval workflows and Go/No-Go decisions
 */

const prisma = require('../prismaClient');

/**
 * Create approval request
 * POST /api/approvals
 */
const createApproval = async (req, res) => {
  try {
    const { type, rfpId, reviewerId } = req.body;

    if (!type || !rfpId || !reviewerId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Required fields: type, rfpId, reviewerId'
      });
    }

    const approval = await prisma.approval.create({
      data: {
        type,
        rfpId,
        reviewerId
      },
      include: {
        reviewer: {
          select: { firstName: true, lastName: true, email: true }
        },
        rfp: {
          select: { rfpNumber: true, clientName: true }
        }
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'APPROVAL_REQUESTED',
        title: 'Approval Request',
        message: `Approval requested for RFP ${approval.rfp.rfpNumber}`,
        userId: reviewerId,
        rfpId
      }
    });

    res.status(201).json({
      message: 'Approval request created',
      approval
    });

  } catch (error) {
    console.error('Create approval error:', error);
    res.status(500).json({ error: 'Failed to create approval request' });
  }
};

/**
 * Decide on approval
 * PATCH /api/approvals/:id
 */
const decideApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Status must be APPROVED or REJECTED'
      });
    }

    const approval = await prisma.approval.update({
      where: { id },
      data: {
        status,
        comments,
        decidedAt: new Date()
      },
      include: {
        rfp: true,
        reviewer: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'APPROVAL_DECIDED',
        description: `${approval.type} ${status.toLowerCase()} by ${approval.reviewer.firstName} ${approval.reviewer.lastName}`,
        entityType: 'Approval',
        entityId: approval.id,
        userId: req.user.id,
        rfpId: approval.rfpId
      }
    });

    res.status(200).json({
      message: 'Approval decision recorded',
      approval
    });

  } catch (error) {
    console.error('Decide approval error:', error);
    res.status(500).json({ error: 'Failed to update approval' });
  }
};

module.exports = {
  createApproval,
  decideApproval
};
