/**
 * DuckDB Email Thread Integration Module
 *
 * Provides comprehensive data loading capabilities for email thread analysis using DuckDB.
 * Supports both CSV and DAT files with advanced parsing and querying capabilities.
 *
 * Features:
 * - CSV file loading with automatic schema detection
 * - DAT file parsing using existing logic from dat_pandas_loader
 * - Email thread analysis and querying
 * - Performance optimizations for large datasets
 * - Error handling and data validation
 */

const Database = require('duckdb').Database;
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

/**
 * EmailThreadDuckDB - Main class for email thread analysis using DuckDB
 *
 * This class provides methods to:
 * 1. Load CSV files directly into DuckDB
 * 2. Parse DAT files using Python logic and load into DuckDB
 * 3. Perform email thread analysis queries
 * 4. Export results in various formats
 */
class EmailThreadDuckDB {
    /**
     * Initialize EmailThreadDuckDB instance
     * @param {Object} options - Configuration options
     * @param {string} options.dbPath - Path to DuckDB database file (optional, uses in-memory if not provided)
     * @param {boolean} options.verbose - Enable verbose logging
     * @param {string} options.datLoaderPath - Path to the DAT loader Python script
     *
     * Inputs: Configuration object with database path and options
     * Outputs: None
     * Side effects: Creates DuckDB database instance, sets up logging
     */
    constructor(options = {}) {
        this.dbPath = options.dbPath || ':memory:';
        this.verbose = options.verbose || false;
        this.datLoaderPath = options.datLoaderPath || 'C:/Users/gregg/Documents/Code/dat_pandas_loader/src';
        this.db = null;
        this.connection = null;
        this.loadedTables = new Set();

        this.log('Initializing EmailThreadDuckDB...');
    }

