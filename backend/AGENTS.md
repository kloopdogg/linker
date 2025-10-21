# Copilot Instructions - Backend

## Project Context

This is the **Linker Backend API** - a Node.js/Express REST API for URL shortening, QR code generation, and analytics tracking. The backend validates Azure AD B2C tokens, manages user authentication/authorization, and provides data persistence via MongoDB.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 4.18
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Azure AD B2C with @azure/msal-node, JWT with jsonwebtoken
- **Security**: Helmet, CORS, Express Rate Limit
- **Validation**: Express-validator
- **Analytics**: GeoIP-lite, useragent parsing
- **Dev Tools**: ts-node, nodemon for hot reload

## Architecture & Directory Structure

```
backend/
├── src/
│   ├── middleware/     # Auth, validation, error handling
│   ├── models/         # Mongoose schemas (User, Url, Click, Role)
│   ├── routes/         # Express route handlers
│   ├── services/       # Business logic (AuthService, RoleService, etc.)
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Helper functions
│   └── server.ts       # Express app initialization and startup
├── dist/               # Compiled JavaScript output
└── .env                # Environment variables
```

## Key Architectural Patterns

### API Response Format
**ALL** API responses follow this standard format:
```typescript
{
  success: boolean,
  data?: any,           // Response payload on success
  message?: string,     // Human-readable message
  errors?: array        // Validation errors (if applicable)
}
```

### Authentication Flow
1. **Frontend** sends B2C ID/access token to `POST /api/auth/azure-token`
2. **Backend** validates B2C token signature using JWKS
3. **Backend** creates/updates user in MongoDB
4. **Backend** generates own JWT signed with `JWT_SECRET`
5. **Backend** returns JWT (7-day expiration) + user data
6. **Frontend** stores JWT in localStorage
7. **All subsequent requests** use backend JWT (B2C token discarded)

### Middleware Stack
```typescript
// Typical protected route
router.get('/protected', authMiddleware, permissionCheck, handler);

// authMiddleware: Validates JWT, attaches user to req.user
// permissionCheck: Verifies user has required permissions (optional)
// handler: Business logic
```

### Service Layer Pattern
- **Routes**: Handle HTTP concerns (request/response)
- **Services**: Contain business logic (AuthService, UrlService, etc.)
- **Models**: Define data schemas and validation
- **Middleware**: Cross-cutting concerns (auth, logging, errors)

## Code Style Guidelines

### TypeScript Conventions
```typescript
// ✅ Good: Explicit types for function parameters and returns
async function createUrl(userId: string, data: CreateUrlDto): Promise<IUrl> {
  // implementation
}

// ✅ Good: Use interfaces for complex types
interface AuthResult {
  token: string;
  user: UserResponse;
}

// ❌ Avoid: Implicit any types
function processData(data) {  // Missing type annotations
  // implementation
}
```

### Route Handlers
```typescript
// ✅ Good: Type Express objects, handle async/await properly
router.post('/endpoint',
  authMiddleware,
  [body('field').notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const result = await service.performAction(req.body);
      
      res.json({
        success: true,
        data: result,
        message: 'Action completed successfully'
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);
```

### Service Methods
```typescript
// ✅ Good: Services handle business logic, throw descriptive errors
class UrlService {
  async createShortUrl(userId: ObjectId, data: CreateUrlDto): Promise<IUrl> {
    // Validate business rules
    if (await this.shortCodeExists(data.shortCode)) {
      throw new Error('Short code already exists');
    }

    // Create document
    const url = new Url({
      user: userId,
      originalUrl: data.originalUrl,
      shortCode: data.shortCode || this.generateShortCode(),
    });

    return await url.save();
  }
}
```

### Model Definitions
```typescript
// ✅ Good: Use TypeScript interfaces for schema types
interface IUser extends Document {
  azureId: string;
  email: string;
  name: string;
  role: string;
  roles?: ObjectId[];
  preferences?: IUserPreferences;
  createdAt: Date;
  lastLogin?: Date;
}

const UserSchema = new Schema<IUser>({
  azureId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  // ... rest of schema
});
```

## Important Implementation Details

### Authentication & Authorization

#### Token Validation
```typescript
// B2C token validation in AuthService
async validateB2CToken(token: string): Promise<AzureUserInfo> {
  // 1. Decode token header to get key ID (kid)
  // 2. Fetch public key from JWKS endpoint
  // 3. Verify signature with RS256
  // 4. Validate issuer, audience, expiration
  // 5. Extract user claims
  // 6. Return user info
}
```

#### JWT Generation
```typescript
// Backend JWT creation
const payload = {
  userId: user._id,
  email: user.email,
  roles: roleSummary.roles,
  permissions: roleSummary.permissions,
  // ... other claims
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
```

