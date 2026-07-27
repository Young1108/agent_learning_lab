import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yang1108.ryzedns.org"),
  title: "AI Learning Lab · 前沿技术，亲手跑懂",
  description:
    "持续追踪 AI 一手来源，用可运行 Demo、概念对比和知识网络，帮助产品与工程人员高效掌握前沿技术。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "AI Learning Lab",
    description: "前沿技术，亲手跑懂，并形成自己的知识网络。",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1743,
        height: 909,
        alt: "AI Learning Lab：Harness、Loop、Graph 技术知识网络",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Learning Lab",
    description: "前沿技术，亲手跑懂，并形成自己的知识网络。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
