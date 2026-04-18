import json
import re
import anthropic

_MODEL = "claude-sonnet-4-6"

_SYSTEM = """あなたはレストランや店舗のメニュー情報を抽出する専門家です。
ユーザーがWebページからスクレイピングしたテキストを提供します。
すべてのメニュー項目を抽出し、JSONの配列のみを返してください。

ルール:
- 各項目は必ず name（商品名）、price（整数の円価格）、category（カテゴリ名）を持つこと
- 「1,200円」「¥1,200」「税込1,320円」などの価格表記はすべて整数に変換する（例: 1200）
- 価格が不明な場合は 0 とする
- 項目の上にある見出しをカテゴリとして使用する
- 明確なカテゴリがない場合は「その他」を使用する
- 見出しや説明だけで価格のない行は除外する
- 説明文がある場合は description フィールドに含める（任意）
- マークダウンやコードブロックは使わず、有効なJSONのみを出力する

出力スキーマ:
[{"name": "...", "price": 1200, "category": "...", "description": "..."}, ...]"""


def extract_menu_items(page_text: str) -> list[dict]:
    client = anthropic.Anthropic()
    items = _call_api(client, page_text)
    if items is None:
        items = _call_api(client, page_text, retry=True)
    return items or []


def _call_api(client: anthropic.Anthropic, page_text: str, retry: bool = False) -> list[dict] | None:
    system = _SYSTEM if not retry else _SYSTEM + "\n重要: 必ずJSONのみを返すこと。前置きや説明は一切不要。"
    message = client.messages.create(
        model=_MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": page_text}],
    )
    raw = message.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    try:
        data = json.loads(raw.strip())
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    return None
