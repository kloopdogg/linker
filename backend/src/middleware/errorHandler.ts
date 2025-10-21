import express from 'express';
import mongoose from 'mongoose';

// Define the types from Express
type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;

interface CustomError extends Error {
  status?: number;
  code?: number;
  errors?: Record<string, { message: string }>;
}

const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err);

  // Default error
  let error: { message: string; status: number } = {
    message: err.message || 'Server Error',
    status: 500
  };

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = {
      message: 'Resource not found',
      status: 404
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    error = {
      message: 'Duplicate field value entered',
      status: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message,
      status: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      status: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      status: 401
    };
  }

  res.status(error.status).json({
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;