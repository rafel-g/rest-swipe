import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Restaurant Swipe",
  description: "Swipe through restaurants near you, ranked by what you like.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#dfeee3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="flex h-dvh flex-col bg-ground text-ink">
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
