/**
 * Task Controller
 * Manages tasks with ownership governance and SLA tracking
 */

const prisma = require('../prismaClient');
const { checkTaskOverdue, calculateRiskLevel, calculateCompletionPercentage } = require('../utils/riskEngine');

/**
 * Get all tasks (filtered by user role)
 * GET /api/tasks
 */
const getAllTasks = async (req, res) => {
  try {
    const { rfpId, status, ownerId } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let where = {};

    // Solution Architects only see their own tasks
    if (userRole === 'SOLUTION_ARCHITECT') {
      where.ownerId = userId;
    }

    if (rfpId) {
      where.rfpId = rfpId;
    }
    if (status) {
      where.status = status;
    }
    if (ownerId && userRole !== 'SOLUTION_ARCHITECT') {
      where.ownerId = ownerId;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        rfp: {
          select: { id: true, rfpNumber: true, clientName: true, projectTitle: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    res.status(200).json({ tasks });

  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

/**
 * Create new task
 * POST /api/tasks
 */
const createTask = async (req, res) => {
  try {
    const { title, description, dueDate, ownerId, rfpId } = req.body;

    // Validate required fields
    if (!title || !dueDate || !ownerId || !rfpId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Required fields: title, dueDate, ownerId, rfpId'
      });
    }

    // Check if RFP exists
    const rfp = await prisma.rFP.findUnique({
      where: { id: rfpId },
      select: { id: true, rfpNumber: true, proposalManagerId: true }
    });

    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    // Only Proposal Managers can create tasks
    if (req.user.role !== 'PROPOSAL_MANAGER' && rfp.proposalManagerId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only Proposal Managers can create tasks'
      });
    }

    // Check overdue status
    const overdueCheck = checkTaskOverdue({ dueDate, status: 'NOT_STARTED' });

    // Create task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        ownerId,
        rfpId,
        isOverdue: overdueCheck.isOverdue,
        isEscalated: overdueCheck.isEscalated
      },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        rfp: {
          select: { rfpNumber: true, clientName: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'TASK_CREATED',
        description: `Task "${title}" created and assigned to ${task.owner.firstName} ${task.owner.lastName}`,
        entityType: 'Task',
        entityId: task.id,
        userId: req.user.id,
        rfpId
      }
    });

    // Create notification for task owner
    await prisma.notification.create({
      data: {
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        message: `You have been assigned: ${title}`,
        userId: ownerId,
        rfpId
      }
    });

    // Recalculate RFP risk
    await recalculateRFPMetrics(rfpId);

    res.status(201).json({
      message: 'Task created successfully',
      task
    });

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

/**
 * Update task
 * PATCH /api/tasks/:id
 */
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Get current task
    const currentTask = await prisma.task.findUnique({
      where: { id },
      include: { rfp: true }
    });

    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permissions - owner can update, managers can update all
    if (req.user.role === 'SOLUTION_ARCHITECT' && currentTask.ownerId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own tasks'
      });
    }

    // Check overdue status if dueDate or status changed
    if (updateData.dueDate || updateData.status) {
      const overdueCheck = checkTaskOverdue({
        dueDate: updateData.dueDate || currentTask.dueDate,
        status: updateData.status || currentTask.status
      });
      updateData.isOverdue = overdueCheck.isOverdue;
      updateData.isEscalated = overdueCheck.isEscalated;
    }

    // Set completedAt if status changed to COMPLETED
    if (updateData.status === 'COMPLETED' && currentTask.status !== 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    // Update task
    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        rfp: {
          select: { rfpNumber: true, clientName: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'TASK_UPDATED',
        description: `Task "${task.title}" updated`,
        entityType: 'Task',
        entityId: task.id,
        userId: req.user.id,
        rfpId: task.rfpId
      }
    });

    // Recalculate RFP risk
    await recalculateRFPMetrics(task.rfpId);

    res.status(200).json({
      message: 'Task updated successfully',
      task
    });

  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

/**
 * Delete task
 * DELETE /api/tasks/:id
 */
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { rfp: { select: { proposalManagerId: true } } }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only Proposal Managers can delete tasks
    if (req.user.role !== 'PROPOSAL_MANAGER' && task.rfp.proposalManagerId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only Proposal Managers can delete tasks'
      });
    }

    const rfpId = task.rfpId;
    await prisma.task.delete({ where: { id } });

    // Recalculate RFP risk
    await recalculateRFPMetrics(rfpId);

    res.status(200).json({
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

/**
 * Helper: Recalculate RFP metrics after task changes
 */
async function recalculateRFPMetrics(rfpId) {
  const rfp = await prisma.rFP.findUnique({
    where: { id: rfpId },
    include: { tasks: true, milestones: true }
  });

  if (rfp) {
    const riskLevel = calculateRiskLevel(rfp, rfp.tasks, rfp.milestones);
    const completionPct = calculateCompletionPercentage(rfp.tasks, rfp.milestones);

    await prisma.rFP.update({
      where: { id: rfpId },
      data: {
        riskLevel,
        completionPercentage: completionPct
      }
    });

    // Create risk escalation notification if needed
    if (riskLevel === 'RED' && rfp.riskLevel !== 'RED') {
      await prisma.notification.create({
        data: {
          type: 'RISK_ESCALATED',
          title: 'RFP Risk Escalated',
          message: `RFP ${rfp.rfpNumber} risk level escalated to RED`,
          userId: rfp.proposalManagerId,
          rfpId
        }
      });
    }
  }
}

module.exports = {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask
};
