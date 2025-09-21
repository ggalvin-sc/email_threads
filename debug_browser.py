"""
Simple browser debug to check for JavaScript console errors
"""

import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

async def debug_browser():
    """Open browser and check for console errors"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        # Collect console messages
        console_messages = []
        page.on('console', lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
        page.on('pageerror', lambda error: console_messages.append(f"ERROR: {error}"))

        try:
            navigator_path = Path.cwd() / 'email_thread_navigator.html'
            await page.goto(f'file://{navigator_path}')

            # Wait a bit for any errors to appear
            await page.wait_for_timeout(5000)

            print("Console messages:")
            for msg in console_messages:
                print(f"  {msg}")

            # Check if React loaded
            react_loaded = await page.evaluate("typeof React !== 'undefined'")
            print(f"React loaded: {react_loaded}")

            # Check if our app component exists
            app_exists = await page.evaluate("typeof EmailThreadNavigator !== 'undefined'")
            print(f"EmailThreadNavigator defined: {app_exists}")

            # Keep browser open for manual inspection
            input("Press Enter to close browser...")

        except Exception as e:
            print(f"Error: {e}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_browser())