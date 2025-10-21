import React, { useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { authAPI } from '../utils/api';

const AuthContext = React.createContext();

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const readStoredUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = window.localStorage.getItem('userInfo');
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Failed to parse stored user info', error);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean(window.localStorage.getItem('authToken'));
  });
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);
  const { instance } = useMsal();

  const validateTokenWithBackend = useCallback(async (accessToken) => {
    try {
      console.log('validateTokenWithBackend called with token:', accessToken.substring(0, 50) + '...');
      const authResponse = await authAPI.validateToken(accessToken);
      console.log('Backend validation response:', authResponse.data);
      
      if (authResponse.data.success && authResponse.data.data.token) {
        localStorage.setItem('authToken', authResponse.data.data.token);
        localStorage.setItem('userInfo', JSON.stringify(authResponse.data.data.user));
        
        const userData = authResponse.data.data.user;
        setUser(userData);
        setIsAuthenticated(true);
        setLoading(false);
        
        console.log('Authentication successful with roles:', userData.roles);
        console.log('User permissions:', userData.permissions);
        return authResponse.data.data;
      } else {
        throw new Error('No token received from backend');
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      throw error;
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        const response = await authAPI.getProfile();
        const profile = response.data.data;
        window.localStorage.setItem('userInfo', JSON.stringify(profile));
        setUser(profile);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (useRedirect = true) => {
    try {
      setLoading(true);
      
      const loginRequest = {
        scopes: ['openid', 'profile', 'offline_access'],
        prompt: 'login'
      };

      if (useRedirect) {
        console.log('Starting B2C redirect login flow');
        await instance.loginRedirect(loginRequest);
        return;
      }
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear local auth state first
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      setIsAuthenticated(false);
      setUser(null);
      
      // Then initiate B2C logout redirect
      await instance.logoutRedirect({
        postLogoutRedirectUri: process.env.REACT_APP_LOGOUT_REDIRECT_URI || 'http://localhost:3000/login'
      });
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if B2C logout fails, clear local state
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      setIsAuthenticated(false);
      setUser(null);
      throw error;
    }
  };

  // Helper function to check if user has a specific role
  const hasRole = useCallback((roleName) => {
    if (!user || !user.roles) return false;
    return user.roles.includes(roleName.toUpperCase());
  }, [user]);

  // Helper function to check if user has any of the specified roles
  const hasAnyRole = useCallback((roleNames) => {
    if (!user || !user.roles) return false;
    return roleNames.some(roleName => user.roles.includes(roleName.toUpperCase()));
  }, [user]);

  // Helper function to check if user has a specific permission
  const hasPermission = useCallback((resource, action) => {
    if (!user || !user.permissions) return false;
    const permission = user.permissions.find(p => p.resource === resource);
    return permission ? permission.actions.includes(action) : false;
  }, [user]);

  // Helper function to check if user is admin
  const isAdmin = useCallback(() => {
    return hasRole('ADMIN');
  }, [hasRole]);

  // Helper function to check if user can manage URLs
  const canManageUrls = useCallback(() => {
    return hasPermission('urls', 'write');
  }, [hasPermission]);

  // Helper function to check if user can delete URLs
  const canDeleteUrls = useCallback(() => {
    return hasPermission('urls', 'delete');
  }, [hasPermission]);

  // Helper function to check if user can view analytics
  const canViewAnalytics = useCallback(() => {
    return hasPermission('analytics', 'read');
  }, [hasPermission]);

  // Helper function to check if user can manage analytics
  const canManageAnalytics = useCallback(() => {
    return hasPermission('analytics', 'write');
  }, [hasPermission]);

  // Helper function to check if user can manage other users
  const canManageUsers = useCallback(() => {
    return hasPermission('users', 'read');
  }, [hasPermission]);

  const updateThemePreference = useCallback(async (theme) => {
    try {
      const response = await authAPI.updatePreferences({ theme });
      const { success, data, message } = response.data || {};
      if (!success || !data) {
        throw new Error(message || 'Failed to update preferences');
      }
      window.localStorage.setItem('userInfo', JSON.stringify(data));
      setUser(data);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      console.error('Failed to update theme preference:', error);
      throw error;
    }
  }, []);

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    validateTokenWithBackend,
    // Role and permission helpers
    hasRole,
    hasAnyRole,
    hasPermission,
    isAdmin,
    canManageUrls,
    canDeleteUrls,
    canViewAnalytics,
    canManageAnalytics,
    canManageUsers,
    updateThemePreference,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default useAuth;