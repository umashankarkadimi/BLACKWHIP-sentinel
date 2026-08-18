#!/bin/bash
echo "Installing BlackWhip SentinelX for macOS..."

if ! command -v node &> /dev/null
then
    echo "Node.js is not installed!"
    echo "Please install Node.js (v18+) using Homebrew: brew install node"
    echo "Or download it from https://nodejs.org/"
    exit 1
fi

echo "Node.js is installed. Version: $(node -v)"
echo "Installing dependencies..."
cd ../..
npm install

echo ""
echo "=============================================================="
echo "Setup Complete!"
echo "Next steps:"
echo "1. Create a .env file in the root directory."
echo "2. Add your Gemini API key: GEMINI_API_KEY=your_actual_api_key"
echo "3. Run 'npm run dev' to start the SentinelX dashboard."
echo "=============================================================="
