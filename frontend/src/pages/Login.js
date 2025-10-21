import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { LoginOutlined } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated, login } = useAuth();

  // Check if this is a logout redirect by looking for specific URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isLogoutRedirect = urlParams.has('post_logout_redirect_uri') || 
                             window.location.search.includes('logout') ||
                             document.referrer.includes('logout');
    
    // Only clear auth state if this is specifically a logout redirect
    if (isLogoutRedirect) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
    }
  }, []);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (useRedirect = false) => {
    try {
      setLoading(true);
      setError('');
      await login(useRedirect);
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Typography
            component="h1"
            variant="h4"
            sx={{
              mb: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 'bold',
            }}
          >
            Linker
          </Typography>
          
          <Typography variant="h6" color="text.secondary" align="center" sx={{ mb: 4 }}>
            URL Shortening & Analytics Platform
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <LoginOutlined />}
            onClick={() => handleLogin(true)} // Use redirect by default
            disabled={loading}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1.1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              mb: 2,
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              },
            }}
          >
            {loading ? 'Signing in...' : 'Sign in or Sign up'}
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={<LoginOutlined />}
            onClick={() => handleLogin(false)} // Popup as fallback
            disabled={loading}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1.1rem',
              borderColor: '#667eea',
              color: '#667eea',
              '&:hover': {
                borderColor: '#5a6fd8',
                color: '#5a6fd8',
                backgroundColor: 'rgba(102, 126, 234, 0.04)',
              },
            }}
          >
            Sign in (Popup - if redirect fails)
          </Button>

          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
            Sign in with your existing account or create a new account to access the admin dashboard
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;