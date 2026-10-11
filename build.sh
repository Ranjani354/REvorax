#!/usr/bin/env bash
# Render build step.
#
# 1. Install Python dependencies.
# 2. Build the React app, then copy the output into backend/static so the
#    FastAPI app can serve it from the same origin as /api.
#
# VITE_API_URL is intentionally NOT set: the browser must call /api on
# whatever host served the page (works on desktop and mobile, any network).
set -euo pipefail

echo "==> Installing Python dependencies"
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

echo "==> Building frontend"
cd frontend
npm ci
npm run build
cd ..

echo "==> Copying frontend build into backend/static"
rm -rf backend/static
mkdir -p backend/static
cp -r frontend/dist/. backend/static/

echo "==> Build complete"
ls -la backend/static
