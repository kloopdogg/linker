# Copilot Instructions - Frontend

## Project Context

This is the **Linker Frontend Application** - a React-based single-page application for URL shortening, QR code generation, and analytics visualization. The frontend uses Azure AD B2C for authentication via MSAL and communicates with a Node.js/Express backend API.

## Tech Stack

- **Framework**: React 18.2 with React Router v6
- **UI Library**: Material-UI (MUI) v5
- **Authentication**: Azure AD B2C with @azure/msal-react and @azure/msal-browser
- **HTTP Client**: Axios with interceptors
- **Charts**: Recharts v2
- **State Management**: React Context API (no Redux)
- **Build Tool**: Create React App (react-scripts)
- **Styling**: Emotion (CSS-in-JS via MUI)

## Architecture & Directory Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Route-level page components
│   ├── hooks/          # Custom React hooks (especially useAuth)
│   ├── utils/          # Utilities (API client, helpers)
│   ├── App.js          # Main app with routing and MSAL setup
│   └── index.js        # React root entry point
├── public/             # Static assets
└── .env                # Environment variables
```

## Key Components & Patterns

### Authentication Flow
- **MSAL Integration**: `App.js` initializes MSAL with B2C configuration
- **Auth Context**: `hooks/useAuth.js` provides `AuthProvider` and `useAuth` hook
- **Protected Routes**: `components/ProtectedRoute.js` guards authenticated routes
- **Auth Callback**: `components/AuthCallback.js` handles B2C redirect after login
- **Token Storage**: Backend JWT stored in localStorage as `authToken` (7-day expiration)
- **B2C Token**: Used ONCE during login, sent to backend for validation, then discarded

### API Communication
- **Base Client**: `utils/api.js` exports configured Axios instance
- **Interceptors**: 
  - Request: Adds `Authorization: Bearer <token>` from localStorage
  - Response: Handles 401 errors by redirecting to login
- **API Modules**: `authAPI`, `urlAPI`, `analyticsAPI` for organized endpoints

### Routing Structure
```
/login              → Login.js (public)
/auth/callback      → AuthCallback.js (public, handles B2C redirect)
/                   → Redirects to /dashboard
/dashboard          → Dashboard.js (protected)
/urls               → UrlManager.js (protected)
/analytics          → Analytics.js (protected)
```

### Component Conventions
1. **Functional Components**: Use function declarations, not arrow functions for named components
2. **Hooks**: All hooks at top of component, before any conditional logic
3. **Material-UI**: Use MUI components consistently; avoid mixing with custom HTML elements
4. **Styling**: Use `sx` prop for inline styles, avoid external CSS files
5. **Error Handling**: Use `react-hot-toast` for user notifications

## Code Style Guidelines

### React Patterns
```javascript
// ✅ Good: Function declaration
function MyComponent() {
  const { isAuthenticated, user } = useAuth();
  // component logic
}

// ❌ Avoid: Arrow function for named components
const MyComponent = () => { /* ... */ };
```

### API Calls
```javascript
// ✅ Good: Use API modules from utils/api.js
import { urlAPI, analyticsAPI } from '../utils/api';

const fetchData = async () => {
  try {
    const response = await urlAPI.getUrls({ page: 1, limit: 10 });
    const data = response.data.data; // Backend returns { success, data, message }
  } catch (error) {
    toast.error('Failed to load data');
  }
};
```

### State Management
```javascript
// ✅ Good: Use local state for component-specific data
const [loading, setLoading] = useState(false);
const [urls, setUrls] = useState([]);

// ✅ Good: Use useAuth for global auth state
const { user, hasPermission, canManageUrls } = useAuth();
```

### Material-UI Styling
```javascript
// ✅ Good: Use sx prop for styling
<Box sx={{ display: 'flex', gap: 2, p: 3 }}>
  <Button variant="contained" sx={{ mt: 2 }}>Submit</Button>
</Box>

// ❌ Avoid: Inline style objects
<div style={{ display: 'flex' }}>
```

## Important Implementation Details

### Authentication
- **No automatic token refresh**: Backend JWT expires after 7 days, user must re-authenticate
- **Permission checks**: Use `hasRole()`, `hasPermission()`, `canManageUrls()` from useAuth
- **Login types**: Redirect flow is default (popup as fallback for debugging)

### Environment Variables
```bash
REACT_APP_API_BASE_URL=http://localhost:5001/api
REACT_APP_AZURE_CLIENT_ID=<b2c-client-id>
REACT_APP_B2C_TENANT_NAME=<tenant-name>
REACT_APP_B2C_USER_FLOW_NAME=B2C_1_signupsignin
REACT_APP_AZURE_REDIRECT_URI=http://localhost:3000/auth/callback
REACT_APP_LOGOUT_REDIRECT_URI=http://localhost:3000/login
```

### Backend API Response Format
All API responses follow this structure:
```javascript
{
  success: boolean,
  data: any,           // Response payload
  message?: string,    // Optional message
  errors?: array       // Validation errors if applicable
}
```

### Common Gotchas
1. **MSAL Cache**: Uses `sessionStorage` by default (cleared on browser close)
2. **Token Expiration**: Frontend has no refresh logic; expired tokens cause redirect to login
3. **CORS**: Backend must whitelist frontend URL for local development
4. **Proxy**: `package.json` has proxy to `http://localhost:5000` for development

