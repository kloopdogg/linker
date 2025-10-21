import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../utils/api';

const AuthCallback = () => {
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState(null);
  const { instance } = useMsal();
  const { validateTokenWithBackend } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Processing auth callback...');
        
        // Handle the redirect promise
        const response = await instance.handleRedirectPromise();
        
        if (response) {
          console.log('B2C redirect response received:', response);
          console.log('Response keys:', Object.keys(response));
          console.log('Account info:', response.account);
          
          // For B2C, we usually get an idToken rather than accessToken
          const token = response.accessToken || response.idToken;
          
          if (token) {
            console.log('Got token from B2C redirect:', token.substring(0, 50) + '...');
            console.log('Token type:', response.accessToken ? 'accessToken' : 'idToken');
            
            // Validate token with backend
            console.log('Sending token to backend for validation...');
            
            // Force reset validation flag before attempting validation from AuthCallback
            console.log('Forcing validation to proceed from AuthCallback...');
            
            // Temporarily create a direct validation call to bypass the flag issue
            try {
              console.log('Making direct API call to validate token...');
              const authResponse = await authAPI.validateToken(token);
              console.log('Direct validation response:', authResponse.data);
              
              if (authResponse.data.success && authResponse.data.data.token) {
                localStorage.setItem('authToken', authResponse.data.data.token);
                localStorage.setItem('userInfo', JSON.stringify(authResponse.data.data.user));
                console.log('Direct validation successful, stored auth data');
                // We'll need to trigger a state update somehow
                window.location.href = '/dashboard'; // Force redirect for now
              } else {
                setError('Token validation failed - no token in response');
              }
            } catch (directValidationError) {
              console.error('Direct validation failed:', directValidationError);
              setError('Authentication failed - token validation error');
            }
            
            console.log('Authentication successful, redirecting...');
            // The useAuth hook will handle setting the auth state
            // and the Navigate component below will redirect
          } else {
            console.log('No token in B2C redirect response');
            console.log('Full response:', response);
            setError('Authentication failed - no token received. Please try again.');
          }
        } else {
          console.log('No redirect response from B2C');
          
          // Check if this might be a logout redirect
          const urlParams = new URLSearchParams(window.location.search);
          const isLogoutCallback = urlParams.has('post_logout_redirect_uri') || 
                                   window.location.href.includes('logout') ||
                                   !instance.getAllAccounts().length;
          
          if (isLogoutCallback) {
            console.log('Detected logout callback, redirecting to login');
            window.location.href = '/login';
            return;
          }
          
          // Check if there are any accounts already signed in
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            console.log('Found existing B2C account, attempting silent token acquisition');
            try {
              const silentRequest = {
                scopes: ['openid', 'profile', 'offline_access'],
                account: accounts[0],
              };
              const silentResponse = await instance.acquireTokenSilent(silentRequest);
              const token = silentResponse.accessToken || silentResponse.idToken;
              if (token) {
                await validateTokenWithBackend(token);
              } else {
                setError('Silent token acquisition failed - no token received.');
              }
            } catch (silentError) {
              console.error('Silent token acquisition failed:', silentError);
              setError('Authentication failed. Please try again.');
            }
          } else {
            console.log('No accounts found after B2C redirect');
            setError('No authentication data found. Please try logging in again.');
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Authentication failed. Please try again.');
      } finally {
        setProcessing(false);
      }
    };

    handleAuthCallback();
  }, [instance, validateTokenWithBackend]);

  // If there's an error, show it
  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        p={3}
      >
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          <a href="/login" style={{ color: 'inherit' }}>
            Click here to try again
          </a>
        </Typography>
      </Box>
    );
  }

  // If still processing, show loading
  if (processing) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Processing authentication...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please wait while we complete your sign-in
        </Typography>
      </Box>
    );
  }

  // If processing is complete and no error, redirect to dashboard
  return <Navigate to="/dashboard" replace />;
};

export default AuthCallback;