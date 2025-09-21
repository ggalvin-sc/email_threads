/**
 * Example Usage of EmailThreadDuckDB
 *
 * Demonstrates how to use the DuckDB integration for email thread analysis
 * with both CSV and DAT files.
 */

const { EmailThreadDuckDB } = require('./EmailThreadDuckDB');
const path = require('path');

/**
 * Main example function demonstrating DuckDB email thread analysis
 *
 * This function shows:
 * 1. Loading CSV files into DuckDB
 * 2. Loading DAT files using Python integration
 * 3. Performing thread analysis
 * 4. Exporting results
 */
async function runExample() {
    console.log('🦆 Starting EmailThreadDuckDB Example\n');

    // Initialize DuckDB instance
    const emailDB = new EmailThreadDuckDB({
        verbose: true,
        datLoaderPath: 'C:/Users/gregg/Documents/Code/dat_pandas_loader/src'
    });

    try {
        // Initialize database
        await emailDB.initialize();
        console.log('✅ Database initialized\n');

        // Example 1: Load CSV file
        console.log('📄 Loading CSV file...');
        const csvPath = path.join(__dirname, '..', '..', 'email_test_data.csv');

        try {
            const csvResult = await emailDB.loadCSVFile(csvPath, 'email_csv_data');
            console.log('CSV Loading Result:', csvResult);
            console.log('');
        } catch (csvError) {
            console.log('CSV loading failed (expected due to duplicate columns):', csvError.message);
            console.log('This demonstrates the error handling capabilities.\n');
        }

        // Example 2: Load DAT file (if available)
        console.log('📦 Attempting to load DAT file...');
        const datPath = path.join(__dirname, '..', '..', 'sample_emails.dat');

        try {
            const datResult = await emailDB.loadDATFile(datPath, 'email_dat_data');
            console.log('DAT Loading Result:', datResult);
            console.log('');
        } catch (datError) {
            console.log('DAT loading failed (file may not exist):', datError.message);
            console.log('This is expected if no DAT file is available.\n');
        }

        // Example 3: Create sample data for demonstration
        console.log('📧 Creating sample email data for demonstration...');
        await emailDB.executeQuery(`
            CREATE OR REPLACE TABLE sample_emails AS
            SELECT * FROM (
                VALUES
                    (1, 'john@company.com', 'team@company.com', 'Project Update', '2024-01-15 09:00:00', 'msg001', 'Initial project update message'),
                    (2, 'jane@company.com', 'team@company.com', 'RE: Project Update', '2024-01-15 10:30:00', 'msg002', 'Reply to project update'),
                    (3, 'bob@company.com', 'team@company.com', 'RE: Project Update', '2024-01-15 11:15:00', 'msg003', 'Another reply to project update'),
                    (4, 'alice@company.com', 'team@company.com', 'Meeting Schedule', '2024-01-16 14:00:00', 'msg004', 'Scheduling team meeting'),
                    (5, 'john@company.com', 'team@company.com', 'RE: Meeting Schedule', '2024-01-16 15:30:00', 'msg005', 'Confirming meeting time'),
                    (6, 'charlie@company.com', 'team@company.com', 'Budget Review', '2024-01-17 08:00:00', 'msg006', 'Quarterly budget review'),
                    (7, 'jane@company.com', 'team@company.com', 'FW: Budget Review', '2024-01-17 09:45:00', 'msg007', 'Forwarding budget information'),
                    (8, 'bob@company.com', 'team@company.com', 'RE: Budget Review', '2024-01-17 11:20:00', 'msg008', 'Budget feedback and comments')
            ) AS sample_data(id, from_email, to_email, subject, date_sent, message_id, body)
        `);

        console.log('✅ Sample data created\n');

        // Example 4: Perform thread analysis
        console.log('🔍 Analyzing email threads...');
        const analysisResult = await emailDB.analyzeEmailThreads('sample_emails');

        console.log('Thread Analysis Results:');
        console.log('- Total emails:', analysisResult.totalEmails);
        console.log('- Unique threads:', analysisResult.threadCount);
        console.log('- Top participants:', analysisResult.topParticipants.length);
        console.log('');

        console.log('Top 5 Email Threads:');
        analysisResult.topThreads.slice(0, 5).forEach((thread, index) => {
            console.log(`${index + 1}. ${thread.normalized_subject}`);
            console.log(`   Messages: ${thread.message_count}, Participants: ${thread.participant_count}`);
            console.log(`   Duration: ${thread.thread_duration_days} days`);
            console.log('');
        });

        // Example 5: Custom queries
        console.log('📊 Running custom analysis queries...');

        // Thread activity by day
        const dailyActivity = await emailDB.executeQuery(`
            SELECT
                DATE(date_sent) as email_date,
                COUNT(*) as emails_sent,
                COUNT(DISTINCT from_email) as active_senders
            FROM sample_emails
            GROUP BY DATE(date_sent)
            ORDER BY email_date
        `);

        console.log('Daily Email Activity:');
        dailyActivity.forEach(day => {
            console.log(`${day.email_date}: ${day.emails_sent} emails from ${day.active_senders} senders`);
        });
        console.log('');

        // Sender statistics
        const senderStats = await emailDB.executeQuery(`
            SELECT
                from_email,
                COUNT(*) as total_emails,
                COUNT(DISTINCT DATE(date_sent)) as active_days,
                MIN(date_sent) as first_email,
                MAX(date_sent) as last_email
            FROM sample_emails
            GROUP BY from_email
            ORDER BY total_emails DESC
        `);

        console.log('Sender Statistics:');
        senderStats.forEach(sender => {
            console.log(`${sender.from_email}: ${sender.total_emails} emails over ${sender.active_days} days`);
        });
        console.log('');

        // Example 6: Export results
        console.log('💾 Exporting results...');
        const exportPath = path.join(__dirname, '..', '..', 'exports');

        try {
            await require('fs-extra').ensureDir(exportPath);

            // Export thread analysis
            const threadExportPath = path.join(exportPath, 'email_threads_analysis.csv');
            await emailDB.exportResults('sample_emails_threads', threadExportPath, 'csv');
            console.log(`✅ Threads exported to: ${threadExportPath}`);

            // Export raw data as JSON
            const dataExportPath = path.join(exportPath, 'email_data.json');
            await emailDB.exportResults('sample_emails', dataExportPath, 'json');
            console.log(`✅ Data exported to: ${dataExportPath}`);

        } catch (exportError) {
            console.log('Export failed:', exportError.message);
        }

        // Example 7: Show loaded tables
        console.log('\n📋 Loaded Tables:');
        const tables = await emailDB.getLoadedTables();
        tables.forEach(table => {
            console.log(`- ${table.name} ${table.loaded ? '(loaded by EmailThreadDuckDB)' : '(system table)'}`);
        });

        console.log('\n🎉 Example completed successfully!');

    } catch (error) {
        console.error('❌ Example failed:', error.message);
        console.error(error.stack);
    } finally {
        // Cleanup
        await emailDB.cleanup();
        console.log('\n🧹 Database cleaned up');
    }
}

