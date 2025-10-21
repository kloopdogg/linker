import express from 'express';
import authMiddleware from './auth';
import type { AuthenticatedRequest } from '../types/auth';

// Define the types from Express
type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;

export interface PermissionOptions {
  resource: string;
  action: string;
  requireAllRoles?: string[]; // User must have ALL of these roles
  requireAnyRoles?: string[]; // User must have ANY of these roles
}

// Permission checking middleware factory
export const requirePermission = (options: PermissionOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check role requirements first (if specified)
      if (options.requireAllRoles && options.requireAllRoles.length > 0) {
        const hasAllRoles = options.requireAllRoles.every(role => 
          user.roles.includes(role.toUpperCase())
        );
        
        if (!hasAllRoles) {
          res.status(403).json({
            success: false,
            message: `Access denied. Required roles: ${options.requireAllRoles.join(', ')}`
          });
          return;
        }
      }

      if (options.requireAnyRoles && options.requireAnyRoles.length > 0) {
        const hasAnyRole = options.requireAnyRoles.some(role => 
          user.roles.includes(role.toUpperCase())
        );
        
        if (!hasAnyRole) {
          res.status(403).json({
            success: false,
            message: `Access denied. Required any of roles: ${options.requireAnyRoles.join(', ')}`
          });
          return;
        }
      }

      // Check specific permission
      const permission = user.permissions.find(p => p.resource === options.resource);
      
      if (!permission || !permission.actions.includes(options.action)) {
        res.status(403).json({
          success: false,
          message: `Access denied. Missing permission: ${options.action} on ${options.resource}`
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Permission check error'
      });
    }
  };
};

// Convenience middleware functions for common permissions
export const requireAdmin = requirePermission({
  resource: 'system',
  action: 'read',
  requireAnyRoles: ['ADMIN']
});

export const requireUrlRead = requirePermission({
  resource: 'urls',
  action: 'read'
});

export const requireUrlWrite = requirePermission({
  resource: 'urls',
  action: 'write'
});

export const requireUrlDelete = requirePermission({
  resource: 'urls',
  action: 'delete'
});

export const requireAnalyticsRead = requirePermission({
  resource: 'analytics',
  action: 'read'
});

export const requireAnalyticsWrite = requirePermission({
  resource: 'analytics',
  action: 'write'
});

export const requireUserManagement = requirePermission({
  resource: 'users',
  action: 'read',
  requireAnyRoles: ['ADMIN', 'MANAGER']
});

// Helper function to check permissions in route handlers
export const hasPermission = (user: any, resource: string, action: string): boolean => {
  if (!user || !user.permissions) {
    return false;
  }

  const permission = user.permissions.find((p: any) => p.resource === resource);
  return permission ? permission.actions.includes(action) : false;
};

// Helper function to check roles
export const hasRole = (user: any, roleName: string): boolean => {
  if (!user || !user.roles) {
    return false;
  }

  return user.roles.includes(roleName.toUpperCase());
};

// Helper function to check if user has any of the specified roles
export const hasAnyRole = (user: any, roleNames: string[]): boolean => {
  if (!user || !user.roles) {
    return false;
  }

  return roleNames.some(roleName => user.roles.includes(roleName.toUpperCase()));
};