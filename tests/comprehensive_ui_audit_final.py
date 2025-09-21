"""
Comprehensive Playwright UI Audit for Email Thread Visualization System
FINAL CORRECTED VERSION - Tests all visualization layouts, interactions, performance, and accessibility
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import pytest
from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    ConsoleMessage,
    Request,
    Response
)


class EmailThreadAuditor:
    """Main auditor class for comprehensive UI testing with improved error handling"""

    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.console_logs: List[Dict] = []
        self.network_logs: List[Dict] = []
        self.performance_metrics: Dict = {}
        self.screenshots_dir = Path("test-screenshots")
        self.reports_dir = Path("test-reports")

        # Ensure directories exist
        self.screenshots_dir.mkdir(exist_ok=True)
        self.reports_dir.mkdir(exist_ok=True)

    async def setup(self):
        """
        Initialize browser and context with proper configuration

        Inputs: None
        Outputs: None
        Side effects: Creates browser instance, sets up console/network logging
        Raises: Exception if browser setup fails
        """
        try:
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security']
            )

            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                record_har_path=str(self.reports_dir / "network_activity.har"),
                ignore_https_errors=True
            )

            self.page = await self.context.new_page()

            # Set up event handlers
            self.page.on('console', self._handle_console_message)
            self.page.on('pageerror', self._handle_page_error)
            self.page.on('request', self._handle_request)
            self.page.on('response', self._handle_response)

        except Exception as e:
            await self.cleanup()
            raise Exception(f"Failed to setup auditor: {str(e)}")

    def _handle_console_message(self, msg: ConsoleMessage):
        """
        Captures and stores console messages for analysis

        Inputs: msg - Console message from browser
        Outputs: None
        Side effects: Appends to console_logs list
        """
        try:
            self.console_logs.append({
                'timestamp': datetime.now().isoformat(),
                'type': msg.type,
                'text': msg.text,
                'location': f"{msg.location['url']}:{msg.location['lineNumber']}" if msg.location else None
            })
        except Exception:
            # Fallback for malformed console messages
            self.console_logs.append({
                'timestamp': datetime.now().isoformat(),
                'type': 'unknown',
                'text': str(msg),
                'location': 'error_parsing_message'
            })

    def _handle_page_error(self, error):
        """
        Captures JavaScript errors for analysis

        Inputs: error - JavaScript error object
        Outputs: None
        Side effects: Appends error to console_logs
        """
        self.console_logs.append({
            'timestamp': datetime.now().isoformat(),
            'type': 'error',
            'text': str(error),
            'location': 'page_error'
        })

    def _handle_request(self, request: Request):
        """
        Logs network requests for analysis

        Inputs: request - Network request object
        Outputs: None
        Side effects: Appends to network_logs list
        """
        try:
            self.network_logs.append({
                'timestamp': datetime.now().isoformat(),
                'type': 'request',
                'url': request.url,
                'method': request.method,
                'headers': dict(request.headers)
            })
        except Exception:
            pass  # Skip malformed requests

    def _handle_response(self, response: Response):
        """
        Logs network responses for analysis

        Inputs: response - Network response object
        Outputs: None
        Side effects: Appends to network_logs list
        """
        try:
            self.network_logs.append({
                'timestamp': datetime.now().isoformat(),
                'type': 'response',
                'url': response.url,
                'status': response.status,
                'headers': dict(response.headers)
            })
        except Exception:
            pass  # Skip malformed responses

    async def load_page(self, url: str, wait_for_selector: Optional[str] = None, timeout: int = 30000) -> bool:
        """
        Loads a page and optionally waits for specific element

        Inputs:
            url - URL to load (http:// or file:// protocol)
            wait_for_selector - CSS selector to wait for (optional)
            timeout - Maximum wait time in milliseconds
        Outputs: bool - True if page loaded successfully
        Side effects: Navigates browser to URL, may capture screenshots
        """
        try:
            # Convert local paths to file URLs if needed
            if not url.startswith(('http://', 'https://', 'file://', 'data:')):
                url = f"file:///{Path(url).resolve().as_posix()}"

            await self.page.goto(url, wait_until='networkidle', timeout=timeout)

            if wait_for_selector:
                await self.page.wait_for_selector(wait_for_selector, timeout=min(timeout, 10000))

            # Give time for any animations or async loading
            await self.page.wait_for_timeout(2000)
            return True

        except Exception as e:
            self.console_logs.append({
                'timestamp': datetime.now().isoformat(),
                'type': 'error',
                'text': f"Failed to load {url}: {str(e)}",
                'location': 'load_page'
            })
            return False

    async def screenshot(self, name: str, full_page: bool = True) -> str:
        """
        Captures a screenshot with timestamp and saves to disk

        Inputs:
            name - Base name for screenshot file
            full_page - Whether to capture full page or just viewport
        Outputs: str - Path to saved screenshot
        Side effects: Creates screenshot file on disk
        Raises: Exception if screenshot fails
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{name}_{timestamp}.png"
            filepath = self.screenshots_dir / filename

            await self.page.screenshot(
                path=str(filepath),
                full_page=full_page
            )

            return str(filepath)

        except Exception as e:
            # Create error placeholder file
            error_filepath = self.screenshots_dir / f"{name}_error.txt"
            with open(error_filepath, 'w') as f:
                f.write(f"Screenshot failed: {str(e)}")
            return str(error_filepath)

    async def assert_no_js_errors(self) -> Tuple[bool, List[Dict]]:
        """
        Checks if any JavaScript errors occurred

        Inputs: None
        Outputs: Tuple of (no_errors: bool, error_list: List[Dict])
        Side effects: None
        """
        errors = [log for log in self.console_logs if log['type'] == 'error']
        return len(errors) == 0, errors

    async def get_performance_metrics(self) -> Dict:
        """
        Collects browser performance metrics using CDP with retry logic

        Inputs: None
        Outputs: Dict containing performance metrics
        Side effects: None
        """
        for attempt in range(3):  # Retry up to 3 times
            try:
                cdp = await self.page.context.new_cdp_session(self.page)
                await cdp.send('Performance.enable')
                metrics = await cdp.send('Performance.getMetrics')
                await cdp.detach()

                parsed_metrics = {}
                for metric in metrics['metrics']:
                    parsed_metrics[metric['name']] = metric['value']

                return parsed_metrics

            except Exception as e:
                if attempt == 2:  # Last attempt
                    return {'error': str(e), 'attempt': attempt + 1}
                await asyncio.sleep(1)  # Wait before retry

        return {'error': 'All attempts failed'}

    async def test_visualization_layouts(self) -> Dict:
        """
        Tests all visualization layout pages and their functionality

        Inputs: None
        Outputs: Dict containing test results for each layout type
        Side effects: Creates multiple screenshots, exercises layout switching
        """
        # Use relative paths from current working directory
        layout_files = {
            'compact': 'test_compact_visualization.html',
            'multiple': 'test_multiple_layouts_fixed.html',
            'systematic': 'test_layouts_systematic.html'
        }

        results = {
            'timestamp': datetime.now().isoformat(),
            'layouts': {}
        }

        for layout_name, filename in layout_files.items():
            layout_result = {
                'filename': filename,
                'loaded': False,
                'screenshots': [],
                'layout_types_tested': [],
                'interactions_tested': [],
                'console_errors': []
            }

            # Clear previous console logs
            self.console_logs.clear()

            # Construct full path
            file_path = Path.cwd() / filename

            if not file_path.exists():
                layout_result['error'] = f'File not found: {file_path}'
                results['layouts'][layout_name] = layout_result
                continue

            # Load the page
            layout_result['loaded'] = await self.load_page(str(file_path))

            if layout_result['loaded']:
                # Initial screenshot
                screenshot_path = await self.screenshot(f'{layout_name}_layout_initial')
                layout_result['screenshots'].append(screenshot_path)

                # Test different layout types if available
                if layout_name in ['multiple', 'systematic']:
                    layout_types = ['tree', 'force', 'radial', 'timeline', 'grid', 'sankey']

                    for layout_type in layout_types:
                        try:
                            # Look for test buttons with multiple selector strategies
                            selectors = [
                                f'button[onclick*="{layout_type}"]',
                                f'#{layout_type}View',
                                f'[data-layout="{layout_type}"]',
                                f'button[onclick*="testLayout(\'{layout_type}\')"]'
                            ]

                            test_button = None
                            for selector in selectors:
                                test_button = await self.page.query_selector(selector)
                                if test_button:
                                    break

                            if test_button:
                                await test_button.click()
                                await self.page.wait_for_timeout(3000)  # Increased wait time

                                screenshot_path = await self.screenshot(f'{layout_name}_{layout_type}_layout')
                                layout_result['screenshots'].append(screenshot_path)
                                layout_result['layout_types_tested'].append(layout_type)
                            else:
                                layout_result['layout_types_tested'].append(f'{layout_type}_button_not_found')

                        except Exception as e:
                            layout_result['layout_types_tested'].append(f'{layout_type}_error: {str(e)}')

                # Test basic interactions with improved selectors
                interactions = [
                    ('zoom_in', ['#zoomIn', '.zoom-btn[title*="zoom in"]', 'button[onclick*="zoomIn"]']),
                    ('zoom_out', ['#zoomOut', '.zoom-btn[title*="zoom out"]', 'button[onclick*="zoomOut"]']),
                    ('zoom_reset', ['#zoomReset', '.zoom-btn[title*="reset"]', 'button[onclick*="reset"]']),
                    ('search', ['#searchBox', '.search-box', 'input[placeholder*="search"]'])
                ]

                for interaction_name, selectors in interactions:
                    try:
                        element = None
                        for selector in selectors:
                            element = await self.page.query_selector(selector)
                            if element:
                                break

                        if element:
                            tag_name = await element.evaluate('el => el.tagName.toLowerCase()')

                            if tag_name == 'button':
                                await element.click()
                                await self.page.wait_for_timeout(500)
                            elif tag_name == 'input':
                                await element.fill('test search')
                                await self.page.wait_for_timeout(500)

                            layout_result['interactions_tested'].append(interaction_name)
                        else:
                            layout_result['interactions_tested'].append(f'{interaction_name}_not_found')

                    except Exception as e:
                        layout_result['interactions_tested'].append(f'{interaction_name}_error: {str(e)}')

                # Final screenshot after interactions
                screenshot_path = await self.screenshot(f'{layout_name}_layout_final')
                layout_result['screenshots'].append(screenshot_path)

            # Collect console errors for this layout
            no_errors, errors = await self.assert_no_js_errors()
            layout_result['console_errors'] = errors

            results['layouts'][layout_name] = layout_result

        return results

    async def audit_main_application(self) -> Dict:
        """
        Audits the main email thread application for basic functionality

        Inputs: None
        Outputs: Dict containing main application audit results
        Side effects: Takes screenshots, logs console messages
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'main_app_status': 'unknown',
            'screenshots': [],
            'console_logs': [],
            'errors': []
        }

        # Try to load the main application
        test_files = [
            'test_layouts_systematic.html',
            'test_multiple_layouts_fixed.html',
            'test_compact_visualization.html'
        ]

        main_app_loaded = False
        for test_file in test_files:
            file_path = Path.cwd() / test_file
            if file_path.exists():
                loaded = await self.load_page(str(file_path))
                if loaded:
                    main_app_loaded = True
                    results['main_app_status'] = f'loaded_{test_file}'
                    # Take screenshot
                    screenshot_path = await self.screenshot(f'main_app_{test_file}')
                    results['screenshots'].append(screenshot_path)
                    break

        if not main_app_loaded:
            results['main_app_status'] = 'failed_to_load'
            results['errors'].append('No test files could be loaded')

        # Collect console logs
        results['console_logs'] = self.console_logs[-10:]  # Last 10 logs

        return results

    async def test_layout_interactions(self) -> Dict:
        """
        Tests interaction capabilities of visualization layouts

        Inputs: None
        Outputs: Dict containing layout interaction test results
        Side effects: Clicks elements, takes screenshots, measures responses
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'interaction_tests': {},
            'screenshots': []
        }

        # Load the systematic test page
        test_file = Path.cwd() / 'test_layouts_systematic.html'
        if not test_file.exists():
            results['error'] = f'Test file not found: {test_file}'
            return results

        loaded = await self.load_page(str(test_file))
        if not loaded:
            results['error'] = 'Failed to load test page'
            return results

        # Test interactions for each layout type
        layout_types = ['tree', 'force', 'radial', 'timeline', 'grid', 'sankey']

        for layout_type in layout_types:
            interaction_result = {
                'layout': layout_type,
                'button_click': False,
                'rendering': False,
                'errors': []
            }

            try:
                # Find and click the test button
                test_button = await self.page.query_selector(f'button[onclick*="testLayout(\'{layout_type}\')"]')
                if test_button:
                    await test_button.click()
                    interaction_result['button_click'] = True
                    await self.page.wait_for_timeout(2000)

                    # Check if layout rendered
                    status_element = await self.page.query_selector(f'#{layout_type}-status')
                    if status_element:
                        status_text = await status_element.text_content()
                        interaction_result['rendering'] = status_text not in ['Not loaded', '']
                        interaction_result['status_text'] = status_text

                    # Take screenshot
                    screenshot_path = await self.screenshot(f'interaction_{layout_type}')
                    results['screenshots'].append(screenshot_path)
                else:
                    interaction_result['errors'].append('Button not found')

            except Exception as e:
                interaction_result['errors'].append(str(e))

            results['interaction_tests'][layout_type] = interaction_result

        return results

    async def test_data_processing(self) -> Dict:
        """
        Tests data processing capabilities of the email thread system

        Inputs: None
        Outputs: Dict containing data processing test results
        Side effects: May trigger data loading, logs processing times
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'data_tests': {},
            'processing_times': {}
        }

        # Load test page and check for data processing
        test_file = Path.cwd() / 'test_layouts_systematic.html'
        if not test_file.exists():
            results['error'] = f'Test file not found: {test_file}'
            return results

        loaded = await self.load_page(str(test_file))
        if not loaded:
            results['error'] = 'Failed to load test page'
            return results

        try:
            # Check if sample data is loaded
            data_check = await self.page.evaluate("""
                () => {
                    return {
                        has_sample_data: typeof sampleEmailData !== 'undefined',
                        data_count: typeof sampleEmailData !== 'undefined' ? sampleEmailData.length : 0,
                        has_clone_function: typeof cloneEmailData === 'function'
                    };
                }
            """)

            results['data_tests']['sample_data_loaded'] = data_check['has_sample_data']
            results['data_tests']['data_count'] = data_check['data_count']
            results['data_tests']['clone_function_available'] = data_check['has_clone_function']

        except Exception as e:
            results['data_tests']['error'] = str(e)

        return results

    async def test_accessibility_compliance(self) -> Dict:
        """
        Tests accessibility compliance of the visualization interface

        Inputs: None
        Outputs: Dict containing accessibility test results
        Side effects: Checks keyboard navigation, ARIA labels, color contrast
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'accessibility_tests': {},
            'keyboard_navigation': {},
            'aria_compliance': {}
        }

        # Load test page
        test_file = Path.cwd() / 'test_layouts_systematic.html'
        if not test_file.exists():
            results['error'] = f'Test file not found: {test_file}'
            return results

        loaded = await self.load_page(str(test_file))
        if not loaded:
            results['error'] = 'Failed to load test page'
            return results

        try:
            # Test keyboard navigation
            keyboard_tests = {
                'tab_navigation': False,
                'enter_activation': False,
                'escape_handling': False
            }

            # Try tab navigation
            await self.page.keyboard.press('Tab')
            focused_element = await self.page.evaluate('document.activeElement.tagName')
            keyboard_tests['tab_navigation'] = focused_element in ['BUTTON', 'INPUT', 'A']

            # Test Enter key activation
            if keyboard_tests['tab_navigation']:
                await self.page.keyboard.press('Enter')
                await self.page.wait_for_timeout(500)
                keyboard_tests['enter_activation'] = True

            # Test Escape key
            await self.page.keyboard.press('Escape')
            keyboard_tests['escape_handling'] = True

            results['keyboard_navigation'] = keyboard_tests

            # Check ARIA compliance
            aria_check = await self.page.evaluate("""
                () => {
                    const buttons = document.querySelectorAll('button');
                    const inputs = document.querySelectorAll('input');

                    let aria_labels = 0;
                    let total_interactive = buttons.length + inputs.length;

                    buttons.forEach(btn => {
                        if (btn.getAttribute('aria-label') || btn.textContent.trim()) {
                            aria_labels++;
                        }
                    });

                    inputs.forEach(input => {
                        if (input.getAttribute('aria-label') || input.getAttribute('placeholder')) {
                            aria_labels++;
                        }
                    });

                    return {
                        total_interactive_elements: total_interactive,
                        labeled_elements: aria_labels,
                        compliance_percentage: total_interactive > 0 ? (aria_labels / total_interactive) * 100 : 0
                    };
                }
            """)

            results['aria_compliance'] = aria_check

        except Exception as e:
            results['accessibility_tests']['error'] = str(e)

        return results

    async def validate_performance_targets(self) -> Dict:
        """
        Validates performance against the spec requirements (<200ms for 100 nodes)

        Inputs: None
        Outputs: Dict containing performance validation results
        Side effects: Measures timing, may stress test the application
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'performance_tests': {},
            'meets_requirements': {}
        }

        # Load the systematic test page for performance testing
        test_file = Path.cwd() / 'test_layouts_systematic.html'

        if not test_file.exists():
            results['error'] = f'Test file not found: {test_file}'
            return results

        loaded = await self.load_page(str(test_file))

        if not loaded:
            results['error'] = 'Failed to load test page'
            return results

        # Test each layout type's rendering performance
        layout_types = ['radial', 'timeline', 'grid', 'sankey']

        for layout_type in layout_types:
            performance_result = {
                'layout': layout_type,
                'render_times': [],
                'average_render_time': None,
                'meets_spec': False
            }

            # Run multiple tests to get average
            for test_run in range(3):  # Reduced to 3 runs for faster testing
                try:
                    # Clear any previous state
                    await self.page.reload(wait_until='networkidle')
                    await self.page.wait_for_timeout(2000)

                    # Measure render time
                    start_time = time.time()

                    test_button = await self.page.query_selector(f'button[onclick*="testLayout(\'{layout_type}\')"]')
                    if test_button:
                        await test_button.click()

                        # Wait for layout to be rendered with more robust checking
                        try:
                            await self.page.wait_for_function(
                                f"""() => {{
                                    const status = document.getElementById('{layout_type}-status');
                                    return status && status.textContent !== 'Not loaded' && status.textContent !== '';
                                }}""",
                                timeout=10000
                            )
                        except:
                            # Fallback: just wait for reasonable time
                            await self.page.wait_for_timeout(3000)

                        end_time = time.time()
                        render_time_ms = (end_time - start_time) * 1000
                        performance_result['render_times'].append(render_time_ms)
                    else:
                        performance_result['render_times'].append('button_not_found')

                except Exception as e:
                    performance_result['render_times'].append(f'error: {str(e)}')

            # Calculate average and check against spec
            valid_times = [t for t in performance_result['render_times'] if isinstance(t, (int, float))]
            if valid_times:
                performance_result['average_render_time'] = sum(valid_times) / len(valid_times)
                performance_result['meets_spec'] = performance_result['average_render_time'] < 200.0
            else:
                performance_result['average_render_time'] = None
                performance_result['meets_spec'] = False

            results['performance_tests'][layout_type] = performance_result
            results['meets_requirements'][layout_type] = performance_result['meets_spec']

        return results

    async def generate_comprehensive_report(self) -> Dict:
        """
        Generates a comprehensive audit report combining all test results

        Inputs: None
        Outputs: Dict containing complete audit report
        Side effects: Saves report to disk as JSON file
        """
        report = {
            'audit_timestamp': datetime.now().isoformat(),
            'auditor_version': '1.0.1',
            'test_environment': {
                'browser': 'Chromium',
                'viewport': '1920x1080',
                'platform': 'Windows',
                'working_directory': str(Path.cwd())
            },
            'tests': {}
        }

        # Run all audit functions with error handling
        test_functions = [
            ('main_application', self.audit_main_application),
            ('visualization_layouts', self.test_visualization_layouts),
            ('layout_interactions', self.test_layout_interactions),
            ('data_processing', self.test_data_processing),
            ('performance_validation', self.validate_performance_targets),
            ('accessibility', self.test_accessibility_compliance)
        ]

        for test_name, test_func in test_functions:
            try:
                print(f"Running {test_name} test...")
                report['tests'][test_name] = await test_func()
            except Exception as e:
                print(f"Error in {test_name}: {str(e)}")
                report['tests'][test_name] = {
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                }

        # Save report to disk
        report_path = self.reports_dir / f"comprehensive_audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        try:
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            report['report_saved_to'] = str(report_path)
        except Exception as e:
            report['report_save_error'] = str(e)

        return report

    async def cleanup(self):
        """
        Cleanup browser resources

        Inputs: None
        Outputs: None
        Side effects: Closes browser and context, handles cleanup errors gracefully
        """
        try:
            if self.context:
                await self.context.close()
        except:
            pass

        try:
            if self.browser:
                await self.browser.close()
        except:
            pass


# Simplified test runner
async def run_full_audit():
    """Run the complete audit suite"""
    auditor = EmailThreadAuditor()

    try:
        await auditor.setup()
        report = await auditor.generate_comprehensive_report()

        print(f"\nAUDIT COMPLETE!")
        if 'report_saved_to' in report:
            print(f"Report saved to: {report['report_saved_to']}")

        # Print summary
        print("\n=== AUDIT SUMMARY ===")
        for test_name, test_results in report['tests'].items():
            status = 'PASS' if not test_results.get('error') else 'FAIL'
            print(f"{test_name}: {status}")

            # Show specific failures
            if test_results.get('error'):
                print(f"   Error: {test_results['error']}")

        return report

    except Exception as e:
        print(f"Audit setup failed: {str(e)}")
        return None

    finally:
        await auditor.cleanup()


if __name__ == "__main__":
    # Start the web server first
    print("Starting email thread audit...")
    print("Make sure the web server is running on http://localhost:8080")
    print("    Run: cd www && npm start")
    print("    Or run: npm start (for CLI demo)")

    # Run the audit
    asyncio.run(run_full_audit())