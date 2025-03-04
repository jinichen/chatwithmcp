import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 不需要认证的路径
const publicPaths = ['/login', '/register', '/forgot-password'];

// 检查路径是否匹配公共路径
const isPublicPath = (path: string) => {
  return publicPaths.some(publicPath => 
    path === publicPath || path.startsWith(`${publicPath}/`)
  );
};

/**
 * 中间件，用于在服务器端检查和拦截未经授权的请求
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 检查路径是否是API路径，如果是则跳过中间件
  if (pathname.startsWith('/api/') || 
      pathname.startsWith('/_next/') || 
      pathname.includes('.')) {
    return NextResponse.next();
  }

  // 如果是公共路径，允许访问
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 从cookie中获取令牌
  const token = request.cookies.get('auth_token')?.value;
  
  // 如果没有令牌，重定向到登录页面，并传递当前路径作为重定向参数
  if (!token) {
    const url = new URL('/login', request.url);
    // 添加当前路径作为重定向参数，以便登录后返回
    if (pathname !== '/') {
      url.searchParams.set('redirect', pathname);
    }
    
    console.log(`[Middleware] 未检测到认证令牌，重定向到登录页面: ${url.toString()}`);
    return NextResponse.redirect(url);
  }
  
  // 有令牌，允许访问请求的页面
  return NextResponse.next();
}

// 配置中间件应该运行的路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了:
     * 1. /api (API 路由)
     * 2. /_next (Next.js 内部路由)
     * 3. /_vercel (Vercel 内部路由)
     * 4. /favicon.ico, /robots.txt, 等静态文件
     */
    '/((?!api|_next|_vercel|favicon.ico|robots.txt).*)',
  ],
}; 