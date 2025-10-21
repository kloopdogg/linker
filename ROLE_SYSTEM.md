# Role-Based Authorization System

## Overview

This document describes the new role-based authorization system that has been implemented in your Linker application. The system allows for granular permission control and feature authorization based on user roles.

## Implementation Summary

### What's New

1. **Enhanced Role System**: Support for multiple roles per user with granular permissions
2. **JWT Token Enhancement**: Roles and permissions are now included in JWT tokens
3. **Permission-Based Authorization**: Feature access controlled by specific permissions, not just roles
4. **Frontend Authorization Components**: React components for conditional rendering based on permissions

### Database Changes

1. **Role Model**: New `Role` collection with permissions
2. **UserRole Model**: Junction table for user-role relationships
3. **User Model**: Enhanced with role management methods

### Default Roles Created

- **ADMIN**: Full system access
  - All permissions on all resources
- **USER**: Standard user access
  - Read/write URLs
  - Read analytics
  - Manage own profile
- **MANAGER**: Team management access
  - Read users
  - Full URL management
  - Read/write analytics
- **ANALYST**: Analytics specialist
  - Read URLs
  - Read/write analytics

## How It Works

### Authentication Flow

When a user authenticates, the system now:

1. Looks up user roles and permissions
2. Includes roles and permissions in JWT token payload
3. Returns enhanced user object with roles and permissions

### JWT Token Payload

The JWT token now includes:
```javascript
{
  userId: "...",
  email: "...",
  name: "...",
  role: "user", // Legacy role for backward compatibility
  roles: ["USER"], // New role system
  permissions: [ // User permissions
    { resource: "urls", actions: ["read", "write"] },
    { resource: "analytics", actions: ["read"] },
    { resource: "profile", actions: ["read", "write"] }
  ],
  // ... other fields
}
```

## Frontend Usage

### Using the Auth Hook

The `useAuth` hook now provides permission checking functions:

```javascript
const { 
  user, 
  hasRole, 
  hasPermission, 
  isAdmin, 
  canManageUrls, 
  canDeleteUrls,
  canViewAnalytics 
} = useAuth();

// Check specific role
if (hasRole('ADMIN')) {
  // Show admin features
}

// Check specific permission
if (hasPermission('urls', 'delete')) {
  // Show delete button
}

// Use convenience functions
if (canManageUrls()) {
  // Show URL management features
}
```

### Using Permission Components

```javascript
import Permission, { 
  AdminOnly, 
  CanManageUrls, 
  CanViewAnalytics 
} from './components/Permission';

// Conditional rendering based on permissions
<Permission resource="urls" action="write">
  <CreateUrlButton />
</Permission>

// Admin-only content
<AdminOnly>
  <AdminPanel />
</AdminOnly>

// Based on roles
<Permission roles={['ADMIN', 'MANAGER']}>
  <ManagementFeatures />
</Permission>
```

### Layout Component Updates

The navigation now:
- Shows only menu items the user has permission to access
- Displays user roles in the profile menu
- Shows admin indicator for admin users

## Backend Usage

### Permission Middleware

```javascript
import { requirePermission, requireAdmin } from '../middleware/permissions';

// Require specific permission
router.get('/sensitive-data', 
  requirePermission({ resource: 'data', action: 'read' }), 
  handler
);

// Admin only
router.get('/admin-panel', requireAdmin, handler);

// Multiple role requirement
router.get('/management', 
  requirePermission({ 
    resource: 'management', 
    action: 'read',
    requireAnyRoles: ['ADMIN', 'MANAGER'] 
  }), 
  handler
);
```

### Route Protection Examples

Your existing routes can be enhanced:

```javascript
// URLs - now with granular permissions
router.post('/urls', requirePermission({ resource: 'urls', action: 'write' }), createUrl);
router.delete('/urls/:id', requirePermission({ resource: 'urls', action: 'delete' }), deleteUrl);

// Analytics - role-based access
router.get('/analytics', requirePermission({ resource: 'analytics', action: 'read' }), getAnalytics);
```

## Administration

### Admin Routes

New admin routes available at `/api/admin/`:

- `GET /api/admin/users` - List all users with roles
- `GET /api/admin/roles` - List all available roles
- `POST /api/admin/users/:userId/roles` - Assign role to user
- `DELETE /api/admin/users/:userId/roles/:roleName` - Remove role from user
- `GET /api/admin/me/permissions` - Get current user's permissions

### User Migration

Existing users are automatically migrated:
- Users with `role: 'admin'` → Get `ADMIN` role
- Users with `role: 'user'` → Get `USER` role

## Feature Authorization

Yes, this implementation makes feature authorization possible! You can now:

1. **Conditionally render UI components** based on permissions
2. **Protect API routes** with specific permission requirements
3. **Show/hide features** based on user roles
4. **Implement fine-grained access control** at the resource/action level

### Example Feature Authorization

```javascript
// In a React component
const UserManagementPage = () => {
  const { canManageUsers, hasPermission } = useAuth();

  if (!canManageUsers()) {
    return <div>Access Denied</div>;
  }

  return (
    <div>
      <UserList />
      
      <Permission resource="users" action="write">
        <AddUserButton />
      </Permission>
      
      <Permission resource="users" action="delete">
        <DeleteUserButton />
      </Permission>
    </div>
  );
};
```

## Testing the System

1. **Check your console logs** - You should see role information during authentication
2. **Inspect JWT tokens** - Use jwt.io to decode and see the new payload structure
3. **Test permission components** - Try the Permission components in your React app
4. **Use admin routes** - Hit `/api/admin/me/permissions` to see your current permissions

The system is now ready for feature-based authorization!