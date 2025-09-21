/**
 * Debug script to check DuckDB table creation and detection
 */

const { EmailThreadDuckDB } = require('./EmailThreadDuckDB');

async function debugTables() {
    console.log('🔍 Debugging DuckDB table creation and detection...\n');

    const emailDB = new EmailThreadDuckDB({ verbose: true });

    try {
        await emailDB.initialize();

        // Create a simple test table
        console.log('Creating test table...');
        await emailDB.executeQuery(`
            CREATE OR REPLACE TABLE test_table AS
            SELECT * FROM (VALUES
                (1, 'test@example.com', 'Test Subject', '2024-01-01'),
                (2, 'user@example.com', 'Another Subject', '2024-01-02')
            ) AS test_data(id, email, subject, date)
        `);

        // Check what tables exist
        console.log('\nChecking existing tables...');
        const tables = await emailDB.executeQuery("SHOW TABLES");
        console.log('Tables found:', tables);

        // Try to describe the test table
        console.log('\nDescribing test table...');
        const schema = await emailDB.executeQuery("DESCRIBE test_table");
        console.log('Schema:', schema);

        // Try to select from the table
        console.log('\nSelecting from test table...');
        const data = await emailDB.executeQuery("SELECT * FROM test_table");
        console.log('Data:', data);

        // Test the table existence check
        console.log('\nTesting table existence check...');
        const tableExists = tables.some(row => {
            console.log('Checking row:', row);
            const tableName_found = row.name || row.table_name || Object.values(row)[0];
            console.log('Table name found:', tableName_found);
            return tableName_found === 'test_table';
        });

        console.log('Table exists result:', tableExists);

    } catch (error) {
        console.error('Debug failed:', error);
    } finally {
        await emailDB.cleanup();
    }
}

debugTables();