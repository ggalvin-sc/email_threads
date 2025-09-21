const { test, expect } = require('@playwright/test');
const { EmailThreadsTester } = require('./email-threads-utils.js');

/**
 * Pytest-style test suite for Email Threads Application
 * Comprehensive testing with automatic screenshots and performance validation
 */

let tester;

test.describe('Email Threads Application - Comprehensive Test Suite', () => {
    test.beforeEach(async ({ browser }) => {
        tester = new EmailThreadsTester();
        await tester.setupBrowser(browser);
    });

    /**
     * Test: Application Initial Load
     * Verifies the application loads correctly with all required UI elements
     */
    test('should load application with all UI elements visible', async () => {
        await tester.testApplicationLoads();

        // Additional verification
        expect(await tester.page.title()).toContain('Email Thread Analyzer');

        // Verify WASM loading message appears in performance info
        await expect(tester.page.locator('#performanceInfo')).toContainText('WASM module loaded');
    });

    /**
     * Test: Sample Data Loading
     * Tests the complete flow of loading sample email data
     */
    test('should load and process sample email data successfully', async () => {
        await tester.testApplicationLoads();
        await tester.testSampleDataLoading();

        // Verify thread count is reasonable
        const threadItems = tester.page.locator('.thread-item');
        const count = await threadItems.count();
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(1000); // Reasonable upper bound
    });

    /**
     * Test: File Upload Functionality
     * Tests CSV file upload with various file types and content
     */
    test('should handle file upload correctly', async () => {
        await tester.testApplicationLoads();
        await tester.testFileUploadFunctionality();

        // Additional file type validation
        const fileInput = tester.page.locator('#csvFileInput');
        expect(await fileInput.getAttribute('accept')).toContain('.csv');
        expect(await fileInput.getAttribute('accept')).toContain('.dat');
    });

    /**
     * Test: Thread Navigation
     * Tests clicking through different threads and content verification
     */
    test('should navigate between threads correctly', async () => {
        await tester.testApplicationLoads();
        await tester.testSampleDataLoading();
        await tester.testThreadNavigation();

        // Verify thread stats are displayed
        await expect(tester.page.locator('#participantCount')).toBeVisible();
        await expect(tester.page.locator('#messageCount')).toBeVisible();
        await expect(tester.page.locator('#lastActivity')).toBeVisible();
    });

    /**
     * Test: View Mode Switching
     * Tests all three view modes (Tree, Timeline, Compact)
     */
    test('should switch between view modes correctly', async () => {
        await tester.testApplicationLoads();
        await tester.testSampleDataLoading();
        await tester.testViewModeSwitching();

        // Verify view controls are functional
        const sortSelect = tester.page.locator('.sort-select');
        await expect(sortSelect).toBeVisible();
        await expect(sortSelect).toBeEnabled();
    });

    /**
     * Test: Email Interactions
     * Tests email card interactions, expansion, and selection
     */
    test('should handle email interactions correctly', async () => {
        await tester.testApplicationLoads();
        await tester.testSampleDataLoading();
        await tester.testEmailInteractions();

        // Verify email content structure
        const emailNodes = tester.page.locator('.email-node');
        if (await emailNodes.count() > 0) {
            await expect(emailNodes.first().locator('.email-author-info')).toBeVisible();
            await expect(emailNodes.first().locator('.email-subject')).toBeVisible();
        }
    });

    /**
     * Test: Filter Functionality
     * Tests All/Unread/Starred filters in the sidebar
     */
    test('should handle filter functionality correctly', async () => {
        await tester.testApplicationLoads();
        await tester.testFilterFunctionality();

        // Verify filter counts are numeric
        const allCount = await tester.page.locator('#allCount').textContent();
        expect(parseInt(allCount)).toBeGreaterThanOrEqual(0);
    });

    /**
     * Test: Error Handling
     * Tests error scenarios and recovery mechanisms
     */
    test('should handle errors gracefully', async () => {
        await tester.testApplicationLoads();
        await tester.testErrorHandling();

        // Verify error section exists and can be shown
        const errorSection = tester.page.locator('#errorSection');
        await expect(errorSection).toBeAttached();

        const retryBtn = tester.page.locator('#retryBtn');
        await expect(retryBtn).toBeAttached();
    });

    /**
     * Test: Performance Validation
     * Tests WASM loading and processing performance
     */
    test('should meet performance requirements', async () => {
        const metrics = await tester.validatePerformance();

        // Validate performance metrics
        expect(metrics.wasmLoadTime).toBeLessThan(15000); // 15 seconds max for WASM
        expect(metrics.dataLoadTime).toBeLessThan(10000);  // 10 seconds max for data processing
        expect(metrics.performanceText).toBeTruthy();

        console.log('Performance metrics:', metrics);
    });

    /**
     * Test: Responsive Design
     * Tests application behavior at different screen sizes
     */
    test('should be responsive across different screen sizes', async () => {
        await tester.testApplicationLoads();
        await tester.testResponsiveDesign();

        // Verify layout doesn't break at mobile size
        await tester.page.setViewportSize({ width: 375, height: 667 });
        await expect(tester.page.locator('.app-layout')).toBeVisible();

        // Reset viewport
        await tester.page.setViewportSize({ width: 1920, height: 1080 });
    });

    /**
     * Test: Comprehensive Screenshot Capture
     * Captures screenshots of all major application states
     */
    test('should capture comprehensive screenshots for documentation', async () => {
        const screenshots = await tester.captureComprehensiveScreenshots();

        // Verify screenshots were created
        expect(screenshots.length).toBeGreaterThan(0);

        // Each screenshot path should be valid
        screenshots.forEach(screenshot => {
            expect(screenshot).toMatch(/\.png$/);
            expect(screenshot).toContain('comprehensive');
        });

        console.log(`Generated ${screenshots.length} documentation screenshots`);
    });

    /**
     * Test: End-to-End Workflow
     * Tests the complete user workflow from start to finish
     */
    test('should complete full user workflow successfully', async () => {
        // Complete workflow test
        await tester.testApplicationLoads();
        await tester.testSampleDataLoading();
        await tester.testThreadNavigation();
        await tester.testViewModeSwitching();
        await tester.testEmailInteractions();
        await tester.testFilterFunctionality();

        // Verify final state
        await expect(tester.page.locator('.email-thread-tree')).toBeVisible();
        await expect(tester.page.locator('#threadHeader')).toBeVisible();

        // Final comprehensive screenshot
        await tester.captureScreenshot('workflow', 'complete_workflow_final');

        console.log('✅ Complete end-to-end workflow test passed');
    });

    /**
     * Test: WASM Integration
     * Specific tests for WebAssembly integration and functionality
     */
    test('should integrate correctly with WASM module', async () => {
        await tester.page.goto(tester.baseURL);

        // Wait for WASM to load
        await tester.page.waitForFunction(() => {
            return window.emailThreadApp &&
                   window.emailThreadApp.processor &&
                   typeof window.emailThreadApp.processor.load_emails_from_csv === 'function';
        });

        // Verify WASM methods are available
        const wasmMethods = await tester.page.evaluate(() => {
            const processor = window.emailThreadApp.processor;
            return {
                hasLoadEmails: typeof processor.load_emails_from_csv === 'function',
                hasGroupThreads: typeof processor.group_by_threads === 'function',
                hasGetThreadIds: typeof processor.get_thread_ids === 'function',
                hasBuildTree: typeof processor.build_thread_tree === 'function',
                hasGenerateStats: typeof processor.generate_thread_stats === 'function'
            };
        });

        // Verify all required WASM methods are available
        expect(wasmMethods.hasLoadEmails).toBe(true);
        expect(wasmMethods.hasGroupThreads).toBe(true);
        expect(wasmMethods.hasGetThreadIds).toBe(true);
        expect(wasmMethods.hasBuildTree).toBe(true);
        expect(wasmMethods.hasGenerateStats).toBe(true);

        await tester.captureScreenshot('wasm', 'integration_verified');

        console.log('✅ WASM integration verified successfully');
    });
});

/**
 * Test configuration and setup
 */
test.describe.configure({
    mode: 'serial',  // Run tests in series for better screenshot organization
    timeout: 60000   // 60 second timeout for WASM operations
});

/**
 * Global test hooks for cleanup and reporting
 */
test.afterAll(async () => {
    console.log('\n📊 Test Suite Summary:');
    console.log('- All email threads application functionality tested');
    console.log('- Screenshots captured for documentation');
    console.log('- Performance metrics validated');
    console.log('- WASM integration verified');
    console.log('- Responsive design confirmed');
    console.log('\n✅ Email Threads Application Test Suite Complete');
});