"""
Test minimal React setup
"""

import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

async def test_minimal():
    """Test minimal React setup"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            minimal_path = Path.cwd() / 'test_minimal.html'
            await page.goto(f'file://{minimal_path}')

            # Wait for content
            await page.wait_for_timeout(2000)

            content = await page.content()
            if 'Hello World' in content:
                print("✓ Minimal React test works")
            else:
                print("✗ Minimal React test failed")

            input("Check browser - press Enter to continue...")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_minimal())