"use client";

import { useState } from "react";
import { convertTextToCsv, SmaregiRow } from "@/lib/csvConverter";
import PreviewTable from "@/components/PreviewTable";

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [previewRows, setPreviewRows] = useState<SmaregiRow[]>([]);
  const [error, setError] = useState("");

  function handleConvert() {
    setError("");

    const trimmed = inputText.trim();
    if (!trimmed) {
      setError("テキストを入力してください。");
      return;
    }

    const { csv, rows } = convertTextToCsv(trimmed);

    if (rows.length === 0) {
      setError(
        "商品データを解析できませんでした。各行に「商品名」と「単価（数値）」が含まれているか確認してください。"
      );
      return;
    }

    setPreviewRows(rows);

    // BOM付きUTF-8でExcel対応のCSVをダウンロード
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smaregi_products_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          スマレジ 商品CSV変換ツール
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          GeminiなどのAIが生成した商品リストをスマレジ用CSVに変換してダウンロードします
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <label
            htmlFor="input"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            商品リストのテキスト（カンマ区切り・タブ区切り）
          </label>
          <textarea
            id="input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={12}
            placeholder={`例：\nアイスコーヒー, 450\nカフェラテ\t550\nチーズケーキ, 480`}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          onClick={handleConvert}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          CSVを生成・ダウンロード
        </button>

        <div className="text-xs text-gray-400 space-y-0.5">
          <p>部門ID: 10（固定） / 税区分: 内税 / 税設定: 標準税率 / 原価: 0</p>
        </div>
      </div>

      {previewRows.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            変換プレビュー
          </h2>
          <PreviewTable rows={previewRows} />
        </div>
      )}
    </main>
  );
}
