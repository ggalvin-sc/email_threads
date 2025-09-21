/**
 * Global setup for Playwright tests
 * Ensures the Email Threads application is ready for testing
 */

const { chromium } = require('@playwright/test');

async function globalSetup() {
  console.log('🚀 Starting Email Threads Application Test Setup...');

  // Create a browser instance to verify the application is accessible
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the application to be accessible
    console.log('🔍 Checking application availability...');
    await page.goto('http://localhost:8080');

    // Wait for the main application elements to load
    await page.waitForSelector('.app-layout', { timeout: 30000 });

    // Verify WASM module can be initialized
    console.log('⚡ Verifying WASM initialization...');
    await page.waitForFunction(() => {
      return window.emailThreadApp !== undefined;
    }, { timeout: 30000 });

    console.log('✅ Application is ready for testing');

  } catch (error) {
    console.error('❌ Application setup failed:', error.message);
    throw new Error('Email Threads Application is not accessible for testing');
  } finally {
    await browser.close();
  }

  console.log('🎯 Test setup completed successfully');
}

module.exports = globalSetup;