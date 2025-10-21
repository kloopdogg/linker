import express from 'express';
import { body, validationResult } from 'express-validator';
import { User, Role, UserRole } from '../models/index';
import RoleService from '../services/RoleService';
import authMiddleware from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/auth';
import { Types } from 'mongoose';

type Request = express.Request;
type Response = express.Response;

const router = express.Router();
const roleService = new RoleService();

// Apply auth middleware to all admin routes
router.use(authMiddleware);

// Get all users with their roles (requires authentication)
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    // Simple admin check - only admins can access
    if (!user || (user.role !== 'admin' && !user.roles?.includes('ADMIN'))) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const users = await User.find({ isActive: true })
      .select('-__v')
      .sort({ createdAt: -1 });

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roles = await roleService.getUserRoles(user._id as Types.ObjectId);
        const permissions = await roleService.getUserPermissions(user._id as Types.ObjectId);
        
        return {
          id: user._id,
          azureId: user.azureId,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role, // Legacy role
          roles: roles.map((r: any) => r.name),
          permissions,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        };
      })
    );

    res.json({
      success: true,
      data: usersWithRoles
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Get all available roles
router.get('/roles', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    // Simple admin check
    if (!user || (user.role !== 'admin' && !user.roles?.includes('ADMIN'))) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const roles = await roleService.getAllRoles();
    
    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles'
    });
  }
});

// Assign role to user
router.post('/users/:userId/roles', [
  body('roleName').notEmpty().withMessage('Role name is required')
], async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    // Simple admin check
    if (!user || (user.role !== 'admin' && !user.roles?.includes('ADMIN'))) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { userId } = req.params;
    const { roleName } = req.body;
    const assignedBy = user.id;

    await roleService.assignRoleToUser(userId!, roleName, assignedBy);

    res.json({
      success: true,
      message: `Role ${roleName} assigned to user successfully`
    });
  } catch (error) {
    console.error('Failed to assign role:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to assign role'
    });
  }
});

// Remove role from user
router.delete('/users/:userId/roles/:roleName', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    // Simple admin check
    if (!user || (user.role !== 'admin' && !user.roles?.includes('ADMIN'))) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const { userId, roleName } = req.params;

    await roleService.removeRoleFromUser(userId!, roleName!);

    res.json({
      success: true,
      message: `Role ${roleName} removed from user successfully`
    });
  } catch (error) {
    console.error('Failed to remove role:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove role'
    });
  }
});

// Get current user's permissions (for debugging/info)
router.get('/me/permissions', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    
    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user permissions'
    });
  }
});

export default router;