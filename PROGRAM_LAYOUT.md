# Email Threads Program - Complete Layout & Structure

## Project Overview
A multi-component email thread processing and visualization system with both CLI and web interfaces.

## Directory Structure

```
email_threads/
├── 📁 Root Directory (CLI Application)
│   ├── index.js                    # Main CLI entry point
│   ├── demo.js                     # Demo script
│   ├── package.json                # Node.js dependencies & scripts
│   ├── email_test_data.csv         # Sample email data
│   ├── thread_report.json          # Generated thread analysis
│   ├── Cargo.toml                  # Rust project configuration
│   ├── build.sh / build.ps1        # Build scripts
│   └── README.md                   # Project documentation
│
├── 📁 src/ (Core Processing Logic)
│   ├── lib.rs                      # Rust WASM library
│   ├── emailThreadProcessor.js     # Main thread processing
│   ├── 📁 duckdb/
│   │   ├── EmailThreadDuckDB.js    # Database integration
│   │   ├── debug_tables.js         # Debug utilities
│   │   └── example_usage.js        # Usage examples
│   └── 📁 visualization/
│       └── threadVisualizer.js     # Thread visualization logic
│
├── 📁 www/ (Web Interface)
│   ├── index.html                  # Web UI main page
│   ├── index.js                    # Web application logic
│   ├── styles.css                  # Web UI styling
│   ├── package.json                # Web dependencies
│   ├── webpack.config.js           # Build configuration
│   └── 📁 pkg/ (Generated WASM)
│       ├── email_threads_wasm.js   # WASM bindings
│       └── index.js                # WASM entry point
│
├── 📁 tests/ (Testing Framework)
│   ├── email-threads.spec.js       # Main test suite
│   ├── email-threads-tests.spec.js # Additional tests
│   ├── email-threads-utils.js      # Test utilities
│   └── global-setup.js             # Test configuration
│
├── 📁 output/ (Generated Files)
│   └── 📁 ALPHA-2024-001/
│       ├── thread_metadata.json    # Thread analysis
│       └── 📁 eml_files/           # Exported email files
│
└── 📁 exports/ (Data Exports)
    ├── email_data.json             # Processed email data
    └── email_threads_analysis.csv  # Analysis results
```

## Application Architecture

### 🔧 CLI Application (Root)
- **Entry Point**: `index.js`
- **Purpose**: Command-line email thread processing
- **Key Features**:
  - CSV email data parsing
  - Thread structure analysis
  - Email file (.eml) export
  - JSON report generation

### 🌐 Web Application (www/)
- **Entry Point**: `index.html` → `index.js`
- **Purpose**: Interactive web-based visualization
- **Technology Stack**:
  - Frontend: HTML5, CSS3, JavaScript
  - Backend: Rust compiled to WebAssembly
  - Build Tool: Webpack
  - Server: webpack-dev-server
- **Access**: http://localhost:8080

### ⚙️ Core Processing (src/)
- **Main Logic**: `emailThreadProcessor.js`
- **Database**: DuckDB integration for data analysis
- **Visualization**: D3.js-based thread visualization
- **WASM Module**: Rust-based high-performance processing

## Key Components Breakdown

### 1. Main CLI Entry (`index.js`)
```javascript
// Loads CSV → Processes threads → Exports results
Email Processing Flow:
CSV Input → Thread Analysis → Visualization → Export
```

### 2. Web Interface (`www/index.html`)
```html
<!-- Interactive email thread visualizer -->
Features:
- File upload (CSV/DAT)
- Thread tree visualization
- Timeline view
- Participant analysis
- Search & filtering
```

### 3. Rust WASM Core (`src/lib.rs`)
```rust
// High-performance email processing
Capabilities:
- CSV parsing
- Thread detection
- Reply/forward analysis
- Participant tracking
```

### 4. Database Layer (`src/duckdb/`)
```javascript
// Advanced analytics and querying
Functions:
- Email storage
- Thread queries
- Participant analysis
- Performance metrics
```

## Data Flow

```
Input Sources:
├── CSV Files (email_test_data.csv)
├── DAT Files (legacy format)
└── Manual Upload (web interface)
         ↓
Processing Pipeline:
├── Parse Email Headers
├── Detect Thread Relationships
├── Build Thread Tree
├── Calculate Metrics
└── Generate Visualizations
         ↓
Output Formats:
├── JSON Reports (thread_report.json)
├── EML Files (individual emails)
├── CSV Analysis (exports/)
└── Interactive Web View
```

## Usage Modes

### CLI Mode
```bash
npm start                    # Process sample data
node index.js               # Main processor
node demo.js                # Demo version
```

### Web Mode
```bash
cd www && npm start         # Start web server
# Visit: http://localhost:8080
```

### Testing
```bash
npm test                    # Run test suite
npm run test:headed         # Visual test mode
```

## Configuration Files

- `package.json` - CLI dependencies & scripts
- `www/package.json` - Web dependencies
- `Cargo.toml` - Rust WASM compilation
- `playwright.config.js` - Testing configuration
- `www/webpack.config.js` - Web build configuration

## Key Features

### Thread Analysis
- Email relationship detection
- Reply/forward tracking
- Participant identification
- Conversation depth analysis
- Branch detection

### Visualization Options
- Tree view (hierarchical)
- Timeline view (chronological)
- Compact view (condensed)
- Interactive exploration

### Data Export
- EML file generation
- JSON metadata
- CSV analysis reports
- Thread statistics

This layout provides both command-line processing power and interactive web visualization for comprehensive email thread analysis.