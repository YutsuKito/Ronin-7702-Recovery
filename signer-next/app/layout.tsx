import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Ronin 7702 Recovery — Local Signer',
  description: 'Local-only Ronin Waypoint EIP-7702 zero-address deauthorization signer',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
