"""
Edge case tests for the EmailThreadAuditor
"""

import pytest
from pathlib import Path
from tests.comprehensive_ui_audit import EmailThreadAuditor


@pytest.mark.asyncio
async def test_load_invalid_url():
    """Test handling of invalid URLs"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    # Should return False for invalid URL
    result = await auditor.load_page('http://invalid-url-that-does-not-exist.com')
    assert result == False

    # Should have logged an error
    errors = [log for log in auditor.console_logs if log['type'] == 'error']
    assert len(errors) > 0

    await auditor.cleanup()


@pytest.mark.asyncio
async def test_screenshot_without_page_load():
    """Test screenshot when no page is loaded"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    # Try to take screenshot without loading any page
    screenshot_path = await auditor.screenshot('empty_page')

    # Should still create a file
    assert Path(screenshot_path).exists()

    await auditor.cleanup()


@pytest.mark.asyncio
async def test_performance_metrics_failure():
    """Test performance metrics when CDP fails"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    # Close the page to simulate CDP failure
    await auditor.page.close()
    auditor.page = await auditor.context.new_page()

    metrics = await auditor.get_performance_metrics()

    # Should return error dict when CDP fails
    assert 'error' in metrics

    await auditor.cleanup()


@pytest.mark.asyncio
async def test_continuous_monitoring_zero_duration():
    """Test continuous monitoring with zero duration"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    # Run for 0 minutes (should exit immediately)
    results = await auditor.continuous_monitoring_loop(0)

    assert results['duration_minutes'] == 0
    assert len(results['iterations']) == 0

    await auditor.cleanup()


@pytest.mark.asyncio
async def test_accessibility_on_empty_page():
    """Test accessibility checks on minimal page"""
    auditor = EmailThreadAuditor()
    await auditor.setup()

    # Load minimal HTML
    await auditor.page.goto('data:text/html,<html><body><h1>Test</h1></body></html>')

    results = await auditor.test_accessibility_compliance()

    # Should complete without errors
    assert 'keyboard_navigation' in results
    assert 'aria_compliance' in results

    await auditor.cleanup()