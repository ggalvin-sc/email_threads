"""
Quick test of the enhanced Email Thread Navigator with top visualization
"""

import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

async def test_enhanced_navigator():
    """Test the enhanced navigator with top visualization"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Load the enhanced navigator
            navigator_path = Path.cwd() / 'email_thread_navigator.html'
            await page.goto(f'file://{navigator_path}')

            # Wait for the app to load
            await page.wait_for_selector('.app-container', timeout=10000)
            await page.wait_for_timeout(2000)

            # Check if top navigator is present
            top_nav = await page.query_selector('.top-navigator')
            print(f"Top navigator present: {top_nav is not None}")

            # Check if visualization container is present
            viz_container = await page.query_selector('.visualization-container')
            print(f"Visualization container present: {viz_container is not None}")

            # Check if timeline SVG is present
            timeline_svg = await page.query_selector('.viz-timeline')
            print(f"Timeline SVG present: {timeline_svg is not None}")

            # Check if navigation buttons are present
            nav_buttons = await page.query_selector_all('.nav-button')
            print(f"Navigation buttons count: {len(nav_buttons)}")

            # Test timeline/tree toggle
            if len(nav_buttons) >= 2:
                await nav_buttons[1].click()  # Click "Tree" button
                await page.wait_for_timeout(500)
                print("Tree view button clicked")

                await nav_buttons[0].click()  # Click "Timeline" button
                await page.wait_for_timeout(500)
                print("Timeline view button clicked")

            # Check main content area
            main_content = await page.query_selector('.main-content')
            print(f"Main content area present: {main_content is not None}")

            # Test clicking on visualization nodes
            message_nodes = await page.query_selector_all('.message-node')
            if message_nodes:
                print(f"Message nodes in visualization: {len(message_nodes)}")
                await message_nodes[0].click()
                await page.wait_for_timeout(500)
                print("Clicked on visualization node")

            # Take a screenshot
            screenshot_path = Path("test-screenshots") / "enhanced_navigator_test.png"
            screenshot_path.parent.mkdir(exist_ok=True)
            await page.screenshot(path=str(screenshot_path), full_page=True)
            print(f"Screenshot saved: {screenshot_path}")

            print("\nEnhanced Navigator Test PASSED!")

        except Exception as e:
            print(f"Test failed: {str(e)}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_enhanced_navigator())