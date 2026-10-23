import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Challenge Arena",
  description: "Challenge AI reasoning, step by step.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
