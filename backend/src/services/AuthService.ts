import { ConfidentialClientApplication } from '@azure/msal-node';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { User, type IUserPreferences } from '../models/index';
import RoleService from './RoleService';
import { Types } from 'mongoose';

// Define the AuthenticationResult interface ourselves since it might not be exported
interface AuthenticationResult {
  accessToken?: string;
  idToken?: string;
  account?: any;
  scopes?: string[];
  authority?: string;
  correlationId?: string;
  fromCache?: boolean;
  expiresOn?: Date | null;
  extExpiresOn?: Date | null;
  familyId?: string;
  refreshToken?: string;
  state?: string;
  uniqueId?: string;
  tokenType?: string;
}

interface AzureUserInfo {
  id: string;
  email?: string;
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  emails?: string[];
  sub?: string;
  oid?: string;
}

interface AuthResult {
  token: string;
  user: {
    id: string;
    azureId: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    role: string;
    roles: string[];
    permissions: Array<{ resource: string; actions: string[] }>;
    preferences: IUserPreferences;
    createdAt: Date;
  };
}

interface StateData {
  timestamp: number;
  nonce: string;
}

interface MSALConfig {
  auth: {
    clientId: string;
    clientSecret: string;
    authority: string;
  };
}

class AuthService {
  private msalConfig: MSALConfig;
  private msalClient: ConfidentialClientApplication;
  private jwksUri: string;
  private isB2C: boolean;
  private jwksClientInstance: jwksClient.JwksClient;
  private roleService: RoleService;

