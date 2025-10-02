const { chromium } = require('playwright');

async function testPage() {
  console.log('Starting Playwright test...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  const page = await browser.newPage();

  // Listen for console messages from the page
  page.on('console', msg => {
    console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`);
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  // Navigate to the page
  console.log('Navigating to page...');
  try {
    await page.goto('http://localhost:8081/hybrid_thread_navigator.html', {
      waitUntil: 'networkidle'
    });

    console.log('Page loaded, taking screenshot...');
    await page.screenshot({ path: 'page_screenshot.png', fullPage: true });

    console.log('Getting page content...');
    const title = await page.title();
    console.log('Page title:', title);

    // Check if React app loaded
    const appContainer = await page.locator('#root').count();
    console.log('App container found:', appContainer > 0);

    // Check for any visible text
    const bodyText = await page.locator('body').textContent();
    console.log('Page text length:', bodyText.length);
    console.log('First 500 chars:', bodyText.substring(0, 500));

    // Check for threads
    const threadItems = await page.locator('.thread-item').count();
    console.log('Thread items found:', threadItems);

    // Wait a bit to see if anything loads
    await page.waitForTimeout(5000);

    // Take another screenshot
    await page.screenshot({ path: 'page_screenshot_after_wait.png', fullPage: true });

    console.log('Test complete, keeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ path: 'error_screenshot.png', fullPage: true });
  }

  await browser.close();
  console.log('Browser closed');
}

testPage().catch(console.error);