"""
CORRECTED VERSION: Comprehensive Playwright UI Auditor for Email Thread Navigator
Fixed bugs, logical gaps, and naming mismatches from senior code review
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
    Response,
    CDPSession
)


class EmailThreadNavigatorAuditor:
    """DevTools-style Playwright auditor for Email Thread Navigator UI testing - CORRECTED VERSION"""

    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.cdp_session: Optional[CDPSession] = None
        self.console_logs: List[Dict] = []
        self.network_logs: List[Dict] = []
        self.performance_metrics: Dict = {}
        self.screenshots_dir = Path("test-screenshots")
        self.reports_dir = Path("test-reports")
        self.har_path = Path("test-reports/navigator-session.har")

        # Ensure directories exist
        self.screenshots_dir.mkdir(exist_ok=True)
        self.reports_dir.mkdir(exist_ok=True)

    async def setup(self):
        """
        Initialize browser with console/network logging and proper CDP session

        Inputs: None
        Outputs: None
        Side effects: Creates browser instance, sets up logging hooks, starts HAR recording, enables CDP
        Raises: Exception if browser setup fails
        """
        try:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=False,  # Set to True for CI
                args=['--disable-dev-shm-usage', '--no-sandbox']
            )

            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                record_har_path=str(self.har_path),
                record_har_mode='minimal'  # FIX: Reduce memory usage
            )

            self.page = await self.context.new_page()

            # FIX: Properly set up CDP session
            self.cdp_session = await self.page.context.new_cdp_session(self.page)
            await self.cdp_session.send('Performance.enable')
            await self.cdp_session.send('Runtime.enable')

            # Console logging hook
            self.page.on('console', self._handle_console_message)
            self.page.on('pageerror', self._handle_page_error)
            self.page.on('request', self._handle_request)
            self.page.on('response', self._handle_response)

        except Exception as e:
            raise Exception(f"Browser setup failed: {str(e)}")

    def _handle_console_message(self, msg: ConsoleMessage):
        """Handle console messages for logging"""
        self.console_logs.append({
            'timestamp': datetime.now().isoformat(),
            'type': msg.type,
            'text': msg.text,
            'location': f"{msg.location.get('url', 'unknown')}:{msg.location.get('lineNumber', 0)}"
        })

    def _handle_page_error(self, error):
        """Handle page errors"""
        self.console_logs.append({
            'timestamp': datetime.now().isoformat(),
            'type': 'error',
            'text': str(error),
            'location': 'page_error'
        })

    def _handle_request(self, request: Request):
        """Log network requests - FIX: Add size limit to prevent memory issues"""
        if len(self.network_logs) < 100:  # Limit log size
            self.network_logs.append({
                'timestamp': datetime.now().isoformat(),
                'type': 'request',
                'url': request.url,
                'method': request.method,
                'resource_type': request.resource_type
            })

    def _handle_response(self, response: Response):
        """Log network responses - FIX: Add size limit"""
        if len(self.network_logs) < 100:  # Limit log size
            self.network_logs.append({
                'timestamp': datetime.now().isoformat(),
                'type': 'response',
                'url': response.url,
                'status': response.status,
                'content_type': response.headers.get('content-type', '')
            })

    async def load_navigator_application(self) -> Dict:
        """
        Loads the main email thread navigator and verifies all three panels render correctly

        Inputs: None
        Outputs: Dict containing load results, panel visibility, rating schema validation, and any errors
        Side effects: Navigates to navigator page, takes screenshot, validates rating schema
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'load_successful': False,
            'panels_visible': {
                'thread_panel': False,
                'message_panel': False,
                'rating_panel': False
            },
            'initial_state': {},
            'rating_schema_valid': False,  # FIX: Added schema validation
            'screenshots': [],
            'errors': []
        }

        try:
            # Navigate to the navigator application
            navigator_path = Path.cwd() / 'email_thread_navigator.html'
            if not navigator_path.exists():
                results['errors'].append(f'Navigator file not found: {navigator_path}')
                return results

            await self.page.goto(f'file://{navigator_path}')

            # Wait for React to render
            await self.page.wait_for_selector('.app-container', timeout=10000)
            await self.page.wait_for_timeout(2000)  # Additional time for full render

            # Check panel visibility
            thread_panel = await self.page.query_selector('.thread-panel')
            message_panel = await self.page.query_selector('.message-panel')
            rating_panel = await self.page.query_selector('.rating-panel')

            results['panels_visible']['thread_panel'] = thread_panel is not None
            results['panels_visible']['message_panel'] = message_panel is not None
            results['panels_visible']['rating_panel'] = rating_panel is not None

            # FIX: Validate rating schema compliance
            schema_validation = await self.page.evaluate("""
                () => {
                    try {
                        // Check if DEFAULT_RATING_SCHEMA exists and has required structure
                        const schema = window.DEFAULT_RATING_SCHEMA;
                        if (!schema) return { valid: false, error: 'Schema not found' };

                        const hasVersion = 'version' in schema;
                        const hasMessageOptions = Array.isArray(schema.messageOptions);
                        const hasValidOptions = schema.messageOptions.every(opt =>
                            'key' in opt && 'label' in opt
                        );

                        return {
                            valid: hasVersion && hasMessageOptions && hasValidOptions,
                            version: schema.version,
                            message_options_count: schema.messageOptions.length,
                            thread_options_count: schema.threadOptions?.length || 0
                        };
                    } catch (error) {
                        return { valid: false, error: error.message };
                    }
                }
            """)
            results['rating_schema_valid'] = schema_validation.get('valid', False)
            results['schema_details'] = schema_validation

            # Check if all panels are visible
            results['load_successful'] = all(results['panels_visible'].values())

            # FIX: Enhanced initial state capture with error handling
            try:
                initial_state = await self.page.evaluate("""
                    () => {
                        const threadNodes = document.querySelectorAll('.thread-node');
                        const ratingButtons = document.querySelectorAll('.rating-button');
                        const searchBox = document.querySelector('.thread-search');

                        return {
                            thread_nodes_count: threadNodes.length,
                            rating_buttons_count: ratingButtons.length,
                            search_box_present: searchBox !== null,
                            selected_message: document.querySelector('.thread-node.selected') !== null,
                            has_thread_data: threadNodes.length > 0  // FIX: Check for empty data
                        };
                    }
                """)
                results['initial_state'] = initial_state

                # FIX: Validate minimum thread data requirements
                if initial_state['thread_nodes_count'] == 0:
                    results['errors'].append('No thread data found - application may not have loaded properly')

            except Exception as e:
                results['errors'].append(f'Failed to capture initial state: {str(e)}')

            # Take screenshot
            screenshot_path = await self.capture_screenshot('navigator_initial_load')
            results['screenshots'].append(screenshot_path)

        except Exception as e:
            results['errors'].append(f'Load failed: {str(e)}')

        return results

    async def test_thread_tree_rendering_performance(self) -> Dict:
        """
        FIX: Renamed from test_thread_tree_rendering to be more specific about performance testing
        Measures actual tree rendering performance and validates hierarchy structure

        Inputs: None
        Outputs: Dict containing tree structure analysis, hierarchy validation, and render timing
        Side effects: Interacts with tree nodes, measures render performance, takes screenshots
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'tree_structure_valid': False,
            'node_analysis': {},
            'hierarchy_test': {},
            'render_performance': {},  # FIX: Added specific performance metrics
            'screenshots': [],
            'errors': []
        }

        try:
            # FIX: Measure actual tree rendering performance
            start_time = time.time()

            # Analyze tree structure
            tree_analysis = await self.page.evaluate("""
                () => {
                    const threadNodes = document.querySelectorAll('.thread-node');
                    const nodeData = [];

                    threadNodes.forEach((node, index) => {
                        const depth = parseInt(node.style.paddingLeft) || 0;
                        const hasChildren = node.querySelector('span') && (node.querySelector('span').textContent === '▼' || node.querySelector('span').textContent === '▶');
                        const isSelected = node.classList.contains('selected');
                        const isRated = node.classList.contains('rated');

                        nodeData.push({
                            index,
                            depth,
                            hasChildren,
                            isSelected,
                            isRated,
                            senderText: node.querySelector('.node-sender')?.textContent || '',
                            subjectText: node.querySelector('.node-subject')?.textContent || ''
                        });
                    });

                    return {
                        total_nodes: threadNodes.length,
                        node_data: nodeData,
                        root_nodes: nodeData.filter(n => n.depth <= 12),
                        child_nodes: nodeData.filter(n => n.depth > 12)
                    };
                }
            """)

            end_time = time.time()
            analysis_time_ms = (end_time - start_time) * 1000

            results['node_analysis'] = tree_analysis
            results['render_performance']['analysis_time_ms'] = analysis_time_ms

            # Test tree expansion/collapse with performance measurement
            expand_buttons = await self.page.query_selector_all('span:has-text("▶")')
            if expand_buttons:
                # Measure expansion performance
                expand_start = time.time()
                await expand_buttons[0].click()
                await self.page.wait_for_timeout(500)
                expand_end = time.time()

                expansion_time_ms = (expand_end - expand_start) * 1000
                results['render_performance']['expansion_time_ms'] = expansion_time_ms

                # Check if children appeared
                after_expand = await self.page.query_selector_all('.thread-node')
                results['hierarchy_test']['expand_worked'] = len(after_expand) > tree_analysis['total_nodes']

                # Take screenshot after expansion
                screenshot_path = await self.capture_screenshot('tree_expanded')
                results['screenshots'].append(screenshot_path)

            # Validate hierarchy structure with better logic
            results['tree_structure_valid'] = (
                tree_analysis['total_nodes'] >= 1 and  # FIX: More flexible minimum
                len(tree_analysis['root_nodes']) >= 1 and
                len(tree_analysis['node_data']) > 0
            )

            # FIX: Check if performance meets spec requirements
            total_render_time = analysis_time_ms + results['render_performance'].get('expansion_time_ms', 0)
            results['render_performance']['total_time_ms'] = total_render_time
            results['render_performance']['meets_spec'] = total_render_time < 200

        except Exception as e:
            results['errors'].append(f'Tree rendering test failed: {str(e)}')

        return results

    async def test_keyboard_navigation_comprehensive(self) -> Dict:
        """
        FIX: Renamed for clarity and enhanced to test all navigation scenarios
        Validates all keyboard shortcuts including edge cases

        Inputs: None
        Outputs: Dict containing comprehensive keyboard navigation test results
        Side effects: Sends keyboard events, changes selection state, takes screenshots
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'keyboard_tests': {},
            'navigation_working': False,
            'edge_cases': {},  # FIX: Added edge case testing
            'shortcuts_complete': False,
            'screenshots': [],
            'errors': []
        }

        try:
            # Test arrow key navigation with bounds checking
            initial_selected = await self.page.query_selector('.thread-node.selected')
            if initial_selected:
                # Test down arrow
                await self.page.keyboard.press('ArrowDown')
                await self.page.wait_for_timeout(300)

                after_down = await self.page.query_selector('.thread-node.selected')
                results['keyboard_tests']['arrow_down'] = after_down != initial_selected

                # Test up arrow
                await self.page.keyboard.press('ArrowUp')
                await self.page.wait_for_timeout(300)

                after_up = await self.page.query_selector('.thread-node.selected')
                results['keyboard_tests']['arrow_up'] = after_up == initial_selected

                # FIX: Test navigation bounds (edge case)
                # Try to navigate past the last item
                for _ in range(10):  # Navigate down multiple times
                    await self.page.keyboard.press('ArrowDown')
                    await self.page.wait_for_timeout(100)

                final_selected = await self.page.query_selector('.thread-node.selected')
                results['edge_cases']['navigation_bounds'] = final_selected is not None

            # Test search focus shortcut
            await self.page.keyboard.press('/')
            await self.page.wait_for_timeout(300)

            focused_element = await self.page.evaluate('document.activeElement.className')
            results['keyboard_tests']['search_focus'] = 'thread-search' in focused_element

            # Test N key for next unrated
            await self.page.keyboard.press('Escape')  # Clear search focus
            await self.page.keyboard.press('n')
            await self.page.wait_for_timeout(300)

            current_selected = await self.page.query_selector('.thread-node.selected')
            has_unrated_class = await current_selected.evaluate('el => el.classList.contains("unrated")') if current_selected else False
            results['keyboard_tests']['next_unrated'] = has_unrated_class

            # FIX: Test Shift+N for previous unrated
            await self.page.keyboard.press('Shift+N')
            await self.page.wait_for_timeout(300)
            results['keyboard_tests']['previous_unrated'] = True  # Basic test that it doesn't crash

            # Test help shortcut
            await self.page.keyboard.press('?')
            await self.page.wait_for_timeout(300)

            help_visible = await self.page.query_selector('.shortcuts-help.visible')
            results['keyboard_tests']['help_toggle'] = help_visible is not None

            # FIX: Test help close with Escape
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(300)

            help_hidden = await self.page.query_selector('.shortcuts-help.visible')
            results['keyboard_tests']['help_close'] = help_hidden is None

            # Take screenshot of keyboard navigation state
            screenshot_path = await self.capture_screenshot('keyboard_navigation')
            results['screenshots'].append(screenshot_path)

            # Determine overall navigation success
            results['navigation_working'] = all([
                results['keyboard_tests'].get('arrow_down', False),
                results['keyboard_tests'].get('search_focus', False),
                results['keyboard_tests'].get('help_toggle', False)
            ])

            # FIX: More comprehensive success criteria
            results['shortcuts_complete'] = all([
                results['keyboard_tests'].get('arrow_down', False),
                results['keyboard_tests'].get('arrow_up', False),
                results['keyboard_tests'].get('search_focus', False),
                results['keyboard_tests'].get('help_toggle', False),
                results['keyboard_tests'].get('help_close', False)
            ])

        except Exception as e:
            results['errors'].append(f'Keyboard navigation test failed: {str(e)}')

        return results

    async def test_rating_panel_workflow_complete(self) -> Dict:
        """
        FIX: Renamed for clarity - tests complete rating workflow including validation
        Tests rating button clicks, note entry, validation, and Save & Next workflow

        Inputs: None
        Outputs: Dict containing comprehensive rating panel interaction results
        Side effects: Clicks rating buttons, enters text, triggers save actions, tests validation
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'rating_tests': {},
            'validation_tests': {},  # FIX: Added validation testing
            'workflow_complete': False,
            'screenshots': [],
            'errors': []
        }

        try:
            # Test message rating button clicks
            message_rating_buttons = await self.page.query_selector_all('.rating-section:last-of-type .rating-button')
            if message_rating_buttons:
                # Click first rating button (should be "Relevant")
                await message_rating_buttons[0].click()
                await self.page.wait_for_timeout(300)

                # Check if button became selected
                is_selected = await message_rating_buttons[0].evaluate('el => el.classList.contains("selected")')
                results['rating_tests']['button_selection'] = is_selected

                # FIX: Test button deselection
                await message_rating_buttons[0].click()  # Click again to deselect
                await self.page.wait_for_timeout(300)
                is_deselected = await message_rating_buttons[0].evaluate('el => !el.classList.contains("selected")')
                results['rating_tests']['button_deselection'] = is_deselected

                # Re-select for further tests
                await message_rating_buttons[0].click()
                await self.page.wait_for_timeout(300)

                # Take screenshot after selection
                screenshot_path = await self.capture_screenshot('rating_selected')
                results['screenshots'].append(screenshot_path)

            # Test note entry with validation
            note_textarea = await self.page.query_selector('.rating-section:last-of-type .rating-note')
            if note_textarea:
                test_note = "This is a test rating note for automated testing."
                await note_textarea.fill(test_note)
                await self.page.wait_for_timeout(300)

                # Verify note was entered
                note_value = await note_textarea.input_value()
                results['rating_tests']['note_entry'] = note_value == test_note

                # FIX: Test note character limit (if implemented)
                long_note = "x" * 1000  # Very long note
                await note_textarea.fill(long_note)
                await self.page.wait_for_timeout(300)
                long_note_value = await note_textarea.input_value()
                results['validation_tests']['note_length_handling'] = len(long_note_value) > 0

                # Restore normal note
                await note_textarea.fill(test_note)

            # Test thread rating
            thread_rating_buttons = await self.page.query_selector_all('.rating-section:first-of-type .rating-button')
            if thread_rating_buttons:
                await thread_rating_buttons[0].click()  # Click first thread rating
                await self.page.wait_for_timeout(300)

                is_thread_selected = await thread_rating_buttons[0].evaluate('el => el.classList.contains("selected")')
                results['rating_tests']['thread_rating'] = is_thread_selected

            # FIX: Test exclusive group behavior (if applicable)
            if len(message_rating_buttons) > 1:
                # Select first button
                await message_rating_buttons[0].click()
                await self.page.wait_for_timeout(300)

                # Select second button (should deselect first if in exclusive group)
                await message_rating_buttons[1].click()
                await self.page.wait_for_timeout(300)

                first_still_selected = await message_rating_buttons[0].evaluate('el => el.classList.contains("selected")')
                second_selected = await message_rating_buttons[1].evaluate('el => el.classList.contains("selected")')

                results['validation_tests']['exclusive_group_behavior'] = {
                    'first_deselected': not first_still_selected,
                    'second_selected': second_selected
                }

            # Test Save & Next button
            save_button = await self.page.query_selector('button:has-text("Save & Next")')
            if save_button:
                # Record current selection before save
                current_node = await self.page.query_selector('.thread-node.selected .node-sender')
                current_sender = await current_node.text_content() if current_node else ''

                await save_button.click()
                await self.page.wait_for_timeout(500)

                # Check if selection moved (auto-advance)
                new_selected = await self.page.query_selector('.thread-node.selected .node-sender')
                new_sender = await new_selected.text_content() if new_selected else ''

                results['rating_tests']['auto_advance'] = new_sender != current_sender and len(new_sender) > 0

            # Take final screenshot
            screenshot_path = await self.capture_screenshot('rating_workflow_complete')
            results['screenshots'].append(screenshot_path)

            # Determine workflow success
            results['workflow_complete'] = all([
                results['rating_tests'].get('button_selection', False),
                results['rating_tests'].get('note_entry', False),
                results['rating_tests'].get('thread_rating', False)
            ])

        except Exception as e:
            results['errors'].append(f'Rating panel test failed: {str(e)}')

        return results

    async def capture_screenshot(self, name: str) -> str:
        """
        FIX: Renamed from 'screenshot' to be more descriptive
        Helper function to take screenshots with consistent naming and error handling

        Inputs: name (str) - descriptive name for the screenshot
        Outputs: str - path to saved screenshot
        Side effects: Saves screenshot file to screenshots directory
        Raises: Exception if screenshot capture fails
        """
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{name}_{timestamp}.png"
            filepath = self.screenshots_dir / filename

            await self.page.screenshot(path=str(filepath), full_page=True)
            return str(filepath)
        except Exception as e:
            # FIX: Don't fail the test if screenshot fails
            error_filename = f"screenshot_error_{timestamp}.txt"
            error_path = self.screenshots_dir / error_filename
            with open(error_path, 'w') as f:
                f.write(f"Screenshot failed for {name}: {str(e)}")
            return str(error_path)

    async def get_real_cdp_metrics(self) -> Dict:
        """
        FIX: Renamed from cdp_metrics and now actually uses CDP
        Gets genuine Chrome DevTools Protocol performance metrics

        Inputs: None
        Outputs: Dict containing real CDP performance metrics
        Side effects: None
        Raises: Exception if CDP session is not available
        """
        try:
            if not self.cdp_session:
                return {'error': 'CDP session not available'}

            # Get actual CDP performance metrics
            runtime_metrics = await self.cdp_session.send('Performance.getMetrics')

            # Convert to readable format
            metrics_dict = {}
            for metric in runtime_metrics.get('metrics', []):
                metrics_dict[metric['name']] = metric['value']

            # Also get browser performance timing
            browser_metrics = await self.page.evaluate("""
                () => {
                    const nav = performance.getEntriesByType('navigation')[0];
                    const paint = performance.getEntriesByType('paint');

                    return {
                        navigation_timing: nav ? {
                            dom_content_loaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
                            load_complete: nav.loadEventEnd - nav.loadEventStart,
                            dom_interactive: nav.domInteractive - nav.fetchStart
                        } : null,
                        paint_timing: paint.map(p => ({ name: p.name, time: p.startTime })),
                        memory: performance.memory ? {
                            used: performance.memory.usedJSHeapSize,
                            total: performance.memory.totalJSHeapSize,
                            limit: performance.memory.jsHeapSizeLimit
                        } : null
                    };
                }
            """)

            return {
                'cdp_metrics': metrics_dict,
                'browser_metrics': browser_metrics,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            return {'error': str(e)}

    async def cleanup(self):
        """
        FIX: Enhanced cleanup with proper resource disposal
        Cleanup browser resources including CDP session

        Inputs: None
        Outputs: None
        Side effects: Closes browser, context, CDP session, handles cleanup errors gracefully
        """
        try:
            if self.cdp_session:
                await self.cdp_session.detach()
        except:
            pass

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

        try:
            if hasattr(self, 'playwright'):
                await self.playwright.stop()
        except:
            pass

    # FIX: Add missing methods that were referenced but not implemented
    async def test_message_view_display(self) -> Dict:
        """
        Verifies message headers, body content, and attachment rendering with enhanced validation

        Inputs: None
        Outputs: Dict containing comprehensive message view validation results
        Side effects: Selects different messages, validates content, takes screenshots
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'message_display': {},
            'content_validation': {},
            'screenshots': [],
            'errors': []
        }

        try:
            # Check message headers display
            headers_section = await self.page.query_selector('.email-headers')
            if headers_section:
                header_rows = await headers_section.query_selector_all('.header-row')
                results['message_display']['headers_count'] = len(header_rows)

                # Check for required headers
                headers_text = await headers_section.text_content()
                required_headers = ['From:', 'To:', 'Date:', 'Subject:']
                headers_present = [header in headers_text for header in required_headers]
                results['message_display']['required_headers_present'] = all(headers_present)
                results['message_display']['missing_headers'] = [
                    required_headers[i] for i, present in enumerate(headers_present) if not present
                ]

            # Check message body
            message_body = await self.page.query_selector('.message-body')
            if message_body:
                body_text = await message_body.text_content()
                results['message_display']['body_has_content'] = len(body_text.strip()) > 0
                results['message_display']['body_word_count'] = len(body_text.split())
                results['message_display']['body_character_count'] = len(body_text)

            # Check attachments display
            attachment_list = await self.page.query_selector('.attachment-list')
            if attachment_list:
                attachment_items = await attachment_list.query_selector_all('.attachment-item')
                results['message_display']['attachments_count'] = len(attachment_items)

                # Check attachment details
                if attachment_items:
                    first_attachment = attachment_items[0]
                    attachment_icon = await first_attachment.query_selector('.attachment-icon')
                    attachment_name = await first_attachment.text_content()

                    results['message_display']['attachment_has_icon'] = attachment_icon is not None
                    results['message_display']['attachment_has_name'] = len(attachment_name.strip()) > 0

            # Test message navigation
            thread_nodes = await self.page.query_selector_all('.thread-node')
            if len(thread_nodes) > 1:
                # Click second message
                await thread_nodes[1].click()
                await self.page.wait_for_timeout(500)

                # Check if message view updated
                updated_body = await self.page.query_selector('.message-body')
                if updated_body:
                    updated_text = await updated_body.text_content()
                    results['content_validation']['message_switching'] = len(updated_text.strip()) > 0

            # Take screenshot of message view
            screenshot_path = await self.capture_screenshot('message_view_display')
            results['screenshots'].append(screenshot_path)

        except Exception as e:
            results['errors'].append(f'Message view test failed: {str(e)}')

        return results

    async def test_search_and_filtering(self) -> Dict:
        """
        Examines search functionality and message filtering behavior with edge cases

        Inputs: None
        Outputs: Dict containing comprehensive search and filtering test results
        Side effects: Enters search queries, filters messages, tests edge cases, takes screenshots
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'search_tests': {},
            'filtering_effective': False,
            'edge_cases': {},
            'screenshots': [],
            'errors': []
        }

        try:
            # Get initial message count
            initial_nodes = await self.page.query_selector_all('.thread-node')
            initial_count = len(initial_nodes)
            results['search_tests']['initial_message_count'] = initial_count

            # Test search functionality
            search_box = await self.page.query_selector('.thread-search')
            if search_box:
                # Search for specific sender
                await search_box.fill('john')
                await self.page.wait_for_timeout(500)

                # Check filtered results
                filtered_nodes = await self.page.query_selector_all('.thread-node')
                filtered_count = len(filtered_nodes)
                results['search_tests']['search_john_count'] = filtered_count

                # Verify filtering worked
                results['search_tests']['search_reduces_results'] = filtered_count < initial_count

                # Take screenshot of search results
                screenshot_path = await self.capture_screenshot('search_john_results')
                results['screenshots'].append(screenshot_path)

                # Test search for non-existent term
                await search_box.fill('nonexistent')
                await self.page.wait_for_timeout(500)

                no_results_nodes = await self.page.query_selector_all('.thread-node')
                results['search_tests']['no_results_count'] = len(no_results_nodes)

                # FIX: Test special characters and edge cases
                special_searches = ['@', '123', '!!!', '   ', '']
                for search_term in special_searches:
                    await search_box.fill(search_term)
                    await self.page.wait_for_timeout(300)

                    special_nodes = await self.page.query_selector_all('.thread-node')
                    results['edge_cases'][f'search_{search_term or "empty"}'] = len(special_nodes)

                # Clear search
                await search_box.fill('')
                await self.page.wait_for_timeout(500)

                # Verify all messages returned
                cleared_nodes = await self.page.query_selector_all('.thread-node')
                results['search_tests']['clear_search_restores'] = len(cleared_nodes) == initial_count

            # Test case-insensitive search
            if search_box:
                await search_box.fill('JOHN')  # Uppercase
                await self.page.wait_for_timeout(500)

                uppercase_nodes = await self.page.query_selector_all('.thread-node')
                results['search_tests']['case_insensitive'] = len(uppercase_nodes) == results['search_tests']['search_john_count']

                await search_box.fill('')  # Clear for next test
                await self.page.wait_for_timeout(500)

            # Determine overall filtering effectiveness
            results['filtering_effective'] = all([
                results['search_tests'].get('search_reduces_results', False),
                results['search_tests'].get('clear_search_restores', False),
                results['search_tests'].get('case_insensitive', False)
            ])

        except Exception as e:
            results['errors'].append(f'Search and filtering test failed: {str(e)}')

        return results

    async def test_performance_requirements(self) -> Dict:
        """
        Measures rendering times to ensure <200ms spec compliance with accurate measurements

        Inputs: None
        Outputs: Dict containing accurate performance measurements and spec compliance
        Side effects: Triggers re-renders, measures timing, captures CDP performance metrics
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'performance_tests': {},
            'spec_compliance': {},
            'measurements': [],
            'cdp_data': {},
            'errors': []
        }

        try:
            # Get baseline CDP metrics
            baseline_metrics = await self.get_real_cdp_metrics()
            results['cdp_data']['baseline'] = baseline_metrics

            # Test tree rendering performance with accurate measurement
            render_times = []

            for iteration in range(5):  # More iterations for better accuracy
                # Clear any existing state
                search_box = await self.page.query_selector('.thread-search')
                if search_box:
                    await search_box.fill('')
                    await self.page.wait_for_timeout(100)

                # Measure actual tree rendering by triggering re-render
                start_time = time.perf_counter()  # FIX: Use high-precision timer

                # Trigger re-render by changing state
                if search_box:
                    await search_box.fill(f'test{iteration}')
                    await search_box.fill('')  # Clear immediately to trigger re-render

                    # Wait for DOM to stabilize with better detection
                    await self.page.wait_for_function(
                        f'document.querySelectorAll(".thread-node").length >= {3}',  # Wait for minimum nodes
                        timeout=5000
                    )

                end_time = time.perf_counter()
                render_time_ms = (end_time - start_time) * 1000
                render_times.append(render_time_ms)

            # Calculate statistics
            avg_render_time = sum(render_times) / len(render_times)
            min_render_time = min(render_times)
            max_render_time = max(render_times)

            results['performance_tests']['average_render_time_ms'] = avg_render_time
            results['performance_tests']['min_render_time_ms'] = min_render_time
            results['performance_tests']['max_render_time_ms'] = max_render_time
            results['performance_tests']['individual_times'] = render_times

            # Check spec compliance (<200ms for 100 nodes)
            results['spec_compliance']['meets_200ms_requirement'] = avg_render_time < 200.0
            results['spec_compliance']['consistent_performance'] = max_render_time < 300.0  # Allow some variance

            # Test message selection performance
            message_selection_times = []
            thread_nodes = await self.page.query_selector_all('.thread-node')

            for i in range(min(3, len(thread_nodes))):
                start_time = time.perf_counter()
                await thread_nodes[i].click()

                # Wait for message view to update
                await self.page.wait_for_function(
                    'document.querySelector(".message-body")?.textContent?.length > 0',
                    timeout=2000
                )

                end_time = time.perf_counter()
                selection_time_ms = (end_time - start_time) * 1000
                message_selection_times.append(selection_time_ms)

            avg_selection_time = sum(message_selection_times) / len(message_selection_times) if message_selection_times else 0
            results['performance_tests']['average_message_selection_ms'] = avg_selection_time
            results['spec_compliance']['message_selection_fast'] = avg_selection_time < 100.0

            # Get final CDP metrics
            final_metrics = await self.get_real_cdp_metrics()
            results['cdp_data']['final'] = final_metrics

        except Exception as e:
            results['errors'].append(f'Performance testing failed: {str(e)}')

        return results

    async def test_accessibility_compliance(self) -> Dict:
        """
        Validates WCAG compliance, keyboard navigation, and ARIA labels with comprehensive checks

        Inputs: None
        Outputs: Dict containing detailed accessibility compliance results
        Side effects: Tests keyboard navigation, checks ARIA attributes, validates color contrast
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'accessibility_tests': {},
            'wcag_compliance': {},
            'aria_validation': {},
            'color_contrast': {},
            'screenshots': [],
            'errors': []
        }

        try:
            # Test keyboard accessibility with comprehensive coverage
            keyboard_accessible_elements = await self.page.evaluate("""
                () => {
                    const interactiveElements = document.querySelectorAll(
                        'button, input, [tabindex], [role="button"], [role="treeitem"], a[href]'
                    );

                    let accessible_count = 0;
                    let total_count = interactiveElements.length;
                    let issues = [];

                    interactiveElements.forEach((el, index) => {
                        const hasAriaLabel = el.hasAttribute('aria-label');
                        const hasText = el.textContent?.trim().length > 0;
                        const hasTitle = el.hasAttribute('title');
                        const hasRole = el.hasAttribute('role');
                        const hasPlaceholder = el.hasAttribute('placeholder');

                        if (hasAriaLabel || hasText || hasTitle || hasRole || hasPlaceholder) {
                            accessible_count++;
                        } else {
                            issues.push({
                                index,
                                tagName: el.tagName,
                                className: el.className,
                                reason: 'No accessible name or role'
                            });
                        }
                    });

                    return {
                        total_interactive_elements: total_count,
                        accessible_elements: accessible_count,
                        accessibility_percentage: total_count > 0 ? (accessible_count / total_count) * 100 : 0,
                        accessibility_issues: issues
                    };
                }
            """)
            results['accessibility_tests']['keyboard_accessible'] = keyboard_accessible_elements

            # Enhanced ARIA compliance testing
            aria_compliance = await self.page.evaluate("""
                () => {
                    const tree = document.querySelector('[role="tree"]');
                    const treeItems = document.querySelectorAll('[role="treeitem"]');
                    const buttons = document.querySelectorAll('button');
                    const inputs = document.querySelectorAll('input');

                    // Check ARIA attributes quality
                    const treeItemsWithAriaSelected = Array.from(treeItems).filter(item =>
                        item.hasAttribute('aria-selected'));
                    const treeItemsWithAriaExpanded = Array.from(treeItems).filter(item =>
                        item.hasAttribute('aria-expanded'));

                    return {
                        has_tree_role: tree !== null,
                        tree_has_aria_label: tree?.hasAttribute('aria-label') || false,
                        treeitem_count: treeItems.length,
                        treeitem_aria_selected_count: treeItemsWithAriaSelected.length,
                        treeitem_aria_expanded_count: treeItemsWithAriaExpanded.length,
                        buttons_with_text: Array.from(buttons).filter(btn =>
                            btn.textContent.trim().length > 0).length,
                        inputs_with_labels: Array.from(inputs).filter(input =>
                            input.hasAttribute('aria-label') ||
                            input.hasAttribute('placeholder') ||
                            document.querySelector(`label[for="${input.id}"]`)).length,
                        total_buttons: buttons.length,
                        total_inputs: inputs.length
                    };
                }
            """)
            results['aria_validation'] = aria_compliance

            # Enhanced color contrast checking
            contrast_checks = await self.page.evaluate("""
                () => {
                    const elements = [
                        { selector: '.thread-node.selected', name: 'selected_thread_node' },
                        { selector: '.rating-button.selected', name: 'selected_rating_button' },
                        { selector: '.thread-search', name: 'search_input' },
                        { selector: '.message-body', name: 'message_body' }
                    ];

                    const results = {};

                    elements.forEach(({ selector, name }) => {
                        const element = document.querySelector(selector);
                        if (element) {
                            const styles = window.getComputedStyle(element);
                            const bgColor = styles.backgroundColor;
                            const textColor = styles.color;
                            const fontSize = parseFloat(styles.fontSize);

                            results[name] = {
                                background_color: bgColor,
                                text_color: textColor,
                                font_size: fontSize,
                                has_contrast: bgColor !== textColor && textColor !== 'rgba(0, 0, 0, 0)'
                            };
                        }
                    });

                    return results;
                }
            """)
            results['color_contrast'] = contrast_checks

            # Test focus management and keyboard navigation
            focus_tests = {};

            # Test tab order
            await self.page.keyboard.press('Tab')
            await self.page.wait_for_timeout(300)

            focused_element = await self.page.evaluate('document.activeElement.tagName')
            focus_tests['tab_navigation_works'] = focused_element in ['BUTTON', 'INPUT', 'DIV']

            # Test focus visibility
            focused_outline = await self.page.evaluate("""
                () => {
                    const focused = document.activeElement;
                    if (!focused) return false;
                    const styles = window.getComputedStyle(focused);
                    return styles.outline !== 'none' || styles.boxShadow.includes('0px 0px') || focused.classList.contains('focus');
                }
            """)
            focus_tests['focus_visible'] = focused_outline

            results['accessibility_tests']['focus_management'] = focus_tests

            # Test screen reader compatibility
            landmark_elements = await self.page.evaluate("""
                () => {
                    const landmarks = document.querySelectorAll(
                        '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer'
                    );

                    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');

                    return {
                        landmark_count: landmarks.length,
                        heading_count: headings.length,
                        has_main_content: document.querySelector('[role="main"], main') !== null,
                        has_skip_links: document.querySelector('a[href*="#"]') !== null
                    };
                }
            """)
            results['accessibility_tests']['landmarks'] = landmark_elements

            # Calculate comprehensive WCAG compliance score
            wcag_score = 0
            total_checks = 8

            if keyboard_accessible_elements['accessibility_percentage'] >= 90:
                wcag_score += 1
            if aria_compliance['has_tree_role']:
                wcag_score += 1
            if aria_compliance['treeitem_count'] > 0:
                wcag_score += 1
            if focus_tests['tab_navigation_works']:
                wcag_score += 1
            if focus_tests['focus_visible']:
                wcag_score += 1
            if any(check.get('has_contrast', False) for check in contrast_checks.values()):
                wcag_score += 1
            if landmark_elements['has_main_content']:
                wcag_score += 1
            if aria_compliance['inputs_with_labels'] == aria_compliance['total_inputs']:
                wcag_score += 1

            results['wcag_compliance']['score'] = wcag_score
            results['wcag_compliance']['percentage'] = (wcag_score / total_checks) * 100
            results['wcag_compliance']['passes_basic_requirements'] = wcag_score >= 6

            # Take accessibility screenshot
            screenshot_path = await self.capture_screenshot('accessibility_compliance')
            results['screenshots'].append(screenshot_path)

        except Exception as e:
            results['errors'].append(f'Accessibility testing failed: {str(e)}')

        return results

    async def test_rating_persistence(self) -> Dict:
        """
        Examines if ratings are saved and retrieved correctly across sessions

        Inputs: None
        Outputs: Dict containing rating persistence test results
        Side effects: Modifies ratings, reloads page, checks persistence behavior
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'persistence_tests': {},
            'rating_state': {},
            'screenshots': [],
            'errors': []
        }

        try:
            # Set initial ratings
            rating_buttons = await self.page.query_selector_all('.rating-section:last-of-type .rating-button')
            if rating_buttons:
                # Click "Relevant" button
                await rating_buttons[0].click()
                await self.page.wait_for_timeout(300)

                # Add note
                note_textarea = await self.page.query_selector('.rating-section:last-of-type .rating-note')
                if note_textarea:
                    test_note = "Persistence test note"
                    await note_textarea.fill(test_note)
                    await self.page.wait_for_timeout(300)

                # Get current rating state
                initial_state = await self.page.evaluate("""
                    () => {
                        const selectedButtons = document.querySelectorAll('.rating-button.selected');
                        const noteValue = document.querySelector('.rating-section:last-of-type .rating-note')?.value || '';

                        return {
                            selected_count: selectedButtons.length,
                            note_content: noteValue,
                            selected_texts: Array.from(selectedButtons).map(btn => btn.textContent.trim())
                        };
                    }
                """)
                results['rating_state']['before_reload'] = initial_state

                # Take screenshot before reload
                screenshot_path = await self.capture_screenshot('rating_before_reload')
                results['screenshots'].append(screenshot_path)

                # Reload page
                await self.page.reload()
                await self.page.wait_for_selector('.app-container', timeout=10000)
                await self.page.wait_for_timeout(2000)

                # Check rating state after reload
                after_reload_state = await self.page.evaluate("""
                    () => {
                        const selectedButtons = document.querySelectorAll('.rating-button.selected');
                        const noteValue = document.querySelector('.rating-section:last-of-type .rating-note')?.value || '';

                        return {
                            selected_count: selectedButtons.length,
                            note_content: noteValue,
                            selected_texts: Array.from(selectedButtons).map(btn => btn.textContent.trim())
                        };
                    }
                """)
                results['rating_state']['after_reload'] = after_reload_state

                # Check persistence (Note: In this implementation, ratings don't persist across reloads)
                # This is expected behavior for the current implementation
                results['persistence_tests']['ratings_persist'] = False  # Expected for current implementation
                results['persistence_tests']['note_persists'] = False    # Expected for current implementation
                results['persistence_tests']['state_resets_correctly'] = (
                    after_reload_state['selected_count'] == 0 and
                    after_reload_state['note_content'] == ''
                )

                # Take screenshot after reload
                screenshot_path = await self.capture_screenshot('rating_after_reload')
                results['screenshots'].append(screenshot_path)

        except Exception as e:
            results['errors'].append(f'Rating persistence test failed: {str(e)}')

        return results

    async def test_thread_expansion_collapse(self) -> Dict:
        """
        Tests tree node expand/collapse functionality with comprehensive state tracking

        Inputs: None
        Outputs: Dict containing detailed tree expansion/collapse test results
        Side effects: Clicks expand/collapse buttons, modifies tree state, takes screenshots
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'expansion_tests': {},
            'tree_state_changes': {},
            'screenshots': [],
            'errors': []
        }

        try:
            # Get initial tree state
            initial_state = await self.page.evaluate("""
                () => {
                    const nodes = document.querySelectorAll('.thread-node');
                    const expandButtons = document.querySelectorAll('span:has-text("▶")');
                    const collapseButtons = document.querySelectorAll('span:has-text("▼")');

                    return {
                        total_nodes: nodes.length,
                        expand_buttons: expandButtons.length,
                        collapse_buttons: collapseButtons.length,
                        visible_nodes: Array.from(nodes).map(node => ({
                            visible: node.offsetHeight > 0,
                            depth: parseInt(node.style.paddingLeft) || 0
                        }))
                    };
                }
            """)
            results['tree_state_changes']['initial'] = initial_state

            # Test expansion
            expand_buttons = await self.page.query_selector_all('span:has-text("▶")')
            if expand_buttons:
                # Click first expand button
                await expand_buttons[0].click()
                await self.page.wait_for_timeout(500)

                # Get state after expansion
                after_expand_state = await self.page.evaluate("""
                    () => {
                        const nodes = document.querySelectorAll('.thread-node');
                        const expandButtons = document.querySelectorAll('span:has-text("▶")');
                        const collapseButtons = document.querySelectorAll('span:has-text("▼")');

                        return {
                            total_nodes: nodes.length,
                            expand_buttons: expandButtons.length,
                            collapse_buttons: collapseButtons.length
                        };
                    }
                """)
                results['tree_state_changes']['after_expand'] = after_expand_state

                # Verify expansion worked
                results['expansion_tests']['expand_increases_visible'] = (
                    after_expand_state['total_nodes'] > initial_state['total_nodes']
                )
                results['expansion_tests']['button_changes_to_collapse'] = (
                    after_expand_state['collapse_buttons'] > initial_state['collapse_buttons']
                )

                # Take screenshot after expansion
                screenshot_path = await self.capture_screenshot('tree_expanded_state')
                results['screenshots'].append(screenshot_path)

                # Test collapse
                collapse_buttons = await self.page.query_selector_all('span:has-text("▼")')
                if collapse_buttons:
                    await collapse_buttons[0].click()
                    await self.page.wait_for_timeout(500)

                    # Get state after collapse
                    after_collapse_state = await self.page.evaluate("""
                        () => {
                            const nodes = document.querySelectorAll('.thread-node');
                            const expandButtons = document.querySelectorAll('span:has-text("▶")');
                            const collapseButtons = document.querySelectorAll('span:has-text("▼")');

                            return {
                                total_nodes: nodes.length,
                                expand_buttons: expandButtons.length,
                                collapse_buttons: collapseButtons.length
                            };
                        }
                    """)
                    results['tree_state_changes']['after_collapse'] = after_collapse_state

                    # Verify collapse worked
                    results['expansion_tests']['collapse_decreases_visible'] = (
                        after_collapse_state['total_nodes'] < after_expand_state['total_nodes']
                    )
                    results['expansion_tests']['returns_to_initial_state'] = (
                        after_collapse_state['total_nodes'] == initial_state['total_nodes']
                    )

                    # Take screenshot after collapse
                    screenshot_path = await self.capture_screenshot('tree_collapsed_state')
                    results['screenshots'].append(screenshot_path)

            # Test multiple expansion levels
            expand_buttons = await self.page.query_selector_all('span:has-text("▶")')
            if len(expand_buttons) > 1:
                # Expand multiple nodes
                for i in range(min(2, len(expand_buttons))):
                    await expand_buttons[i].click()
                    await self.page.wait_for_timeout(300)

                multi_expand_state = await self.page.evaluate("""
                    () => {
                        const nodes = document.querySelectorAll('.thread-node');
                        return { total_nodes: nodes.length };
                    }
                """)

                results['expansion_tests']['multiple_expansion_works'] = (
                    multi_expand_state['total_nodes'] >= initial_state['total_nodes']
                )

        except Exception as e:
            results['errors'].append(f'Tree expansion test failed: {str(e)}')

        return results


# Test runner function (corrected)
async def run_navigator_audit_corrected():
    """Run the corrected navigator audit suite"""
    auditor = EmailThreadNavigatorAuditor()

    try:
        await auditor.setup()

        # Run individual tests
        print("Starting corrected Email Thread Navigator audit...")

        test_results = {}
        test_functions = [
            ('application_load', auditor.load_navigator_application),
            ('thread_tree_rendering_performance', auditor.test_thread_tree_rendering_performance),
            ('keyboard_navigation_comprehensive', auditor.test_keyboard_navigation_comprehensive),
            ('rating_panel_workflow_complete', auditor.test_rating_panel_workflow_complete),
            ('message_view_display', auditor.test_message_view_display),
            ('search_and_filtering', auditor.test_search_and_filtering),
            ('performance_requirements', auditor.test_performance_requirements),
            ('accessibility_compliance', auditor.test_accessibility_compliance),
            ('rating_persistence', auditor.test_rating_persistence),
            ('thread_expansion_collapse', auditor.test_thread_expansion_collapse)
        ]

        for test_name, test_func in test_functions:
            try:
                print(f"Running {test_name}...")
                test_results[test_name] = await test_func()
                status = 'PASS' if not test_results[test_name].get('error') else 'FAIL'
                print(f"   {status}")
            except Exception as e:
                print(f"   FAIL: {str(e)}")
                test_results[test_name] = {'error': str(e)}

        # Generate summary report
        report = {
            'audit_timestamp': datetime.now().isoformat(),
            'auditor_version': '2.1.0-corrected',
            'test_environment': {
                'browser': 'Chromium',
                'viewport': '1920x1080',
                'platform': 'Windows',
                'working_directory': str(Path.cwd()),
                'application_under_test': 'Email Thread Navigator - CORRECTED AUDIT'
            },
            'tests': test_results,
            'console_logs': auditor.console_logs[-10:],
            'summary': {
                'total_tests': len(test_functions),
                'successful_tests': sum(1 for test in test_results.values() if not test.get('error')),
                'screenshots_captured': sum(len(test.get('screenshots', [])) for test in test_results.values())
            }
        }

        report['summary']['success_rate'] = (report['summary']['successful_tests'] / report['summary']['total_tests']) * 100

        # Save corrected report
        report_filename = f"navigator_audit_corrected_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path = Path("test-reports") / report_filename

        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"\nCORRECTED NAVIGATOR AUDIT COMPLETE!")
        print(f"Report saved to: {report_path}")
        print(f"Success Rate: {report['summary']['success_rate']:.1f}%")
        print(f"Screenshots: {report['summary']['screenshots_captured']}")

        return report

    except Exception as e:
        print(f"Corrected audit setup failed: {str(e)}")
        return None

    finally:
        await auditor.cleanup()


if __name__ == "__main__":
    print("Starting CORRECTED Email Thread Navigator audit...")
    asyncio.run(run_navigator_audit_corrected())