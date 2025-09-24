#!/bin/bash

echo "🦀 Building Email Thread Analyzer with Rust and WebAssembly"

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack not found. Installing..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

echo "📦 Building WASM package..."
wasm-pack build --target web --out-dir www/pkg

if [ $? -ne 0 ]; then
    echo "❌ WASM build failed"
    exit 1
fi

echo "📁 Installing web dependencies..."
cd www
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi

echo "🚀 Building web application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Web build failed"
    exit 1
fi

echo "✅ Build completed successfully!"
echo ""
echo "To run the application:"
echo "  cd www"
echo "  npm start"
echo ""
echo "Or serve the dist folder with any static file server."