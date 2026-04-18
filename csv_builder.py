import csv
import io

_HEADERS = [
    "商品コード",
    "商品名",
    "商品名かな",
    "部門コード",
    "部門名",
    "単価",
    "原価",
    "税区分",
    "税率",
    "商品説明",
]


def build_csv(items: list[dict]) -> bytes:
    category_map = _build_category_map(items)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_HEADERS)
    for idx, item in enumerate(items, start=1):
        cat_name = item.get("category", "その他") or "その他"
        writer.writerow([
            idx,
            item.get("name", ""),
            "",
            category_map[cat_name],
            cat_name,
            item.get("price", 0),
            "",
            1,
            10,
            item.get("description", ""),
        ])
    return buf.getvalue().encode("utf-8-sig")


def _build_category_map(items: list[dict]) -> dict[str, int]:
    seen: dict[str, int] = {}
    counter = 1
    for item in items:
        cat = item.get("category", "その他") or "その他"
        if cat not in seen:
            seen[cat] = counter
            counter += 1
    return seen
