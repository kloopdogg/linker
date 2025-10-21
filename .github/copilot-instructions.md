# Linker - AI Agent Instructions

## Project Architecture

**Linker** is a full-stack URL shortening service with QR codes and analytics. Stack: Node.js/Express/TypeScript backend, React/JavaScript frontend, MongoDB/CosmosDB for Mongo database, Azure AD B2C authentication.

### Authentication Flow (Critical)
1. Frontend uses Azure AD B2C with MSAL → gets B2C access token
2. Send B2C token ONCE to `POST /api/auth/azure-token` for validation
3. Backend validates B2C token signature via JWKS, creates/updates user in MongoDB
4. Backend returns **its own JWT** (7-day expiration, signed with `JWT_SECRET`)
5. Frontend stores backend JWT in localStorage as `authToken`
6. **All subsequent requests** use backend JWT only (B2C token discarded)
7. No refresh mechanism, requiring that users re-authenticate after 7 days

**Backend JWT payload includes**: `userId`, `email`, `roles` (array), `permissions` (resource/actions array). Middleware attaches to `req.user`.

### API Response Format (Mandatory)
ALL API responses use this structure:
```typescript
{
  success: boolean,
  data?: any,           // Payload on success
  message?: string,     // Human-readable message
  errors?: array        // Validation errors (express-validator)
}
```

Frontend always accesses: `response.data.data` (e.g., `const urls = response.data.data.urls`).

## Role-Based Access Control (RBAC)

### Permission Structure
```typescript
{
  resource: 'urls' | 'analytics' | 'users' | 'profile',
  actions: ['read', 'write', 'delete']
}
```

### Default Roles
- **USER**: Basic access (read/write own URLs, read analytics)
- **ADMIN**: Full system access
- **MANAGER**: Team management (read users, full URLs, read/write analytics)
- **ANALYST**: Analytics specialist (read URLs, read/write analytics)

### Backend Usage
```typescript
// Route protection
import { requirePermission, requireAdmin } from '../middleware/permissions';
router.delete('/urls/:id', requirePermission({ resource: 'urls', action: 'delete' }), handler);
```

### Frontend Usage
```javascript
// useAuth hook provides permission checking
const { hasRole, hasPermission, canManageUrls } = useAuth();

// Permission component for conditional rendering
<Permission resource="urls" action="write">
  <CreateButton />
</Permission>
```

## Device Detection Pattern (ua-parser-js)

**Issue**: `ua-parser-js` often fails to detect `device.vendor`, causing fallback to generic brands.

**Current logic** (`/backend/src/services/AnalyticsService.ts` lines 53-67):
```typescript
let deviceBrand = result.device.vendor || result.device.model || 'Unknown';
if (deviceBrand === 'Unknown' && result.os.name) {
  // Fallback inference from OS
  if (osName.includes('ios') || osName.includes('mac')) {
    deviceBrand = 'Apple'; // Generic fallback
  }
}
```

**When improving**: Use `result.device.type` + OS to infer specific brands (e.g., iOS + mobile → "iPhone", iOS + tablet → "iPad"). Prioritize specificity over coverage.

## Database Patterns

### MongoDB Indexes (Critical for Performance)
Key indexes already configured:
```typescript
// Visit.ts
visitedAt: 1, visitedAt: -1
{ url: 1, visitedAt: -1 }
{ country: 1, visitedAt: -1 }
{ 'device.type': 1, visitedAt: -1 }

// Url.ts
{ shortCode: 1 } unique
{ user: 1, createdAt: -1 }

// User.ts
{ azureId: 1 } unique
{ email: 1 } unique
```

### Query Best Practices
```typescript
// ✅ Good: Use lean() for read-only, project only needed fields
const urls = await Url.find({ user: userId })
  .select('shortCode originalUrl visitCount')
  .lean()
  .limit(20);

// ✅ Good: Aggregation for complex analytics
const stats = await Visit.aggregate([
  { $match: { url: urlId } },
  { $group: { _id: '$country', count: { $sum: 1 } } }
]);

// ❌ Avoid: Fetching full documents when only IDs needed
const urls = await Url.find({ user: userId }); // Heavy!
```

## Analytics Aggregation Job

**Purpose**: Pre-aggregate historical visit data every 3 hours for fast reporting.

**Key Files**:
- `/backend/src/jobs/AnalyticsAggregationJob.ts` - Core logic
- `/backend/src/jobs/scheduler.ts` - Cron setup (`0 */1 * * *`)
- `/backend/src/jobs/runAggregation.ts` - CLI runner for manual execution

**How it works**:
1. Aggregates all days **before today** (skips current day)
2. Uses unique index on `(url, period, date)` to prevent duplicates
3. Creates daily summaries: total visits, unique visitors, country/device/browser breakdowns, hourly patterns
4. Runs on startup + every 3 hours

**Manual trigger**: `cd backend && npm run aggregate`

## Code Style & Conventions

### Backend TypeScript
```typescript
// ✅ Explicit types for parameters and returns
async function createUrl(userId: string, data: CreateUrlDto): Promise<IUrl> {
  // implementation
}

// ✅ Service layer handles business logic, throws errors
class UrlService {
  async createShortUrl(userId: ObjectId, data: CreateUrlDto): Promise<IUrl> {
    if (await this.shortCodeExists(data.shortCode)) {
      throw new Error('Short code already exists');
    }
    return await Url.create({ ...data, user: userId });
  }
}

// ✅ Route handlers orchestrate, always try/catch
router.post('/urls', authMiddleware, [
  body('originalUrl').isURL(),
  body('shortCode').optional().matches(/^[a-zA-Z0-9_-]+$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const result = await urlService.createShortUrl(req.user.userId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

### Frontend React/JavaScript
```javascript
// ✅ Function declarations for named components
function MyComponent() {
  const { user } = useAuth();
  // component logic
}

