import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "글쓰기 연습장",
  description: "학생 초안, AI 피드백, 수정본, 교사 피드백을 관리하는 글쓰기 수행평가 웹앱"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
