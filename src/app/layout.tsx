import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";

export const metadata: Metadata = {
  title: "Oliview | AI 리뷰 댓글 관리",
  description: "다중 매장 리뷰 수집·답글 반자동화",
  icons: {
    icon: [
      { url: "/landing/img/favicon/favicon.ico", sizes: "any" },
      { url: "/landing/img/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/landing/img/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/landing/img/favicon/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
