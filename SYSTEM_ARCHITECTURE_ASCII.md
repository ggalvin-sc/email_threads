# Email Threads System - Complete ASCII Architecture & Data Flow

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                    EMAIL THREADS SYSTEM ARCHITECTURE                                ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        INPUT SOURCES                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

    📄 email_test_data.csv       📄 *.dat files        🌐 Web Upload       📁 Custom CSV
           │                           │                     │                    │
           └───────────────────────────┼─────────────────────┼────────────────────┘
                                       │                     │
                                       ▼                     ▼
           ┌─────────────────────────────────────────────────────────────────────────┐
           │                         DATA INGESTION LAYER                           │
           └─────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                         CLI APPLICATION                                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

    🚀 index.js (Entry Point)
           │
           ├─── 📞 require('./src/emailThreadProcessor')
           │              │
           │              ▼
           │    ┌─────────────────────────────────────────────────────────────┐
           │    │           EmailThreadProcessor Class                        │
           │    │  ┌─────────────────────────────────────────────────────┐    │
           │    │  │  📥 loadEmailsFromFile(csvPath)                    │    │
           │    │  │      │                                             │    │
           │    │  │      ├─── csv-parser ──► parseColumnHistory()     │    │
           │    │  │      │                        │                   │    │
           │    │  │      │                        ▼                   │    │
           │    │  │      │              🧬 Extract Threading Info:    │    │
           │    │  │      │                 • messageId               │    │
           │    │  │      │                 • inReplyTo               │    │
           │    │  │      │                 • references              │    │
           │    │  │      │                 • threadId                │    │
           │    │  │      │                 • isForward               │    │
           │    │  │      │                 • isExternal              │    │
           │    │  │      │                                             │    │
           │    │  │      ▼                                             │    │
           │    │  │  🗂️ groupByThreads()                              │    │
           │    │  │      │                                             │    │
           │    │  │      ├─── Sort by date ──► Map<threadId, emails[]>│    │
           │    │  │      │                                             │    │
           │    │  │      ▼                                             │    │
           │    │  │  🌳 buildThreadTree(threadId)                      │    │
           │    │  │      │                                             │    │
           │    │  │      ├─── Create parent-child relationships      │    │
           │    │  │      ├─── Build tree structure                   │    │
           │    │  │      └─── Return: { roots, participants, etc }   │    │
           │    │  │                                                   │    │
           │    │  │  📊 generateThreadStats(threadId)                 │    │
           │    │  │      │                                             │    │
           │    │  │      ├─── maxDepth calculation                   │    │
           │    │  │      ├─── branch counting                        │    │
           │    │  │      ├─── reply/forward counts                   │    │
           │    │  │      └─── participant analysis                   │    │
           │    │  │                                                   │    │
           │    │  │  💾 exportForPythonProcessing()                   │    │
           │    │  │      │                                             │    │
           │    │  │      ├─── generateEmlContent() ──► .eml files    │    │
           │    │  │      └─── thread_metadata.json                   │    │
           │    │  └─────────────────────────────────────────────────────┘    │
           │    └─────────────────────────────────────────────────────────────┘
           │
           ├─── 🖥️ displayThreadStructure() ──► Console ASCII Art
           │
           └─── 📄 generateThreadReport() ──► thread_report.json


╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                          WEB APPLICATION                                            ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

    🌐 www/index.html (Entry Point)
           │
           ├─── 📦 www/index.js (EmailThreadApp)
           │         │
           │         ├─── 🦀 WASM Integration
           │         │      │
           │         │      ├─── init() ──► pkg/email_threads_wasm.js
           │         │      │                    │
           │         │      │                    ├─── Rust lib.rs compiled to WASM
           │         │      │                    └─── EmailThreadProcessor (Rust)
           │         │      │
           │         │      └─── set_panic_hook() ──► Error handling
           │         │
           │         ├─── 🎛️ Event Management
           │         │      │
           │         │      ├─── File Upload Handler
           │         │      ├─── View Toggle (Tree/Timeline/Compact)
           │         │      ├─── Thread Selection
           │         │      └─── Sample Data Loading
           │         │
           │         ├─── 📊 Visualization Engine
           │         │      │
           │         │      ├─── D3.js Integration
           │         │      ├─── renderThreadTree()
           │         │      ├─── renderTimeline()
           │         │      └─── renderCompactView()
           │         │
           │         └─── 🎨 UI State Management
           │                │
           │                ├─── Thread sidebar updates
           │                ├─── Statistics display
           │                └─── Performance monitoring
           │
           ├─── 🎨 www/styles.css ──► UI Styling
           │
           └─── ⚙️ webpack.config.js ──► Build Configuration

╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                       RUST/WASM CORE                                               ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

    🦀 src/lib.rs (High-Performance Core)
           │
           ├─── 📊 CsvRecord Struct
           │      │
           │      ├─── Serde deserialization
           │      ├─── Field mapping
           │      └─── Data validation
           │
           ├─── 🧵 EmailThreadProcessor Struct
           │      │
           │      ├─── process_csv_data()
           │      │      │
           │      │      ├─── Parse CSV records
           │      │      ├─── Extract thread metadata
           │      │      └─── Return processed data
           │      │
           │      ├─── build_thread_tree()
           │      │      │
           │      │      ├─── Parent-child relationship mapping
           │      │      ├─── Tree structure creation
           │      │      └─── Statistics calculation
           │      │
           │      └─── export_thread_data()
           │             │
           │             ├─── JSON serialization
           │             └─── WASM-JS bridge
           │
           └─── 🌉 WASM Bindings
                  │
                  ├─── #[wasm_bindgen] annotations
                  ├─── JavaScript interop
                  └─── Memory management

╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                      DATABASE LAYER                                                ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

    🗄️ src/duckdb/ (Analytics & Storage)
           │
           ├─── 📊 EmailThreadDuckDB.js
           │      │
           │      ├─── Database connection management
           │      ├─── Table creation & schema
           │      ├─── Email data insertion
           │      ├─── Thread query operations
           │      └─── Performance analytics
           │
           ├─── 🔧 debug_tables.js
           │      │
           │      ├─── Table inspection utilities
           │      ├─── Data validation
           │      └─── Debug output formatting
           │
           └─── 📋 example_usage.js
                  │
                  ├─── Usage demonstrations
                  ├─── Query examples
                  └─── Best practices

╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                    VISUALIZATION LAYER                                             ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

    🎨 src/visualization/threadVisualizer.js
           │
           ├─── Tree View Rendering
           │      │
           │      ├─── Hierarchical layout
           │      ├─── Node positioning
           │      └─── Edge drawing
           │
           ├─── Timeline View
           │      │
           │      ├─── Chronological ordering
           │      ├─── Time axis scaling
           │      └─── Event plotting
           │
           └─── Interactive Features
                  │
                  ├─── Zoom & pan controls
                  ├─── Node selection
                  └─── Tooltip displays

╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                     OUTPUT DESTINATIONS                                            ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

    📁 output/ALPHA-2024-001/
           │
           ├─── 📧 eml_files/
           │      │
           │      ├─── BEG_001.eml
           │      ├─── BEG_002.eml
           │      └─── ... (RFC 5322 format)
           │
           └─── 📄 thread_metadata.json
                  │
                  ├─── Thread structure
                  ├─── Statistics
                  └─── Participant data

    📁 exports/
           │
           ├─── 📊 email_data.json
           │      │
           │      ├─── Processed email records
           │      └─── Thread relationships
           │
           └─── 📈 email_threads_analysis.csv
                  │
                  ├─── Statistical summaries
                  └─── Analytics data

    📄 thread_report.json
           │
           ├─── Global summary
           ├─── Per-thread statistics
           └─── Processing metadata

╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                        DATA FLOW                                                   ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

CSV Input ──► Parse Headers ──► Extract Threading ──► Group by Threads ──► Build Trees ──► Generate Stats
    │              │                    │                    │                 │               │
    │              ▼                    ▼                    ▼                 ▼               ▼
    │         Column History     Message Metadata      Thread Groups     Tree Structure   Statistics
    │         Extraction         • messageId          Map<threadId,     • roots          • depth
    │                           • inReplyTo           emails[]>         • children       • branches
    │                           • references                            • participants   • counts
    │                           • threadId
    │
    └─► Export Formats:
        ├─── 📧 EML Files (RFC 5322)
        ├─── 📄 JSON Reports
        ├─── 📊 CSV Analysis
        └─── 🌐 Web Visualization

╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                    EXECUTION PATHWAYS                                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

CLI Mode (npm start):
   index.js ──► EmailThreadProcessor ──► CSV Parse ──► Thread Analysis ──► Console Output + File Export

Web Mode (cd www && npm start):
   webpack-dev-server ──► index.html ──► index.js ──► WASM ──► Interactive Visualization

Testing Mode (npm test):
   Playwright ──► email-threads.spec.js ──► Automated UI Testing ──► Results Report

Build Mode:
   Rust Source ──► wasm-pack ──► WASM Binary ──► webpack ──► Production Bundle
```

## Key Component Interactions:

1. **CSV Parser** → **Thread Processor** → **Tree Builder** → **Statistics Generator**
2. **WASM Core** ↔ **JavaScript App** ↔ **D3 Visualization** ↔ **DOM Updates**
3. **DuckDB Layer** ↔ **Analytics Engine** ↔ **Query Interface** ↔ **Results Display**
4. **File System** ↔ **Export Manager** ↔ **Format Converters** ↔ **Output Files**

## Performance Optimizations:

- **Rust/WASM**: High-performance CSV parsing and thread analysis
- **Lazy Loading**: Progressive data loading for large datasets
- **Caching**: Thread tree caching for repeated operations
- **Streaming**: CSV streaming for memory efficiency