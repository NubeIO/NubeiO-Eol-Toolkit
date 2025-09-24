#!/bin/bash

# FGA Simulator Launcher

echo "🌟 Fujitsu Air Conditioner Simulator"
echo "   Nube IO - Desktop Application"
echo ""

# Check if the application exists
if [ ! -f "build/bin/FGA_Simulator" ]; then
    echo "❌ Application not found. Building..."
    wails build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed. Please check the errors above."
        exit 1
    fi
    echo "✅ Build completed successfully"
fi

echo "🚀 Starting FGA Simulator..."
./build/bin/FGA_Simulator
