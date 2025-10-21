# Azure App Service Deployment Plan for Linker

## Architecture Decision: Two App Services vs One

**Recommendation: Use TWO separate App Services**

### Rationale:
1. **Separation of Concerns**: Frontend (React SPA) and Backend (Node.js API) have different scaling requirements
2. **Independent Scaling**: Frontend needs CDN/static hosting; Backend needs compute resources
3. **Security**: API can be secured with different access controls than static assets
4. **Deployment Flexibility**: Deploy frontend and backend independently
5. **Cost Optimization**: Frontend can use cheaper static hosting options in the future

### Architecture Overview:
```
┌─────────────────────┐    ┌─────────────────────┐
│   Frontend App      │    │   Backend API       │
│   (React SPA)       │───▶│   (Node.js/Express) │
│   linker-frontend   │    │   linker-backend    │
└─────────────────────┘    └─────────────────────┘
         │                           │
         │                           │
         ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐
│   Azure B2C         │    │   MongoDB Atlas     │
│   Authentication    │    │   Database          │
└─────────────────────┘    └─────────────────────┘
```

## Prerequisites

### 1. Azure Resources Required
- Azure Resource Group
- Azure App Service Plan (or use Free/Shared tier for testing)
- Azure B2C Tenant (if not already configured)
- Azure Key Vault (for secrets)
- MongoDB Atlas Database (or Azure Cosmos DB)

### 2. Environment Preparation
```bash
# Install Azure CLI
brew install azure-cli

# Login to Azure
az login

# Set default subscription
az account set --subscription "Your-Subscription-ID"

# Install Node.js dependencies
npm run install-all
```

## B2C Integration Changes Required

### 1. Frontend B2C Configuration Updates
Update frontend environment variables for production:

**File: `/frontend/.env.production`** (create this file):
```env
# B2C Configuration
REACT_APP_B2C_TENANT_NAME=your-tenant-name
REACT_APP_B2C_CLIENT_ID=your-client-id
REACT_APP_B2C_USER_FLOW=B2C_1_signupsignin
REACT_APP_B2C_REDIRECT_URI=https://linker-frontend.azurewebsites.net/auth/callback
REACT_APP_LOGOUT_REDIRECT_URI=https://linker-frontend.azurewebsites.net/login

# API Configuration
REACT_APP_API_BASE_URL=https://linker-backend.azurewebsites.net/api
REACT_APP_BACKEND_URL=https://linker-backend.azurewebsites.net
```

### 2. Backend B2C Configuration Updates
Update backend environment variables for production:

**Required Backend Environment Variables:**
```env
# Azure B2C Configuration
AZURE_B2C_TENANT_NAME=your-tenant-name
AZURE_B2C_USER_FLOW=B2C_1_signupsignin
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id

# CORS Configuration
FRONTEND_URL=https://linker-frontend.azurewebsites.net

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/linker

# Security
JWT_SECRET=your-super-secure-jwt-secret

# App Service Configuration
PORT=80
NODE_ENV=production
```

### 3. B2C App Registration Updates
In Azure B2C, update your app registration:

1. **Redirect URIs**: Add production URLs
   - `https://linker-frontend.azurewebsites.net/auth/callback`
   - `https://linker-frontend.azurewebsites.net` (for logout)

2. **CORS Origins**: Add frontend domain
   - `https://linker-frontend.azurewebsites.net`

3. **Implicit Grant**: Ensure Access tokens and ID tokens are enabled

## Azure CLI Deployment Steps

### Step 1: Create Resource Group
```bash
# Create resource group
az group create \
  --name rg-linker-prod \
  --location "East US 2"
```

### Step 2: Create App Service Plan
```bash
# Create App Service Plan (B1 for production, F1 for testing)
az appservice plan create \
  --name asp-linker-prod \
  --resource-group rg-linker-prod \
  --sku B1 \
  --location "East US 2" \
  --is-linux
```

### Step 3: Create Backend App Service
```bash
# Create backend app service
az webapp create \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --plan asp-linker-prod \
  --runtime "NODE:18-lts"

# Configure backend app settings
az webapp config appsettings set \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --settings \
    NODE_ENV=production \
    PORT=80 \
    AZURE_B2C_TENANT_NAME="your-tenant-name" \
    AZURE_B2C_USER_FLOW="B2C_1_signupsignin" \
    AZURE_CLIENT_ID="your-client-id" \
    AZURE_CLIENT_SECRET="your-client-secret" \
    AZURE_TENANT_ID="your-tenant-id" \
    MONGODB_URI="your-mongodb-connection-string" \
    JWT_SECRET="your-jwt-secret" \
    FRONTEND_URL="https://linker-frontend.azurewebsites.net"

# Enable logging
az webapp log config \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --application-logging filesystem \
  --level information
```

