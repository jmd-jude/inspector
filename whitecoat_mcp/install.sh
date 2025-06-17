#!/bin/bash

echo "🚀 Installing Whitecoat..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add this server to your Claude Desktop config"
echo "2. Restart Claude Desktop"
echo "3. Start using Whitecoat!"
echo ""
echo "💡 Configuration details:"
echo "   Server name: Whitecoat"
echo "   Command: node"
echo "   Args: [\"$(pwd)/src/index.js\"]"
echo ""
echo "🎯 Test the installation:"
echo "   Run: npm start"
echo "   (Press Ctrl+C to stop)"