#### Auth Middleware
```typescript
// JWT validation on protected routes
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  const decoded = jwt.verify(token, JWT_SECRET);
  req.user = decoded; // Attach user to request
  next();
};
```

### Role-Based Access Control (RBAC)

#### Permission Structure
```typescript
{
  resource: 'urls',        // e.g., 'urls', 'analytics', 'users'
  actions: ['read', 'write', 'delete']
}
```

#### Common Roles
- **USER**: Default role, basic read access
- **ADMIN**: Full access to all resources
- **MANAGER**: Management-level permissions

#### Permission Checks
```typescript
// In route handler
const user = (req as AuthenticatedRequest).user;
const hasPermission = user.permissions.some(
  p => p.resource === 'urls' && p.actions.includes('write')
);

if (!hasPermission) {
  return res.status(403).json({
    success: false,
    message: 'Insufficient permissions'
  });
}
```

### Environment Variables

Required configuration in `.env`:
```bash
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/linker

# Azure B2C
AZURE_CLIENT_ID=<b2c-client-id>
AZURE_CLIENT_SECRET=<b2c-client-secret>
AZURE_B2C_TENANT_NAME=<tenant-name>
AZURE_B2C_USER_FLOW=B2C_1_signupsignin
AZURE_TENANT_ID=<azure-tenant-id>

# JWT
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d

# Application
BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

### Database Indexes
```typescript
// Critical indexes for performance
UserSchema.index({ azureId: 1 });
UserSchema.index({ email: 1 });
UrlSchema.index({ shortCode: 1 }, { unique: true });
UrlSchema.index({ user: 1, createdAt: -1 });
ClickSchema.index({ url: 1, timestamp: -1 });
```

## API Endpoints Overview

### Authentication Routes (`/api/auth`)
- `POST /azure-token` - Validate B2C token, return backend JWT
- `GET /me` - Get current user profile
- `PATCH /preferences` - Update user preferences
- `POST /logout` - Logout (frontend-side token removal)

### URL Routes (`/api/urls`)
- `GET /` - List user's URLs (paginated)
- `POST /` - Create new short URL
- `GET /:id` - Get URL details
- `PUT /:id` - Update URL
- `DELETE /:id` - Delete URL
- `POST /:id/qr-code` - Generate QR code

### Analytics Routes (`/api/analytics`)
- `GET /overview` - Dashboard overview stats
- `GET /visits/:urlId` - Click analytics for specific URL
- `GET /countries` - Geographic distribution
- `GET /devices` - Device/browser analytics
- `GET /time-patterns` - Temporal patterns

### Public Routes
- `GET /:shortCode` - Redirect to original URL (tracks click)

## Common Patterns & Best Practices

### Error Handling
```typescript
// ✅ Good: Descriptive errors with proper status codes
try {
  const result = await service.performAction();
  res.json({ success: true, data: result });
} catch (error) {
  console.error('Action failed:', error);
  
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
}
```

### Input Validation
```typescript
// ✅ Good: Use express-validator for validation
[
  body('email').isEmail().withMessage('Valid email required'),
  body('url').isURL().withMessage('Valid URL required'),
  body('shortCode')
    .optional()
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid characters in short code')
],
async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  // Process request
}
```

### Async/Await Pattern
```typescript
// ✅ Good: Always handle Promise rejections
async function handler(req: Request, res: Response): Promise<void> {
  try {
    const result = await asyncOperation();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Operation failed'
    });
  }
}

// ❌ Avoid: Unhandled Promise rejections
function handler(req: Request, res: Response) {
  asyncOperation().then(result => {  // No error handling
    res.json({ success: true, data: result });
  });
}
```

### Database Queries
```typescript
// ✅ Good: Use projection and lean for better performance
const urls = await Url.find({ user: userId })
  .select('shortCode originalUrl createdAt visits')  // Project only needed fields
  .limit(20)
  .lean()  // Return plain objects, not Mongoose documents
  .exec();

