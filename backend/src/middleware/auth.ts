import jwt, { JwtPayload } from 'jsonwebtoken';
import express from 'express';
import type { AuthenticatedRequest } from '../types/auth';

// Define the types from Express
type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;

// Re-export the type for convenience
export type { AuthenticatedRequest };

const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ 
        message: 'Access denied. No token provided.' 
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload & {
      userId?: string;
      id?: string;
      azureId: string;
      email: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      role: string;
      roles: string[];
      permissions: Array<{ resource: string; actions: string[] }>;
      preferences?: {
        theme?: 'light' | 'dark';
        timezone?: string;
      };
    };

    const resolvedId = decoded.userId || decoded.id;
    if (!resolvedId) {
      throw new Error('Token missing user identifier');
    }

    (req as AuthenticatedRequest).user = {
      id: resolvedId,
      userId: decoded.userId,
      azureId: decoded.azureId,
      email: decoded.email,
      name: decoded.name,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      role: decoded.role,
      roles: decoded.roles,
      permissions: decoded.permissions,
      preferences: decoded.preferences,
      iat: decoded.iat as number,
      exp: decoded.exp as number
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ 
        message: 'Token expired' 
      });
      return;
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        message: 'Invalid token' 
      });
      return;
    }
    
    res.status(500).json({ 
      message: 'Authentication error' 
    });
  }
};

export default authMiddleware;