    /**
     * Initialize DuckDB database connection
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Establishes database connection, installs required extensions
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new Database(this.dbPath, (err) => {
                if (err) {
                    this.log('Error initializing database:', err);
                    reject(err);
                    return;
                }

                this.connection = this.db.connect();
                this.log('DuckDB database initialized successfully');

                // Try to install useful extensions (ignore errors if already installed)
                Promise.resolve()
                    .then(() => {
                        this.log('Database connection ready');
                        resolve();
                    })
                    .catch(reject);
            });
        });
    }

    /**
     * Execute a SQL query on the database
     * @param {string} query - SQL query to execute
     * @param {Array} params - Query parameters (optional)
     * @returns {Promise<Array>} Query results
     *
     * Inputs: SQL query string and optional parameters
     * Outputs: Returns array of result rows
     * Side effects: Executes query on database
     */
    async executeQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            // Use run for non-SELECT queries, all for SELECT queries
            if (query.trim().toUpperCase().startsWith('SELECT') || query.trim().toUpperCase().startsWith('WITH')) {
                this.connection.all(query, (err, result) => {
                    if (err) {
                        this.log('Query error:', err);
                        reject(err);
                    } else {
                        this.log(`Query executed: ${query.substring(0, 100)}...`);
                        resolve(result || []);
                    }
                });
            } else {
                this.connection.run(query, (err) => {
                    if (err) {
                        this.log('Query error:', err);
                        reject(err);
                    } else {
                        this.log(`Query executed: ${query.substring(0, 100)}...`);
                        resolve([]);
                    }
                });
            }
        });
    }

    /**
     * Load CSV file into DuckDB table with automatic schema detection
     * @param {string} filePath - Path to CSV file
     * @param {string} tableName - Name for the created table
     * @param {Object} options - CSV parsing options
     * @returns {Promise<Object>} Loading results with row count and schema info
     *
     * Inputs: File path, table name, and parsing options
     * Outputs: Returns object with loading statistics
     * Side effects: Creates table in database, loads CSV data
     */
    async loadCSVFile(filePath, tableName = 'email_data', options = {}) {
        this.log(`Loading CSV file: ${filePath} into table: ${tableName}`);

        try {
            // Verify file exists
            if (!await fs.pathExists(filePath)) {
                throw new Error(`CSV file not found: ${filePath}`);
            }

            // Default CSV loading options
            const csvOptions = {
                header: true,
                delimiter: ',',
                quote: '"',
                escape: '"',
                nullstr: '',
                skip: 0,
                ...options
            };

            // Build CSV loading query
            const optionsStr = Object.entries(csvOptions)
                .map(([key, value]) => {
                    if (typeof value === 'string') {
                        return `${key}='${value}'`;
                    }
                    return `${key}=${value}`;
                })
                .join(', ');

            // First, let's read the CSV to detect potential issues
            const sampleQuery = `
                SELECT * FROM read_csv_auto('${filePath.replace(/\\/g, '/')}', sample_size=100)
                LIMIT 5
            `;

            try {
                const sample = await this.executeQuery(sampleQuery);
                this.log(`CSV sample loaded successfully, columns: ${Object.keys(sample[0] || {}).join(', ')}`);
            } catch (sampleError) {
                this.log(`CSV sample read failed, using custom parsing: ${sampleError.message}`);

                // Try with manual column specification to handle duplicate columns
                const createQuery = `
                    CREATE OR REPLACE TABLE ${tableName} AS
                    SELECT * FROM read_csv('${filePath.replace(/\\/g, '/')}',
                        header=true,
                        auto_detect=true,
                        ignore_errors=true,
                        max_line_size=1048576
                    )
                `;

                await this.executeQuery(createQuery);
                const count = await this.executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);

                this.loadedTables.add(tableName);
                this.log(`CSV loaded with error tolerance: ${count[0].count} rows`);

                return {
                    success: true,
                    rowCount: count[0].count,
                    tableName: tableName,
                    method: 'error_tolerant'
                };
            }

            // Standard CSV loading
            const createQuery = `
                CREATE OR REPLACE TABLE ${tableName} AS
                SELECT * FROM read_csv_auto('${filePath.replace(/\\/g, '/')}')
            `;

            await this.executeQuery(createQuery);

            // Get row count and basic stats
            const countResult = await this.executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
            const columnsResult = await this.executeQuery(`DESCRIBE ${tableName}`);

            this.loadedTables.add(tableName);

            const result = {
                success: true,
                rowCount: countResult[0].count,
                columnCount: columnsResult.length,
                tableName: tableName,
                columns: columnsResult.map(col => ({
                    name: col.column_name,
                    type: col.column_type
                })),
                method: 'standard'
            };

            this.log(`CSV loaded successfully: ${result.rowCount} rows, ${result.columnCount} columns`);
            return result;

        } catch (error) {
            this.log(`Error loading CSV file: ${error.message}`);
            throw new Error(`Failed to load CSV file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Parse DAT file using Python logic and load into DuckDB
     * @param {string} datFilePath - Path to DAT file
     * @param {string} tableName - Name for the created table
     * @param {Object} options - DAT parsing options
     * @returns {Promise<Object>} Loading results with row count and schema info
     *
     * Inputs: DAT file path, table name, and parsing options
     * Outputs: Returns object with loading statistics
     * Side effects: Executes Python script, creates temporary CSV, loads into DuckDB
     */
    async loadDATFile(datFilePath, tableName = 'dat_email_data', options = {}) {
        this.log(`Loading DAT file: ${datFilePath} into table: ${tableName}`);

        try {
            // Verify DAT file exists
            if (!await fs.pathExists(datFilePath)) {
                throw new Error(`DAT file not found: ${datFilePath}`);
            }

            // Verify Python DAT loader exists
            const datLoaderScript = path.join(this.datLoaderPath, 'dat_loader.py');
            if (!await fs.pathExists(datLoaderScript)) {
                throw new Error(`DAT loader script not found: ${datLoaderScript}`);
            }

            // Create temporary directory for processing
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            await fs.ensureDir(tempDir);

            const tempCsvPath = path.join(tempDir, `${tableName}_temp.csv`);

            // Create Python script to convert DAT to CSV
            const pythonScript = `
import sys
sys.path.append('${this.datLoaderPath.replace(/\\/g, '/')}')

from dat_loader import load_dat_file
import pandas as pd
import traceback

try:
    # Load DAT file using the existing loader
    df = load_dat_file('${datFilePath.replace(/\\/g, '/')}', verbose=${this.verbose})

    # Save to CSV for DuckDB ingestion
    df.to_csv('${tempCsvPath.replace(/\\/g, '/')}', index=False, encoding='utf-8')

    print(f"SUCCESS: Converted {len(df)} rows to CSV")
    print(f"Columns: {', '.join(df.columns.tolist())}")

except Exception as e:
    print(f"ERROR: {str(e)}")
    traceback.print_exc()
    sys.exit(1)
`;

            const pythonScriptPath = path.join(tempDir, 'convert_dat.py');
            await fs.writeFile(pythonScriptPath, pythonScript);

            // Execute Python script
            const pythonResult = await this.executePython(pythonScriptPath);

            if (!pythonResult.success) {
                throw new Error(`DAT conversion failed: ${pythonResult.error}`);
            }

            this.log(`DAT file converted to CSV successfully`);

            // Load the converted CSV into DuckDB
            const csvResult = await this.loadCSVFile(tempCsvPath, tableName, options);

            // Cleanup temporary files
            await fs.remove(tempCsvPath);
            await fs.remove(pythonScriptPath);

            this.log(`DAT file loaded successfully: ${csvResult.rowCount} rows`);

            return {
                ...csvResult,
                sourceType: 'DAT',
                originalFile: datFilePath
            };

        } catch (error) {
            this.log(`Error loading DAT file: ${error.message}`);
            throw new Error(`Failed to load DAT file ${datFilePath}: ${error.message}`);
        }
    }

    /**
     * Execute Python script and capture output
     * @param {string} scriptPath - Path to Python script
     * @returns {Promise<Object>} Execution result with success status and output
     *
     * Inputs: Python script file path
     * Outputs: Returns object with execution status and output
     * Side effects: Spawns Python process, captures stdout/stderr
     */
    async executePython(scriptPath) {
        return new Promise((resolve) => {
            const python = spawn('python', [scriptPath]);
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code === 0 && stdout.includes('SUCCESS:')) {
                    resolve({
                        success: true,
                        output: stdout,
                        code: code
                    });
                } else {
                    resolve({
                        success: false,
                        error: stderr || stdout,
                        code: code
                    });
                }
            });

            python.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    code: -1
                });
            });
        });
    }

    /**
     * Perform email thread analysis on loaded data
     * @param {string} tableName - Name of table containing email data
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Thread analysis results
     *
     * Inputs: Table name and analysis options
     * Outputs: Returns thread analysis statistics and groupings
     * Side effects: Creates temporary analysis tables, performs thread grouping
     */
    async analyzeEmailThreads(tableName = 'email_data', options = {}) {
        this.log(`Analyzing email threads in table: ${tableName}`);

        try {
            // Verify table exists by trying to select from it
            try {
                await this.executeQuery(`SELECT COUNT(*) FROM ${tableName} LIMIT 1`);
                this.log(`Table ${tableName} exists and is accessible`);
            } catch (tableError) {
                throw new Error(`Table ${tableName} does not exist or is not accessible: ${tableError.message}`);
            }

            // Get table schema to identify relevant columns
            const schema = await this.executeQuery(`DESCRIBE ${tableName}`);
            const columns = schema.map(col => col.column_name.toLowerCase());

            // Identify key email columns (flexible column matching)
            const columnMap = {
                subject: this.findColumn(columns, ['subject', 'subj', 'title']),
                from: this.findColumn(columns, ['from', 'sender', 'from_address']),
                to: this.findColumn(columns, ['to', 'recipient', 'to_address']),
                date: this.findColumn(columns, ['date', 'sent', 'datesent', 'timestamp', 'date_sent']),
                messageId: this.findColumn(columns, ['message_id', 'messageid', 'id', 'msg_id']),
                body: this.findColumn(columns, ['body', 'fulltext', 'content', 'text', 'full_text'])
            };

            this.log(`Identified columns: ${JSON.stringify(columnMap)}`);

            // Basic email statistics
            const basicStats = await this.executeQuery(`
                SELECT
                    COUNT(*) as total_emails,
                    COUNT(DISTINCT ${columnMap.from || '1'}) as unique_senders,
                    COUNT(DISTINCT ${columnMap.subject || '1'}) as unique_subjects,
                    MIN(${columnMap.date || 'NULL'}) as earliest_date,
                    MAX(${columnMap.date || 'NULL'}) as latest_date
                FROM ${tableName}
                WHERE ${columnMap.subject || '1'} IS NOT NULL
            `);

            // Thread grouping based on subject similarity
            const threadAnalysisQuery = `
                WITH thread_groups AS (
                    SELECT
                        ${columnMap.subject || "'No Subject'"} as original_subject,
                        REGEXP_REPLACE(
                            UPPER(${columnMap.subject || "'No Subject'"}),
                            '^(RE:|FWD?:|FW:)\\s*',
                            ''
                        ) as normalized_subject,
                        COUNT(*) as message_count,
                        COUNT(DISTINCT ${columnMap.from || '1'}) as participant_count,
                        MIN(${columnMap.date || 'NULL'}) as thread_start,
                        MAX(${columnMap.date || 'NULL'}) as thread_end,
                        STRING_AGG(DISTINCT ${columnMap.from || '1'}, '; ') as participants
                    FROM ${tableName}
                    WHERE ${columnMap.subject || '1'} IS NOT NULL
                    GROUP BY normalized_subject
                    HAVING COUNT(*) > 1
                    ORDER BY message_count DESC
                )
                SELECT
                    ROW_NUMBER() OVER (ORDER BY message_count DESC) as thread_rank,
                    *,
                    DATEDIFF('day', thread_start::DATE, thread_end::DATE) as thread_duration_days
                FROM thread_groups
                LIMIT 100
            `;

            const threadAnalysis = await this.executeQuery(threadAnalysisQuery);

            // Create thread analysis table
            const threadTableName = `${tableName}_threads`;
            await this.executeQuery(`
                CREATE OR REPLACE TABLE ${threadTableName} AS (${threadAnalysisQuery})
            `);

            this.loadedTables.add(threadTableName);

            // Top participants analysis
            const participantStats = await this.executeQuery(`
                SELECT
                    ${columnMap.from || "'Unknown'"} as sender,
                    COUNT(*) as email_count,
                    COUNT(DISTINCT ${columnMap.subject || '1'}) as unique_threads,
                    MIN(${columnMap.date || 'NULL'}) as first_email,
                    MAX(${columnMap.date || 'NULL'}) as last_email
                FROM ${tableName}
                WHERE ${columnMap.from || '1'} IS NOT NULL
                GROUP BY ${columnMap.from || '1'}
                ORDER BY email_count DESC
                LIMIT 20
            `);

            const results = {
                basicStats: basicStats[0],
                threadCount: threadAnalysis.length,
                topThreads: threadAnalysis.slice(0, 10),
                topParticipants: participantStats.slice(0, 10),
                columnMapping: columnMap,
                analysisTable: threadTableName,
                totalEmails: basicStats[0].total_emails
            };

            this.log(`Thread analysis complete: ${results.threadCount} threads identified`);
            return results;

        } catch (error) {
            this.log(`Error analyzing email threads: ${error.message}`);
            throw new Error(`Failed to analyze email threads: ${error.message}`);
        }
    }

    /**
     * Find the best matching column from available columns
     * @param {Array<string>} availableColumns - Available column names
     * @param {Array<string>} targetColumns - Target column names to match
     * @returns {string|null} Best matching column name or null
     *
     * Inputs: Array of available columns and target column patterns
     * Outputs: Returns best matching column name
     * Side effects: None
     */
    findColumn(availableColumns, targetColumns) {
        for (const target of targetColumns) {
            const match = availableColumns.find(col =>
                col.includes(target) || target.includes(col)
            );
            if (match) return match;
        }
        return null;
    }

    /**
     * Export analysis results to various formats
     * @param {string} tableName - Table to export
     * @param {string} outputPath - Output file path
     * @param {string} format - Export format ('csv', 'json', 'parquet')
     * @returns {Promise<Object>} Export results
     *
     * Inputs: Table name, output path, and export format
     * Outputs: Returns export status and file information
     * Side effects: Creates export file at specified path
     */
    async exportResults(tableName, outputPath, format = 'csv') {
        this.log(`Exporting table ${tableName} to ${outputPath} as ${format}`);

        try {
            const exportQueries = {
                csv: `COPY ${tableName} TO '${outputPath.replace(/\\/g, '/')}' (FORMAT CSV, HEADER)`,
                json: `COPY ${tableName} TO '${outputPath.replace(/\\/g, '/')}' (FORMAT JSON)`,
                parquet: `COPY ${tableName} TO '${outputPath.replace(/\\/g, '/')}' (FORMAT PARQUET)`
            };

            if (!exportQueries[format]) {
                throw new Error(`Unsupported export format: ${format}`);
            }

            await this.executeQuery(exportQueries[format]);

            const stats = await fs.stat(outputPath);

            this.log(`Export completed: ${stats.size} bytes written`);

            return {
                success: true,
                outputPath: outputPath,
                format: format,
                fileSize: stats.size
            };

        } catch (error) {
            this.log(`Export error: ${error.message}`);
            throw new Error(`Failed to export table ${tableName}: ${error.message}`);
        }
    }

    /**
     * Get list of loaded tables
     * @returns {Promise<Array>} List of table information
     *
     * Inputs: None
     * Outputs: Returns array of table metadata
     * Side effects: None
     */
    async getLoadedTables() {
        const tables = await this.executeQuery("SHOW TABLES");
        return tables.map(row => ({
            name: Object.values(row)[0],
            loaded: this.loadedTables.has(Object.values(row)[0])
        }));
    }

    /**
     * Clean up database resources
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Closes database connection and cleans up resources
     */
    async cleanup() {
        if (this.connection) {
            this.connection.close();
        }
        if (this.db) {
            this.db.close();
        }
        this.log('Database resources cleaned up');
    }

    /**
     * Log message with timestamp (if verbose mode enabled)
     * @param {...any} args - Arguments to log
     *
     * Inputs: Any number of arguments to log
     * Outputs: None
     * Side effects: Prints log message to console if verbose mode is enabled
     */
    log(...args) {
        if (this.verbose) {
            console.log(`[${new Date().toISOString()}] EmailThreadDuckDB:`, ...args);
        }
    }
}

module.exports = { EmailThreadDuckDB };