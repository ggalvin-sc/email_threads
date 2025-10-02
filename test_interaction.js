const { chromium } = require('playwright');

async function testInteraction() {
  console.log('Starting Playwright interaction test...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 2000
  });

  const page = await browser.newPage();

  // Listen for console messages from the page
  page.on('console', msg => {
    console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`);
  });

  // Navigate to the page
  console.log('Navigating to page...');
  await page.goto('http://localhost:8081/hybrid_thread_navigator.html', {
    waitUntil: 'networkidle'
  });

  // Wait for threads to load
  await page.waitForTimeout(2000);

  console.log('Taking screenshot before interaction...');
  await page.screenshot({ path: 'before_click.png', fullPage: true });

  // Click on the first thread
  console.log('Clicking on first thread...');
  const firstThread = page.locator('.thread-item').first();
  await firstThread.click();

  // Wait for the content to load
  await page.waitForTimeout(3000);

  console.log('Taking screenshot after thread click...');
  await page.screenshot({ path: 'after_thread_click.png', fullPage: true });

  // Check if messages loaded
  const messageCount = await page.locator('.message').count();
  console.log('Message elements found:', messageCount);

  // Check the timeline
  const timelineNodes = await page.locator('.timeline-node').count();
  console.log('Timeline nodes found:', timelineNodes);

  // Check attachments section
  const attachmentSection = await page.locator('h3:has-text("Thread Attachments")').count();
  console.log('Attachment section found:', attachmentSection > 0);

  // Get current center content
  const centerContent = await page.locator('.center-content').textContent();
  console.log('Center content (first 500 chars):', centerContent.substring(0, 500));

  console.log('Test complete, keeping browser open for 60 seconds...');
  await page.waitForTimeout(60000);

  await browser.close();
  console.log('Browser closed');
}

testInteraction().catch(console.error);