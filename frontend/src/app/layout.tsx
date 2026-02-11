import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "GridVault - 网格交易机器人",
  description: "Sui 网格交易机器人管理面板",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  )
}
