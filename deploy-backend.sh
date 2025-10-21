#!/bin/bash
set -e

echo "Building backend..."
cd backend
npm install
npm run build

echo "Installing production dependencies..."
rm -rf node_modules
npm ci --only=production

echo "Creating deployment package..."
zip -r ../backend-deploy.zip dist package.json node_modules -x "src/*" "*.ts" "tsconfig.json"

echo "Deploying to Azure App Service..."
az webapp deploy \
  --name linker-backend \
  --resource-group linker-rg \
  --src-path ../backend-deploy.zip \
  --type zip

echo "Backend deployment complete!"

rm ../backend-deploy.zip