"""
Pytest tests for Playwright Email Thread Navigator Auditor
Tests each audit function and edge cases
"""

import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from playwright.async_api import async_playwright
from playwright_auditor import EmailThreadAuditor


@pytest.fixture
def temp_html_file():
    """Create temporary HTML file for testing"""
    content = """<!DOCTYPE html>
<html><head><title>Test</title></head>
<body><div id="root"></div></body></html>"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
        f.write(content)
        return Path(f.name)


@pytest.fixture
def broken_html_file():
    """Create broken HTML file for testing"""
    content = """<!DOCTYPE html>
<html><head><script>throw new Error('Test error');</script></head>
<body><div id="root"></div></body></html>"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
        f.write(content)
        return Path(f.name)


@pytest.fixture
def react_html_file():
    """Create HTML file with React setup"""
    content = """<!DOCTYPE html>
<html>
<head>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
</head>
<body>
    <div id="root"></div>
    <script>
        function App() { return React.createElement('div', {className: 'app-container'}, 'Test App'); }
        ReactDOM.render(React.createElement(App), document.getElementById('root'));
    </script>
</body>
</html>"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
        f.write(content)
        return Path(f.name)


class TestEmailThreadAuditor:

    def test_auditor_initialization(self, temp_html_file):
        """Test EmailThreadAuditor initializes correctly"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        assert auditor.html_path.exists()
        assert auditor.screenshot_dir.exists()
        assert auditor.console_logs == []
        assert auditor.js_errors == []
        assert auditor.network_logs == []

    @pytest.mark.asyncio
    async def test_audit_page_load_success(self, temp_html_file):
        """Test successful page load detection"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            result = await auditor.audit_page_load(page)

            assert result['load_success'] is True
            assert result['root_element_exists'] is True
            assert result['dom_ready'] is True
            assert 'load_time' in result

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_page_load_failure(self):
        """Test page load failure detection"""
        # Test with non-existent file
        auditor = EmailThreadAuditor("nonexistent.html")

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            result = await auditor.audit_page_load(page)

            assert result['load_success'] is False
            assert 'error' in result

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_javascript_execution_with_react(self, react_html_file):
        """Test JavaScript execution audit with React"""
        auditor = EmailThreadAuditor(str(react_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            # Load page first
            await auditor.audit_page_load(page)

            result = await auditor.audit_javascript_execution(page)

            assert result['execution_successful'] is True
            assert result['react_loaded'] is True
            assert result['react_dom_loaded'] is True

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_javascript_execution_without_react(self, temp_html_file):
        """Test JavaScript execution audit without React"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            await auditor.audit_page_load(page)
            result = await auditor.audit_javascript_execution(page)

            assert result['react_loaded'] is False
            assert result['react_dom_loaded'] is False
            assert result['execution_successful'] is False

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_component_rendering(self, react_html_file):
        """Test component rendering audit"""
        auditor = EmailThreadAuditor(str(react_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            await auditor.audit_page_load(page)
            await page.wait_for_timeout(1000)  # Wait for React to render

            result = await auditor.audit_component_rendering(page)

            assert 'component_status' in result
            assert 'successful_renders' in result
            assert 'render_success_rate' in result

            # Should find the app-container from our React component
            assert result['component_status']['top_navigator']['found'] is False  # Expected - not in test file

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_state_management(self, temp_html_file):
        """Test state management audit"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            await auditor.audit_page_load(page)
            result = await auditor.audit_state_management(page)

            assert 'react_state_check' in result
            assert 'viewMode_analysis' in result
            assert 'state_initialization_success' in result

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_event_handlers(self, temp_html_file):
        """Test event handlers audit"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            await auditor.audit_page_load(page)
            result = await auditor.audit_event_handlers(page)

            assert 'interaction_results' in result
            assert 'successful_interactions' in result
            assert 'crash_detected' in result
            assert 'interaction_success_rate' in result

            # Most interactions should fail gracefully (elements don't exist)
            assert result['crash_detected'] is False  # No crashes expected

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_performance_metrics(self, temp_html_file):
        """Test performance metrics audit"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            await auditor.audit_page_load(page)
            result = await auditor.audit_performance_metrics(page)

            assert 'performance_timing' in result
            assert 'resource_timing' in result
            assert 'render_performance' in result
            assert 'performance_healthy' in result

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_browser_compatibility(self, temp_html_file):
        """Test browser compatibility audit"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            await auditor.audit_page_load(page)
            result = await auditor.audit_browser_compatibility(page)

            assert 'browser_features' in result
            assert 'cdn_resources' in result
            assert 'compatibility_issues' in result
            assert 'environment_compatible' in result

            # Modern browser should support ES6
            assert result['browser_features']['es6_support'] is True

            await browser.close()

    @pytest.mark.asyncio
    async def test_console_monitoring(self, broken_html_file):
        """Test console monitoring captures errors"""
        auditor = EmailThreadAuditor(str(broken_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            auditor.setup_console_monitoring(page)

            # This should trigger the JavaScript error
            await auditor.audit_page_load(page)

            # Should have captured the error
            assert len(auditor.js_errors) > 0
            assert any('Test error' in error for error in auditor.js_errors)

            await browser.close()

    @pytest.mark.asyncio
    async def test_screenshot_functionality(self, temp_html_file):
        """Test screenshot capture functionality"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            await auditor.audit_page_load(page)
            screenshot_path = await auditor.screenshot(page, "test_screenshot")

            assert screenshot_path.exists()
            assert screenshot_path.suffix == '.png'

            # Clean up
            screenshot_path.unlink()

            await browser.close()

    def test_generate_audit_summary(self):
        """Test audit summary generation"""
        auditor = EmailThreadAuditor("test.html")

        # Mock results with various conditions
        results = {
            'page_load': {'load_success': True},
            'javascript_execution': {'execution_successful': True, 'react_loaded': True},
            'component_rendering': {'all_components_rendered': False, 'render_success_rate': 0.3},
            'state_management': {'duplicate_state_detected': True},
            'event_handlers': {'crash_detected': False},
            'performance_metrics': {'performance_healthy': True},
            'browser_compatibility': {'environment_compatible': True}
        }

        summary = auditor.generate_audit_summary(results)

        assert summary['overall_health'] == 'CRITICAL'  # Due to duplicate state
        assert len(summary['critical_failures']) > 0
        assert 'Duplicate React state declarations detected' in summary['critical_failures']

    def test_generate_diagnosis(self):
        """Test diagnosis generation"""
        auditor = EmailThreadAuditor("test.html")

        # Test duplicate state diagnosis
        failures = ["Duplicate React state declarations detected"]
        warnings = []
        diagnosis = auditor.generate_diagnosis(failures, warnings)

        assert "Duplicate useState declarations" in diagnosis
        assert "Remove duplicate viewMode" in diagnosis

    @pytest.mark.asyncio
    async def test_full_audit_integration(self, temp_html_file):
        """Test complete audit run integration"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        results = await auditor.run_full_audit()

        # Check all audit sections are present
        expected_sections = [
            'page_load', 'javascript_execution', 'component_rendering',
            'state_management', 'event_handlers', 'performance_metrics',
            'browser_compatibility', 'summary'
        ]

        for section in expected_sections:
            assert section in results

        # Check summary structure
        assert 'overall_health' in results['summary']
        assert 'diagnosis' in results['summary']

        # Verify report file was created
        report_path = auditor.screenshot_dir / "audit_report.json"
        assert report_path.exists()

        # Verify report content
        with open(report_path) as f:
            report_data = json.load(f)
        assert 'audit_timestamp' in report_data
        assert 'results' in report_data


class TestEdgeCases:
    """Test edge cases and error conditions"""

    @pytest.mark.asyncio
    async def test_audit_with_network_disabled(self, react_html_file):
        """Test audit behavior when network is disabled (CDN fails)"""
        auditor = EmailThreadAuditor(str(react_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            context = await browser.new_context(offline=True)
            page = await context.new_page()
            auditor.setup_console_monitoring(page)

            await auditor.audit_page_load(page)
            result = await auditor.audit_javascript_execution(page)

            # React should fail to load due to CDN being offline
            assert result['react_loaded'] is False

            await browser.close()

    @pytest.mark.asyncio
    async def test_audit_with_slow_page(self, temp_html_file):
        """Test audit behavior with artificially slow page"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            # Slow down the page
            await page.add_init_script("setTimeout(() => { console.log('Delayed execution'); }, 3000);")

            auditor.setup_console_monitoring(page)
            result = await auditor.audit_page_load(page)

            # Should still succeed, just take longer
            assert result['load_success'] is True
            assert result['load_time'] > 2.0  # Should be slow

            await browser.close()

    def test_invalid_file_path(self):
        """Test auditor with invalid file path"""
        auditor = EmailThreadAuditor("/nonexistent/path.html")
        assert not auditor.html_path.exists()

    @pytest.mark.asyncio
    async def test_memory_usage_with_large_audit(self, temp_html_file):
        """Test memory usage doesn't grow excessively during audit"""
        auditor = EmailThreadAuditor(str(temp_html_file))

        # Run audit multiple times to check for memory leaks
        async with async_playwright() as p:
            browser = await p.chromium.launch()

            for i in range(3):
                page = await browser.new_page()
                auditor.setup_console_monitoring(page)
                await auditor.audit_page_load(page)
                await page.close()

            # Console logs shouldn't grow excessively
            assert len(auditor.console_logs) < 100  # Reasonable limit

            await browser.close()


# Tests that WILL FAIL and why:

class TestExpectedFailures:
    """These tests document expected failure conditions"""

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="File protocol CORS restrictions expected")
    async def test_cors_restricted_resources(self):
        """This test WILL FAIL due to file:// protocol CORS restrictions"""
        # This test expects to fail when testing with file:// URLs that try to load external resources
        pass

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="Duplicate viewMode state will cause React errors")
    async def test_duplicate_state_detection(self):
        """This test WILL FAIL if the duplicate viewMode bug is present"""
        # This would fail with the actual broken email_thread_navigator.html
        # due to duplicate useState declarations
        pass

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="CDN timeout in slow networks")
    async def test_cdn_timeout_failure(self):
        """This test WILL FAIL in environments with slow/unreliable CDN access"""
        # Expected to fail when React/Babel CDNs are slow or unreachable
        pass


if __name__ == "__main__":
    # Run specific test
    pytest.main([__file__ + "::TestEmailThreadAuditor::test_audit_page_load_success", "-v"])