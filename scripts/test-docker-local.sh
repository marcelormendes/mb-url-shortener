#!/bin/bash

# Local CI Docker Test Script
# This script replicates what GitHub Actions CI does for Docker testing

set -e

echo "🚀 Starting local Docker CI test..."

# Get current git commit hash (like CI does)
COMMIT_SHA=$(git rev-parse HEAD)
IMAGE_TAG="url-shortener:${COMMIT_SHA}"

echo "📦 Building Docker image: ${IMAGE_TAG}"

# Build Docker image (same as CI)
docker build -t "${IMAGE_TAG}" .

echo "🧪 Testing Docker image..."

# Start the container (same as CI)
docker run -d --name url-shortener-test \
  -p 3000:3000 -p 3001:3001 \
  -e NODE_ENV=production \
  "${IMAGE_TAG}"

# Wait for the service to start and check logs
sleep 5
echo "📋 Container logs:"
docker logs url-shortener-test

# Wait a bit more for full startup
sleep 10

# Check if container is still running
if ! docker ps | grep -q url-shortener-test; then
  echo "❌ Container is not running. Final logs:"
  docker logs url-shortener-test
  docker rm -f url-shortener-test 2>/dev/null || true
  exit 1
fi

echo "✅ Container is running successfully"

# Health check with retry (same as CI)
echo "🏥 Running health checks..."
for i in {1..6}; do
  if curl -f http://localhost:3000/documentation; then
    echo "✅ Health check passed"
    break
  else
    echo "⏳ Health check attempt $i failed, retrying in 5 seconds..."
    if [ $i -eq 6 ]; then
      echo "❌ Health check failed after 6 attempts"
      docker logs url-shortener-test
      docker stop url-shortener-test
      docker rm url-shortener-test
      exit 1
    fi
    sleep 5
  fi
done

# Test a basic API call
echo "🔗 Testing URL shortening API..."
SHORTEN_RESPONSE=$(curl -s -X POST http://localhost:3000/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/test"}' || echo "FAILED")

if [[ "$SHORTEN_RESPONSE" == *"shortened successfully"* ]]; then
  echo "✅ API test passed"
else
  echo "❌ API test failed: $SHORTEN_RESPONSE"
  docker logs url-shortener-test
  docker stop url-shortener-test
  docker rm url-shortener-test
  exit 1
fi

# Clean up
echo "🧹 Cleaning up..."
docker stop url-shortener-test
docker rm url-shortener-test

echo "🎉 All Docker tests passed! Image is ready for CI/CD."
echo "💡 You can now safely push your changes to trigger CI."