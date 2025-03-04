import "@/app/globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { MainLayout } from "@/components/layout/main-layout";
import { AuthProvider } from "@/context/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ASA Dialog + MCP System",
  description: "智能对话系统与MCP扩展平台",
};

// 不需要认证的路由路径
const publicPaths = ['/login', '/register', '/forgot-password'];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AuthProvider>
          <MainLayout>{children}</MainLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
