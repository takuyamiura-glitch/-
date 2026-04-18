import requests
from bs4 import BeautifulSoup

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

_REMOVE_TAGS = ["script", "style", "nav", "footer", "header", "aside", "form", "iframe"]
_MAX_CHARS = 12000


def fetch_menu_text(url: str) -> str:
    html = _fetch_with_requests(url)
    text = _extract_text(html)
    if len(text.strip()) < 200:
        html = _fetch_with_playwright(url)
        text = _extract_text(html)
    if len(text) > _MAX_CHARS:
        cut = text.rfind("\n", 0, _MAX_CHARS)
        text = text[: cut if cut > 0 else _MAX_CHARS]
    return text


def _fetch_with_requests(url: str) -> str:
    resp = requests.get(url, headers=_HEADERS, timeout=15, allow_redirects=True)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding
    return resp.text


def _fetch_with_playwright(url: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle", timeout=30000)
        html = page.content()
        browser.close()
    return html


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.find_all(_REMOVE_TAGS):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)
