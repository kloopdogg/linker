# Linker - URL Shortening Service Setup Guide

## Quick Start

### Prerequisites
- Node.js 18.x or higher
- MongoDB (local installation or MongoDB Atlas)
- Azure AD application registration

### Installation

1. **Clone and Install Dependencies**
   ```bash
   cd linker
   npm run install-all
   ```

2. **Environment Configuration**
   
   **Backend (.env):**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Update `.env` with your values:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/linker
   JWT_SECRET=your-super-secret-jwt-key
   AZURE_CLIENT_ID=your-azure-client-id
   AZURE_CLIENT_SECRET=your-azure-client-secret
   AZURE_TENANT_ID=your-azure-tenant-id
   AZURE_REDIRECT_URI=http://localhost:5000/api/auth/callback
   BASE_URL=http://localhost:5000
   FRONTEND_URL=http://localhost:3000
   ```
   
   **Frontend (.env):**
   ```bash
   cd frontend
   cp .env.example .env
   ```
   
   Update `.env` with your values:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   REACT_APP_BASE_URL=http://localhost:5000
   REACT_APP_AZURE_CLIENT_ID=your-azure-client-id
   REACT_APP_AZURE_TENANT_ID=your-azure-tenant-id
   ```

3. **Azure AD Setup**
   
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to Azure Active Directory > App registrations
   - Create a new registration:
     - Name: "Linker URL Shortener"
     - Supported account types: "Accounts in this organizational directory only"
     - Redirect URI: `http://localhost:3000` (for development)
   - Note the Application (client) ID and Directory (tenant) ID
   - Go to "Certificates & secrets" and create a new client secret
   - Add API permissions for Microsoft Graph: `User.Read`

4. **Database Setup**
   
   **Local MongoDB:**
   ```bash
   # Install MongoDB locally or use Docker
   docker run --name mongodb -d -p 27017:27017 mongo:latest
   ```
   
   **MongoDB Atlas (Recommended for production):**
   - Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a new cluster
   - Get connection string and update `MONGODB_URI`

5. **Run the Application**
   ```bash
   # Development mode (runs both backend and frontend)
   npm run dev
   ```
   
   Or run separately:
   ```bash
   # Backend only
   cd backend && npm run dev
   
   # Frontend only (in another terminal)
   cd frontend && npm start
   ```

6. **Access the Application**
   - Frontend (Admin Dashboard): http://localhost:3000
   - Backend API: http://localhost:5000/api
   - Health Check: http://localhost:5000/health

## Features

### URL Management
- Create short URLs with custom titles and descriptions
- QR code generation for each short URL
- Enable/disable URLs
- Tag-based organization
- Bulk operations

### Analytics & Reporting
- Real-time click tracking
- Geographic analytics by country
- Device and browser breakdown
- Time-based patterns (hourly/daily heatmaps)
- Export capabilities (JSON/CSV)

### Authentication
- Azure AD integration
- JWT-based session management
- Role-based access control

## API Endpoints

### Authentication
- `GET /api/auth/login` - Get Azure AD login URL
- `POST /api/auth/validate-token` - Validate Azure AD token
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/logout` - Logout

### URL Management
- `GET /api/urls` - List URLs with pagination/filtering
- `POST /api/urls` - Create new short URL
- `GET /api/urls/:id` - Get URL details
- `PUT /api/urls/:id` - Update URL
- `DELETE /api/urls/:id` - Delete URL
- `POST /api/urls/:id/qr-code` - Generate QR code

### Analytics
- `GET /api/analytics/overview` - Overview statistics
- `GET /api/analytics/countries` - Country breakdown
- `GET /api/analytics/devices` - Device analytics
- `GET /api/analytics/time-patterns` - Time-based patterns
- `GET /api/analytics/visits/:urlId` - URL-specific analytics
- `GET /api/analytics/export` - Export analytics data

### Public Routes
- `GET /:shortCode` - Redirect to original URL

## Deployment

### Azure App Service

1. **Create App Service**
   ```bash
   az webapp create \
     --resource-group myResourceGroup \
     --plan myAppServicePlan \
     --name linker-app-service \
     --runtime "NODE|18-lts"
   ```

2. **Configure Environment Variables**
   ```bash
   az webapp config appsettings set \
     --resource-group myResourceGroup \
     --name linker-app-service \
     --settings \
     NODE_ENV=production \
     MONGODB_URI="your-mongodb-atlas-uri" \
     JWT_SECRET="your-production-jwt-secret" \
     AZURE_CLIENT_ID="your-azure-client-id" \
     BASE_URL="https://link.myapp.com"
   ```

3. **Deploy**
   ```bash
   # Build frontend
   cd frontend && npm run build
   
   # Copy to backend public folder
   cp -r build/* ../backend/public/
   
   # Deploy backend
   cd ../backend
   az webapp deployment source config-zip \
     --resource-group myResourceGroup \
     --name linker-app-service \
     --src backend.zip
   ```

### Docker Deployment

```bash
# Build image
docker build -t linker-app .

# Run container
docker run -p 5000:5000 \
  -e MONGODB_URI="your-mongodb-uri" \
  -e JWT_SECRET="your-jwt-secret" \
  linker-app
```

## Production Considerations

### Security
- Use Azure Key Vault for secrets
- Enable HTTPS only
- Configure CORS for production domains
- Implement rate limiting
- Regular security updates

### Performance
- MongoDB indexes are pre-configured
- Implement Redis caching for analytics
- Use CDN for static assets
- Enable gzip compression

### Monitoring
- Application Insights integration
- MongoDB Atlas monitoring
- Custom metrics for click tracking
- Error logging and alerting

### Scaling
- App Service auto-scaling rules
- MongoDB sharding for high volume
- Consider Azure Front Door for global distribution
- Implement background jobs for analytics aggregation

## Support

For issues and questions:
1. Check the logs: `az webapp log tail --resource-group myResourceGroup --name linker-app-service`
2. Monitor Application Insights
3. Review MongoDB Atlas metrics
4. Check Azure AD sign-in logs

## Development

### Database Schema
- **Users**: Azure AD user information
- **Urls**: Short URL metadata and QR codes
- **Visits**: Individual click tracking with analytics
- **Analytics**: Aggregated analytics data

### Adding Features
1. Backend: Add routes in `/routes`, services in `/services`, models in `/models`
2. Frontend: Add components in `/components`, pages in `/pages`
3. Update API client in `/utils/api.js`
4. Add tests for new functionality

This setup provides a complete, production-ready URL shortening service with comprehensive analytics similar to the screenshots you provided.