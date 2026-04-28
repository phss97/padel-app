#!/bin/bash
set -e

echo "🔍 Pre-deployment checks"
echo "========================"

# Check if .env exists
echo -n "✓ .env file exists... "
[ -f .env ] && echo "PASS (found, should NOT be committed)" || echo "WARN (missing, create from .env.example)"

# Check if node_modules is gitignored
echo -n "✓ node_modules gitignored... "
grep -q "node_modules" .gitignore && echo "PASS" || echo "FAIL"

# Check if .env is gitignored
echo -n "✓ .env gitignored... "
grep -q "^\.env$" .gitignore && echo "PASS" || echo "FAIL"

# Check if build passes
echo -n "✓ Build passes... "
if npm run build > /dev/null 2>&1; then echo "PASS"; else echo "FAIL"; fi

echo ""
echo "Done! If all PASS, you're ready to deploy."
