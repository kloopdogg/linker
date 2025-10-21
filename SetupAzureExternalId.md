# Azure External ID Setup Guide for Linker App

This guide will walk you through setting up Azure External ID for authentication in the Linker URL shortener application.

## Prerequisites

- Azure subscription with appropriate permissions
- Access to Azure Portal (portal.azure.com)
- Application deployed or ready for deployment

## Step 1: Create an Azure External ID Tenant

1. **Navigate to Azure Portal**
   - Go to [portal.azure.com](https://portal.azure.com)
   - Sign in with your Azure account

2. **Create External ID Resource**
   - Search for "External Identities" in the search bar
   - Click on "External Identities"
   - Click "Create" or "Add external identity provider"
   - Select "Azure AD B2C" or "External ID" depending on your needs

3. **Configure Tenant Settings**
   - Choose your subscription
   - Create a new resource group or select existing one
   - Choose a unique domain name (e.g., `linker-auth.onmicrosoft.com`)
   - Select your preferred region
   - Click "Review + Create" and then "Create"

## Step 2: Register Your Application

1. **Navigate to App Registrations**
   - In Azure Portal, go to "Azure Active Directory" 
   - Click on "App registrations"
   - Click "New registration"

2. **Configure Application Registration**
   - **Name**: `Linker URL Shortener`
   - **Supported account types**: Choose based on your needs:
     - "Accounts in this organizational directory only" (Single tenant)
     - "Accounts in any organizational directory" (Multi-tenant)
     - "Accounts in any organizational directory and personal Microsoft accounts" (Multi-tenant + personal)
   - **Redirect URI**: 
     - Type: Web
     - URL: `http://localhost:3000/auth/callback` (for development)
     - URL: `https://your-domain.com/auth/callback` (for production)

3. **Complete Registration**
   - Click "Register"
   - Note down the **Application (client) ID** and **Directory (tenant) ID**

## Step 3: Configure Application Settings

### 3.1 Authentication Settings

1. **Navigate to Authentication**
   - In your app registration, click "Authentication"
   - Add additional redirect URIs if needed:
     - `http://localhost:3000/auth/callback` (development)
     - `https://your-production-domain.com/auth/callback`
   - Under "Front-channel logout URL" (optional):
     - `http://localhost:3000/logout`
     - `https://your-production-domain.com/logout`

2. **Configure Token Settings**
   - Under "Implicit grant and hybrid flows":
     - ✅ Check "Access tokens"
     - ✅ Check "ID tokens"
   - Under "Advanced settings":
     - ✅ Check "Allow public client flows" (if using mobile/desktop apps)

### 3.2 API Permissions

1. **Navigate to API Permissions**
   - Click "API permissions"
   - Click "Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions"
   - Add the following permissions:
     - `User.Read` (to read user profile)
     - `openid` (for OpenID Connect)
     - `profile` (for basic profile info)
     - `email` (for email address)

2. **Grant Admin Consent**
   - Click "Grant admin consent for [your tenant]"
   - Confirm the action

### 3.3 Certificates & Secrets

1. **Create Client Secret**
   - Navigate to "Certificates & secrets"
   - Click "New client secret"
   - Add description: "Linker App Secret"
   - Choose expiration (recommended: 12 months or 24 months)
   - Click "Add"
   - **Important**: Copy the secret value immediately (you won't see it again)

## Step 4: Configure Application Environment Variables

Create or update your `.env` file with the following variables:

```env
# Azure External ID Configuration
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/linker
MONGODB_URI_PROD=mongodb+srv://username:password@cluster.mongodb.net/linker

# Application Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### Production Environment Variables

For production, update the values:

```env
AZURE_REDIRECT_URI=https://your-production-domain.com/auth/callback
FRONTEND_URL=https://your-production-domain.com
NODE_ENV=production
```

## Step 5: Configure User Flow (Optional for B2C)

If you're using Azure AD B2C for more advanced user management:

1. **Create User Flow**
   - Navigate to your B2C tenant
   - Click "User flows"
   - Click "New user flow"
   - Select "Sign up and sign in"
   - Choose recommended version
   - Configure identity providers (Microsoft Account, Google, etc.)

2. **Configure Attributes**
   - User attributes to collect: Email, Display Name
   - Application claims to return: Email, Display Name, Object ID

## Step 6: Test the Authentication Flow

### 6.1 Start Your Application

1. **Backend (from `/backend` directory)**:
   ```bash
   npm install
   npm run dev
   ```

2. **Frontend (from `/frontend` directory)**:
   ```bash
   npm install
   npm start
   ```

### 6.2 Test Authentication

1. Navigate to `http://localhost:3000`
2. Click on login/sign in
3. You should be redirected to Microsoft login page
4. Sign in with your Microsoft account
5. Grant permissions when prompted
6. You should be redirected back to your application

## Step 7: Security Best Practices

### 7.1 Environment Security

- Never commit `.env` files to version control
- Use Azure Key Vault for production secrets
- Rotate client secrets regularly
- Use different tenants for development/staging/production

### 7.2 Application Security

- Implement proper CORS settings
- Use HTTPS in production
- Validate tokens server-side
- Implement proper session management
- Add rate limiting for auth endpoints

### 7.3 Monitoring and Logging

- Enable Azure AD sign-in logs
- Monitor authentication failures
- Set up alerts for suspicious activities
- Log authentication events in your application

## Step 8: Deployment Considerations

### 8.1 Azure App Service

If deploying to Azure App Service:

1. **Configure App Settings**
   - Add all environment variables as App Settings
   - Use Key Vault references for secrets

2. **Configure Custom Domain**
   - Add your custom domain
   - Update redirect URIs in Azure AD
   - Enable HTTPS

### 8.2 Other Hosting Platforms

For other platforms (Vercel, Netlify, etc.):

1. Add environment variables through platform settings
2. Ensure redirect URIs match your domain
3. Configure HTTPS properly

## Troubleshooting Common Issues

### Issue 1: "AADSTS50011: The reply URL specified in the request does not match"

**Solution**: Ensure redirect URI in Azure AD matches exactly what your app sends
- Check for trailing slashes
- Verify HTTP vs HTTPS
- Confirm the path is correct

### Issue 2: "AADSTS700016: Application not found in directory"

**Solution**: 
- Verify client ID is correct
- Ensure you're using the right tenant ID
- Check if app registration exists

### Issue 3: "Invalid client secret"

**Solution**:
- Generate a new client secret
- Ensure secret hasn't expired
- Verify secret is correctly set in environment variables

### Issue 4: "Insufficient privileges to complete the operation"

**Solution**:
- Grant admin consent for required permissions
- Ensure user has necessary roles
- Check API permissions configuration

## Additional Resources

- [Azure AD Documentation](https://docs.microsoft.com/en-us/azure/active-directory/)
- [MSAL.js Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)
- [Azure AD B2C Documentation](https://docs.microsoft.com/en-us/azure/active-directory-b2c/)

## Support

If you encounter issues:

1. Check Azure AD sign-in logs
2. Review application logs
3. Verify all configuration steps
4. Test with a simple authentication flow first
5. Consult Microsoft documentation for specific error codes

---

**Note**: Keep this document updated when making changes to your authentication configuration. Always test changes in a development environment before applying to production.