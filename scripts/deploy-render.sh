#!/bin/bash
# Quick deploy script for Render.com
# Usage: ./scripts/deploy-render.sh

set -e

echo "🚀 Starting deploy process..."

# Step 1: Verify build
echo "📦 Running build..."
npm run build

# Step 2: Check for secrets in dist
echo "🔍 Checking dist for secrets..."
if grep -r "eyJhbGci" dist/ 2>/dev/null; then
  echo "❌ Found potential secrets in dist! Aborting."
  exit 1
fi

# Step 3: Commit dist (optional - Render builds from source)
echo "✅ Build clean. Ready for Render deploy."
echo ""
echo "Next steps:"
echo "1. Push to GitHub: git push origin main"
echo "2. Go to https://dashboard.render.com"
echo "3. Create new Static Site from this repo"
echo "4. Set environment variables from .env"
