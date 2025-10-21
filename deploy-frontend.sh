#!/bin/bash
set -e

echo "Building frontend..."
cd frontend
npm install
NODE_ENV=production npm run build

echo "Creating deployment package..."
# Create temporary directory for deployment files
mkdir -p ../frontend-deploy-temp
cd ../frontend-deploy-temp

# Copy the build directory
cp -r ../frontend/build .

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
cat > package.json << 'EOF'
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

# Install Express dependency
npm install --production

# Create deployment zip
zip -r ../frontend-deploy.zip build server.js package.json node_modules

# Clean up temp directory
cd ..
rm -rf frontend-deploy-temp

echo "Deploying to Azure App Service..."
az webapp deploy \
  --name linker-frontend \
  --resource-group linker-rg \
  --src-path frontend-deploy.zip \
  --type zip

rm frontend-deploy.zip

echo "Frontend deployment complete!"