/**
 * Dashboard Controller
 * Executive KPIs and analytics
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get executive dashboard metrics
 * GET /api/dashboard/executive
 */
const getExecutiveDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.email === 'sarah.johnson@gmail.com';

    // Base filter for privacy (Strictly RFPs created by me unless Admin)
    const privacyFilter = isAdmin ? {} : { proposalManagerId: userId };

    // Total Active RFPs (all statuses except WON/LOST)
    const activeRFPs = await prisma.rFP.count({
      where: {
        ...privacyFilter,
        status: {
          notIn: ['WON', 'LOST', 'SUBMITTED']
        }
      }
    });

    // RFPs at Risk (AMBER or RED)
    const rfpsAtRisk = await prisma.rFP.count({
      where: {
        ...privacyFilter,
        riskLevel: {
          in: ['AMBER', 'RED']
        },
        status: {
          notIn: ['WON', 'LOST', 'SUBMITTED']
        }
      }
    });

    // Total Pipeline Value
    const pipelineValue = await prisma.rFP.aggregate({
      where: {
        ...privacyFilter,
        status: {
          notIn: ['WON', 'LOST']
        }
      },
      _sum: {
        estimatedDealValue: true
      }
    });

    // Average Proposal Turnaround Time (in days)
    const submittedRFPs = await prisma.rFP.findMany({
      where: {
        status: {
          in: ['SUBMITTED', 'WON', 'LOST']
        },
        submittedAt: {
          not: null
        }
      },
      select: {
        createdAt: true,
        submittedAt: true
      }
    });

    let avgTurnaround = 0;
    if (submittedRFPs.length > 0) {
      const totalDays = submittedRFPs.reduce((sum, rfp) => {
        const days = Math.floor(
          (new Date(rfp.submittedAt) - new Date(rfp.createdAt)) / (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }, 0);
      avgTurnaround = Math.round(totalDays / submittedRFPs.length);
    }

    // Win Rate (%)
    const totalDecided = await prisma.rFP.count({
      where: {
        status: {
          in: ['WON', 'LOST']
        }
      }
    });

    const totalWon = await prisma.rFP.count({
      where: {
        status: 'WON'
      }
    });

    const winRate = totalDecided > 0 ? Math.round((totalWon / totalDecided) * 100) : 0;

    // SLA Compliance (% of tasks completed on time)
    const allCompletedTasks = await prisma.task.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          not: null
        }
      },
      select: {
        dueDate: true,
        completedAt: true
      }
    });

    let slaCompliance = 100;
    if (allCompletedTasks.length > 0) {
      const onTimeTasks = allCompletedTasks.filter(
        task => new Date(task.completedAt) <= new Date(task.dueDate)
      );
      slaCompliance = Math.round((onTimeTasks.length / allCompletedTasks.length) * 100);
    }

    // Risk Distribution
    const riskDistribution = await prisma.rFP.groupBy({
      by: ['riskLevel'],
      where: {
        ...privacyFilter,
        status: {
          notIn: ['WON', 'LOST']
        }
      },
      _count: true
    });

    // Industry Pipeline Value
    const industryPipeline = await prisma.rFP.groupBy({
      by: ['industry'],
      where: {
        status: {
          notIn: ['WON', 'LOST']
        }
      },
      _sum: {
        estimatedDealValue: true
      },
      _count: true
    });

    // Recent Activity
    const recentActivity = await prisma.activityLog.findMany({
      take: 20,
      where: isAdmin ? {} : {
        OR: [
          { userId: userId },
          { rfp: privacyFilter }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        },
        rfp: {
          select: { rfpNumber: true, clientName: true }
        }
      }
    });

    // RFP Volume by Status (for the chart)
    const statusCounts = await prisma.rFP.groupBy({
      by: ['status'],
      where: {
        ...privacyFilter,
        status: {
          notIn: ['WON', 'LOST']
        }
      },
      _count: true
    });

    res.status(200).json({
      kpis: {
        activeRFPs,
        rfpsAtRisk,
        totalPipelineValue: pipelineValue._sum.estimatedDealValue || 0,
        avgProposalTurnaround: avgTurnaround,
        winRate,
        slaCompliance
      },
      charts: {
        riskDistribution: riskDistribution.map(r => ({
          level: r.riskLevel,
          count: r._count
        })),
        statusDistribution: statusCounts.map(s => ({
          status: s.status,
          count: s._count
        })),
        industryPipeline: industryPipeline.map(i => ({
          industry: i.industry,
          value: i._sum.estimatedDealValue,
          count: i._count
        }))
      },
      recentActivity
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

/**
 * Get user-specific dashboard
 * GET /api/dashboard/my-rfps
 */
const getMyDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let rfps;
    let tasks;

    if (userRole === 'PROPOSAL_MANAGER') {
      // Get RFPs where user is the manager
      rfps = await prisma.rFP.findMany({
        where: { proposalManagerId: userId },
        include: {
          solutionArchitect: {
            select: { firstName: true, lastName: true }
          },
          tasks: {
            select: { status: true }
          }
        },
        orderBy: { submissionDeadline: 'asc' }
      });

      tasks = await prisma.task.findMany({
        where: {
          rfp: {
            proposalManagerId: userId
          }
        },
        include: {
          owner: {
            select: { firstName: true, lastName: true }
          },
          rfp: {
            select: { rfpNumber: true, clientName: true }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

    } else if (userRole === 'SOLUTION_ARCHITECT') {
      // Get RFPs where user is the architect
      rfps = await prisma.rFP.findMany({
        where: { solutionArchitectId: userId },
        include: {
          proposalManager: {
            select: { firstName: true, lastName: true }
          },
          tasks: {
            select: { status: true }
          }
        },
        orderBy: { submissionDeadline: 'asc' }
      });

      tasks = await prisma.task.findMany({
        where: { ownerId: userId },
        include: {
          rfp: {
            select: { rfpNumber: true, clientName: true }
          }
        },
        orderBy: { dueDate: 'asc' }
      });
    }

    // My notifications
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false }
    });

    res.status(200).json({
      rfps: rfps || [],
      tasks: tasks || [],
      notifications,
      unreadCount
    });

  } catch (error) {
    console.error('My dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

module.exports = {
  getExecutiveDashboard,
  getMyDashboard
};