### Step 4: Create Frontend App Service
```bash
# Create frontend app service
az webapp create \
  --name linker-frontend \
  --resource-group rg-linker-prod \
  --plan asp-linker-prod \
  --runtime "NODE:18-lts"

# Configure frontend app settings
az webapp config appsettings set \
  --name linker-frontend \
  --resource-group rg-linker-prod \
  --settings \
    NODE_ENV=production \
    PORT=80 \
    REACT_APP_B2C_TENANT_NAME="your-tenant-name" \
    REACT_APP_B2C_CLIENT_ID="your-client-id" \
    REACT_APP_B2C_USER_FLOW="B2C_1_signupsignin" \
    REACT_APP_B2C_REDIRECT_URI="https://linker-frontend.azurewebsites.net/auth/callback" \
    REACT_APP_LOGOUT_REDIRECT_URI="https://linker-frontend.azurewebsites.net/login" \
    REACT_APP_API_BASE_URL="https://linker-backend.azurewebsites.net/api" \
    REACT_APP_BACKEND_URL="https://linker-backend.azurewebsites.net"
```

### Step 5: Configure CORS for Backend
```bash
# Configure CORS to allow frontend domain
az webapp cors add \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --allowed-origins "https://linker-frontend.azurewebsites.net"
```

## Code Changes Required for Production

### 1. Update Backend CORS Configuration
**File: `/backend/src/server.ts`**
```typescript
// Update CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL, 'https://linker-frontend.azurewebsites.net']
    : 'http://localhost:3000',
  credentials: true
}));
```

### 2. Create Frontend Production Build Script
**File: `/frontend/package.json`** - Add build scripts:
```json
{
  "scripts": {
    "build:prod": "REACT_APP_ENV=production npm run build",
    "serve": "npx serve -s build -l 80"
  }
}
```

### 3. Create Backend Production Start Script
**File: `/backend/package.json`** - Ensure production script:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "start:prod": "npm run build && npm start"
  }
}
```

### 4. Create Deployment Scripts

**File: `/deploy-backend.sh`**:
```bash
#!/bin/bash
set -e

echo "Building backend..."
cd backend
npm run build

echo "Installing production dependencies..."
npm ci --only=production

echo "Creating deployment package..."
zip -r ../backend-deploy.zip dist package.json node_modules -x "src/*" "*.ts" "tsconfig.json"

echo "Deploying to Azure App Service..."
az webapp deploy \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --src-path ../backend-deploy.zip \
  --type zip

echo "Backend deployment complete!"
```

**File: `/deploy-frontend.sh`**:
```bash
#!/bin/bash
set -e

echo "Building frontend..."
cd frontend
npm run build

echo "Creating deployment package..."
# Create a simple server.js for serving static files
cat > server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'build')));

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const port = process.env.PORT || 80;
app.listen(port, () => {
  console.log(`Frontend server running on port ${port}`);
});
EOF

# Create package.json for the deployment
cat > deploy-package.json << 'EOF'
{
  "name": "linker-frontend-deploy",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Create deployment zip
zip -r ../frontend-deploy.zip build server.js deploy-package.json

echo "Deploying to Azure App Service..."
az webapp deploy \
  --name linker-frontend \
  --resource-group rg-linker-prod \
  --src-path ../frontend-deploy.zip \
  --type zip

echo "Frontend deployment complete!"
```

## Deployment Process

### 1. Prepare for Deployment
```bash
# Make deploy scripts executable
chmod +x deploy-backend.sh
chmod +x deploy-frontend.sh

# Install dependencies
npm run install-all

# Test builds locally
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
```

### 2. Deploy Backend
```bash
# Deploy backend
./deploy-backend.sh

# Check deployment status
az webapp log tail \
  --name linker-backend \
  --resource-group rg-linker-prod
```

### 3. Deploy Frontend
```bash
# Deploy frontend
./deploy-frontend.sh

# Check deployment status
az webapp log tail \
  --name linker-frontend \
  --resource-group rg-linker-prod
```

### 4. Verify Deployment
```bash
# Test backend health endpoint
curl https://linker-backend.azurewebsites.net/health

# Test frontend
curl https://linker-frontend.azurewebsites.net
```

## Post-Deployment Configuration

### 1. Configure Custom Domains (Optional)
```bash
# Add custom domain for backend
az webapp config hostname add \
  --webapp-name linker-backend \
  --resource-group rg-linker-prod \
  --hostname api.yourdomain.com

# Add custom domain for frontend
az webapp config hostname add \
  --webapp-name linker-frontend \
  --resource-group rg-linker-prod \
  --hostname app.yourdomain.com
```

### 2. Configure SSL Certificates
```bash
# Create managed certificate for backend
az webapp config ssl create \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --hostname api.yourdomain.com

# Create managed certificate for frontend
az webapp config ssl create \
  --name linker-frontend \
  --resource-group rg-linker-prod \
  --hostname app.yourdomain.com
```

### 3. Setup Monitoring and Alerts
```bash
# Enable Application Insights for backend
az extension add --name application-insights

az monitor app-insights component create \
  --app linker-backend-insights \
  --location "East US 2" \
  --resource-group rg-linker-prod \
  --application-type web

# Configure backend to use Application Insights
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app linker-backend-insights \
  --resource-group rg-linker-prod \
  --query instrumentationKey -o tsv)

