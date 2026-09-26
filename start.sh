#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$DIR/.tools/node/bin:/Users/avijeet/.local/bin:$PATH"

echo "=================================================="
echo " Starting School Management System SaaS"
echo "=================================================="

# Kill any existing processes on 4000 or 5173
pkill -f "tsx watch src/server.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
lsof -ti :4000 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
lsof -ti :5174 | xargs kill -9 2>/dev/null || true
lsof -ti :5175 | xargs kill -9 2>/dev/null || true
sleep 1

# Start backend
echo "[1/2] Starting Backend API on http://127.0.0.1:4000..."
nohup npm --workspace=packages/backend run dev > "$DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# Start frontend
echo "[2/2] Starting Frontend on http://127.0.0.1:5173..."
nohup npm --workspace=packages/frontend run dev > "$DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

sleep 2

echo ""
echo "=================================================="
echo " SUCCESS: Services are live and running!"
echo "=================================================="
echo " - Frontend Web App: http://localhost:5173"
echo " - Backend API:      http://localhost:4000"
echo " - Health Endpoint:  http://localhost:4000/health"
echo ""
echo " Test Personas (Password for all: password123):"
echo "  1. School A Director:     rajesh.sharma"
echo "  2. School A Branch Admin: sunita.rao"
echo "  3. School A Teacher:      vikram.verma"
echo "  4. School B Director:     anita.desai"
echo "  5. SaaS Super Admin:      superadmin"
echo "=================================================="
