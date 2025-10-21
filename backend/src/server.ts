import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth';
import urlRoutes from './routes/urls';
import analyticsRoutes from './routes/analytics';
import redirectRoutes from './routes/redirect';
import adminRoutes from './routes/admin';

// Import middleware
import authMiddleware from './middleware/auth';
import errorHandler from './middleware/errorHandler';

// Import utilities
import initializeRoleSystem from './utils/initializeRoles';
import JobScheduler from './jobs/scheduler';

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Trust proxy for Azure App Service
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
const corsOrigin: string = process.env.FRONTEND_URL || '';

app.use(cors({
  origin: [corsOrigin],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/urls', authMiddleware, urlRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/admin', adminRoutes); // Admin routes include their own auth middleware

// Public redirect route (no auth required)
app.use('/', redirectRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler - API only
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested resource does not exist',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/linker';

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Initialize role system once the database is ready
    await initializeRoleSystem();

    // Start scheduled jobs
    JobScheduler.start();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Database connection or role initialization error:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  JobScheduler.stop();
  mongoose.connection.close(false).then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

export default app;