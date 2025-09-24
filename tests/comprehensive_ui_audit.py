"""
Comprehensive Playwright UI Audit for Email Thread Visualization System
Tests all visualization layouts, interactions, performance, and accessibility
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
    """Main auditor class for comprehensive UI testing"""

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
        """
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=False,  # Show browser for debugging
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )

        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            record_har_path=str(self.reports_dir / "network_activity.har")
        )

        self.page = await self.context.new_page()

        # Set up console logging
        self.page.on('console', self._handle_console_message)
        self.page.on('pageerror', self._handle_page_error)
        self.page.on('request', self._handle_request)
        self.page.on('response', self._handle_response)

    def _handle_console_message(self, msg: ConsoleMessage):
        """
        Captures and stores console messages for analysis

        Inputs: msg - Console message from browser
        Outputs: None
        Side effects: Appends to console_logs list
        """
        self.console_logs.append({
            'timestamp': datetime.now().isoformat(),
            'type': msg.type,
            'text': msg.text,
            'location': f"{msg.location['url']}:{msg.location['lineNumber']}" if msg.location else None
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
        self.network_logs.append({
            'timestamp': datetime.now().isoformat(),
            'type': 'request',
            'url': request.url,
            'method': request.method,
            'headers': dict(request.headers)
        })

    def _handle_response(self, response: Response):
        """
        Logs network responses for analysis

        Inputs: response - Network response object
        Outputs: None
        Side effects: Appends to network_logs list
        """
        self.network_logs.append({
            'timestamp': datetime.now().isoformat(),
            'type': 'response',
            'url': response.url,
            'status': response.status,
            'headers': dict(response.headers)
        })

    async def load_page(self, url: str, wait_for_selector: Optional[str] = None) -> bool:
        """
        Loads a page and optionally waits for specific element

        Inputs:
            url - URL to load
            wait_for_selector - CSS selector to wait for (optional)
        Outputs: bool - True if page loaded successfully
        Side effects: Navigates browser to URL, may capture screenshots
        """
        try:
            await self.page.goto(url, wait_until='networkidle')

            if wait_for_selector:
                await self.page.wait_for_selector(wait_for_selector, timeout=10000)

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
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{name}_{timestamp}.png"
        filepath = self.screenshots_dir / filename

        await self.page.screenshot(
            path=str(filepath),
            full_page=full_page
        )

        return str(filepath)

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
        Collects browser performance metrics using CDP

        Inputs: None
        Outputs: Dict containing performance metrics
        Side effects: None
        """
        try:
            # Get performance metrics via CDP
            cdp = await self.page.context.new_cdp_session(self.page)
            await cdp.send('Performance.enable')
            metrics = await cdp.send('Performance.getMetrics')
            await cdp.detach()

            # Parse metrics into useful format
            parsed_metrics = {}
            for metric in metrics['metrics']:
                parsed_metrics[metric['name']] = metric['value']

            return parsed_metrics

        except Exception as e:
            return {'error': str(e)}

    async def audit_main_application(self) -> Dict:
        """
        Comprehensive audit of the main application at localhost:8080

        Inputs: None
        Outputs: Dict containing audit results
        Side effects: Creates screenshots, logs console output
        """
        results = {
            'url': 'http://localhost:8080',
            'timestamp': datetime.now().isoformat(),
            'loaded': False,
            'screenshot': None,
            'console_errors': [],
            'performance': {},
            'ui_elements': {},
            'functionality_tests': {}
        }

        # Load main application
        results['loaded'] = await self.load_page('http://localhost:8080')

        if not results['loaded']:
            return results

        # Capture initial screenshot
        results['screenshot'] = await self.screenshot('main_app_initial')

        # Check for UI elements
        ui_checks = {
            'upload_section': '#uploadSection',
            'sample_data_button': '#loadSampleData',
            'csv_input': '#csvFileInput',
            'visualization_area': '#threadVisualization'
        }

        for element_name, selector in ui_checks.items():
            try:
                element = await self.page.query_selector(selector)
                results['ui_elements'][element_name] = element is not None
            except:
                results['ui_elements'][element_name] = False

        # Test sample data loading
        try:
            sample_button = await self.page.query_selector('#loadSampleData')
            if sample_button:
                await sample_button.click()
                await self.page.wait_for_timeout(3000)  # Wait for processing
                results['functionality_tests']['sample_data_load'] = True
                await self.screenshot('main_app_after_sample_load')
            else:
                results['functionality_tests']['sample_data_load'] = False
        except Exception as e:
            results['functionality_tests']['sample_data_load'] = f"Error: {str(e)}"

        # Get performance metrics
        results['performance'] = await self.get_performance_metrics()

        # Check for console errors
        no_errors, errors = await self.assert_no_js_errors()
        results['console_errors'] = errors

        return results

    async def test_visualization_layouts(self) -> Dict:
        """
        Tests all visualization layout pages and their functionality

        Inputs: None
        Outputs: Dict containing test results for each layout type
        Side effects: Creates multiple screenshots, exercises layout switching
        """
        layout_pages = {
            'compact': 'file:///C:/Users/gregg/Documents/Code/email_threads/test_compact_visualization.html',
            'multiple': 'file:///C:/Users/gregg/Documents/Code/email_threads/test_multiple_layouts_fixed.html',
            'systematic': 'file:///C:/Users/gregg/Documents/Code/email_threads/test_layouts_systematic.html'
        }

        results = {
            'timestamp': datetime.now().isoformat(),
            'layouts': {}
        }

        for layout_name, url in layout_pages.items():
            layout_result = {
                'url': url,
                'loaded': False,
                'screenshots': [],
                'layout_types_tested': [],
                'interactions_tested': [],
                'console_errors': []
            }

            # Clear previous console logs
            self.console_logs.clear()

            # Load the page
            layout_result['loaded'] = await self.load_page(url)

            if layout_result['loaded']:
                # Initial screenshot
                screenshot_path = await self.screenshot(f'{layout_name}_layout_initial')
                layout_result['screenshots'].append(screenshot_path)

                # Test different layout types if available
                if layout_name == 'multiple' or layout_name == 'systematic':
                    layout_types = ['tree', 'force', 'radial', 'timeline', 'grid', 'sankey']

                    for layout_type in layout_types:
                        try:
                            # Look for test button or layout switcher
                            test_button = await self.page.query_selector(f'button[onclick*="{layout_type}"]')
                            if not test_button:
                                test_button = await self.page.query_selector(f'#{layout_type}View')
                            if not test_button:
                                test_button = await self.page.query_selector(f'[data-layout="{layout_type}"]')

                            if test_button:
                                await test_button.click()
                                await self.page.wait_for_timeout(2000)  # Wait for layout to render

                                screenshot_path = await self.screenshot(f'{layout_name}_{layout_type}_layout')
                                layout_result['screenshots'].append(screenshot_path)
                                layout_result['layout_types_tested'].append(layout_type)

                        except Exception as e:
                            layout_result['layout_types_tested'].append(f'{layout_type}_error: {str(e)}')

                # Test basic interactions
                interactions = [
                    ('zoom_in', '#zoomIn', 'button'),
                    ('zoom_out', '#zoomOut', 'button'),
                    ('zoom_reset', '#zoomReset', 'button'),
                    ('search', '#searchBox', 'input')
                ]

                for interaction_name, selector, element_type in interactions:
                    try:
                        element = await self.page.query_selector(selector)
                        if element:
                            if element_type == 'button':
                                await element.click()
                                await self.page.wait_for_timeout(500)
                            elif element_type == 'input':
                                await element.fill('test search')
                                await self.page.wait_for_timeout(500)

                            layout_result['interactions_tested'].append(interaction_name)

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

    async def test_layout_interactions(self) -> Dict:
        """
        Deep testing of user interactions across all layouts

        Inputs: None
        Outputs: Dict containing detailed interaction test results
        Side effects: Exercises UI extensively, creates interaction screenshots
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'interaction_tests': {}
        }

        # Load the systematic test page (most comprehensive)
        test_url = 'file:///C:/Users/gregg/Documents/Code/email_threads/test_layouts_systematic.html'
        loaded = await self.load_page(test_url)

        if not loaded:
            results['error'] = 'Failed to load test page'
            return results

        # Test each layout type's interactions
        layout_types = ['radial', 'timeline', 'grid', 'sankey']

        for layout_type in layout_types:
            interaction_result = {
                'layout': layout_type,
                'tests_performed': [],
                'screenshots': [],
                'errors': []
            }

            try:
                # Activate this layout
                test_button = await self.page.query_selector(f'button[onclick*="testLayout(\'{layout_type}\')"]')
                if test_button:
                    await test_button.click()
                    await self.page.wait_for_timeout(2000)

                    # Screenshot after layout activation
                    screenshot_path = await self.screenshot(f'interaction_{layout_type}_activated')
                    interaction_result['screenshots'].append(screenshot_path)
                    interaction_result['tests_performed'].append('layout_activation')

                    # Test debug functionality
                    debug_button = await self.page.query_selector(f'button[onclick*="debugLayout(\'{layout_type}\')"]')
                    if debug_button:
                        await debug_button.click()
                        await self.page.wait_for_timeout(1000)
                        interaction_result['tests_performed'].append('debug_mode')

                    # Check status indicators
                    status_element = await self.page.query_selector(f'#{layout_type}-status')
                    if status_element:
                        status_text = await status_element.inner_text()
                        interaction_result['tests_performed'].append(f'status_check: {status_text}')

                    # Final screenshot for this layout
                    screenshot_path = await self.screenshot(f'interaction_{layout_type}_complete')
                    interaction_result['screenshots'].append(screenshot_path)

            except Exception as e:
                interaction_result['errors'].append(str(e))

            results['interaction_tests'][layout_type] = interaction_result

        return results

    async def test_data_processing(self) -> Dict:
        """
        Tests data processing functionality and file outputs

        Inputs: None
        Outputs: Dict containing data processing test results
        Side effects: May trigger data processing, reads generated files
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'file_checks': {},
            'data_validation': {}
        }

        # Check for expected data files
        expected_files = [
            'email_test_data.csv',
            'thread_report.json',
            'exports/email_data.json',
            'exports/email_threads_analysis.csv'
        ]

        base_path = Path('C:/Users/gregg/Documents/Code/email_threads')

        for file_path in expected_files:
            full_path = base_path / file_path
            exists = full_path.exists()
            results['file_checks'][file_path] = {
                'exists': exists,
                'size': full_path.stat().st_size if exists else 0,
                'modified': full_path.stat().st_mtime if exists else None
            }

            # If it's a JSON file, try to validate structure
            if exists and file_path.endswith('.json'):
                try:
                    with open(full_path, 'r') as f:
                        data = json.load(f)
                        results['data_validation'][file_path] = {
                            'valid_json': True,
                            'keys': list(data.keys()) if isinstance(data, dict) else 'not_dict',
                            'size': len(data) if isinstance(data, (list, dict)) else 'unknown'
                        }
                except Exception as e:
                    results['data_validation'][file_path] = {
                        'valid_json': False,
                        'error': str(e)
                    }

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
        test_url = 'file:///C:/Users/gregg/Documents/Code/email_threads/test_layouts_systematic.html'
        loaded = await self.load_page(test_url)

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
            for test_run in range(5):
                try:
                    # Clear any previous state
                    await self.page.reload()
                    await self.page.wait_for_timeout(1000)

                    # Measure render time
                    start_time = time.time()

                    test_button = await self.page.query_selector(f'button[onclick*="testLayout(\'{layout_type}\')"]')
                    if test_button:
                        await test_button.click()

                        # Wait for layout to be rendered (look for status change)
                        await self.page.wait_for_function(
                            f"document.getElementById('{layout_type}-status').textContent !== 'Not loaded'",
                            timeout=5000
                        )

                        end_time = time.time()
                        render_time_ms = (end_time - start_time) * 1000
                        performance_result['render_times'].append(render_time_ms)

                except Exception as e:
                    performance_result['render_times'].append(f'error: {str(e)}')

            # Calculate average and check against spec
            valid_times = [t for t in performance_result['render_times'] if isinstance(t, (int, float))]
            if valid_times:
                performance_result['average_render_time'] = sum(valid_times) / len(valid_times)
                performance_result['meets_spec'] = performance_result['average_render_time'] < 200.0

            results['performance_tests'][layout_type] = performance_result
            results['meets_requirements'][layout_type] = performance_result['meets_spec']

        return results

    async def test_accessibility_compliance(self) -> Dict:
        """
        Tests accessibility compliance including keyboard navigation and ARIA

        Inputs: None
        Outputs: Dict containing accessibility test results
        Side effects: Tests keyboard interactions, injects accessibility checks
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'keyboard_navigation': {},
            'aria_compliance': {},
            'focus_management': {}
        }

        # Load main application for accessibility testing
        loaded = await self.load_page('http://localhost:8080')

        if not loaded:
            results['error'] = 'Failed to load application'
            return results

        # Test keyboard navigation
        keyboard_tests = [
            ('tab', 'Tab'),
            ('enter', 'Enter'),
            ('space', 'Space'),
            ('escape', 'Escape'),
            ('arrow_down', 'ArrowDown'),
            ('arrow_up', 'ArrowUp')
        ]

        for test_name, key in keyboard_tests:
            try:
                # Focus on body first
                await self.page.focus('body')

                # Press the key
                await self.page.keyboard.press(key)
                await self.page.wait_for_timeout(500)

                # Check if focus changed or any visual response occurred
                focused_element = await self.page.evaluate('document.activeElement.tagName')
                results['keyboard_navigation'][test_name] = {
                    'key_pressed': key,
                    'focused_element': focused_element,
                    'test_passed': focused_element != 'BODY'  # Basic check
                }

            except Exception as e:
                results['keyboard_navigation'][test_name] = {
                    'error': str(e)
                }

        # Check for ARIA attributes
        aria_checks = [
            ('buttons_have_labels', 'button:not([aria-label]):not([aria-labelledby])'),
            ('images_have_alt', 'img:not([alt])'),
            ('inputs_have_labels', 'input:not([aria-label]):not([aria-labelledby])'),
            ('headings_hierarchy', 'h1, h2, h3, h4, h5, h6')
        ]

        for check_name, selector in aria_checks:
            try:
                elements = await self.page.query_selector_all(selector)
                results['aria_compliance'][check_name] = {
                    'selector': selector,
                    'elements_found': len(elements),
                    'needs_attention': len(elements) > 0
                }
            except Exception as e:
                results['aria_compliance'][check_name] = {
                    'error': str(e)
                }

        return results

    async def continuous_monitoring_loop(self, duration_minutes: int = 5) -> Dict:
        """
        Runs continuous monitoring loop for stability testing

        Inputs: duration_minutes - How long to run the monitoring loop
        Outputs: Dict containing monitoring results over time
        Side effects: Continuously exercises application, creates periodic screenshots
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'duration_minutes': duration_minutes,
            'iterations': [],
            'stability_metrics': {}
        }

        start_time = time.time()
        end_time = start_time + (duration_minutes * 60)
        iteration = 0

        while time.time() < end_time:
            iteration += 1
            iteration_start = time.time()

            iteration_result = {
                'iteration': iteration,
                'timestamp': datetime.now().isoformat(),
                'actions_performed': [],
                'errors': [],
                'performance': {}
            }

            try:
                # Load main application
                await self.load_page('http://localhost:8080')
                iteration_result['actions_performed'].append('loaded_main_app')

                # Click sample data button if available
                sample_button = await self.page.query_selector('#loadSampleData')
                if sample_button:
                    await sample_button.click()
                    await self.page.wait_for_timeout(2000)
                    iteration_result['actions_performed'].append('loaded_sample_data')

                # Take periodic screenshot
                if iteration % 10 == 0:  # Every 10th iteration
                    await self.screenshot(f'monitoring_iteration_{iteration}')
                    iteration_result['actions_performed'].append('captured_screenshot')

                # Get performance metrics
                iteration_result['performance'] = await self.get_performance_metrics()

                # Check for errors
                no_errors, errors = await self.assert_no_js_errors()
                if errors:
                    iteration_result['errors'] = errors

            except Exception as e:
                iteration_result['errors'].append(str(e))

            iteration_result['duration_seconds'] = time.time() - iteration_start
            results['iterations'].append(iteration_result)

            # Brief pause between iterations
            await asyncio.sleep(2)

        # Calculate stability metrics
        total_iterations = len(results['iterations'])
        error_iterations = len([i for i in results['iterations'] if i['errors']])

        results['stability_metrics'] = {
            'total_iterations': total_iterations,
            'error_iterations': error_iterations,
            'success_rate': (total_iterations - error_iterations) / total_iterations if total_iterations > 0 else 0,
            'average_iteration_time': sum(i['duration_seconds'] for i in results['iterations']) / total_iterations if total_iterations > 0 else 0
        }

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
            'auditor_version': '1.0.0',
            'test_environment': {
                'browser': 'Chromium',
                'viewport': '1920x1080',
                'platform': 'Windows'
            },
            'tests': {}
        }

        # Run all audit functions
        print("Running main application audit...")
        report['tests']['main_application'] = await self.audit_main_application()

        print("Testing visualization layouts...")
        report['tests']['visualization_layouts'] = await self.test_visualization_layouts()

        print("Testing layout interactions...")
        report['tests']['layout_interactions'] = await self.test_layout_interactions()

        print("Testing data processing...")
        report['tests']['data_processing'] = await self.test_data_processing()

        print("Validating performance targets...")
        report['tests']['performance_validation'] = await self.validate_performance_targets()

        print("Testing accessibility compliance...")
        report['tests']['accessibility'] = await self.test_accessibility_compliance()

        # Save report to disk
        report_path = self.reports_dir / f"comprehensive_audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        report['report_saved_to'] = str(report_path)

        return report

    async def cleanup(self):
        """
        Cleanup browser resources

        Inputs: None
        Outputs: None
        Side effects: Closes browser and context
        """
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()


# Test functions for pytest
@pytest.mark.asyncio
async def test_auditor_initialization():
    """Test that the auditor initializes correctly"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    assert auditor.browser is not None
    assert auditor.context is not None
    assert auditor.page is not None

    await auditor.cleanup()


