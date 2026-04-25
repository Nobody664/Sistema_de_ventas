#!/bin/bash
set -e

echo "Building frontend for production..."
cd frontend
npm install
npm run build
echo "Build complete!"