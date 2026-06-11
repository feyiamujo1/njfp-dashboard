import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "NJFP Entrepreneurship Training Dashboard",
  description:
    "Analytics dashboard for NJFP Entrepreneurship Skills Training — 5,000 fellows",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
