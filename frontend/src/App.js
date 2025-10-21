import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { Toaster } from 'react-hot-toast';

// Import components and pages
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UrlManager from './pages/UrlManager';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AuthCallback from './components/AuthCallback';
import useAuth, { AuthProvider } from './hooks/useAuth';

// MSAL configuration for Azure AD B2C
const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_AZURE_CLIENT_ID,
    authority: `https://${process.env.REACT_APP_B2C_TENANT_NAME}.b2clogin.com/${process.env.REACT_APP_B2C_TENANT_NAME}.onmicrosoft.com/${process.env.REACT_APP_B2C_USER_FLOW_NAME}`,
    knownAuthorities: [`${process.env.REACT_APP_B2C_TENANT_NAME}.b2clogin.com`],
    redirectUri: process.env.REACT_APP_AZURE_REDIRECT_URI,
    postLogoutRedirectUri: process.env.REACT_APP_LOGOUT_REDIRECT_URI,
    navigateToLoginRequestUrl: false
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  },
  system: {
    allowNativeBroker: false, // Disable to avoid issues with popup flows
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0: // LogLevel.Error
            console.error('[MSAL]', message);
            return;
          case 1: // LogLevel.Warning
            console.warn('[MSAL]', message);
            return;
          case 2: // LogLevel.Info
            console.info('[MSAL]', message);
            return;
          case 3: // LogLevel.Verbose
            console.debug('[MSAL]', message);
            return;
          default:
            console.log('[MSAL]', message);
            return;
        }
      },
      logLevel: 2 // Info level
    }
  }
};

const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL instance
msalInstance.initialize();

const buildTheme = (mode) => {
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#8ea2ff' : '#667eea',
      },
      secondary: {
        main: isDark ? '#a18cd1' : '#764ba2',
      },
      background: {
        default: isDark ? '#0f172a' : '#f5f5f5',
        paper: isDark ? '#1e293b' : '#ffffff',
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: isDark
              ? 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });
};

const resolvePreferredMode = (user) => {
  if (user?.preferences?.theme === 'dark') {
    return 'dark';
  }
  if (user?.preferences?.theme === 'light') {
    return 'light';
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

const AppContent = () => {
  const { user } = useAuth();
  const mode = resolvePreferredMode(user);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  const toastOptions = useMemo(() => ({
    duration: 4000,
    style: mode === 'dark'
      ? { background: '#1f2937', color: '#f8fafc' }
      : { background: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb' },
  }), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="urls" element={<UrlManager />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>
          </Routes>
          <Toaster
            position="top-center"
            toastOptions={toastOptions}
          />
        </div>
      </Router>
    </ThemeProvider>
  );
};

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </MsalProvider>
  );
}

export default App;