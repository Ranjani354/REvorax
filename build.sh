#!/usr/bin/env bash
set -e

echo "==> Installing Python dependencies"
pip install -r backend/requirements.txt

echo "==> Building frontend"
cd frontend && npm install && npm run build && cd ..

echo "==> Copying frontend to backend/static"
rm -rf backend/static && mkdir -p backend/static
cp -r frontend/dist/* backend/static/

echo "==> Seeding database"
python backend/seed.py

echo "==> Build complete"
ls -la backend/static