// ✅ Material-UI sx prop for styling
<Box sx={{ display: 'flex', gap: 2, p: 3 }}>
  <Button variant="contained" sx={{ mt: 2 }}>Submit</Button>
</Box>

// ✅ API calls with proper error handling
const fetchData = async () => {
  try {
    const response = await urlAPI.getUrls({ page: 1 });
    setUrls(response.data.data.urls); // Note: .data.data pattern
  } catch (error) {
    toast.error('Failed to load URLs');
  }
};
```

## Environment Variables

### Backend (`/backend/.env`)
```bash
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/linker
JWT_SECRET=<strong-256-bit-secret>
AZURE_CLIENT_ID=<b2c-client-id>
AZURE_CLIENT_SECRET=<b2c-client-secret>
AZURE_B2C_TENANT_NAME=<tenant-name>
AZURE_B2C_USER_FLOW=B2C_1_signupsignin
BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

### Frontend (`/frontend/.env`)
```bash
REACT_APP_API_BASE_URL=http://localhost:5000/api
REACT_APP_AZURE_CLIENT_ID=<b2c-client-id>
REACT_APP_B2C_TENANT_NAME=<tenant-name>
REACT_APP_B2C_USER_FLOW_NAME=B2C_1_signupsignin
REACT_APP_AZURE_REDIRECT_URI=http://localhost:3000/auth/callback
```

## Common Development Tasks

### Running the Application
```bash
# Both backend + frontend
npm run dev

# Backend only (from /backend)
npm run dev    # Uses nodemon + ts-node for hot reload

# Frontend only (from /frontend)
npm start      # CRA dev server on port 3000

# Manual aggregation
cd backend && npm run aggregate
```

### Adding a Protected Route
```typescript
// Backend: /backend/src/routes/feature.ts
router.post('/feature', 
  authMiddleware, 
  requirePermission({ resource: 'feature', action: 'write' }),
  async (req, res) => { /* handler */ }
);

// Frontend: /frontend/src/App.js
<Route path="/feature" element={<FeaturePage />} />

// Component: Check permissions
function FeaturePage() {
  const { hasPermission } = useAuth();
  if (!hasPermission('feature', 'write')) {
    return <Typography>Access Denied</Typography>;
  }
  // render feature
}
```

### Adding New API Endpoint
```javascript
// /frontend/src/utils/api.js
export const featureAPI = {
  getItems: (params) => api.get('/feature', { params }),
  createItem: (data) => api.post('/feature', data),
  updateItem: (id, data) => api.put(`/feature/${id}`, data),
  deleteItem: (id) => api.delete(`/feature/${id}`)
};
```

## Security Considerations

1. **JWT Security**: `JWT_SECRET` must be 256-bit random string, never committed
2. **Token Storage**: localStorage vulnerable to XSS—sanitize ALL user input
3. **CORS**: Production whitelists specific domains (not wildcards)
4. **Rate Limiting**: 100 requests/15min on all `/api/*` routes
5. **HTTPS Only**: Production requires HTTPS for token security
6. **Input Validation**: All user input validated with express-validator before processing

## Debugging Tips

### Terminal Commands Don't Capture Output
**Known issue**: The `run_in_terminal` tool cannot capture command output reliably. Instead:
1. Ask user to run command manually
2. Use `get_terminal_last_command` tool to retrieve output
3. If that fails, ask user to copy-paste output

### Frontend Console Logs
- Dashboard.js has debugging logs for API responses
- Check browser console for auth flow: "validateTokenWithBackend called", "User permissions:", etc.
- useAuth hook logs authentication state changes

### Backend Logs
- Morgan logs all HTTP requests in `combined` format
- Auth flow logs show: "Authenticating user", "User role summary", "Generated JWT token"
- Check for validation errors in response logs

## Known Gotchas

1. **Visit Model Collection Name**: Model named `Visit`, MongoDB pluralizes to `visits` collection
2. **Mongoose Validation**: Doesn't run on `findOneAndUpdate` by default—use `{ runValidators: true }`
3. **MSAL Cache**: Uses sessionStorage—cleared on browser close
4. **Proxy Setup**: frontend `package.json` proxies to `http://localhost:5000` (check for conflicts)
5. **Analytics Timing**: Current day data NOT in analytics table—queries hit Visit collection directly
6. **Device Detection**: ua-parser-js frequently returns `vendor: undefined`—expect fallback logic to trigger

## Related Documentation

- `/CLICK_TO_VISIT_MIGRATION.md` - Recent terminology migration details
- `/ROLE_SYSTEM.md` - Complete RBAC implementation guide
- `/B2C-Login.md` - Azure AD B2C authentication flow
- `/SETUP.md` - Environment setup instructions
- `/backend/AGENTS.md` - Backend-specific agent guidelines (detailed)
- `/frontend/AGENTS.md` - Frontend-specific agent guidelines (detailed)
- `/backend/src/jobs/README.md` - Analytics aggregation job details
