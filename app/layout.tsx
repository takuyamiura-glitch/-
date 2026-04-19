import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "スマレジCSV変換ツール",
  description: "AIが生成した商品リストをスマレジ用CSVに変換します",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
