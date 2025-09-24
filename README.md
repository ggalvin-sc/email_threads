# Email Thread Analyzer 🦀

A high-performance email thread processing and visualization application built with **Rust** and **WebAssembly**, featuring complex thread analysis with branching patterns, forwards, and replies. Includes Node.js integration and python-emailthreads compatibility.

## Features

- **🦀 Rust Performance**: Core processing engine written in Rust, compiled to WebAssembly for maximum speed
- **🌐 Web-Based Interface**: Modern, responsive web application with interactive visualizations
- **🔀 Complex Thread Processing**: Handles email threads with multiple branches, forwards, and replies
- **📊 CSV/DAT Data Import**: Processes email data from CSV files with legal discovery field structure
- **📈 Interactive Visualizations**: Multiple view modes including thread list, tree view, and timeline
- **🎨 Theme Support**: Light, dark, and blue themes with smooth transitions
- **📱 Mobile Responsive**: Works seamlessly on desktop and mobile devices
- **⚡ Real-time Processing**: Instant feedback with WebAssembly-powered performance
- **🔗 Python Integration**: Exports data for processing with python-emailthreads library
- **📋 Thread Statistics**: Comprehensive analysis of thread metrics and participant data

## Test Data Structure

The application works with CSV files containing the following fields:
```
BegBates, EndBates, BegAttach, EndAttach, Custodian, DuplicateCustodian, From, To, CC, BCC, Subject, DateSent, FileName, FileType, FileExtension, ESIType, FileName, DeDuplicatedPath, DateCreated, DateLastModified, Title, author, Confidentiality, Hash, nativelink, FullText, EndAttach_Left, column_history
```

## Thread Structure

The test data includes a complex email thread with:

```
1. Original Email (A)
   ├── 2. Reply to A (B)
   │   ├── 4. Reply to B (D)
   │   │   ├── 7. Reply to D (G)
   │   │   └── 8. Forward of D to new recipients (H)
   │   └── 5. Forward of B (E)
   │       └── 9. Reply to forward E (I)
   ├── 3. Reply to A (C)
   │   ├── 6. Reply to C (F)
   │   │   └── 10. Reply to F with CC additions (J)
   │   └── 11. Forward of C to external team (K)
   └── 12. Late reply to original A (L)
       └── 13. Reply to L (M)
```

## Quick Start

### Prerequisites
- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v16 or later)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) for building WebAssembly

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd email_threads
   ```

2. **Build the application**:

   **On Windows**:
   ```powershell
   .\build.ps1
   ```

   **On Linux/macOS**:
   ```bash
   chmod +x build.sh
   ./build.sh
   ```

3. **Run the web application**:
   ```bash
   cd www
   npm start
   ```

4. **Open your browser** to `http://localhost:8080`

### Alternative Manual Build

```bash
# Build WASM package
wasm-pack build --target web --out-dir www/pkg

# Install and build web interface
cd www
npm install
npm run build

# Start development server
npm start
```

## Usage

### Web Interface

1. **Load Sample Data**: Click "Load Sample Data" to try the complex thread example
2. **Upload CSV Files**: Drag and drop or browse for your email CSV/DAT files
3. **Explore Threads**: Select different threads from the dropdown
4. **Switch Views**: Choose between List, Tree, and Timeline views
5. **Change Themes**: Toggle between Light, Dark, and Blue themes

### View Modes

- **📋 Thread List**: Hierarchical view showing email relationships with expandable content
- **🌳 Tree View**: Interactive D3.js tree diagram with hover tooltips
- **⏱️ Timeline**: Chronological timeline of all emails in the thread

### Using Your Own Data

The application expects CSV files with these required fields:
- `BegBates`, `EndBates`, `From`, `To`, `CC`, `Subject`, `DateSent`
- `FullText`, `Custodian`, `Confidentiality`
- `column_history` (contains threading metadata)

### Node.js API (Optional)

For server-side processing, you can still use the Node.js components:

```javascript
const EmailThreadProcessor = require('./src/emailThreadProcessor');

const processor = new EmailThreadProcessor();
await processor.loadEmailsFromFile('path/to/data.csv');
const threads = processor.groupByThreads();
const threadTree = processor.buildThreadTree('ALPHA-2024-001');
```

## Architecture

### 🦀 Rust Core (`src/lib.rs`)
- **EmailThreadProcessor**: Main WASM-exposed struct for thread processing
- **EmailMessage**: Rust struct representing email data
- **ThreadTree & ThreadNode**: Hierarchical thread structures
- **High-performance CSV parsing** and thread analysis

### 🌐 Web Interface (`www/`)
- **Modern JavaScript** with ES6 modules and async/await
- **D3.js integration** for interactive tree visualizations
- **Responsive CSS** with CSS custom properties for theming
- **Webpack build system** for optimized bundles

### 📦 Output Files

When using Node.js components, you'll find:
- `thread_report.json` - Comprehensive thread analysis report
- `output/[THREAD-ID]/` - .eml files for python-emailthreads processing
- `visualizations/` - Generated HTML visualizations (Node.js version)

## Python Integration

The application exports .eml files that can be processed with python-emailthreads:

```bash
cd output/ALPHA-2024-001/
python ../../src/python/thread_parser.py eml_files thread_analysis.json
```

## API Reference

### EmailThreadProcessor

- `loadEmailsFromFile(filePath)` - Load emails from CSV
- `groupByThreads()` - Group emails by thread ID
- `buildThreadTree(threadId)` - Build hierarchical thread structure
- `generateThreadStats(threadId)` - Generate thread statistics
- `exportForPythonProcessing(threadId, outputDir)` - Export .eml files

### ThreadVisualizer

- `generateHTMLVisualization(threadData, options)` - Create HTML visualization
- `generateD3Visualization(threadData, options)` - Create D3.js tree view

## Thread Metadata

The `column_history` field contains threading metadata in the format:
```
MSG-ID:<message-id>|REFS:<references>|THREAD:<thread-id>|IN-REPLY-TO:<parent-id>|FWD:true|EXTERNAL:true
```

## Visualization Features

- **Interactive Thread View**: Click to expand email content
- **Thread Statistics**: Participant count, depth, branches
- **Email Type Indicators**: Visual tags for replies, forwards, external emails
- **Responsive Design**: Works on desktop and mobile
- **Dark Theme**: Alternative color scheme
- **D3.js Tree View**: Hierarchical tree visualization

## Sample Thread Data

The included `email_test_data.csv` contains a sample thread with:
- 13 interconnected emails
- Multiple reply chains
- Forwarded messages
- External recipients
- Complex branching patterns

## Performance

**Rust + WebAssembly** provides significant performance benefits:

- ⚡ **Instant CSV Processing**: Parse thousands of emails in milliseconds
- 🧠 **Memory Efficient**: Rust's zero-cost abstractions minimize memory usage
- 🔄 **Real-time Updates**: Thread analysis updates in real-time as you explore
- 📱 **Smooth Interactions**: 60fps animations and transitions
- 🌐 **No Server Required**: Runs entirely in the browser

## Browser Compatibility

- ✅ Chrome 57+ (WebAssembly support)
- ✅ Firefox 52+ (WebAssembly support)
- ✅ Safari 11+ (WebAssembly support)
- ✅ Edge 16+ (WebAssembly support)

## Development

### Rust Development
```bash
# Test Rust code
cargo test

# Check for issues
cargo clippy

# Format code
cargo fmt
```

### Web Development
```bash
cd www

# Development server with hot reload
npm run dev

# Production build
npm run build
```

## License

MIT License - see LICENSE file for details.

---

**Built with ❤️ using Rust 🦀 and WebAssembly ⚡**