  constructor() {
    this.roleService = new RoleService();
    // Check if we're using B2C or regular Azure AD
    const isB2C = Boolean(process.env.AZURE_B2C_TENANT_NAME && process.env.AZURE_B2C_USER_FLOW);
    
    if (isB2C) {
      // B2C Configuration
      this.msalConfig = {
        auth: {
          clientId: process.env.AZURE_CLIENT_ID!,
          clientSecret: process.env.AZURE_CLIENT_SECRET!,
          authority: `https://${process.env.AZURE_B2C_TENANT_NAME}.b2clogin.com/${process.env.AZURE_B2C_TENANT_NAME}.onmicrosoft.com/${process.env.AZURE_B2C_USER_FLOW}`
        }
      };
      
      // B2C JWKS endpoint for token validation
      this.jwksUri = `https://${process.env.AZURE_B2C_TENANT_NAME}.b2clogin.com/${process.env.AZURE_B2C_TENANT_NAME}.onmicrosoft.com/${process.env.AZURE_B2C_USER_FLOW}/discovery/v2.0/keys`;
    } else {
      // Regular Azure AD Configuration
      this.msalConfig = {
        auth: {
          clientId: process.env.AZURE_CLIENT_ID!,
          clientSecret: process.env.AZURE_CLIENT_SECRET!,
          authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
        }
      };
      
      // Regular Azure AD JWKS endpoint
      this.jwksUri = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`;
    }
    
    this.msalClient = new ConfidentialClientApplication(this.msalConfig);
    this.isB2C = isB2C;
    
    // Setup JWKS client for token validation
    this.jwksClientInstance = jwksClient({
      jwksUri: this.jwksUri,
      requestHeaders: {},
      timeout: 30000
    });
  }

  async validateAzureToken(token: string): Promise<AzureUserInfo> {
    try {
      if (this.isB2C) {
        return await this.validateB2CToken(token);
      } else {
        return await this.validateAzureADToken(token);
      }
    } catch (error) {
      throw new Error(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateB2CToken(token: string): Promise<AzureUserInfo> {
    try {
      console.log('=== B2C Token Validation ===');
      console.log('Token (first 50 chars):', token.substring(0, 50) + '...');
      
      // Decode the token to get the header
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded) {
        throw new Error('Invalid token format');
      }

      console.log('Token header:', decoded.header);
      console.log('Token payload issuer:', (decoded.payload as any).iss);
      console.log('Expected issuer:', `https://${process.env.AZURE_B2C_TENANT_NAME}.b2clogin.com/${process.env.AZURE_B2C_TENANT_NAME}.onmicrosoft.com/${process.env.AZURE_B2C_USER_FLOW}/v2.0/`);

      // Get the signing key
      const getKey = (header: jwt.JwtHeader, callback: (err: Error | null, key?: string) => void) => {
        this.jwksClientInstance.getSigningKey(header.kid!, (err, key) => {
          if (err) {
            console.error('Error getting signing key:', err);
            callback(err);
            return;
          }
          const signingKey = key!.getPublicKey();
          console.log('Got signing key for kid:', header.kid);
          callback(null, signingKey);
        });
      };

      // Verify the token - B2C can use either tenant name or tenant ID in issuer
      const expectedIssuer1 = `https://${process.env.AZURE_B2C_TENANT_NAME}.b2clogin.com/${process.env.AZURE_B2C_TENANT_NAME}.onmicrosoft.com/${process.env.AZURE_B2C_USER_FLOW}/v2.0/`;
      const expectedIssuer2 = `https://${process.env.AZURE_B2C_TENANT_NAME}.b2clogin.com/${process.env.AZURE_TENANT_ID}/v2.0/`;
      
      console.log('Expected issuer 1 (tenant name):', expectedIssuer1);
      console.log('Expected issuer 2 (tenant ID):', expectedIssuer2);

      const verifiedToken = await new Promise<any>((resolve, reject) => {
        jwt.verify(token, getKey, {
          audience: process.env.AZURE_CLIENT_ID,
          issuer: [expectedIssuer1, expectedIssuer2], // Accept either format
          algorithms: ['RS256']
        }, (err: any, decoded: any) => {
          if (err) {
            console.error('JWT verification failed:', err);
            reject(err);
          } else {
            console.log('JWT verification successful');
            resolve(decoded);
          }
        });
      });

      console.log('Verified token payload:', {
        sub: verifiedToken.sub,
        oid: verifiedToken.oid,
        emails: verifiedToken.emails,
        email: verifiedToken.email,
        name: verifiedToken.name,
        given_name: verifiedToken.given_name,
        family_name: verifiedToken.family_name
      });

      // Extract user info from B2C token
      const userInfo: AzureUserInfo = {
        id: verifiedToken.sub || verifiedToken.oid,
        email: verifiedToken.emails?.[0] || verifiedToken.email,
        displayName: verifiedToken.name || verifiedToken.given_name + ' ' + verifiedToken.family_name,
        given_name: verifiedToken.given_name,
        family_name: verifiedToken.family_name,
        userPrincipalName: verifiedToken.emails?.[0] || verifiedToken.email
      };

      console.log('Extracted user info:', userInfo);
      return userInfo;
    } catch (error) {
      console.error('B2C token validation error details:', error);
      throw new Error(`B2C token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateAzureADToken(accessToken: string): Promise<AzureUserInfo> {
    try {
      // For regular Azure AD, validate against Graph API
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      const userInfo = await response.json() as AzureUserInfo;
      return userInfo;
    } catch (error) {
      throw new Error(`Azure AD token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async authenticateUser(azureUserInfo: AzureUserInfo): Promise<AuthResult> {
    try {
      console.log('Authenticating user with info:', azureUserInfo);
      
      // Initialize default roles if needed (do this once on startup)
      await this.roleService.initializeDefaultRoles();
      
      // Find or create user
      let user = await User.findOne({ azureId: azureUserInfo.id });
      
      if (!user) {
        // Create new user
        const userEmail = azureUserInfo.mail || azureUserInfo.userPrincipalName || azureUserInfo.email;
        const finalEmail = userEmail || `${azureUserInfo.id}@b2c.temp`; // Temporary fallback until B2C config updates
        
        console.log('Creating new user with email:', finalEmail);
        
        try {
          user = new User({
            azureId: azureUserInfo.id,
            email: finalEmail,
            name: azureUserInfo.displayName || 'B2C User',
            firstName: azureUserInfo.given_name,
            lastName: azureUserInfo.family_name,
            role: 'user'
          });
          await user.save();
          console.log('Created new user:', user.email);
          
          // Assign default role to new user
          await this.roleService.assignDefaultRole(user._id as Types.ObjectId);
          console.log('Assigned default role to new user');
        } catch (createError: any) {
          // Handle duplicate key error - another request might have created the user
          if (createError.code === 11000) {
            console.log('User already exists, fetching existing user...');
            user = await User.findOne({ azureId: azureUserInfo.id });
            if (!user) {
              throw new Error('User creation race condition - user not found after duplicate error');
            }
          } else {
            throw createError;
          }
        }
      } else {
        // Update existing user info
        user.name = azureUserInfo.displayName || user.name;
        if (azureUserInfo.given_name) user.firstName = azureUserInfo.given_name;
        if (azureUserInfo.family_name) user.lastName = azureUserInfo.family_name;
        const userEmail = azureUserInfo.mail || azureUserInfo.userPrincipalName || azureUserInfo.email;
        if (userEmail && !user.email.endsWith('@b2c.temp')) {
          user.email = userEmail;
        } else if (userEmail && user.email.endsWith('@b2c.temp')) {
          // Update from temp email to real email
          console.log('Updating user email from temp to real email:', userEmail);
          user.email = userEmail;
        }
        user.lastLogin = new Date();
        await user.save();
        console.log('Updated existing user:', user.email);
      }

  // Get user roles and permissions
      const roleSummary = await this.roleService.getUserRoleSummary(user._id as Types.ObjectId);
      console.log('User role summary:', roleSummary);

      // Ensure we serialize nested preference schema to plain object
      const rawPreferences = user.preferences
        ? (typeof (user.preferences as any).toObject === 'function'
          ? (user.preferences as any).toObject()
          : user.preferences)
        : undefined;
      const userPreferences = rawPreferences || { theme: 'light', timezone: 'UTC' };

      // Generate our own JWT token for the user
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
      }

      const userId = (user._id as Types.ObjectId).toString();

      const payload = {
        userId,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role, // Keep legacy role for backward compatibility
        roles: roleSummary.roles, // New role system
        permissions: roleSummary.permissions, // User permissions
        azureId: user.azureId,
        preferences: userPreferences
      };

      const token = jwt.sign(payload, jwtSecret, {
        expiresIn: '7d'
      });

      console.log('Generated JWT token for user:', user.email);

      const userResult = {
        id: userId,
        azureId: user.azureId,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: roleSummary.roles,
        permissions: roleSummary.permissions,
        preferences: userPreferences,
        createdAt: user.createdAt,
        ...(user.firstName && { firstName: user.firstName }),
        ...(user.lastName && { lastName: user.lastName })
      };

      return {
        token,
        user: userResult
      };
    } catch (error) {
      console.error('User authentication failed:', error);
      throw new Error('Failed to authenticate user');
    }
  }

  generateAuthUrl(): string {
    const authUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?` +
      `client_id=${process.env.AZURE_CLIENT_ID}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(process.env.AZURE_REDIRECT_URI!)}&` +
      `scope=${encodeURIComponent('openid profile email User.Read')}&` +
      `state=${this.generateState()}`;
    
    return authUrl;
  }

  private generateState(): string {
    return Buffer.from(JSON.stringify({
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15)
    })).toString('base64');
  }

  async exchangeCodeForToken(code: string, state: string): Promise<AuthenticationResult> {
    try {
      // Validate state parameter
      const stateData: StateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const now = Date.now();
      
      if (now - stateData.timestamp > 10 * 60 * 1000) { // 10 minutes
        throw new Error('State parameter expired');
      }

      const tokenRequest = {
        code,
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        redirectUri: process.env.AZURE_REDIRECT_URI!,
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);
      if (!response) {
        throw new Error('No token received from Azure');
      }
      return response;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthenticationResult> {
    try {
      const refreshRequest = {
        refreshToken,
        scopes: ['openid', 'profile', 'email', 'User.Read']
      };

      const response = await this.msalClient.acquireTokenByRefreshToken(refreshRequest);
      if (!response) {
        throw new Error('No token received from Azure refresh');
      }
      return response;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AuthService;