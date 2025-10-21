import React from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Permission component for conditional rendering based on user permissions
 * 
 * @param {Object} props
 * @param {string} [props.resource] - The resource to check permission for
 * @param {string} [props.action] - The action to check permission for
 * @param {string[]} [props.roles] - Required roles (user must have ANY of these)
 * @param {string[]} [props.allRoles] - Required roles (user must have ALL of these)
 * @param {boolean} [props.adminOnly] - If true, only admins can see this content
 * @param {React.ReactNode} props.children - Content to render if permission check passes
 * @param {React.ReactNode} [props.fallback] - Content to render if permission check fails
 */
const Permission = ({ 
  resource, 
  action, 
  roles, 
  allRoles, 
  adminOnly, 
  children, 
  fallback = null 
}) => {
  const { hasPermission, hasRole, hasAnyRole, isAdmin } = useAuth();

  // Check admin-only access
  if (adminOnly && !isAdmin()) {
    return fallback;
  }

  // Check specific roles (user must have ANY of these roles)
  if (roles && roles.length > 0 && !hasAnyRole(roles)) {
    return fallback;
  }

  // Check all roles (user must have ALL of these roles)
  if (allRoles && allRoles.length > 0) {
    const hasAllRequiredRoles = allRoles.every(role => hasRole(role));
    if (!hasAllRequiredRoles) {
      return fallback;
    }
  }

  // Check specific permission
  if (resource && action && !hasPermission(resource, action)) {
    return fallback;
  }

  return children;
};

// Convenience components for common permission checks
export const AdminOnly = ({ children, fallback = null }) => (
  <Permission adminOnly={true} fallback={fallback}>
    {children}
  </Permission>
);

export const CanManageUrls = ({ children, fallback = null }) => (
  <Permission resource="urls" action="write" fallback={fallback}>
    {children}
  </Permission>
);

export const CanDeleteUrls = ({ children, fallback = null }) => (
  <Permission resource="urls" action="delete" fallback={fallback}>
    {children}
  </Permission>
);

export const CanViewAnalytics = ({ children, fallback = null }) => (
  <Permission resource="analytics" action="read" fallback={fallback}>
    {children}
  </Permission>
);

export const CanManageAnalytics = ({ children, fallback = null }) => (
  <Permission resource="analytics" action="write" fallback={fallback}>
    {children}
  </Permission>
);

export const CanManageUsers = ({ children, fallback = null }) => (
  <Permission resource="users" action="read" fallback={fallback}>
    {children}
  </Permission>
);

export const ManagerOrAdmin = ({ children, fallback = null }) => (
  <Permission roles={['MANAGER', 'ADMIN']} fallback={fallback}>
    {children}
  </Permission>
);

export const AnalystOnly = ({ children, fallback = null }) => (
  <Permission roles={['ANALYST']} fallback={fallback}>
    {children}
  </Permission>
);

export default Permission;