az webapp config appsettings set \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

## Environment Variables Checklist

### Backend Required Variables:
- [ ] `AZURE_B2C_TENANT_NAME`
- [ ] `AZURE_B2C_USER_FLOW`
- [ ] `AZURE_CLIENT_ID`
- [ ] `AZURE_CLIENT_SECRET`
- [ ] `AZURE_TENANT_ID`
- [ ] `MONGODB_URI`
- [ ] `JWT_SECRET`
- [ ] `FRONTEND_URL`
- [ ] `NODE_ENV=production`
- [ ] `PORT=80`

### Frontend Required Variables:
- [ ] `REACT_APP_B2C_TENANT_NAME`
- [ ] `REACT_APP_B2C_CLIENT_ID`
- [ ] `REACT_APP_B2C_USER_FLOW`
- [ ] `REACT_APP_B2C_REDIRECT_URI`
- [ ] `REACT_APP_LOGOUT_REDIRECT_URI`
- [ ] `REACT_APP_API_BASE_URL`
- [ ] `REACT_APP_BACKEND_URL`
- [ ] `NODE_ENV=production`
- [ ] `PORT=80`

## Security Considerations

### 1. App Service Security
```bash
# Enable HTTPS only
az webapp update \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --https-only true

az webapp update \
  --name linker-frontend \
  --resource-group rg-linker-prod \
  --https-only true

# Configure minimum TLS version
az webapp config set \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --min-tls-version "1.2"

az webapp config set \
  --name linker-frontend \
  --resource-group rg-linker-prod \
  --min-tls-version "1.2"
```

### 2. Network Security
```bash
# Restrict backend access (optional)
az webapp config access-restriction add \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --rule-name "Frontend-Only" \
  --action Allow \
  --ip-address "0.0.0.0/0" \
  --priority 100
```

## Monitoring and Maintenance

### 1. Health Checks
- Backend: `https://linker-backend.azurewebsites.net/health`
- Frontend: `https://linker-frontend.azurewebsites.net`

### 2. Log Monitoring
```bash
# Stream backend logs
az webapp log tail \
  --name linker-backend \
  --resource-group rg-linker-prod

# Stream frontend logs
az webapp log tail \
  --name linker-frontend \
  --resource-group rg-linker-prod
```

### 3. Scaling Configuration
```bash
# Configure auto-scaling for backend
az monitor autoscale create \
  --resource-group rg-linker-prod \
  --resource /subscriptions/{subscription-id}/resourceGroups/rg-linker-prod/providers/Microsoft.Web/serverfarms/asp-linker-prod \
  --name backend-autoscale \
  --min-count 1 \
  --max-count 3 \
  --count 1

az monitor autoscale rule create \
  --resource-group rg-linker-prod \
  --autoscale-name backend-autoscale \
  --scale-out 1 \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale-in 1 \
  --condition "Percentage CPU < 30 avg 5m"
```

## Troubleshooting

### Common Issues:
1. **CORS Errors**: Check FRONTEND_URL environment variable and CORS configuration
2. **B2C Authentication**: Verify redirect URIs in B2C app registration
3. **Database Connection**: Ensure MongoDB connection string is correct and network access is allowed
4. **Build Failures**: Check Node.js version compatibility and dependency versions

### Debug Commands:
```bash
# Check app service status
az webapp show \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --query "state"

# View deployment logs
az webapp log download \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --log-file backend-logs.zip

# Restart app service
az webapp restart \
  --name linker-backend \
  --resource-group rg-linker-prod
```

## Cost Optimization

### 1. App Service Plans
- **Development**: F1 (Free) tier
- **Staging**: B1 (Basic) tier
- **Production**: P1V2 (Premium) tier with auto-scaling

### 2. Monitoring Costs
- Set up billing alerts for the resource group
- Monitor App Service metrics to optimize scaling rules
- Consider using Azure Functions for low-traffic scenarios

## Rollback Strategy

### Quick Rollback Commands:
```bash
# Rollback backend to previous deployment
az webapp deployment list \
  --name linker-backend \
  --resource-group rg-linker-prod

az webapp deploy \
  --name linker-backend \
  --resource-group rg-linker-prod \
  --src-path previous-backend-deploy.zip \
  --type zip

# Rollback frontend to previous deployment
az webapp deploy \
  --name linker-frontend \
  --resource-group rg-linker-prod \
  --src-path previous-frontend-deploy.zip \
  --type zip
```

---

This deployment plan provides a comprehensive approach to deploying your Linker application to Azure App Service with proper B2C integration, security considerations, and operational best practices.