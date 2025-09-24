"""
Comprehensive Playwright auditor for Email Thread Navigator
Diagnoses loading failures and UI issues through systematic testing
"""

import asyncio
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from playwright.async_api import async_playwright, Browser, Page, ConsoleMessage, Error


class EmailThreadAuditor:
    """DevTools-style Playwright auditor for comprehensive UI testing"""

    def __init__(self, html_path: str, screenshot_dir: str = "audit-screenshots"):
        self.html_path = Path(html_path)
        self.screenshot_dir = Path(screenshot_dir)
        self.screenshot_dir.mkdir(exist_ok=True)
        self.console_logs: List[Dict] = []
        self.js_errors: List[str] = []
        self.network_logs: List[Dict] = []
        self.performance_metrics: Dict = {}

    async def audit_page_load(self, page: Page) -> Dict[str, Any]:
        """
        Load the HTML file and check if basic React/DOM elements appear.
        Captures console errors that prevent initial rendering.

        Returns:
            Dict with load_success, error_details, dom_elements_found
        """
        print("🔍 Auditing page load and initial DOM rendering...")

        load_start = time.time()

        try:
            # Navigate to the file
            await page.goto(f'file://{self.html_path.absolute()}')

            # Wait for basic DOM structure with extended timeout
            try:
                await page.wait_for_selector('body', timeout=5000)
                await page.wait_for_timeout(2000)  # Allow time for React to mount

                # Check for React root
                root_element = await page.query_selector('#root')
                app_container = await page.query_selector('.app-container')

                load_time = time.time() - load_start

                # Capture current DOM state
                await self.screenshot(page, "01_initial_page_load")

                return {
                    'load_success': True,
                    'load_time': load_time,
                    'root_element_exists': root_element is not None,
                    'app_container_exists': app_container is not None,
                    'console_errors': len(self.js_errors),
                    'dom_ready': True
                }

            except Exception as dom_error:
                await self.screenshot(page, "01_failed_page_load")
                return {
                    'load_success': False,
                    'load_time': time.time() - load_start,
                    'error': str(dom_error),
                    'root_element_exists': False,
                    'app_container_exists': False,
                    'console_errors': len(self.js_errors),
                    'dom_ready': False
                }

        except Exception as e:
            return {
                'load_success': False,
                'load_time': time.time() - load_start,
                'error': f"Failed to navigate: {str(e)}",
                'console_errors': len(self.js_errors)
            }

    async def audit_javascript_execution(self, page: Page) -> Dict[str, Any]:
        """
        Examine JavaScript execution flow and check if React components mount.
        Identifies syntax/runtime errors preventing component initialization.

        Returns:
            Dict with react_loaded, components_defined, execution_errors
        """
        print("🔍 Auditing JavaScript execution and React component mounting...")

        try:
            # Check if core libraries loaded
            react_loaded = await page.evaluate("typeof React !== 'undefined'")
            react_dom_loaded = await page.evaluate("typeof ReactDOM !== 'undefined'")
            babel_loaded = await page.evaluate("typeof Babel !== 'undefined'")

            # Check if our components are defined
            components_check = await page.evaluate("""
                () => {
                    const components = {};
                    try {
                        components.EmailThreadNavigator = typeof EmailThreadNavigator !== 'undefined';
                        components.TopNavigator = typeof TopNavigator !== 'undefined';
                        components.ThreadTree = typeof ThreadTree !== 'undefined';
                        components.RatingPanel = typeof RatingPanel !== 'undefined';
                        components.TimelineVisualization = typeof TimelineVisualization !== 'undefined';
                    } catch (e) {
                        components.evaluation_error = e.message;
                    }
                    return components;
                }
            """)

            # Check React mounting
            react_mount_check = await page.evaluate("""
                () => {
                    try {
                        const rootElement = document.getElementById('root');
                        return {
                            root_exists: !!rootElement,
                            root_has_children: rootElement ? rootElement.children.length > 0 : false,
                            react_fiber: !!rootElement && !!rootElement._reactInternals
                        };
                    } catch (e) {
                        return { error: e.message };
                    }
                }
            """)

            await self.screenshot(page, "02_javascript_execution_state")

            return {
                'react_loaded': react_loaded,
                'react_dom_loaded': react_dom_loaded,
                'babel_loaded': babel_loaded,
                'components_defined': components_check,
                'react_mounting': react_mount_check,
                'js_errors_count': len(self.js_errors),
                'execution_successful': react_loaded and len(self.js_errors) == 0
            }

        except Exception as e:
            return {
                'execution_successful': False,
                'error': str(e),
                'js_errors_count': len(self.js_errors)
            }

    async def audit_component_rendering(self, page: Page) -> Dict[str, Any]:
        """
        Test if individual UI components render correctly.
        Checks for missing elements, CSS issues, or component-specific errors.

        Returns:
            Dict with component_status for each major UI component
        """
        print("🔍 Auditing individual component rendering...")

        component_selectors = {
            'top_navigator': '.top-navigator',
            'nav_title': '.nav-title',
            'visualization_container': '.visualization-container',
            'nav_controls': '.nav-controls',
            'thread_panel': '.thread-panel',
            'thread_header': '.thread-header',
            'thread_search': '.thread-search',
            'thread_tree': '.thread-tree',
            'message_panel': '.message-panel',
            'rating_panel': '.rating-panel',
            'rating_buttons': '.rating-button',
            'progress_indicator': '.thread-progress',
            'filter_chips': '.filter-chip'
        }

        component_status = {}

        for component_name, selector in component_selectors.items():
            try:
                elements = await page.query_selector_all(selector)
                element_count = len(elements)

                # Check if element is visible
                is_visible = False
                if element_count > 0:
                    is_visible = await elements[0].is_visible()

                component_status[component_name] = {
                    'found': element_count > 0,
                    'count': element_count,
                    'visible': is_visible,
                    'selector': selector
                }

            except Exception as e:
                component_status[component_name] = {
                    'found': False,
                    'error': str(e),
                    'selector': selector
                }

        await self.screenshot(page, "03_component_rendering_audit")

        # Count successful renders
        successful_renders = sum(1 for status in component_status.values()
                               if status.get('found', False))
        total_components = len(component_selectors)

        return {
            'component_status': component_status,
            'successful_renders': successful_renders,
            'total_components': total_components,
            'render_success_rate': successful_renders / total_components,
            'all_components_rendered': successful_renders == total_components
        }

    async def audit_state_management(self, page: Page) -> Dict[str, Any]:
        """
        Verify React state initialization and detect state-related issues.
        Specifically checks for duplicate state declarations and initialization problems.

        Returns:
            Dict with state_errors, initialization_status, duplicate_issues
        """
        print("🔍 Auditing React state management and initialization...")

        try:
            # Check React DevTools availability and state
            state_check = await page.evaluate("""
                () => {
                    const results = {
                        react_version: typeof React !== 'undefined' ? React.version : 'not_loaded',
                        hooks_available: typeof React !== 'undefined' && typeof React.useState !== 'undefined',
                        state_errors: [],
                        component_instances: {}
                    };

                    // Check for common state issues in console
                    const originalError = console.error;
                    const stateErrors = [];
                    console.error = (...args) => {
                        const message = args.join(' ');
                        if (message.includes('useState') || message.includes('useEffect') ||
                            message.includes('duplicate') || message.includes('re-render')) {
                            stateErrors.push(message);
                        }
                        originalError.apply(console, args);
                    };

                    results.state_errors = stateErrors;

                    // Try to find React component instances
                    try {
                        const rootElement = document.getElementById('root');
                        if (rootElement && rootElement._reactInternals) {
                            results.component_instances.root_connected = true;
                        }
                    } catch (e) {
                        results.component_instances.error = e.message;
                    }

                    return results;
                }
            """)

            # Check for specific viewMode duplicate issue
            viewmode_check = await page.evaluate("""
                () => {
                    const scriptContent = document.querySelector('script[type="text/babel"]')?.textContent || '';
                    const viewModeMatches = scriptContent.match(/useState.*viewMode/g) || [];
                    return {
                        viewMode_declarations: viewModeMatches.length,
                        viewMode_matches: viewModeMatches,
                        potential_duplicate_issue: viewModeMatches.length > 1
                    };
                }
            """)

            await self.screenshot(page, "04_state_management_audit")

            return {
                'react_state_check': state_check,
                'viewMode_analysis': viewmode_check,
                'state_initialization_success': state_check['hooks_available'],
                'duplicate_state_detected': viewmode_check['potential_duplicate_issue'],
                'total_state_errors': len(state_check['state_errors'])
            }

        except Exception as e:
            return {
                'state_initialization_success': False,
                'error': str(e),
                'audit_failed': True
            }

    async def audit_event_handlers(self, page: Page) -> Dict[str, Any]:
        """
        Test user interactions to ensure they don't crash the app.
        Tests clicks, hovers, keyboard shortcuts, and form interactions.

        Returns:
            Dict with interaction_results, crash_detected, handler_errors
        """
        print("🔍 Auditing event handlers and user interactions...")

        interaction_results = {}
        errors_before = len(self.js_errors)

        # Test basic clicks
        try:
            # Try clicking nav buttons if they exist
            nav_buttons = await page.query_selector_all('.nav-button')
            if nav_buttons:
                await nav_buttons[0].click()
                await page.wait_for_timeout(500)
                interaction_results['nav_button_click'] = {'success': True, 'error': None}
            else:
                interaction_results['nav_button_click'] = {'success': False, 'error': 'No nav buttons found'}

        except Exception as e:
            interaction_results['nav_button_click'] = {'success': False, 'error': str(e)}

        # Test thread node interactions
        try:
            thread_nodes = await page.query_selector_all('.thread-node')
            if thread_nodes:
                # Test hover
                await thread_nodes[0].hover()
                await page.wait_for_timeout(500)
                interaction_results['thread_hover'] = {'success': True, 'error': None}

                # Test click
                await thread_nodes[0].click()
                await page.wait_for_timeout(500)
                interaction_results['thread_click'] = {'success': True, 'error': None}
            else:
                interaction_results['thread_hover'] = {'success': False, 'error': 'No thread nodes found'}
                interaction_results['thread_click'] = {'success': False, 'error': 'No thread nodes found'}

        except Exception as e:
            interaction_results['thread_hover'] = {'success': False, 'error': str(e)}
            interaction_results['thread_click'] = {'success': False, 'error': str(e)}

        # Test keyboard shortcuts
        try:
            await page.keyboard.press('KeyDown')
            await page.wait_for_timeout(200)
            await page.keyboard.press('Digit1')
            await page.wait_for_timeout(200)
            interaction_results['keyboard_shortcuts'] = {'success': True, 'error': None}
        except Exception as e:
            interaction_results['keyboard_shortcuts'] = {'success': False, 'error': str(e)}

        # Test search functionality
        try:
            search_input = await page.query_selector('.thread-search')
            if search_input:
                await search_input.fill('test')
                await page.wait_for_timeout(500)
                interaction_results['search_input'] = {'success': True, 'error': None}
            else:
                interaction_results['search_input'] = {'success': False, 'error': 'Search input not found'}
        except Exception as e:
            interaction_results['search_input'] = {'success': False, 'error': str(e)}

        await self.screenshot(page, "05_event_handlers_audit")

        errors_after = len(self.js_errors)
        new_errors = errors_after - errors_before

        successful_interactions = sum(1 for result in interaction_results.values()
                                    if result['success'])

        return {
            'interaction_results': interaction_results,
            'successful_interactions': successful_interactions,
            'total_interactions_tested': len(interaction_results),
            'new_errors_during_interactions': new_errors,
            'crash_detected': new_errors > 0,
            'interaction_success_rate': successful_interactions / len(interaction_results)
        }

    async def audit_performance_metrics(self, page: Page) -> Dict[str, Any]:
        """
        Measure load times, bundle size, and rendering performance.
        Identifies performance bottlenecks that might prevent proper loading.

        Returns:
            Dict with timing_metrics, resource_sizes, performance_scores
        """
        print("🔍 Auditing performance metrics and load times...")

        try:
            # Get performance timing
            performance_timing = await page.evaluate("""
                () => {
                    const perfData = performance.getEntriesByType('navigation')[0];
                    const paintEntries = performance.getEntriesByType('paint');

                    return {
                        dom_content_loaded: perfData ? perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart : 0,
                        load_event: perfData ? perfData.loadEventEnd - perfData.loadEventStart : 0,
                        dom_interactive: perfData ? perfData.domInteractive - perfData.navigationStart : 0,
                        first_paint: paintEntries.find(p => p.name === 'first-paint')?.startTime || 0,
                        first_contentful_paint: paintEntries.find(p => p.name === 'first-contentful-paint')?.startTime || 0
                    };
                }
            """)

            # Check bundle sizes
            resource_timing = await page.evaluate("""
                () => {
                    const resources = performance.getEntriesByType('resource');
                    return resources.map(r => ({
                        name: r.name,
                        size: r.transferSize || r.decodedBodySize || 0,
                        duration: r.duration,
                        type: r.initiatorType
                    }));
                }
            """)

            # Test React render performance
            render_performance = await page.evaluate("""
                () => {
                    const start = performance.now();
                    // Trigger a re-render if possible
                    const event = new Event('resize');
                    window.dispatchEvent(event);
                    const end = performance.now();
                    return {
                        test_render_time: end - start,
                        timestamp: Date.now()
                    };
                }
            """)

            await self.screenshot(page, "06_performance_metrics_audit")

            # Calculate total bundle size
            total_bundle_size = sum(r['size'] for r in resource_timing if r['name'].endswith('.js'))

            return {
                'performance_timing': performance_timing,
                'resource_timing': resource_timing,
                'render_performance': render_performance,
                'total_bundle_size_bytes': total_bundle_size,
                'performance_healthy': (
                    performance_timing['dom_interactive'] < 5000 and
                    performance_timing['first_contentful_paint'] < 3000
                )
            }

        except Exception as e:
            return {
                'performance_healthy': False,
                'error': str(e),
                'audit_failed': True
            }

    async def audit_browser_compatibility(self, page: Page) -> Dict[str, Any]:
        """
        Test browser environment compatibility and feature support.
        Identifies environment-specific issues that prevent proper execution.

        Returns:
            Dict with feature_support, compatibility_issues, environment_info
        """
        print("🔍 Auditing browser compatibility and environment...")

        try:
            # Check browser features
            browser_features = await page.evaluate("""
                () => {
                    return {
                        user_agent: navigator.userAgent,
                        es6_support: typeof Symbol !== 'undefined' && typeof Promise !== 'undefined',
                        es2015_classes: typeof class {} === 'function',
                        arrow_functions: (() => true)(),
                        template_literals: `template${'literal'}` === 'templateliteral',
                        destructuring: (() => { try { const {a} = {a: 1}; return true; } catch(e) { return false; } })(),
                        async_await: typeof async function() {} === 'function',
                        fetch_available: typeof fetch !== 'undefined',
                        local_storage: typeof localStorage !== 'undefined',
                        file_protocol: location.protocol === 'file:',
                        cors_restrictions: location.protocol === 'file:' ? 'potential_cors_issues' : 'none'
                    };
                }
            """)

            # Check CDN resource loading
            cdn_resources = await page.evaluate("""
                () => {
                    const scripts = Array.from(document.querySelectorAll('script[src]'));
                    return scripts.map(script => ({
                        src: script.src,
                        loaded: script.readyState === 'complete' || !script.readyState,
                        error: script.onerror ? 'error_detected' : 'no_error'
                    }));
                }
            """)

            await self.screenshot(page, "07_browser_compatibility_audit")

            # Check for compatibility issues
            compatibility_issues = []
            if not browser_features['es6_support']:
                compatibility_issues.append('ES6 features not supported')
            if browser_features['file_protocol'] and browser_features['cors_restrictions']:
                compatibility_issues.append('File protocol may cause CORS issues')
            if any(res['error'] == 'error_detected' for res in cdn_resources):
                compatibility_issues.append('CDN resource loading failed')

            return {
                'browser_features': browser_features,
                'cdn_resources': cdn_resources,
                'compatibility_issues': compatibility_issues,
                'environment_compatible': len(compatibility_issues) == 0,
                'total_issues_found': len(compatibility_issues)
            }

        except Exception as e:
            return {
                'environment_compatible': False,
                'error': str(e),
                'audit_failed': True
            }

    async def screenshot(self, page: Page, name: str) -> Path:
        """Take a full-page screenshot and save to audit directory"""
        screenshot_path = self.screenshot_dir / f"{name}.png"
        await page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"📸 Screenshot saved: {screenshot_path}")
        return screenshot_path

    def setup_console_monitoring(self, page: Page):
        """Set up console and error monitoring"""
        def handle_console(msg: ConsoleMessage):
            self.console_logs.append({
                'type': msg.type,
                'text': msg.text,
                'location': msg.location,
                'timestamp': time.time()
            })
            if msg.type in ['error', 'warning']:
                print(f"🔴 Console {msg.type}: {msg.text}")

        def handle_error(error: Error):
            error_msg = str(error)
            self.js_errors.append(error_msg)
            print(f"💥 JavaScript Error: {error_msg}")

        page.on('console', handle_console)
        page.on('pageerror', handle_error)

    async def run_full_audit(self) -> Dict[str, Any]:
        """
        Run complete audit suite and generate comprehensive report.

        Returns:
            Dict containing all audit results and summary analysis
        """
        print(f"🚀 Starting comprehensive audit of {self.html_path}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            page = await browser.new_page()

            # Set up monitoring
            self.setup_console_monitoring(page)

            try:
                # Run all audits in sequence
                audit_results = {}

                audit_results['page_load'] = await self.audit_page_load(page)
                audit_results['javascript_execution'] = await self.audit_javascript_execution(page)
                audit_results['component_rendering'] = await self.audit_component_rendering(page)
                audit_results['state_management'] = await self.audit_state_management(page)
                audit_results['event_handlers'] = await self.audit_event_handlers(page)
                audit_results['performance_metrics'] = await self.audit_performance_metrics(page)
                audit_results['browser_compatibility'] = await self.audit_browser_compatibility(page)

                # Generate summary
                summary = self.generate_audit_summary(audit_results)
                audit_results['summary'] = summary

                # Save detailed logs
                await self.save_audit_report(audit_results)

                return audit_results

            finally:
                await browser.close()

    def generate_audit_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate executive summary of audit findings"""
        critical_failures = []
        warnings = []
        successes = []

        # Analyze each audit result
        if not results['page_load'].get('load_success', False):
            critical_failures.append("Page failed to load")
        else:
            successes.append("Page loaded successfully")

        if not results['javascript_execution'].get('execution_successful', False):
            critical_failures.append("JavaScript execution failed")
        elif not results['javascript_execution'].get('react_loaded', False):
            critical_failures.append("React framework not loaded")
        else:
            successes.append("JavaScript execution successful")

        if not results['component_rendering'].get('all_components_rendered', False):
            render_rate = results['component_rendering'].get('render_success_rate', 0)
            if render_rate < 0.5:
                critical_failures.append(f"Component rendering failed ({render_rate:.1%} success rate)")
            else:
                warnings.append(f"Some components failed to render ({render_rate:.1%} success rate)")
        else:
            successes.append("All components rendered successfully")

        if results['state_management'].get('duplicate_state_detected', False):
            critical_failures.append("Duplicate React state declarations detected")

        if results['event_handlers'].get('crash_detected', False):
            warnings.append("Event handler errors detected")

        return {
            'overall_health': 'HEALTHY' if not critical_failures else 'CRITICAL' if critical_failures else 'WARNING',
            'critical_failures': critical_failures,
            'warnings': warnings,
            'successes': successes,
            'total_console_logs': len(self.console_logs),
            'total_js_errors': len(self.js_errors),
            'diagnosis': self.generate_diagnosis(critical_failures, warnings)
        }

    def generate_diagnosis(self, failures: List[str], warnings: List[str]) -> str:
        """Generate diagnostic recommendation based on findings"""
        if "Duplicate React state declarations detected" in failures:
            return "PRIMARY ISSUE: Duplicate useState declarations causing React rendering failure. Fix: Remove duplicate viewMode state declarations."
        elif "React framework not loaded" in failures:
            return "PRIMARY ISSUE: React/Babel CDN resources failed to load. Check internet connection and CDN availability."
        elif "JavaScript execution failed" in failures:
            return "PRIMARY ISSUE: JavaScript syntax or runtime error preventing execution. Check console logs for specific error details."
        elif "Page failed to load" in failures:
            return "PRIMARY ISSUE: HTML file cannot be accessed or parsed. Verify file path and permissions."
        elif warnings:
            return "SECONDARY ISSUES: Minor component or interaction issues detected. App may be partially functional."
        else:
            return "No critical issues detected. App should be functioning normally."

    async def save_audit_report(self, results: Dict[str, Any]):
        """Save comprehensive audit report to JSON file"""
        report_path = self.screenshot_dir / "audit_report.json"

        # Prepare serializable report
        serializable_results = {
            'audit_timestamp': time.time(),
            'html_file': str(self.html_path),
            'results': results,
            'console_logs': self.console_logs,
            'js_errors': self.js_errors,
            'total_screenshots': len(list(self.screenshot_dir.glob("*.png")))
        }

        with open(report_path, 'w') as f:
            json.dump(serializable_results, f, indent=2, default=str)

        print(f"📊 Audit report saved: {report_path}")


# Helper function for easy execution
async def audit_email_navigator(html_path: str = "email_thread_navigator.html"):
    """Run complete audit on Email Thread Navigator"""
    auditor = EmailThreadAuditor(html_path)
    results = await auditor.run_full_audit()

    print("\n" + "="*50)
    print("📋 AUDIT SUMMARY")
    print("="*50)
    summary = results['summary']
    print(f"Overall Health: {summary['overall_health']}")
    print(f"Critical Failures: {len(summary['critical_failures'])}")
    print(f"Warnings: {len(summary['warnings'])}")
    print(f"Successes: {len(summary['successes'])}")
    print(f"\n🎯 Diagnosis: {summary['diagnosis']}")

    if summary['critical_failures']:
        print("\n🚨 Critical Issues:")
        for failure in summary['critical_failures']:
            print(f"  - {failure}")

    if summary['warnings']:
        print("\n⚠️ Warnings:")
        for warning in summary['warnings']:
            print(f"  - {warning}")

    return results


if __name__ == "__main__":
    asyncio.run(audit_email_navigator())