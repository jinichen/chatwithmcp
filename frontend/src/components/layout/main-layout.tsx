"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { MessageSquare, Store, Settings, Menu, ChevronRight, Plus, User, LogOut, LogIn, UserPlus, Moon, Sun, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { Avatar } from "@/components/ui/avatar"
import { usePathname, useRouter } from "next/navigation"
import { RequireAuth } from "@/components/auth/require-auth"

// 不需要认证的路由路径
const publicPaths = ['/login', '/register', '/forgot-password'];

// 侧边栏链接项
interface SidebarLinkProps {
  href: string
  icon: ReactNode
  children: ReactNode
  isActive?: boolean
}

const SidebarLink = ({
  href,
  icon,
  children,
  isActive = false,
}: SidebarLinkProps) => {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
      )}
    >
      {icon}
      <span>{children}</span>
      {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
    </Link>
  )
}

// 主布局组件
export function MainLayout({ children }: { children: ReactNode }) {
  const { user, logout, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  
  // 检查当前路径是否需要身份验证
  const isPublicPath = publicPaths.includes(pathname);
  
  // 强制重定向未登录用户到登录页面
  useEffect(() => {
    if (!isAuthenticated && !isPublicPath && typeof window !== 'undefined') {
      router.push('/login');
    }
  }, [isAuthenticated, isPublicPath, router]);
  
  // 对于登录和注册页面，不显示侧边栏和顶部导航
  if (isPublicPath) {
    return <>{children}</>;
  }
  
  // 如果是需要认证的页面但用户未登录，包装在RequireAuth内
  if (!isPublicPath) {
    return (
      <RequireAuth>
        <MainLayoutContent>{children}</MainLayoutContent>
      </RequireAuth>
    );
  }
  
  // 默认情况下显示全布局
  return <MainLayoutContent>{children}</MainLayoutContent>;
}

// 抽取主布局内容为独立组件
function MainLayoutContent({ children }: { children: ReactNode }) {
  const { user, logout, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
        (!('darkMode' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    return false
  })
  
  // 切换暗黑模式
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, [darkMode])
  
  // 处理移动菜单
  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu)
  }
  
  // 处理新建对话
  const handleNewConversation = () => {
    router.push('/conversations')
  }
  
  return (
    <div className="flex min-h-screen bg-background">
      {/* 移动端菜单覆盖层 */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={toggleMobileMenu}
        />
      )}
      
      {/* 侧边栏 - 桌面版固定，移动版可收起 */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 border-r bg-sidebar transform transition-transform duration-300 ease-in-out md:translate-x-0",
        showMobileMenu ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between border-b p-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="text-sidebar-foreground">ASA 系统</span>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={toggleMobileMenu}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex flex-col h-[calc(100%-4rem)]">
          <nav className="flex-1 overflow-auto p-4">
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  主导航
                </h3>
                <div className="space-y-1.5">
                  <SidebarLink 
                    href="/" 
                    icon={<MessageSquare className="h-5 w-5" />} 
                    isActive={pathname === '/' || pathname.startsWith('/conversations')}
                  >
                    智能对话
                  </SidebarLink>
                  <SidebarLink 
                    href="/store" 
                    icon={<Store className="h-5 w-5" />}
                    isActive={pathname === '/store'}
                  >
                    插件商店
                  </SidebarLink>
                  <SidebarLink 
                    href="/settings" 
                    icon={<Settings className="h-5 w-5" />}
                    isActive={pathname === '/settings'}
                  >
                    账户设置
                  </SidebarLink>
                </div>
              </div>
              
              {isAuthenticated && (
                <div>
                  <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    快速操作
                  </h3>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="w-full flex items-center gap-2 mb-2"
                    onClick={handleNewConversation}
                  >
                    <Plus className="h-4 w-4" />
                    新建对话
                  </Button>
                </div>
              )}
            </div>
          </nav>

          {/* 用户信息和登出 */}
          <div className="border-t p-4 mt-auto">
            {isAuthenticated && user ? (
              <div>
                <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-secondary/50">
                  <Avatar className="border h-10 w-10">
                    <div className="bg-primary text-white flex items-center justify-center h-full font-medium text-md">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 flex items-center gap-2"
                    onClick={() => logout()}
                  >
                    <LogOut className="h-4 w-4" />
                    退出
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setDarkMode(!darkMode)}
                    title={darkMode ? "切换到亮色模式" : "切换到暗色模式"}
                  >
                    {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1 flex items-center gap-2"
                    asChild
                  >
                    <Link href="/login">
                      <LogIn className="h-4 w-4" />
                      登录
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setDarkMode(!darkMode)}
                    title={darkMode ? "切换到亮色模式" : "切换到暗色模式"}
                  >
                    {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full flex items-center gap-2"
                  asChild
                >
                  <Link href="/register">
                    <UserPlus className="h-4 w-4" />
                    注册账号
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="w-full md:pl-72">
        {/* 顶部导航 */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden" 
              onClick={toggleMobileMenu}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-semibold md:text-xl">ASA 智能对话系统</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* 移除了"新建对话"按钮 */}
          </div>
        </header>
        
        {/* 内容区 */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 