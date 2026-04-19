"use client";

import { SMAREGI_HEADERS, SmaregiRow } from "@/lib/csvConverter";

type Props = {
  rows: SmaregiRow[];
};

export default function PreviewTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            {SMAREGI_HEADERS.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-gray-200"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              {SMAREGI_HEADERS.map((h) => (
                <td
                  key={h}
                  className="px-3 py-2 whitespace-nowrap border-b border-gray-100 text-gray-800"
                >
                  {row[h] || <span className="text-gray-400">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 px-3 py-2 bg-gray-50 border-t border-gray-200">
        {rows.length} 件の商品が変換されました
      </p>
    </div>
  );
}
