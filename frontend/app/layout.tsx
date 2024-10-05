import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import AuthHeader from "./components/AuthHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StudySync",
  description: "Lock in with collaborative study sessions!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <AuthHeader />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
