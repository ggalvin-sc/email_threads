"""
Test the enhanced Email Thread Navigator features
"""

import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

async def test_enhanced_features():
    """Test enhanced features: color coding, filters, keyboard shortcuts, etc."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Navigate to the enhanced navigator
            navigator_path = Path.cwd() / 'email_thread_navigator.html'
            await page.goto(f'file://{navigator_path}')

            # Listen for console errors
            page.on('console', lambda msg: print(f"Console: {msg.text}"))
            page.on('pageerror', lambda error: print(f"Page error: {error}"))

            # Wait for app with longer timeout
            try:
                await page.wait_for_selector('.app-container', timeout=15000)
                print("✓ App container loaded successfully")
            except Exception as e:
                print(f"Failed to load app container: {e}")

                # Check for JavaScript errors
                errors = await page.evaluate("""
                    () => {
                        const errors = [];
                        window.addEventListener('error', (e) => {
                            errors.push(e.message);
                        });
                        return errors;
                    }
                """)
                print(f"JavaScript errors: {errors}")
                return

            # Test progress indicator
            progress_element = await page.query_selector('.thread-progress')
            if progress_element:
                progress_text = await progress_element.text_content()
                print(f"✓ Progress indicator: {progress_text}")

            # Test rating filters
            filter_chips = await page.query_selector_all('.filter-chip')
            print(f"✓ Found {len(filter_chips)} rating filter chips")

            # Test rating filter functionality
            if len(filter_chips) > 1:
                await filter_chips[1].click()  # Click "hot" filter
                await page.wait_for_timeout(500)
                print("✓ Rating filter clicked successfully")

            # Test thread nodes with color coding
            thread_nodes = await page.query_selector_all('.thread-node')
            print(f"✓ Found {len(thread_nodes)} thread nodes")

            # Check for color-coded classes
            for i, node in enumerate(thread_nodes[:3]):  # Check first 3 nodes
                class_name = await node.get_attribute('class')
                print(f"  Node {i+1} classes: {class_name}")

            # Test hover preview
            if len(thread_nodes) > 0:
                await thread_nodes[0].hover()
                await page.wait_for_timeout(1000)

                preview = await page.query_selector('.message-preview.visible')
                if preview:
                    print("✓ Hover preview appeared")
                else:
                    print("- Hover preview not visible")

            # Test keyboard shortcuts info
            shortcuts_section = await page.query_selector('.keyboard-shortcuts')
            if shortcuts_section:
                print("✓ Keyboard shortcuts section found")

            # Take screenshot
            screenshot_path = Path("test-screenshots") / "enhanced_features_test.png"
            screenshot_path.parent.mkdir(exist_ok=True)
            await page.screenshot(path=str(screenshot_path), full_page=True)
            print(f"✓ Screenshot saved: {screenshot_path}")

            print("\nEnhanced features test completed successfully!")

        except Exception as e:
            print(f"Test failed: {str(e)}")
            import traceback
            traceback.print_exc()

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_enhanced_features())