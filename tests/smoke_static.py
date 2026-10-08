import os
from pathlib import Path

from playwright.sync_api import sync_playwright


base_url = os.getenv("BASE_URL", "http://127.0.0.1:3000")
result_dir = Path(__file__).resolve().parents[1] / "test-results"
result_dir.mkdir(exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(base_url)
    page.wait_for_load_state("networkidle")
    assert page.title() == "UP Drive"
    assert page.locator("#loginForm").is_visible()
    assert page.locator("#registerForm").is_visible()
    page.screenshot(path=str(result_dir / "smoke-login-page.png"), full_page=True)
    browser.close()

print("Static smoke test passed")
