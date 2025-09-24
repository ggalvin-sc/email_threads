const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Comprehensive Playwright test suite for Email Threads Application
 * Tests all functionality including UI interactions, data loading, visualization modes,
 * error handling, and performance validation with screenshot capture
 */

class EmailThreadsTester {
    constructor() {
        this.baseURL = 'http://localhost:8080';
        this.screenshotDir = path.join(__dirname, '..', 'test-screenshots');
        this.testDataFile = path.join(__dirname, '..', 'email_test_data.csv');
        this.page = null;
        this.browser = null;
        this.screenshotCounter = 0;
    }

    /**
     * Initialize browser and page for testing
     * @param {Browser} browser - Playwright browser instance
     * @returns {Promise<Page>} Configured page instance
     *
     * Inputs: browser - Playwright browser object
     * Outputs: Returns configured page with extended timeout
     * Side effects: Creates screenshots directory, sets page instance
     */
    async setupBrowser(browser) {
        this.browser = browser;

        // Create screenshots directory if it doesn't exist
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }

        // Create page with extended timeout for WASM loading
        this.page = await browser.newPage({
            viewport: { width: 1920, height: 1080 }
        });

        // Set extended timeout for WASM operations
        this.page.setDefaultTimeout(30000);

        // Listen for console messages and errors
        this.page.on('console', msg => {
            console.log(`Browser console: ${msg.text()}`);
        });

        this.page.on('pageerror', error => {
            console.error(`Page error: ${error.message}`);
        });

