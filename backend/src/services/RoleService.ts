import { Role, UserRole, User } from '../models/index';
import { Types } from 'mongoose';

interface IRoleWithPermissions {
  name: string;
  description: string;
  permissions: Array<{
    resource: string;
    actions: string[];
  }>;
}

class RoleService {
  // Initialize default roles if they don't exist
  async initializeDefaultRoles(): Promise<void> {
    const defaultRoles: IRoleWithPermissions[] = [
      {
        name: 'ADMIN',
        description: 'Full system administrator with all permissions',
        permissions: [
          { resource: 'users', actions: ['read', 'write', 'delete'] },
          { resource: 'roles', actions: ['read', 'write', 'delete'] },
          { resource: 'urls', actions: ['read', 'write', 'delete'] },
          { resource: 'analytics', actions: ['read', 'write', 'delete'] },
          { resource: 'system', actions: ['read', 'write', 'delete'] }
        ]
      },
      {
        name: 'USER',
        description: 'Standard user with basic permissions',
        permissions: [
          { resource: 'urls', actions: ['read', 'write'] },
          { resource: 'analytics', actions: ['read'] },
          { resource: 'profile', actions: ['read', 'write'] }
        ]
      },
      {
        name: 'MANAGER',
        description: 'Manager with elevated permissions for team management',
        permissions: [
          { resource: 'users', actions: ['read'] },
          { resource: 'urls', actions: ['read', 'write', 'delete'] },
          { resource: 'analytics', actions: ['read', 'write'] },
          { resource: 'profile', actions: ['read', 'write'] }
        ]
      },
      {
        name: 'ANALYST',
        description: 'Analytics specialist with advanced analytics permissions',
        permissions: [
          { resource: 'urls', actions: ['read'] },
          { resource: 'analytics', actions: ['read', 'write'] },
          { resource: 'profile', actions: ['read', 'write'] }
        ]
      }
    ];

    for (const roleData of defaultRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (!existingRole) {
        const role = new Role(roleData);
        await role.save();
        console.log(`Created default role: ${roleData.name}`);
      }
    }
  }

  // Get user roles with permissions
  async getUserRoles(userId: string | Types.ObjectId): Promise<any[]> {
    const userRoles = await UserRole.find({
      userId,
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    }).populate('roleId');

    return userRoles.map(ur => ur.roleId);
  }

  // Get user permissions
  async getUserPermissions(userId: string | Types.ObjectId): Promise<Array<{ resource: string; actions: string[] }>> {
    const roles = await this.getUserRoles(userId);
    const permissions = new Map<string, Set<string>>();

    // Aggregate permissions from all roles
    for (const role of roles) {
      if (role && role.permissions) {
        for (const permission of role.permissions) {
          if (!permissions.has(permission.resource)) {
            permissions.set(permission.resource, new Set());
          }
          for (const action of permission.actions) {
            permissions.get(permission.resource)!.add(action);
          }
        }
      }
    }

    // Convert back to array format
    return Array.from(permissions.entries()).map(([resource, actions]) => ({
      resource,
      actions: Array.from(actions)
    }));
  }

  // Check if user has specific permission
  async hasPermission(userId: string | Types.ObjectId, resource: string, action: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const resourcePermission = permissions.find(p => p.resource === resource);
    return resourcePermission ? resourcePermission.actions.includes(action) : false;
  }

  // Assign role to user
  async assignRoleToUser(userId: string | Types.ObjectId, roleName: string, assignedBy: string | Types.ObjectId): Promise<void> {
    const role = await Role.findOne({ name: roleName.toUpperCase(), isActive: true });
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await user.assignRole(role._id as Types.ObjectId, new Types.ObjectId(assignedBy));
  }

  // Remove role from user
  async removeRoleFromUser(userId: string | Types.ObjectId, roleName: string): Promise<void> {
    const role = await Role.findOne({ name: roleName.toUpperCase(), isActive: true });
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await user.removeRole(role._id as Types.ObjectId);
  }

  // Auto-assign default role to new users
  async assignDefaultRole(userId: string | Types.ObjectId, assignedBy?: string | Types.ObjectId): Promise<void> {
    // Assign default USER role to new users
    const defaultAssignedBy = assignedBy || userId; // Self-assign if no assigner specified
    await this.assignRoleToUser(userId, 'USER', defaultAssignedBy);
  }

  // Migrate existing users to role system
  async migrateExistingUsers(): Promise<void> {
    const users = await User.find({});
    
    for (const user of users) {
      // Check if user already has roles assigned
      const existingRoles = await this.getUserRoles(user._id as Types.ObjectId);
      
      if (existingRoles.length === 0) {
        // Assign role based on existing role field
        const roleName = user.role === 'admin' ? 'ADMIN' : 'USER';
        await this.assignRoleToUser(user._id as Types.ObjectId, roleName, user._id as Types.ObjectId);
        console.log(`Migrated user ${user.email} to role: ${roleName}`);
      }
    }
  }

  // Get all available roles
  async getAllRoles(): Promise<any[]> {
    return await Role.find({ isActive: true }).sort({ name: 1 });
  }

  // Create a summary of user roles and permissions for JWT
  async getUserRoleSummary(userId: string | Types.ObjectId): Promise<{
    roles: string[];
    permissions: Array<{ resource: string; actions: string[] }>;
  }> {
    const roles = await this.getUserRoles(userId);
    const permissions = await this.getUserPermissions(userId);

    return {
      roles: roles.map(role => role.name),
      permissions
    };
  }
}

export default RoleService;