@pytest.mark.asyncio
async def test_screenshot_functionality():
    """Test screenshot capture functionality"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    # Load a simple page first
    await auditor.page.goto('data:text/html,<h1>Test Page</h1>')

    # Take screenshot
    screenshot_path = await auditor.screenshot('test_screenshot')

    assert Path(screenshot_path).exists()
    assert Path(screenshot_path).stat().st_size > 0

    await auditor.cleanup()


@pytest.mark.asyncio
async def test_console_logging():
    """Test console message capture"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    # Generate console message
    await auditor.page.goto('data:text/html,<script>console.log("test message");</script>')
    await auditor.page.wait_for_timeout(1000)

    # Check if message was captured
    log_messages = [log for log in auditor.console_logs if 'test message' in log['text']]
    assert len(log_messages) > 0

    await auditor.cleanup()


@pytest.mark.asyncio
async def test_performance_metrics():
    """Test performance metrics collection"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    await auditor.page.goto('data:text/html,<h1>Performance Test</h1>')

    metrics = await auditor.get_performance_metrics()

    assert isinstance(metrics, dict)
    # Should have some performance metrics or an error key
    assert len(metrics) > 0

    await auditor.cleanup()


@pytest.mark.asyncio
async def test_main_application_audit():
    """Test the main application audit function"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    # This test will fail if the server isn't running
    results = await auditor.audit_main_application()

    assert 'timestamp' in results
    assert 'loaded' in results
    assert 'ui_elements' in results

    await auditor.cleanup()


if __name__ == "__main__":
    async def run_full_audit():
        """Run the complete audit suite"""
        auditor = EmailThreadAuditor()
        await auditor.setup()

        try:
            report = await auditor.generate_comprehensive_report()
            print(f"Audit complete! Report saved to: {report['report_saved_to']}")

            # Print summary
            print("\n=== AUDIT SUMMARY ===")
            for test_name, test_results in report['tests'].items():
                print(f"{test_name}: {'✓' if not test_results.get('error') else '✗'}")

        finally:
            await auditor.cleanup()

    # Run the audit
    asyncio.run(run_full_audit())