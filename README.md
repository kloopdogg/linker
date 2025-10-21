# URL Shortener Service (Linker)

A comprehensive URL shortening service with QR code generation and detailed analytics tracking.

## Features

- **URL Shortening**: Generate short URLs with 6-character alphanumeric codes
- **QR Code Generation**: Automatic QR code creation for each short URL
- **Analytics Tracking**: Comprehensive tracking including:
  - Device type and browser information
  - Geographic location (country-based)
  - Time-based analytics with heatmaps
  - Click-through rates and usage patterns
- **Admin Dashboard**: React-based admin interface with charts and reports
- **Azure AD Integration**: Secure authentication using Azure External ID
- **Multi-instance Ready**: Designed for Azure App Service deployment

## Project Structure

```
linker/
├── backend/          # Node.js Express API server
│   ├── models/       # MongoDB schemas
│   ├── routes/       # API endpoints
│   ├── middleware/   # Authentication & validation
│   ├── services/     # Business logic
│   └── utils/        # Helper functions
├── frontend/         # React admin dashboard
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
└── README.md
```

## Getting Started

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure environment variables
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Environment Variables

Create `.env` file in the backend directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/linker
JWT_SECRET=your-jwt-secret
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
BASE_URL=https://link.uvenu.com
```

## Deployment

This application is designed for deployment on Azure App Service with MongoDB Atlas.

## Analytics Features

- Real-time click tracking
- Geographic distribution reports
- Device and browser analytics
- Time-based usage patterns
- Export capabilities for all reports