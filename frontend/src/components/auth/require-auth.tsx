"use client"

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

interface RequireAuthProps {
  children: ReactNode;
}

// 保存路径的本地存储键名
const REDIRECT_PATH_KEY = 'auth_redirect_path';

/**
 * 路由保护组件 - 包装需要登录才能访问的页面
 * 如果用户未登录，将自动重定向到登录页面
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 如果已完成加载且用户未认证，则重定向到登录页面
    if (!loading && !isAuthenticated) {
      console.log(`需要登录访问: ${pathname}，保存当前路径并重定向到登录页面`);
      
      // 保存当前路径以便登录后重定向
      if (pathname && pathname !== '/') {
        localStorage.setItem(REDIRECT_PATH_KEY, pathname);
      }
      
      // 重定向到登录页面
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`);
    }
  }, [isAuthenticated, loading, router, pathname]);

  // 显示加载指示器
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-lg">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

  // 如果用户已认证，显示子组件
  return isAuthenticated ? <>{children}</> : null;
} 