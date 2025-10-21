import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Link as LinkIcon,
  Analytics as AnalyticsIcon,
  People as PeopleIcon,
  Menu as MenuIcon,
  AccountCircle,
  ExitToApp,
  AdminPanelSettings,
  DarkMode,
  LightMode,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const drawerWidth = 240;

// All possible menu items with their permission requirements
const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'URL Manager', icon: <LinkIcon />, path: '/urls' },
  { 
    text: 'Analytics', 
    icon: <AnalyticsIcon />, 
    path: '/analytics',
    requirePermission: { resource: 'analytics', action: 'read' }
  },
  { 
    text: 'User Management', 
    icon: <PeopleIcon />, 
    path: '/admin/users',
    requirePermission: { resource: 'users', action: 'read' }
  },
];

// Get role color for display
const getRoleColor = (role) => {
  switch (role) {
    case 'ADMIN': return 'error';
    case 'MANAGER': return 'warning';
    case 'ANALYST': return 'info';
    case 'USER': return 'default';
    default: return 'default';
  }
};

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout, hasPermission, isAdmin, updateThemePreference } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Filter menu items based on user permissions
  const visibleMenuItems = menuItems.filter(item => {
    if (!item.requirePermission) return true;
    return hasPermission(item.requirePermission.resource, item.requirePermission.action);
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
    handleProfileMenuClose();
  };

  const handleToggleTheme = async () => {
    const currentTheme = user?.preferences?.theme === 'dark' ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    try {
      await updateThemePreference(nextTheme);
      toast.success(`Switched to ${nextTheme} mode`);
    } catch (error) {
      console.error('Theme toggle failed:', error);
      toast.error('Failed to update theme');
    } finally {
      handleProfileMenuClose();
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Linker
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {visibleMenuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            selected={location.pathname === item.path}
            onClick={() => {
              navigate(item.path);
              if (isMobile) {
                setMobileOpen(false);
              }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      
      {/* Show admin indicator */}
      {isAdmin() && (
        <>
          <Divider />
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Chip 
              icon={<AdminPanelSettings />} 
              label="Admin" 
              color="error" 
              size="small" 
            />
          </Box>
        </>
      )}
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {visibleMenuItems.find(item => item.path === location.pathname)?.text || 'Linker'}
          </Typography>
          
          {/* Display user's first and last name */}
          {user?.firstName && user?.lastName && (
            <Typography 
              variant="body1" 
              component="span" 
              sx={{ mr: 1, color: 'inherit' }}
            >
              {user.firstName} {user.lastName}
            </Typography>
          )}
          
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="primary-search-account-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ 
              width: 40, 
              height: 32, 
              borderRadius: 2,
              fontSize: '0.875rem',
              fontWeight: 500
            }}>
              {user?.firstName && user?.lastName 
                ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` 
                : user?.name?.charAt(0) || <AccountCircle />}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem sx={{ cursor: 'default', '&:hover': { backgroundColor: 'transparent' } }}>
          <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.primary, fontWeight: 500 })}>
            {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.name}
          </Typography>
        </MenuItem>
        <MenuItem sx={{ cursor: 'default', '&:hover': { backgroundColor: 'transparent' } }}>
          <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.secondary })}>
            {user?.email}
          </Typography>
        </MenuItem>

        <MenuItem onClick={handleToggleTheme}>
          <ListItemIcon>
            {user?.preferences?.theme === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </ListItemIcon>
          {user?.preferences?.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        </MenuItem>
        
        {/* Display user roles */}
        {user?.roles && user.roles.length > 0 && (
          <MenuItem sx={{ cursor: 'default', '&:hover': { backgroundColor: 'transparent' } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {user.roles.map((role, index) => (
                <Chip 
                  key={index}
                  label={role} 
                  color={getRoleColor(role)} 
                  size="small" 
                  variant="outlined"
                />
              ))}
            </Box>
          </MenuItem>
        )}
        
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <ExitToApp fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;