/**
 * Performance testing function
 * Tests the performance of various operations
 */
async function runPerformanceTest() {
    console.log('\n⚡ Running Performance Tests...\n');

    const emailDB = new EmailThreadDuckDB({ verbose: false });

    try {
        await emailDB.initialize();

        // Create larger dataset for performance testing
        console.log('Creating large dataset for performance testing...');
        const startTime = Date.now();

        await emailDB.executeQuery(`
            CREATE OR REPLACE TABLE large_email_dataset AS
            WITH RECURSIVE email_generator AS (
                SELECT
                    1 as id,
                    'user1@company.com' as from_email,
                    'team@company.com' as to_email,
                    'Test Subject ' || (id % 100) as subject,
                    '2024-01-01 08:00:00'::TIMESTAMP + INTERVAL (id) MINUTE as date_sent,
                    'msg' || LPAD(id::VARCHAR, 6, '0') as message_id,
                    'Email body content for message ' || id as body

                UNION ALL

                SELECT
                    id + 1,
                    'user' || ((id + 1) % 20 + 1) || '@company.com',
                    'team@company.com',
                    CASE
                        WHEN (id + 1) % 3 = 0 THEN 'RE: Test Subject ' || ((id + 1) % 100)
                        WHEN (id + 1) % 7 = 0 THEN 'FW: Test Subject ' || ((id + 1) % 100)
                        ELSE 'Test Subject ' || ((id + 1) % 100)
                    END,
                    '2024-01-01 08:00:00'::TIMESTAMP + INTERVAL (id + 1) MINUTE,
                    'msg' || LPAD((id + 1)::VARCHAR, 6, '0'),
                    'Email body content for message ' || (id + 1)
                FROM email_generator
                WHERE id < 10000
            )
            SELECT * FROM email_generator
        `);

        const dataCreationTime = Date.now() - startTime;
        console.log(`✅ Created 10,000 email records in ${dataCreationTime}ms`);

        // Test thread analysis performance
        console.log('Testing thread analysis performance...');
        const analysisStartTime = Date.now();

        const analysisResult = await emailDB.analyzeEmailThreads('large_email_dataset');

        const analysisTime = Date.now() - analysisStartTime;
        console.log(`✅ Analyzed ${analysisResult.totalEmails} emails in ${analysisTime}ms`);
        console.log(`   Found ${analysisResult.threadCount} unique threads`);

        // Test query performance
        console.log('Testing complex query performance...');
        const queryStartTime = Date.now();

        await emailDB.executeQuery(`
            SELECT
                DATE(date_sent) as day,
                COUNT(*) as total_emails,
                COUNT(DISTINCT from_email) as unique_senders,
                COUNT(DISTINCT REGEXP_REPLACE(UPPER(subject), '^(RE:|FWD?:|FW:)\\s*', '')) as unique_threads,
                AVG(LENGTH(body)) as avg_body_length
            FROM large_email_dataset
            GROUP BY DATE(date_sent)
            ORDER BY day
        `);

        const queryTime = Date.now() - queryStartTime;
        console.log(`✅ Complex aggregation query completed in ${queryTime}ms`);

        console.log('\n📊 Performance Summary:');
        console.log(`- Data Creation: ${dataCreationTime}ms for 10,000 records`);
        console.log(`- Thread Analysis: ${analysisTime}ms`);
        console.log(`- Complex Query: ${queryTime}ms`);

    } catch (error) {
        console.error('Performance test failed:', error.message);
    } finally {
        await emailDB.cleanup();
    }
}

// Run examples if this file is executed directly
if (require.main === module) {
    (async () => {
        await runExample();
        await runPerformanceTest();
    })();
}

module.exports = { runExample, runPerformanceTest };