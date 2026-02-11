import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "GridVault - Intelligent Grid Trading on Sui",
  description: "Automated grid trading bot for Sui blockchain - Secure, Efficient, Decentralized",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
