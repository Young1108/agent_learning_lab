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
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Albert+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("ai-lab-theme");if(t){t=t.replace(/^"|"$/g,"");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
