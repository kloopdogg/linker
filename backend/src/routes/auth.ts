import express from 'express';
import { body, validationResult } from 'express-validator';
import AuthService from '../services/AuthService';
import authMiddleware from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/auth';
import { User } from '../models/index';

// Define the types from Express
type Request = express.Request;
type Response = express.Response;

const router = express.Router();
const authService = new AuthService();

// Get Azure AD login URL
router.get('/login', (req: Request, res: Response) => {
  try {
    const authUrl = authService.generateAuthUrl();
    
    res.json({
      success: true,
      data: {
        authUrl,
        message: 'Redirect user to this URL to authenticate with Azure AD'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to generate auth URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Handle Azure AD callback
router.post('/callback', [
  body('code').notEmpty().withMessage('Authorization code is required'),
  body('state').notEmpty().withMessage('State parameter is required')
], async (req: Request, res: Response): Promise<void> => {
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

    const { code, state } = req.body;

    // Exchange code for tokens
    const tokenResponse = await authService.exchangeCodeForToken(code, state);
    
    // Validate token and get user info
    const azureUserInfo = await authService.validateAzureToken(tokenResponse.accessToken!);
    
    // Authenticate user and generate JWT
    const authResult = await authService.authenticateUser(azureUserInfo);

    res.json({
      success: true,
      message: 'Authentication successful',
      data: authResult
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(401).json({
      success: false,
      message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Handle direct Azure token validation (for SPAs)
router.post('/azure-token', [
  body('accessToken').notEmpty().withMessage('Access token is required')
], async (req: Request, res: Response): Promise<void> => {
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

    const { accessToken } = req.body;

    // Validate Azure token
    const azureUserInfo = await authService.validateAzureToken(accessToken);
    
    // Authenticate user and generate JWT
    const authResult = await authService.authenticateUser(azureUserInfo);

    res.json({
      success: true,
      message: 'Authentication successful',
      data: authResult
    });
  } catch (error) {
    console.error('Azure token validation error:', error);
    res.status(401).json({
      success: false,
      message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Get current user profile (alias for /me to match frontend expectations)
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    res.json({
      success: true,
      data: {
        id: user?.id,
        azureId: user?.azureId,
        email: user?.email,
        name: user?.name,
        firstName: user?.firstName,
        lastName: user?.lastName,
        role: user?.role,
        roles: user?.roles,
        permissions: user?.permissions,
        preferences: user?.preferences
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Get current user profile
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    res.json({
      success: true,
      data: {
        id: user?.id,
        azureId: user?.azureId,
        email: user?.email,
        name: user?.name,
        firstName: user?.firstName,
        lastName: user?.lastName,
        role: user?.role,
        roles: user?.roles,
        permissions: user?.permissions,
        preferences: user?.preferences
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Validate token endpoint (alias for azure-token to match frontend expectations)
router.post('/validate-token', [
  body('accessToken').notEmpty().withMessage('Access token is required')
], async (req: Request, res: Response): Promise<void> => {
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

    const { accessToken } = req.body;

    // Validate Azure token
    const azureUserInfo = await authService.validateAzureToken(accessToken);
    
    // Authenticate user and generate JWT
    const authResult = await authService.authenticateUser(azureUserInfo);

    res.json({
      success: true,
      message: 'Authentication successful',
      data: authResult
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({
      success: false,
      message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Logout (invalidate token on frontend)
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Update user preferences (e.g., theme)
router.patch('/preferences',
  authMiddleware,
  [
    body('theme')
      .optional()
      .isIn(['light', 'dark'])
      .withMessage('Theme must be either "light" or "dark"'),
  ],
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

      const authUser = (req as AuthenticatedRequest).user;
      const userId = authUser?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const { theme } = req.body as { theme?: 'light' | 'dark' };

      if (!theme) {
        res.status(400).json({
          success: false,
          message: 'No preference updates provided'
        });
        return;
      }

      const userDoc = await User.findById(userId);
      if (!userDoc) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      userDoc.preferences = {
        ...(typeof (userDoc.preferences as any)?.toObject === 'function'
          ? (userDoc.preferences as any).toObject()
          : userDoc.preferences || {}),
        theme,
      };

      await userDoc.save();

      const updatedPreferences = userDoc.preferences;
      if (authUser) {
        authUser.preferences = updatedPreferences;
      }

      res.json({
        success: true,
        message: 'Preferences updated',
        data: {
          id: userDoc._id,
          azureId: userDoc.azureId,
          email: userDoc.email,
          name: userDoc.name,
          firstName: userDoc.firstName,
          lastName: userDoc.lastName,
          role: authUser?.role ?? userDoc.role,
          roles: authUser?.roles ?? [],
          permissions: authUser?.permissions ?? [],
          preferences: updatedPreferences,
          createdAt: userDoc.createdAt,
        }
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update preferences'
      });
    }
  }
);

export default router;