"""
Test the complex email thread with multiple branches in all visualization modes
"""

import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

async def test_complex_thread_visualization():
    """Test the complex email thread with all visualization modes"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Load the enhanced navigator
            navigator_path = Path.cwd() / 'email_thread_navigator.html'
            await page.goto(f'file://{navigator_path}')

            # Wait for the app to load
            await page.wait_for_selector('.app-container', timeout=10000)
            await page.wait_for_timeout(4000)  # Extra time for complex data

            print("Testing Complex Email Thread Visualization...")

            # Check thread info
            thread_info = await page.query_selector('.nav-subtitle')
            if thread_info:
                info_text = await thread_info.text_content()
                print(f"Thread info: {info_text}")

            # Test Timeline mode with complex data
            timeline_btn = await page.query_selector('button:has-text("Timeline")')
            if timeline_btn:
                await timeline_btn.click()
                await page.wait_for_timeout(2000)

                # Count nodes in visualization
                viz_nodes = await page.query_selector_all('.message-node')
                print(f"Timeline mode: Found {len(viz_nodes)} nodes in visualization")

                screenshot_path = Path("test-screenshots") / "complex_timeline_mode.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print("Complex timeline mode screenshot captured")

            # Test Tree mode with complex data
            tree_btn = await page.query_selector('button:has-text("Tree")')
            if tree_btn:
                await tree_btn.click()
                await page.wait_for_timeout(2000)

                # Count connections in tree view
                connections = await page.query_selector_all('.tree-connection')
                print(f"Tree mode: Found {len(connections)} connections")

                screenshot_path = Path("test-screenshots") / "complex_tree_mode.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print("Complex tree mode screenshot captured")

            # Test Sankey mode with complex data
            sankey_btn = await page.query_selector('button:has-text("Sankey")')
            if sankey_btn:
                await sankey_btn.click()
                await page.wait_for_timeout(2000)

                # Count flows in sankey view
                flows = await page.query_selector_all('.sankey-flow')
                print(f"Sankey mode: Found {len(flows)} flows")

                screenshot_path = Path("test-screenshots") / "complex_sankey_mode.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print("Complex sankey mode screenshot captured")

            # Test navigation through complex thread
            await timeline_btn.click()  # Back to timeline
            await page.wait_for_timeout(1000)

            # Count thread tree nodes
            thread_nodes = await page.query_selector_all('.thread-node')
            print(f"Thread tree: Found {len(thread_nodes)} thread nodes")

            # Test clicking on different branches
            if len(viz_nodes) > 5:
                print("Testing navigation through different email branches...")

                # Click on different nodes to test navigation
                for i in [0, 3, 7, 12] if len(viz_nodes) > 12 else [0, min(2, len(viz_nodes)-1)]:
                    if i < len(viz_nodes):
                        await viz_nodes[i].click()
                        await page.wait_for_timeout(500)

                        # Check if message content updated
                        message_body = await page.query_selector('.message-body')
                        if message_body:
                            content = await message_body.text_content()
                            print(f"Clicked node {i}: Message content length = {len(content)} chars")

            # Take final overview screenshot
            screenshot_path = Path("test-screenshots") / "complex_thread_overview.png"
            await page.screenshot(path=str(screenshot_path), full_page=True)
            print("Complex thread overview screenshot captured")

            # Test search functionality with complex data
            search_box = await page.query_selector('.thread-search')
            if search_box:
                await search_box.fill('ceo')
                await page.wait_for_timeout(1000)

                filtered_nodes = await page.query_selector_all('.thread-node')
                print(f"Search 'ceo': Found {len(filtered_nodes)} matching messages")

                screenshot_path = Path("test-screenshots") / "complex_search_results.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print("Complex search results screenshot captured")

                # Clear search
                await search_box.fill('')
                await page.wait_for_timeout(500)

            print("\nComplex email thread visualization testing complete!")
            print("The complex thread demonstrates:")
            print("- Multiple conversation branches from single root")
            print("- Deep threading with sub-conversations")
            print("- Different stakeholders and roles")
            print("- Varied attachment patterns")
            print("- Complex decision-making processes")

        except Exception as e:
            print(f"Test failed: {str(e)}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_complex_thread_visualization())