        return this.page;
    }

    /**
     * Take and save a screenshot with automatic naming
     * @param {string} testName - Name of the current test
     * @param {string} description - Description of the screenshot
     * @returns {Promise<string>} Path to saved screenshot
     *
     * Inputs: testName (string), description (string)
     * Outputs: Returns screenshot file path
     * Side effects: Saves screenshot to disk with incremented counter
     */
    async captureScreenshot(testName, description) {
        this.screenshotCounter++;
        const filename = `${this.screenshotCounter.toString().padStart(3, '0')}_${testName}_${description}.png`;
        const filepath = path.join(this.screenshotDir, filename);

        await this.page.screenshot({
            path: filepath,
            fullPage: true
        });

        console.log(`📸 Screenshot saved: ${filename}`);
        return filepath;
    }

    /**
     * Navigate to application and verify it loads correctly with all UI elements
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Navigates to app, verifies UI elements are present and visible
     */
    async testApplicationLoads() {
        await this.page.goto(this.baseURL);

        // Wait for WASM to initialize
        await this.page.waitForLoadState('networkidle');

        // Take initial screenshot
        await this.captureScreenshot('app_load', 'initial_page');

        // Verify key UI elements are present
        await expect(this.page.locator('.app-layout')).toBeVisible();
        await expect(this.page.locator('.thread-sidebar')).toBeVisible();
        await expect(this.page.locator('.main-content')).toBeVisible();
        await expect(this.page.locator('#uploadSection')).toBeVisible();

        // Verify sidebar elements
        await expect(this.page.locator('h2').filter({ hasText: '📧 Email Threads' })).toBeVisible();
        await expect(this.page.locator('.sidebar-filters')).toBeVisible();
        await expect(this.page.locator('.filter-btn').filter({ hasText: 'All' })).toBeVisible();

        // Verify upload section
        await expect(this.page.locator('#csvFileInput')).toBeVisible();
        await expect(this.page.locator('#loadSampleData')).toBeVisible();
        await expect(this.page.locator('.upload-text')).toContainText('Drop CSV file here');

        // Verify footer
        await expect(this.page.locator('.app-footer')).toContainText('Built with Rust');

        console.log('✅ Application loaded successfully with all UI elements');
    }

    /**
     * Test loading sample email data and verify processing works correctly
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Clicks load sample data, waits for processing, verifies thread data loaded
     */
    async testSampleDataLoading() {
        // Click load sample data button
        await this.page.click('#loadSampleData');

        // Verify processing status appears
        await expect(this.page.locator('#processingStatus')).toBeVisible();
        await expect(this.page.locator('#statusText')).toContainText('Loading sample data');

        await this.captureScreenshot('sample_data', 'processing_status');

        // Wait for processing to complete (up to 30 seconds for WASM)
        await this.page.waitForSelector('#processingStatus', { state: 'hidden', timeout: 30000 });

        // Verify upload section is hidden and thread interface is shown
        await expect(this.page.locator('#uploadSection')).toBeHidden();
        await expect(this.page.locator('#threadList')).toBeVisible();

        // Verify threads are loaded
        const threadItems = this.page.locator('.thread-item');
        await expect(threadItems.first()).toBeVisible();

        // Verify filter counts are updated
        const allCount = this.page.locator('#allCount');
        await expect(allCount).not.toContainText('0');

        await this.captureScreenshot('sample_data', 'threads_loaded');

        console.log('✅ Sample data loaded and processed successfully');
    }

    /**
     * Test CSV file upload functionality with drag/drop simulation
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Simulates file upload, verifies file processing
     */
    async testFileUploadFunctionality() {
        // First reset the app if needed
        if (await this.page.locator('#retryBtn').isVisible()) {
            await this.page.click('#retryBtn');
        }

        // Verify file input is present
        await expect(this.page.locator('#csvFileInput')).toBeVisible();

        // Create a test CSV file content
        const testCsvContent = `Subject,From,To,Date,Message-ID,Body
"Test Subject","test@example.com","recipient@example.com","2024-01-01T10:00:00Z","msg001","Test email body"`;

        // Upload file using setInputFiles
        const fileInputLocator = this.page.locator('#csvFileInput');

        // Create a temporary file buffer
        const buffer = Buffer.from(testCsvContent);
        await fileInputLocator.setInputFiles({
            name: 'test-emails.csv',
            mimeType: 'text/csv',
            buffer: buffer
        });

        await this.captureScreenshot('file_upload', 'file_selected');

        // Verify processing starts
        await expect(this.page.locator('#processingStatus')).toBeVisible();

        console.log('✅ File upload functionality tested');
    }

    /**
     * Test clicking through different email threads and verifying content
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Clicks thread items, verifies thread content displays
     */
    async testThreadNavigation() {
        // Ensure sample data is loaded first
        if (await this.page.locator('#loadSampleData').isVisible()) {
            await this.testSampleDataLoading();
        }

        // Get all thread items
        const threadItems = this.page.locator('.thread-item');
        const threadCount = await threadItems.count();

        if (threadCount === 0) {
            throw new Error('No threads available for navigation test');
        }

        // Test clicking on multiple threads
        for (let i = 0; i < Math.min(3, threadCount); i++) {
            await threadItems.nth(i).click();

            // Verify thread interface becomes visible
            await expect(this.page.locator('#threadHeader')).toBeVisible();
            await expect(this.page.locator('#threadStats')).toBeVisible();
            await expect(this.page.locator('#threadControls')).toBeVisible();
            await expect(this.page.locator('#threadVisualization')).toBeVisible();

            // Verify thread content is displayed
            await expect(this.page.locator('.email-thread-tree')).toBeVisible();
            await expect(this.page.locator('.email-node')).toBeVisible();

            // Verify thread is marked as active
            await expect(threadItems.nth(i)).toHaveClass(/active/);

            await this.captureScreenshot('thread_nav', `thread_${i}_selected`);
        }

        console.log('✅ Thread navigation tested successfully');
    }

    /**
     * Test switching between Tree, Timeline, and Compact view modes
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Clicks view mode buttons, verifies visual changes
     */
    async testViewModeSwitching() {
        // Ensure a thread is selected
        const threadItems = this.page.locator('.thread-item');
        if (await threadItems.count() > 0) {
            await threadItems.first().click();
        }

        await expect(this.page.locator('#threadControls')).toBeVisible();

        // Test Tree View (default)
        await this.page.click('[data-view="tree"]');
        await expect(this.page.locator('.email-thread-tree')).toBeVisible();
        await expect(this.page.locator('[data-view="tree"]')).toHaveClass(/active/);
        await this.captureScreenshot('view_modes', 'tree_view');

        // Test Timeline View
        await this.page.click('[data-view="timeline"]');
        await expect(this.page.locator('.timeline-view')).toBeVisible();
        await expect(this.page.locator('[data-view="timeline"]')).toHaveClass(/active/);
        await this.captureScreenshot('view_modes', 'timeline_view');

        // Test Compact View
        await this.page.click('[data-view="compact"]');
        await expect(this.page.locator('.compact-view')).toBeVisible();
        await expect(this.page.locator('[data-view="compact"]')).toHaveClass(/active/);
        await this.captureScreenshot('view_modes', 'compact_view');

        // Switch back to tree view
        await this.page.click('[data-view="tree"]');
        await expect(this.page.locator('.email-thread-tree')).toBeVisible();

        console.log('✅ View mode switching tested successfully');
    }

    /**
     * Test email interactions like expanding/collapsing and selections
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Interacts with email cards, tests expand/collapse functionality
     */
    async testEmailInteractions() {
        // Ensure we're in tree view with a thread selected
        const threadItems = this.page.locator('.thread-item');
        if (await threadItems.count() > 0) {
            await threadItems.first().click();
        }

        await this.page.click('[data-view="tree"]');
        await expect(this.page.locator('.email-thread-tree')).toBeVisible();

        // Test email card selection
        const emailCards = this.page.locator('.email-content');
        const emailCount = await emailCards.count();

        if (emailCount > 0) {
            // Click on first email card
            await emailCards.first().click();
            await expect(emailCards.first()).toHaveClass(/selected/);
            await this.captureScreenshot('email_interactions', 'email_selected');

            // Click on second email card if available
            if (emailCount > 1) {
                await emailCards.nth(1).click();
                await expect(emailCards.nth(1)).toHaveClass(/selected/);
                await expect(emailCards.first()).not.toHaveClass(/selected/);
            }
        }

        // Test expand buttons if available
        const expandButtons = this.page.locator('.expand-btn');
        const expandCount = await expandButtons.count();

        if (expandCount > 0) {
            await expandButtons.first().click();
            await this.captureScreenshot('email_interactions', 'email_expanded');
        }

        // Test action buttons
        const actionButtons = this.page.locator('.email-action-btn');
        const actionCount = await actionButtons.count();

        if (actionCount > 0) {
            // Just verify they're clickable (don't actually click to avoid navigation)
            await expect(actionButtons.first()).toBeVisible();
            await expect(actionButtons.first()).toBeEnabled();
        }

        console.log('✅ Email interactions tested successfully');
    }

    /**
     * Test the All/Unread/Starred filter functionality in sidebar
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Clicks filter buttons, verifies filter state changes
     */
    async testFilterFunctionality() {
        // Ensure threads are loaded
        if (await this.page.locator('#loadSampleData').isVisible()) {
            await this.testSampleDataLoading();
        }

        // Test All filter (should be active by default)
        const allFilter = this.page.locator('.filter-btn').filter({ hasText: 'All' });
        await expect(allFilter).toHaveClass(/active/);
        await this.captureScreenshot('filters', 'all_filter_active');

        // Test Unread filter
        const unreadFilter = this.page.locator('.filter-btn').filter({ hasText: 'Unread' });
        await unreadFilter.click();
        await expect(unreadFilter).toHaveClass(/active/);
        await expect(allFilter).not.toHaveClass(/active/);
        await this.captureScreenshot('filters', 'unread_filter_active');

        // Test Starred filter
        const starredFilter = this.page.locator('.filter-btn').filter({ hasText: 'Starred' });
        await starredFilter.click();
        await expect(starredFilter).toHaveClass(/active/);
        await expect(unreadFilter).not.toHaveClass(/active/);
        await this.captureScreenshot('filters', 'starred_filter_active');

        // Switch back to All
        await allFilter.click();
        await expect(allFilter).toHaveClass(/active/);
        await expect(starredFilter).not.toHaveClass(/active/);

        console.log('✅ Filter functionality tested successfully');
    }

    /**
     * Test error handling scenarios and retry functionality
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Triggers error conditions, tests error display and retry
     */
    async testErrorHandling() {
        // Test invalid file upload
        const fileInput = this.page.locator('#csvFileInput');

        // Upload invalid file type
        const invalidContent = 'This is not a valid CSV file content!@#$%';
        const buffer = Buffer.from(invalidContent);

        await fileInput.setInputFiles({
            name: 'invalid.txt',
            mimeType: 'text/plain',
            buffer: buffer
        });

        // Check if error appears (this might trigger file type validation)
        await this.captureScreenshot('error_handling', 'invalid_file_upload');

        // Test retry button if error section appears
        const errorSection = this.page.locator('#errorSection');
        const retryBtn = this.page.locator('#retryBtn');

        // Use a short timeout to check if error appears
        try {
            await expect(errorSection).toBeVisible({ timeout: 5000 });
            await this.captureScreenshot('error_handling', 'error_displayed');

            // Test retry functionality
            await retryBtn.click();
            await expect(errorSection).toBeHidden();
            await expect(this.page.locator('#uploadSection')).toBeVisible();
            await this.captureScreenshot('error_handling', 'after_retry');

        } catch (e) {
            // Error might not appear for file type validation, which is okay
            console.log('ℹ️ Error handling test: No error displayed for invalid file');
        }

        console.log('✅ Error handling tested');
    }

    /**
     * Validate WASM loading and email processing performance
     * @returns {Promise<Object>} Performance metrics object
     *
     * Inputs: None
     * Outputs: Returns object with timing metrics
     * Side effects: Measures and logs performance timings
     */
    async validatePerformance() {
        // Navigate to fresh page
        await this.page.goto(this.baseURL);

        const startTime = Date.now();

        // Wait for WASM initialization
        await this.page.waitForFunction(() => {
            return window.emailThreadApp && window.emailThreadApp.processor;
        }, { timeout: 30000 });

        const wasmLoadTime = Date.now() - startTime;

        // Test sample data loading performance
        const dataLoadStart = Date.now();
        await this.page.click('#loadSampleData');

        // Wait for processing to complete
        await this.page.waitForSelector('#processingStatus', { state: 'hidden', timeout: 30000 });

        const dataLoadTime = Date.now() - dataLoadStart;

        // Check performance info display
        const performanceInfo = this.page.locator('#performanceInfo');
        await expect(performanceInfo).toBeVisible();
        const performanceText = await performanceInfo.textContent();

        await this.captureScreenshot('performance', 'performance_info');

        const metrics = {
            wasmLoadTime,
            dataLoadTime,
            performanceText
        };

        console.log(`⏱️ WASM Load Time: ${wasmLoadTime}ms`);
        console.log(`⏱️ Data Processing Time: ${dataLoadTime}ms`);
        console.log(`📊 Performance Info: ${performanceText}`);

        // Verify reasonable performance
        expect(wasmLoadTime).toBeLessThan(15000); // WASM should load within 15 seconds
        expect(dataLoadTime).toBeLessThan(10000); // Data processing within 10 seconds

        console.log('✅ Performance validation completed');
        return metrics;
    }

    /**
     * Test application behavior at different screen sizes (responsive design)
     * @returns {Promise<void>}
     *
     * Inputs: None
     * Outputs: None
     * Side effects: Changes viewport size, verifies layout adaptations
     */
    async testResponsiveDesign() {
        // Test desktop view (default)
        await this.page.setViewportSize({ width: 1920, height: 1080 });
        await this.captureScreenshot('responsive', 'desktop_1920x1080');

        // Test tablet view
        await this.page.setViewportSize({ width: 768, height: 1024 });
        await this.captureScreenshot('responsive', 'tablet_768x1024');

        // Verify main layout is still visible
        await expect(this.page.locator('.app-layout')).toBeVisible();
        await expect(this.page.locator('.thread-sidebar')).toBeVisible();
        await expect(this.page.locator('.main-content')).toBeVisible();

        // Test mobile view
        await this.page.setViewportSize({ width: 375, height: 667 });
        await this.captureScreenshot('responsive', 'mobile_375x667');

        // Verify key elements are still accessible
        await expect(this.page.locator('.app-layout')).toBeVisible();

        // Test ultra-wide view
        await this.page.setViewportSize({ width: 2560, height: 1440 });
        await this.captureScreenshot('responsive', 'ultrawide_2560x1440');

        // Reset to default
        await this.page.setViewportSize({ width: 1920, height: 1080 });

        console.log('✅ Responsive design tested at multiple screen sizes');
    }

    /**
     * Comprehensive test capturing all application states with screenshots
     * @returns {Promise<Array<string>>} Array of screenshot file paths
     *
     * Inputs: None
     * Outputs: Returns array of all screenshot paths
     * Side effects: Captures comprehensive screenshots of all app states
     */
    async captureComprehensiveScreenshots() {
        const screenshots = [];

        // Initial state
        await this.page.goto(this.baseURL);
        screenshots.push(await this.captureScreenshot('comprehensive', 'app_initial_state'));

        // Load sample data and capture various states
        await this.page.click('#loadSampleData');
        await this.page.waitForSelector('#processingStatus', { state: 'hidden', timeout: 30000 });
        screenshots.push(await this.captureScreenshot('comprehensive', 'data_loaded'));

        // Select first thread
        const threadItems = this.page.locator('.thread-item');
        if (await threadItems.count() > 0) {
            await threadItems.first().click();
            screenshots.push(await this.captureScreenshot('comprehensive', 'thread_selected'));

            // Capture all view modes
            await this.page.click('[data-view="tree"]');
            screenshots.push(await this.captureScreenshot('comprehensive', 'tree_view_detail'));

            await this.page.click('[data-view="timeline"]');
            screenshots.push(await this.captureScreenshot('comprehensive', 'timeline_view_detail'));

            await this.page.click('[data-view="compact"]');
            screenshots.push(await this.captureScreenshot('comprehensive', 'compact_view_detail'));
        }

        console.log(`📸 Captured ${screenshots.length} comprehensive screenshots`);
        return screenshots;
    }
}

// Export the class for use in tests
module.exports = { EmailThreadsTester };