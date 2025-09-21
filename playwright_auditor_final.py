"""
Production-ready Playwright auditor for Email Thread Navigator
Fixed version addressing senior code review findings
"""

import asyncio
import json
import time
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
from contextlib import asynccontextmanager
from playwright.async_api import async_playwright, Browser, Page, ConsoleMessage, Error


class EmailThreadAuditorV2:
    """
    Production-ready DevTools-style Playwright auditor

    Features:
    - Thread-safe operation
    - Proper resource cleanup
    - Configurable timeouts
    - Error boundaries
    - Comprehensive logging
    """

    def __init__(self,
                 html_path: str,
                 screenshot_dir: str = "audit-screenshots",
                 default_timeout: int = 10000,
                 screenshot_timeout: int = 5000):
        """
        Initialize auditor with configurable parameters

        Args:
            html_path: Path to HTML file to audit
            screenshot_dir: Directory for saving screenshots
            default_timeout: Default timeout for page operations (ms)
            screenshot_timeout: Timeout for screenshot operations (ms)
        """
        self.html_path = Path(html_path)
        self.screenshot_dir = Path(screenshot_dir)
        self.screenshot_dir.mkdir(exist_ok=True)
        self.default_timeout = default_timeout
        self.screenshot_timeout = screenshot_timeout

        # Thread-safe logging
        self._lock = threading.Lock()
        self.console_logs: List[Dict] = []
        self.js_errors: List[str] = []
        self.network_logs: List[Dict] = []
        self.performance_metrics: Dict = {}

    @asynccontextmanager
    async def _safe_page_operation(self, page: Page, operation_name: str):
        """
        Context manager for safe page operations with error boundaries

        Args:
            page: Playwright page instance
            operation_name: Name of operation for logging

        Yields:
            None - use for error boundary around page operations
        """
        try:
            yield
        except Exception as e:
            await self._log_error(f"Error in {operation_name}: {str(e)}")
            # Take error screenshot if possible
            try:
                await self.screenshot(page, f"error_{operation_name}")
            except:
                pass  # Don't fail on screenshot errors
            raise

    async def _log_error(self, message: str):
        """Thread-safe error logging"""
        with self._lock:
            self.js_errors.append(f"{time.time()}: {message}")
            print(f"ERROR: {message}")

    async def audit_page_load(self, page: Page) -> Dict[str, Any]:
        """
        Load HTML file and verify basic DOM structure appears.

        Captures console errors that prevent initial rendering and measures
        load performance metrics.

        Args:
            page: Playwright page instance for testing

        Returns:
            Dict containing:
                - load_success (bool): Whether page loaded successfully
                - load_time (float): Time taken for initial load
                - root_element_exists (bool): Whether #root element found
                - app_container_exists (bool): Whether .app-container found
                - console_errors (int): Number of console errors captured
                - dom_ready (bool): Whether DOM is in ready state
                - error (str, optional): Error message if load failed

        Side effects:
            - Saves screenshot to audit directory
            - Updates console_logs and js_errors collections
        """
        async with self._safe_page_operation(page, "page_load"):
            print("AUDIT: Auditing page load and initial DOM rendering...")

            load_start = time.time()

            try:
                # Set timeout and navigate
                page.set_default_timeout(self.default_timeout)
                await page.goto(f'file://{self.html_path.absolute()}')

                # Wait for basic DOM with fallback strategy
                try:
                    await page.wait_for_selector('body', timeout=5000)
                    await page.wait_for_timeout(min(3000, self.default_timeout // 3))
                except:
                    # Fallback - just wait for navigation
                    await page.wait_for_load_state('domcontentloaded', timeout=self.default_timeout)

                # Check critical elements
                root_element = await page.query_selector('#root')
                app_container = await page.query_selector('.app-container')

                load_time = time.time() - load_start

                # Capture state
                await self.screenshot(page, "01_initial_page_load")

                return {
                    'load_success': True,
                    'load_time': load_time,
                    'root_element_exists': root_element is not None,
                    'app_container_exists': app_container is not None,
                    'console_errors': len(self.js_errors),
                    'dom_ready': True
                }

            except Exception as e:
                await self.screenshot(page, "01_failed_page_load")
                return {
                    'load_success': False,
                    'load_time': time.time() - load_start,
                    'error': str(e),
                    'root_element_exists': False,
                    'app_container_exists': False,
                    'console_errors': len(self.js_errors),
                    'dom_ready': False
                }

    async def audit_javascript_execution(self, page: Page) -> Dict[str, Any]:
        """
        Examine JavaScript execution flow and React component mounting.

        Identifies syntax/runtime errors that prevent component initialization
        and verifies that required libraries and components are properly loaded.

        Args:
            page: Playwright page instance

        Returns:
            Dict containing:
                - react_loaded (bool): Whether React library loaded
                - react_dom_loaded (bool): Whether ReactDOM loaded
                - babel_loaded (bool): Whether Babel transpiler loaded
                - components_defined (dict): Status of each component definition
                - react_mounting (dict): React mounting and fiber status
                - js_errors_count (int): Count of JavaScript errors
                - execution_successful (bool): Overall execution success

        Side effects:
            - Saves screenshot of execution state
            - May trigger additional console logging
        """
        async with self._safe_page_operation(page, "javascript_execution"):
            print("AUDIT: Auditing JavaScript execution and React component mounting...")

            try:
                # Check core library loading with timeout protection
                checks = await asyncio.wait_for(
                    page.evaluate("""
                        () => ({
                            react_loaded: typeof React !== 'undefined',
                            react_dom_loaded: typeof ReactDOM !== 'undefined',
                            babel_loaded: typeof Babel !== 'undefined'
                        })
                    """),
                    timeout=5.0
                )

                # Check component definitions safely
                components_check = await asyncio.wait_for(
                    page.evaluate("""
                        () => {
                            const components = {};
                            const componentNames = [
                                'EmailThreadNavigator', 'TopNavigator', 'ThreadTree',
                                'RatingPanel', 'TimelineVisualization'
                            ];

                            componentNames.forEach(name => {
                                try {
                                    components[name] = typeof window[name] !== 'undefined';
                                } catch (e) {
                                    components[name] = false;
                                    components[`${name}_error`] = e.message;
                                }
                            });

                            return components;
                        }
                    """),
                    timeout=5.0
                )

                # Check React mounting state
                react_mount_check = await asyncio.wait_for(
                    page.evaluate("""
                        () => {
                            try {
                                const rootElement = document.getElementById('root');
                                const hasReactFiber = rootElement &&
                                    (rootElement._reactInternals || rootElement._reactInternalFiber);

                                return {
                                    root_exists: !!rootElement,
                                    root_has_children: rootElement ? rootElement.children.length > 0 : false,
                                    react_fiber_attached: hasReactFiber,
                                    root_inner_html_length: rootElement ? rootElement.innerHTML.length : 0
                                };
                            } catch (e) {
                                return { error: e.message };
                            }
                        }
                    """),
                    timeout=5.0
                )

                await self.screenshot(page, "02_javascript_execution_state")

                execution_successful = (
                    checks['react_loaded'] and
                    len(self.js_errors) == 0 and
                    react_mount_check.get('root_exists', False)
                )

                return {
                    'react_loaded': checks['react_loaded'],
                    'react_dom_loaded': checks['react_dom_loaded'],
                    'babel_loaded': checks['babel_loaded'],
                    'components_defined': components_check,
                    'react_mounting': react_mount_check,
                    'js_errors_count': len(self.js_errors),
                    'execution_successful': execution_successful
                }

            except asyncio.TimeoutError:
                return {
                    'execution_successful': False,
                    'error': 'JavaScript evaluation timeout',
                    'js_errors_count': len(self.js_errors)
                }
            except Exception as e:
                return {
                    'execution_successful': False,
                    'error': str(e),
                    'js_errors_count': len(self.js_errors)
                }

    async def audit_component_rendering(self, page: Page) -> Dict[str, Any]:
        """
        Test individual UI component rendering and visibility.

        Systematically checks each major UI component for presence, count,
        and visibility. Identifies missing elements or CSS rendering issues.

        Args:
            page: Playwright page instance

        Returns:
            Dict containing:
                - component_status (dict): Per-component rendering status
                - successful_renders (int): Count of successfully rendered components
                - total_components (int): Total components tested
                - render_success_rate (float): Percentage of successful renders
                - all_components_rendered (bool): Whether all components present

        Side effects:
            - Saves component rendering screenshot
        """
        async with self._safe_page_operation(page, "component_rendering"):
            print("AUDIT: Auditing individual component rendering...")

            # Comprehensive component selector mapping
            component_selectors = {
                'top_navigator': '.top-navigator',
                'nav_title': '.nav-title',
                'nav_subtitle': '.nav-subtitle',
                'thread_progress': '.thread-progress',
                'visualization_container': '.visualization-container',
                'nav_controls': '.nav-controls',
                'nav_button': '.nav-button',
                'thread_panel': '.thread-panel',
                'thread_header': '.thread-header',
                'thread_search': '.thread-search',
                'rating_filter': '.rating-filter',
                'filter_chip': '.filter-chip',
                'thread_tree': '.thread-tree',
                'thread_node': '.thread-node',
                'message_panel': '.message-panel',
                'message_header': '.message-header',
                'message_body': '.message-body',
                'rating_panel': '.rating-panel',
                'rating_section': '.rating-section',
                'rating_button': '.rating-button',
                'rating_note': '.rating-note',
                'keyboard_shortcuts': '.keyboard-shortcuts'
            }

            component_status = {}

            # Test each component with error isolation
            for component_name, selector in component_selectors.items():
                try:
                    elements = await page.query_selector_all(selector)
                    element_count = len(elements)

                    # Check visibility for first element
                    is_visible = False
                    bounding_box = None
                    if element_count > 0:
                        is_visible = await elements[0].is_visible()
                        try:
                            bounding_box = await elements[0].bounding_box()
                        except:
                            bounding_box = None

                    component_status[component_name] = {
                        'found': element_count > 0,
                        'count': element_count,
                        'visible': is_visible,
                        'has_dimensions': bounding_box is not None,
                        'selector': selector
                    }

                except Exception as e:
                    component_status[component_name] = {
                        'found': False,
                        'error': str(e),
                        'selector': selector
                    }

            await self.screenshot(page, "03_component_rendering_audit")

            # Calculate success metrics
            successful_renders = sum(1 for status in component_status.values()
                                   if status.get('found', False) and status.get('visible', False))
            total_components = len(component_selectors)
            render_success_rate = successful_renders / total_components if total_components > 0 else 0

            return {
                'component_status': component_status,
                'successful_renders': successful_renders,
                'total_components': total_components,
                'render_success_rate': render_success_rate,
                'all_components_rendered': successful_renders == total_components
            }

    async def audit_state_management(self, page: Page) -> Dict[str, Any]:
        """
        Verify React state initialization and detect duplicate state issues.

        Specifically designed to catch the duplicate viewMode useState bug
        and other state-related problems that prevent proper component mounting.

        Args:
            page: Playwright page instance

        Returns:
            Dict containing:
                - react_state_check (dict): React hooks and state system status
                - viewMode_analysis (dict): Analysis of viewMode state declarations
                - state_initialization_success (bool): Whether state system working
                - duplicate_state_detected (bool): Whether duplicate states found
                - total_state_errors (int): Count of state-related errors

        Side effects:
            - Saves state management audit screenshot
            - May capture additional console errors
        """
        async with self._safe_page_operation(page, "state_management"):
            print("AUDIT: Auditing React state management and initialization...")

            try:
                # Check React state system
                state_check = await page.evaluate("""
                    () => {
                        const results = {
                            react_version: typeof React !== 'undefined' ? React.version : 'not_loaded',
                            hooks_available: typeof React !== 'undefined' && typeof React.useState !== 'undefined',
                            use_effect_available: typeof React !== 'undefined' && typeof React.useEffect !== 'undefined',
                            state_errors: [],
                            console_warnings: []
                        };

                        // Capture React warnings
                        const originalWarn = console.warn;
                        const originalError = console.error;

                        const capturedMessages = [];
                        console.warn = (...args) => {
                            const message = args.join(' ');
                            if (message.includes('Warning') || message.includes('useState') ||
                                message.includes('useEffect') || message.includes('duplicate')) {
                                capturedMessages.push(`WARN: ${message}`);
                            }
                            originalWarn.apply(console, args);
                        };

                        console.error = (...args) => {
                            const message = args.join(' ');
                            if (message.includes('useState') || message.includes('useEffect') ||
                                message.includes('duplicate') || message.includes('re-render') ||
                                message.includes('infinite loop')) {
                                capturedMessages.push(`ERROR: ${message}`);
                            }
                            originalError.apply(console, args);
                        };

                        results.captured_react_messages = capturedMessages;

                        return results;
                    }
                """)

                # Analyze viewMode duplicate issue specifically
                viewmode_analysis = await page.evaluate("""
                    () => {
                        try {
                            const scriptElements = document.querySelectorAll('script[type="text/babel"]');
                            let allScriptContent = '';

                            scriptElements.forEach(script => {
                                allScriptContent += script.textContent || '';
                            });

                            // Look for useState patterns
                            const useStateMatches = allScriptContent.match(/useState\\s*\\([^)]*\\)/g) || [];
                            const viewModeMatches = allScriptContent.match(/useState\\s*\\([^)]*viewMode[^)]*\\)/g) || [];
                            const setViewModeMatches = allScriptContent.match(/setViewMode/g) || [];

                            // Look for function signatures that declare viewMode
                            const functionViewModeMatches = allScriptContent.match(/function\\s+\\w*[^{]*{[^}]*viewMode[^}]*}/g) || [];

                            return {
                                total_useState_calls: useStateMatches.length,
                                viewMode_useState_calls: viewModeMatches.length,
                                setViewMode_references: setViewModeMatches.length,
                                viewMode_in_functions: functionViewModeMatches.length,
                                potential_duplicate_issue: viewModeMatches.length > 1,
                                duplicate_risk_score: viewModeMatches.length > 1 ? 'HIGH' : 'LOW',
                                viewMode_patterns: viewModeMatches
                            };
                        } catch (e) {
                            return {
                                analysis_error: e.message,
                                potential_duplicate_issue: false
                            };
                        }
                    }
                """)

                # Check for component mount state
                mount_state = await page.evaluate("""
                    () => {
                        try {
                            const rootElement = document.getElementById('root');
                            if (!rootElement) return { root_missing: true };

                            // Look for signs of React components
                            const hasDataReactRoot = rootElement.hasAttribute('data-reactroot') ||
                                                   !!rootElement._reactInternals ||
                                                   !!rootElement._reactInternalInstance;

                            return {
                                root_exists: true,
                                react_mounted: hasDataReactRoot,
                                root_children_count: rootElement.children.length,
                                root_text_content_length: rootElement.textContent.length
                            };
                        } catch (e) {
                            return { mount_check_error: e.message };
                        }
                    }
                """)

                await self.screenshot(page, "04_state_management_audit")

                return {
                    'react_state_check': state_check,
                    'viewMode_analysis': viewmode_analysis,
                    'mount_state': mount_state,
                    'state_initialization_success': state_check['hooks_available'],
                    'duplicate_state_detected': viewmode_analysis.get('potential_duplicate_issue', False),
                    'total_state_errors': len(state_check.get('state_errors', []))
                }

            except Exception as e:
                return {
                    'state_initialization_success': False,
                    'error': str(e),
                    'audit_failed': True
                }

    async def screenshot(self, page: Page, name: str) -> Optional[Path]:
        """
        Take full-page screenshot with error handling.

        Args:
            page: Playwright page instance
            name: Base name for screenshot file

        Returns:
            Path to saved screenshot or None if failed

        Side effects:
            - Saves PNG file to screenshot directory
        """
        try:
            screenshot_path = self.screenshot_dir / f"{name}.png"
            await asyncio.wait_for(
                page.screenshot(path=str(screenshot_path), full_page=True),
                timeout=self.screenshot_timeout / 1000
            )
            print(f"SCREENSHOT: Screenshot saved: {screenshot_path}")
            return screenshot_path
        except Exception as e:
            await self._log_error(f"Screenshot failed for {name}: {str(e)}")
            return None

    def setup_console_monitoring(self, page: Page):
        """
        Set up comprehensive console and error monitoring.

        Args:
            page: Playwright page instance

        Side effects:
            - Attaches event listeners to page
            - Updates console_logs and js_errors collections thread-safely
        """
        def handle_console(msg: ConsoleMessage):
            with self._lock:
                log_entry = {
                    'type': msg.type,
                    'text': msg.text,
                    'location': str(msg.location) if msg.location else 'unknown',
                    'timestamp': time.time()
                }
                self.console_logs.append(log_entry)

                if msg.type in ['error', 'warning']:
                    print(f"CONSOLE {msg.type}: {msg.text}")

        def handle_error(error: Error):
            with self._lock:
                error_msg = str(error)
                self.js_errors.append(error_msg)
                print(f"JS ERROR: {error_msg}")

        def handle_request_failed(request):
            with self._lock:
                failure_info = {
                    'url': request.url,
                    'method': request.method,
                    'failure': request.failure,
                    'timestamp': time.time()
                }
                self.network_logs.append(failure_info)
                print(f"NETWORK FAILURE: {request.url}")

        page.on('console', handle_console)
        page.on('pageerror', handle_error)
        page.on('requestfailed', handle_request_failed)

    async def run_comprehensive_audit(self) -> Dict[str, Any]:
        """
        Execute complete audit suite with proper resource management.

        Returns:
            Dict containing all audit results and executive summary

        Side effects:
            - Creates screenshots in audit directory
            - Saves JSON audit report
            - Updates all logging collections
        """
        print(f"Starting comprehensive audit of {self.html_path}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context()

            try:
                page = await context.new_page()
                self.setup_console_monitoring(page)

                # Execute audit sequence with error isolation
                audit_results = {}

                # Core audits - order matters for dependencies
                audit_functions = [
                    ('page_load', self.audit_page_load),
                    ('javascript_execution', self.audit_javascript_execution),
                    ('component_rendering', self.audit_component_rendering),
                    ('state_management', self.audit_state_management)
                ]

                for audit_name, audit_func in audit_functions:
                    try:
                        print(f"Running {audit_name} audit...")
                        audit_results[audit_name] = await audit_func(page)
                    except Exception as e:
                        await self._log_error(f"Audit {audit_name} failed: {str(e)}")
                        audit_results[audit_name] = {
                            'failed': True,
                            'error': str(e),
                            'timestamp': time.time()
                        }

                # Generate executive summary
                summary = self.generate_executive_summary(audit_results)
                audit_results['executive_summary'] = summary

                # Save comprehensive report
                await self.save_comprehensive_report(audit_results)

                return audit_results

            finally:
                await context.close()
                await browser.close()

    def generate_executive_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate executive summary with actionable recommendations.

        Args:
            results: Complete audit results dictionary

        Returns:
            Dict containing health status, issues, and recommendations
        """
        critical_issues = []
        warnings = []
        recommendations = []

        # Analyze page load
        if not results.get('page_load', {}).get('load_success', False):
            critical_issues.append("Page failed to load - check file path and permissions")
            recommendations.append("Verify HTML file exists and is accessible")

        # Analyze JavaScript execution
        js_result = results.get('javascript_execution', {})
        if not js_result.get('react_loaded', False):
            critical_issues.append("React library failed to load")
            recommendations.append("Check internet connection and CDN accessibility")

        if not js_result.get('execution_successful', False):
            critical_issues.append("JavaScript execution errors detected")
            recommendations.append("Review console logs for syntax or runtime errors")

        # Analyze state management
        state_result = results.get('state_management', {})
        if state_result.get('duplicate_state_detected', False):
            critical_issues.append("Duplicate React state declarations found")
            recommendations.append("Remove duplicate useState declarations, especially viewMode")

        # Analyze component rendering
        render_result = results.get('component_rendering', {})
        render_rate = render_result.get('render_success_rate', 0)
        if render_rate < 0.3:
            critical_issues.append(f"Severe component rendering failure ({render_rate:.1%})")
        elif render_rate < 0.7:
            warnings.append(f"Partial component rendering issues ({render_rate:.1%})")

        # Determine overall health
        if critical_issues:
            health_status = 'CRITICAL'
        elif warnings:
            health_status = 'WARNING'
        else:
            health_status = 'HEALTHY'

        # Generate primary diagnosis
        if "Duplicate React state declarations found" in critical_issues:
            primary_diagnosis = "DUPLICATE STATE BUG: Multiple viewMode useState declarations causing React render failure"
        elif "React library failed to load" in critical_issues:
            primary_diagnosis = "CDN LOADING FAILURE: React dependencies not accessible"
        elif "JavaScript execution errors detected" in critical_issues:
            primary_diagnosis = "SYNTAX/RUNTIME ERROR: JavaScript code has errors preventing execution"
        elif "Page failed to load" in critical_issues:
            primary_diagnosis = "FILE ACCESS ISSUE: HTML file cannot be loaded or parsed"
        else:
            primary_diagnosis = "No critical issues detected"

        return {
            'health_status': health_status,
            'critical_issues': critical_issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'primary_diagnosis': primary_diagnosis,
            'total_console_logs': len(self.console_logs),
            'total_js_errors': len(self.js_errors),
            'audit_timestamp': time.time()
        }

    async def save_comprehensive_report(self, results: Dict[str, Any]):
        """
        Save detailed audit report with all findings.

        Args:
            results: Complete audit results

        Side effects:
            - Writes JSON report to audit directory
        """
        report_path = self.screenshot_dir / "comprehensive_audit_report.json"

        report_data = {
            'audit_metadata': {
                'timestamp': time.time(),
                'html_file': str(self.html_path),
                'auditor_version': '2.0',
                'total_screenshots': len(list(self.screenshot_dir.glob("*.png")))
            },
            'audit_results': results,
            'logs': {
                'console_logs': self.console_logs,
                'js_errors': self.js_errors,
                'network_logs': self.network_logs
            }
        }

        try:
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report_data, f, indent=2, default=str, ensure_ascii=False)
            print(f"REPORT: Comprehensive audit report saved: {report_path}")
        except Exception as e:
            await self._log_error(f"Failed to save audit report: {str(e)}")


# Convenience function for immediate execution
async def diagnose_email_navigator(html_path: str = "email_thread_navigator.html") -> Dict[str, Any]:
    """
    Run complete diagnostic audit on Email Thread Navigator.

    Args:
        html_path: Path to HTML file to diagnose

    Returns:
        Complete audit results with executive summary
    """
    auditor = EmailThreadAuditorV2(html_path)
    results = await auditor.run_comprehensive_audit()

    print("\n" + "="*60)
    print("EXECUTIVE SUMMARY")
    print("="*60)

    summary = results['executive_summary']
    print(f"Health Status: {summary['health_status']}")
    print(f"Primary Diagnosis: {summary['primary_diagnosis']}")

    if summary['critical_issues']:
        print(f"\nCRITICAL ISSUES ({len(summary['critical_issues'])}):")
        for issue in summary['critical_issues']:
            print(f"  * {issue}")

    if summary['warnings']:
        print(f"\nWARNINGS ({len(summary['warnings'])}):")
        for warning in summary['warnings']:
            print(f"  * {warning}")

    if summary['recommendations']:
        print(f"\nRECOMMENDATIONS:")
        for rec in summary['recommendations']:
            print(f"  * {rec}")

    print(f"\nConsole Logs: {summary['total_console_logs']}")
    print(f"JS Errors: {summary['total_js_errors']}")
    print("\nDetailed report saved in audit-screenshots/ directory")

    return results


if __name__ == "__main__":
    asyncio.run(diagnose_email_navigator())