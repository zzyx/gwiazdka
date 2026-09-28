import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gwiazdki",
  description: "Check off your tasks and earn gwiazdki.",
  appleWebApp: {
    capable: true,
    title: "Gwiazdki",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#F6F7F9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
