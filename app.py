import json
import os

from dotenv import load_dotenv
from flask import Flask, Response, flash, redirect, render_template, request, session, url_for

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-me")

if not os.environ.get("ANTHROPIC_API_KEY"):
    raise RuntimeError("ANTHROPIC_API_KEY が設定されていません。.env ファイルを確認してください。")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    from scraper import fetch_menu_text
    from parser import extract_menu_items

    url = request.form.get("url", "").strip()
    if not url.startswith("http"):
        flash("有効なURLを入力してください（http または https で始まるURL）。")
        return redirect(url_for("index"))

    try:
        page_text = fetch_menu_text(url)
    except Exception as e:
        flash(f"URLにアクセスできませんでした: {e}")
        return redirect(url_for("index"))

    try:
        items = extract_menu_items(page_text)
    except Exception as e:
        flash(f"メニュー解析中にエラーが発生しました: {e}")
        return redirect(url_for("index"))

    if not items:
        flash("メニュー項目が見つかりませんでした。メニューが直接記載されているページのURLをお試しください。")
        return redirect(url_for("index"))

    session["items"] = items
    session["source_url"] = url
    return redirect(url_for("preview"))


@app.route("/preview")
def preview():
    items = session.get("items")
    if not items:
        return redirect(url_for("index"))
    return render_template("preview.html", items=items, source_url=session.get("source_url", ""))


@app.route("/download", methods=["POST"])
def download():
    from csv_builder import build_csv

    raw = request.form.get("items_json", "[]")
    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        flash("データの読み込みに失敗しました。もう一度お試しください。")
        return redirect(url_for("index"))

    csv_bytes = build_csv(items)
    return Response(
        csv_bytes,
        mimetype="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''smaregi_products.csv"},
    )


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug)