// ✅ Good: Use aggregation for complex queries
const stats = await Click.aggregate([
  { $match: { url: urlId } },
  { $group: { _id: '$country', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
]);
```

## Commands

```bash
# Development
npm run dev           # Start with nodemon + ts-node (hot reload)

# Build
npm run build         # Compile TypeScript to dist/
npm start             # Run compiled code from dist/

# Production
npm run start:prod    # Build and start

# Testing
npm test              # Run Jest tests (if configured)
```

## Security Considerations

### Token Security
- **JWT_SECRET**: Must be strong, random, and secret (use 256-bit key)
- **Token Expiration**: 7 days balances security and UX; no refresh mechanism
- **HTTPS Only**: Production must use HTTPS to prevent token interception
- **No Token Refresh**: Users re-authenticate after 7 days

### API Security
- **Helmet**: Sets security-related HTTP headers
- **CORS**: Whitelist specific frontend domains (not wildcards in production)
- **Rate Limiting**: Prevents brute force and DoS attacks
- **Input Validation**: Sanitize all user input with express-validator
- **MongoDB Injection**: Use parameterized queries, avoid string concatenation

### Authentication
- **B2C Token Validation**: Verifies signature using public keys from JWKS endpoint
- **JWT Verification**: All protected routes validate JWT signature and expiration
- **Permission Checks**: RBAC system prevents unauthorized access

## Common Tasks

### Add New Protected Route
```typescript
router.post('/new-endpoint',
  authMiddleware,  // Validates JWT
  [
    body('field').notEmpty()  // Validation
  ],
  async (req: Request, res: Response): Promise<void> => {
    // Implementation
  }
);
```

### Add Permission Check
```typescript
// Check user has specific permission
const user = (req as AuthenticatedRequest).user;
const canWrite = user.permissions.some(
  p => p.resource === 'resource' && p.actions.includes('write')
);

if (!canWrite) {
  res.status(403).json({
    success: false,
    message: 'Insufficient permissions'
  });
  return;
}
```

### Add New Service Method
```typescript
class MyService {
  async performAction(data: ActionDto): Promise<Result> {
    // Validate business rules
    if (!this.isValid(data)) {
      throw new Error('Invalid data');
    }

    // Perform action
    const result = await Model.create(data);
    
    return result;
  }
}
```

### Add MongoDB Model
```typescript
interface INewModel extends Document {
  field1: string;
  field2: number;
  createdAt: Date;
}

const NewModelSchema = new Schema<INewModel>({
  field1: { type: String, required: true },
  field2: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Add indexes
NewModelSchema.index({ field1: 1 });

export const NewModel = model<INewModel>('NewModel', NewModelSchema);
```

## Testing Considerations

### Manual Testing
- Test all endpoints with Postman/Thunder Client
- Verify JWT expiration handling (set short expiration for testing)
- Test permission checks with different user roles
- Verify input validation catches invalid data
- Test error responses return proper format

### Integration Points
- MongoDB connection and reconnection logic
- Azure B2C JWKS endpoint availability
- Rate limiter behavior under load
- CORS with different origins

## Database Management

### Mongoose Best Practices
1. **Always use indexes** on frequently queried fields
2. **Use lean()** for read-only queries (better performance)
3. **Validate at schema level** when possible
4. **Use transactions** for multi-document operations
5. **Project fields** to reduce data transfer

### Common Gotchas
- Mongoose documents are heavy objects; use `.lean()` or `.toObject()`
- Don't forget to await queries (common TypeScript mistake)
- Use `Types.ObjectId` for ObjectId type annotations
- Schema validation doesn't run on `findOneAndUpdate()` by default (use `runValidators: true`)

## Related Documentation

- See `/B2C-Login.md` for complete authentication flow
- See `/SETUP.md` for environment setup
- See `/frontend/AGENTS.md` for frontend-specific guidelines
- See `/ROLE_SYSTEM.md` for RBAC implementation details

## AI Agent Guidance

When assisting with this backend codebase:

1. **Follow Response Format**: All responses must use `{ success, data, message }` structure
2. **Type Safety**: Use TypeScript types explicitly; avoid `any`
3. **Auth Aware**: Check authentication and permissions for all protected endpoints
4. **Token Lifecycle**: B2C token used once; backend JWT used for all subsequent requests
5. **Error Handling**: Always wrap async operations in try/catch
6. **Validation**: Use express-validator for input validation
7. **Security First**: Consider security implications of all changes
8. **Service Layer**: Put business logic in services, not route handlers
9. **Database**: Use indexes, projections, and lean queries for performance
10. **Testing**: Suggest manual testing steps for all API changes

## Performance Tips

1. **Database Indexes**: Add indexes for fields used in queries, sorts, or lookups
2. **Pagination**: Always paginate list endpoints (limit, skip)
3. **Projection**: Select only needed fields in queries
4. **Lean Queries**: Use `.lean()` for read-only data
5. **Connection Pooling**: MongoDB connection is pooled automatically
6. **Caching**: Consider Redis for frequently accessed data (not yet implemented)
7. **Async Operations**: Use Promise.all() for parallel operations

## Monitoring & Logging

- **Morgan**: HTTP request logging (configured in server.ts)
- **Console Logs**: Use for debugging; remove or use proper logger in production
- **Error Logs**: Always log errors with context for debugging
- **Azure Monitoring**: Consider Application Insights for production monitoring
