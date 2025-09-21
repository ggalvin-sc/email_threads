const path = require('path');
const fs = require('fs');

/**
 * Utility class for Email Threads Playwright testing
 * Handles browser setup, screenshot management, and test utilities
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
        await this.page.waitForSelector('.app-layout', { state: 'visible' });
        await this.page.waitForSelector('.thread-sidebar', { state: 'visible' });
        await this.page.waitForSelector('.main-content', { state: 'visible' });
        await this.page.waitForSelector('#uploadSection', { state: 'visible' });

        // Verify sidebar elements
        await this.page.waitForSelector('h2:has-text("📧 Email Threads")', { state: 'visible' });
        await this.page.waitForSelector('.sidebar-filters', { state: 'visible' });
        await this.page.waitForSelector('.filter-btn:has-text("All")', { state: 'visible' });

        // Verify upload section
        await this.page.waitForSelector('#csvFileInput', { state: 'visible' });
        await this.page.waitForSelector('#loadSampleData', { state: 'visible' });

        // Verify footer
        await this.page.waitForSelector('.app-footer:has-text("Built with Rust")', { state: 'visible' });

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
        await this.page.waitForSelector('#processingStatus', { state: 'visible' });

        await this.captureScreenshot('sample_data', 'processing_status');

        // Wait for processing to complete (up to 30 seconds for WASM)
        await this.page.waitForSelector('#processingStatus', { state: 'hidden', timeout: 30000 });

        // Verify upload section is hidden and thread interface is shown
        await this.page.waitForSelector('#uploadSection', { state: 'hidden' });
        await this.page.waitForSelector('#threadList', { state: 'visible' });

        // Verify threads are loaded
        await this.page.waitForSelector('.thread-item', { state: 'visible' });

        await this.captureScreenshot('sample_data', 'threads_loaded');

        console.log('✅ Sample data loaded and processed successfully');
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

        // Test clicking on first thread
        await threadItems.first().click();

        // Verify thread interface becomes visible
        await this.page.waitForSelector('#threadHeader', { state: 'visible' });
        await this.page.waitForSelector('#threadStats', { state: 'visible' });
        await this.page.waitForSelector('#threadControls', { state: 'visible' });
        await this.page.waitForSelector('#threadVisualization', { state: 'visible' });

        // Verify thread content is displayed
        await this.page.waitForSelector('.email-thread-tree', { state: 'visible' });

        await this.captureScreenshot('thread_nav', 'thread_selected');

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

        await this.page.waitForSelector('#threadControls', { state: 'visible' });

        // Test Tree View (default)
        await this.page.click('[data-view="tree"]');
        await this.page.waitForSelector('.email-thread-tree', { state: 'visible' });
        await this.captureScreenshot('view_modes', 'tree_view');

        // Test Timeline View
        await this.page.click('[data-view="timeline"]');
        await this.page.waitForSelector('.timeline-view', { state: 'visible' });
        await this.captureScreenshot('view_modes', 'timeline_view');

        // Test Compact View
        await this.page.click('[data-view="compact"]');
        await this.page.waitForSelector('.compact-view', { state: 'visible' });
        await this.captureScreenshot('view_modes', 'compact_view');

        // Switch back to tree view
        await this.page.click('[data-view="tree"]');
        await this.page.waitForSelector('.email-thread-tree', { state: 'visible' });

        console.log('✅ View mode switching tested successfully');
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