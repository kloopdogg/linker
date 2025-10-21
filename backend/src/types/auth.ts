import express from 'express';

export interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    userId?: string;
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
    iat: number;
    exp: number;
  };
}