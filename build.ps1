Write-Host "🦀 Building Email Thread Analyzer with Rust and WebAssembly" -ForegroundColor Cyan

# Check if wasm-pack is installed
if (-not (Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
    Write-Host "❌ wasm-pack not found. Please install it first:" -ForegroundColor Red
    Write-Host "  cargo install wasm-pack" -ForegroundColor Yellow
    exit 1
}

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Building WASM package..." -ForegroundColor Green
wasm-pack build --target web --out-dir www/pkg

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ WASM build failed" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Installing web dependencies..." -ForegroundColor Green
Set-Location www
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Building web application..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Web build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To run the application:" -ForegroundColor Cyan
Write-Host "  cd www" -ForegroundColor Yellow
Write-Host "  npm start" -ForegroundColor Yellow
Write-Host ""
Write-Host "Or serve the dist folder with any static file server." -ForegroundColor Gray