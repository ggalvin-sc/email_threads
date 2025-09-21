// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for Email Threads Application testing
 * Optimized for WASM applications with extended timeouts and comprehensive reporting
 */
module.exports = defineConfig({
  // Test directory
  testDir: './tests',

  // Global timeout for entire test suite
  globalTimeout: 300000, // 5 minutes

  // Timeout for individual tests (increased for WASM loading)
  timeout: 60000, // 60 seconds

  // Expect timeout for assertions
  expect: {
    timeout: 10000 // 10 seconds
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 1,

  // Opt out of parallel tests for better screenshot organization
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  // Global test setup
  globalSetup: require.resolve('./tests/global-setup.js'),

  // Shared settings for all the projects below
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:8080',

    // Browser context options
    viewport: { width: 1920, height: 1080 },

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Record video for failed tests
    video: 'retain-on-failure',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Extended action timeout for WASM operations
    actionTimeout: 30000,

    // Extended navigation timeout
    navigationTimeout: 30000,

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,

    // User agent
    userAgent: 'Playwright Email Threads Tester'
  },

  // Test output directory
  outputDir: 'test-results',

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Additional Chrome-specific options for WASM
        launchOptions: {
          args: [
            '--enable-features=SharedArrayBuffer',
            '--enable-webassembly',
            '--no-sandbox',
            '--disable-web-security'
          ]
        }
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Firefox-specific options for WASM
        launchOptions: {
          firefoxUserPrefs: {
            'javascript.options.shared_memory': true,
            'dom.postMessage.sharedArrayBuffer.bypassCOOP_COEP.insecure.enabled': true
          }
        }
      },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet testing
    {
      name: 'Tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 768 }
      },
    }
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'cd www && npm start',
    port: 8080,
    timeout: 120000, // 2 minutes to start server
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe'
  },
});