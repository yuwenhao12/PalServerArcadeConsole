import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "PalServer Arcade Console",
  description: "通过 Palworld 官方 REST API 管理专用服务器",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={cn("font-sans")}>
      <body>{children}</body>
    </html>
  );
}
