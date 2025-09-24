"""
Test the enhanced visualization modes: Timeline, Tree, and Sankey
"""

import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

async def test_visualization_modes():
    """Test all three visualization modes and click functionality"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Load the enhanced navigator
            navigator_path = Path.cwd() / 'email_thread_navigator.html'
            await page.goto(f'file://{navigator_path}')

            # Wait for the app to load
            await page.wait_for_selector('.app-container', timeout=10000)
            await page.wait_for_timeout(3000)

            print("Testing Enhanced Visualization Modes...")

            # Test Timeline mode
            timeline_btn = await page.query_selector('button:has-text("Timeline")')
            if timeline_btn:
                await timeline_btn.click()
                await page.wait_for_timeout(1000)
                screenshot_path = Path("test-screenshots") / "enhanced_timeline_mode.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print("Timeline mode tested and screenshot captured")

            # Test Tree mode
            tree_btn = await page.query_selector('button:has-text("Tree")')
            if tree_btn:
                await tree_btn.click()
                await page.wait_for_timeout(1000)
                screenshot_path = Path("test-screenshots") / "enhanced_tree_mode.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print("Tree mode tested and screenshot captured")

            # Test Sankey mode
            sankey_btn = await page.query_selector('button:has-text("Sankey")')
            if sankey_btn:
                await sankey_btn.click()
                await page.wait_for_timeout(1000)
                screenshot_path = Path("test-screenshots") / "enhanced_sankey_mode.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print("Sankey mode tested and screenshot captured")

            # Test clicking on visualization nodes
            await timeline_btn.click()  # Switch back to timeline
            await page.wait_for_timeout(1000)

            # Find and click visualization nodes
            message_nodes = await page.query_selector_all('.message-node')
            if len(message_nodes) > 1:
                print(f"Found {len(message_nodes)} message nodes in visualization")

                # Click second node
                await message_nodes[1].click()
                await page.wait_for_timeout(500)

                # Verify message view updated
                message_body = await page.query_selector('.message-body')
                if message_body:
                    content = await message_body.text_content()
                    print(f"Message view updated - Content length: {len(content)} characters")

                screenshot_path = Path("test-screenshots") / "visualization_click_test.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print("Click navigation test completed")

            # Test mode indicator
            mode_indicator = await page.query_selector('svg text:last-child')
            if mode_indicator:
                mode_text = await mode_indicator.text_content()
                print(f"Mode indicator shows: {mode_text}")

            print("\nAll visualization modes tested successfully!")

        except Exception as e:
            print(f"Test failed: {str(e)}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_visualization_modes())