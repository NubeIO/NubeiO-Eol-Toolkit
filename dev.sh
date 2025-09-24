#!/bin/bash

# FGA Simulator Development Script

echo "🚀 Starting FGA Simulator Development Environment"
echo ""

# Check if Wails is installed
if ! command -v wails &> /dev/null; then
    echo "❌ Wails CLI not found. Installing..."
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
else
    echo "✅ Wails CLI found"
fi

# Check if dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install
    cd ..
else
    echo "✅ Frontend dependencies installed"
fi

# Run in development mode
echo ""
echo "🔥 Starting development server..."
echo "   - Backend: Go with Wails"
echo "   - Frontend: React with Tailwind CSS"
echo "   - Hot reload enabled"
echo ""

wails dev