## Commands

```bash
# Development
npm start              # Start dev server on port 3000

# Build
npm run build          # Create production build in /build

# Testing
npm test              # Run Jest tests (if configured)

# Deployment
# Build artifacts go to /build directory
# See /deploy-frontend.sh for deployment script
```

## Working with This Codebase

### When Adding New Features
1. **Check Authentication**: Determine if feature requires authentication
2. **Add Route**: Update `App.js` routes, wrap with `ProtectedRoute` if needed
3. **Create Page**: Add new page component in `src/pages/`
4. **Add API Calls**: Extend API modules in `src/utils/api.js`
5. **Handle Permissions**: Use `useAuth` hooks for role/permission checks
6. **Add Navigation**: Update `components/Layout.js` if adding nav item

### When Modifying Authentication
- **DO NOT** modify MSAL config without updating backend B2C settings
- **DO NOT** store B2C tokens (they're used once and discarded)
- **ALWAYS** clear localStorage on logout (`authToken` and `userInfo`)
- **TEST** with both redirect and popup flows

### When Adding API Calls
1. Add method to appropriate API module in `utils/api.js`
2. Follow existing pattern: `methodName: (params) => api.method('/endpoint', params)`
3. Handle errors with try/catch and toast notifications
4. Return response.data.data for consistent access pattern

### When Creating New Components
1. Use Material-UI components for consistency
2. Accept necessary props; keep components focused
3. Use `sx` prop for styling
4. Handle loading and error states
5. Add PropTypes or TypeScript if available

## Testing Considerations

### Manual Testing Checklist
- [ ] Login flow (both redirect and popup)
- [ ] Token expiration (mock or wait 7 days)
- [ ] Logout and session cleanup
- [ ] Protected route access without auth
- [ ] API error handling (401, 403, 500)
- [ ] Permission-based UI elements
- [ ] Mobile responsiveness (MUI handles most)

## Security Notes

1. **XSS Risk**: localStorage tokens are vulnerable to XSS; sanitize all user input
2. **HTTPS**: Production must use HTTPS for secure token transmission
3. **Redirect URIs**: Must match exactly in Azure B2C app registration
4. **Token Validation**: Backend validates all tokens; frontend trusts backend response
5. **CORS**: Backend should whitelist specific domains, not use wildcards in production

## Related Documentation

- See `/B2C-Login.md` for complete authentication flow documentation
- See `/SETUP.md` for environment setup instructions
- See `/backend/AGENTS.md` for backend-specific guidelines
- See `/ROLE_SYSTEM.md` for role and permission system details

## AI Agent Guidance

When assisting with this frontend codebase:

1. **Maintain Consistency**: Follow existing patterns for components, API calls, and styling
2. **Use MUI**: Always prefer Material-UI components over custom HTML
3. **Auth-Aware**: Check authentication requirements and permissions for any feature
4. **API Format**: Remember backend response format `{ success, data, message }`
5. **Token Lifecycle**: Backend JWT is the only token used after initial login
6. **Error Handling**: Use toast notifications for user-facing errors
7. **Loading States**: Always show loading indicators during async operations
8. **Mobile First**: MUI handles responsive design; use breakpoints when needed
9. **No TypeScript**: This is a JavaScript project; don't add TypeScript unless requested
10. **Testing**: Suggest manual testing steps; unit tests are minimal in this project

## Common Tasks

### Add a New Protected Route
```javascript
// In App.js
<Route path="/new-feature" element={<NewFeature />} />
```

### Add Permission Check
```javascript
// In component
const { hasPermission } = useAuth();

if (!hasPermission('resource', 'action')) {
  return <Typography>Access Denied</Typography>;
}
```

### Add New API Endpoint
```javascript
// In utils/api.js
export const featureAPI = {
  getData: (id) => api.get(`/feature/${id}`),
  createItem: (data) => api.post('/feature', data),
  updateItem: (id, data) => api.put(`/feature/${id}`, data),
  deleteItem: (id) => api.delete(`/feature/${id}`)
};
```

### Theme Toggle Implementation
```javascript
// Already implemented in App.js and useAuth
const { user, updateThemePreference } = useAuth();
const currentTheme = user?.preferences?.theme || 'light';

// Toggle theme
await updateThemePreference(currentTheme === 'light' ? 'dark' : 'light');
```
