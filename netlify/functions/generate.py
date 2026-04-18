import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper import fetch_menu_text
from parser import extract_menu_items

_CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": _CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _err(400, "リクエストが不正です")

    url = (body.get("url") or "").strip()
    if not url.startswith("http"):
        return _err(400, "有効なURLを入力してください（http または https で始まるURL）")

    try:
        page_text = fetch_menu_text(url)
    except Exception as e:
        return _err(502, f"URLにアクセスできませんでした: {e}")

    if len(page_text.strip()) < 100:
        return _err(422, "ページからテキストを取得できませんでした。JavaScriptで動的に表示されるサイトには対応していません。メニューが直接記載されているページのURLをお試しください。")

    try:
        items = extract_menu_items(page_text)
    except Exception as e:
        return _err(500, f"メニュー解析中にエラーが発生しました: {e}")

    if not items:
        return _err(422, "メニュー項目が見つかりませんでした。メニューが直接記載されているページのURLをお試しください。")

    return {
        "statusCode": 200,
        "headers": _CORS,
        "body": json.dumps({"items": items}, ensure_ascii=False),
    }


def _err(status: int, msg: str) -> dict:
    return {"statusCode": status, "headers": _CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}
