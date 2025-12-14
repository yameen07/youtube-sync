#!/bin/bash

# Build and test script for YouTube Sync
# This builds the client and starts the server to test the production build locally

echo "🔨 Building client..."
cd client
npm install
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""
echo "🚀 Starting server..."
echo "   The app will be available at: http://localhost:8080"
echo "   Press Ctrl+C to stop"
echo ""

cd ../server
npm install
npm start

