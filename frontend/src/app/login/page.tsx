"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getApiBaseUrl } from '@/lib/api'
import { AlertCircle, LogIn, Loader2, ArrowRight, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 在组件加载时检查是否已经登录
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (token) {
          // 如果已有令牌，跳转到会话页面
          router.push('/conversations')
        } else {
          setIsChecking(false)
        }
      } catch (e) {
        console.error('检查认证状态出错:', e)
        setIsChecking(false)
      }
    }
    
    checkAuthStatus()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 登录请求
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'username': username,
          'password': password
        })
      })

      if (!response.ok) {
        throw new Error(`登录失败: ${response.status}`)
      }

      const data = await response.json()
      
      // 保存token到localStorage
      localStorage.setItem('auth_token', data.access_token)
      
      // 获取用户信息
      const userResponse = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${data.access_token}`
        }
      })
      
      if (!userResponse.ok) {
        throw new Error(`获取用户信息失败: ${userResponse.status}`)
      }
      
      const userData = await userResponse.json()
      
      // 保存用户信息到localStorage
      localStorage.setItem('user', JSON.stringify(userData))
      
      // 延迟重定向以确保localStorage更新完成
      setTimeout(() => {
        router.push('/conversations')
      }, 100)
    } catch (err) {
      console.error('登录失败:', err)
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 显示加载状态
  if (isChecking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">正在检查登录状态...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* 左侧登录表单 */}
      <div className="flex w-full flex-col justify-center px-5 md:px-8 lg:w-1/2 xl:px-12">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">ASA 智能对话系统</h1>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">欢迎回来</h2>
            <p className="text-muted-foreground">
              请输入您的账户信息登录系统
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="animate-in fade-in">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>登录失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  用户名或邮箱
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11"
                  placeholder="请输入用户名或邮箱"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    密码
                  </Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-xs text-primary hover:underline"
                  >
                    忘记密码?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                  placeholder="请输入密码"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  登录
                </>
              )}
            </Button>
          </form>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              没有账户?{' '}
              <Link href="/register" className="font-medium text-primary hover:underline inline-flex items-center">
                立即注册
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* 右侧装饰图 - 在大屏幕上显示 */}
      <div className="hidden lg:block lg:w-1/2 bg-secondary/30">
        <div className="flex h-full items-center justify-center p-8">
          <div className="rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-background p-8 shadow-lg backdrop-blur">
            <div className="max-w-md space-y-6 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-primary" />
              <h2 className="text-2xl font-bold">智能对话助手系统</h2>
              <p className="text-muted-foreground">
                ASA系统为您提供丰富的智能对话功能，结合多种AI模型，帮助您更高效地处理各类任务。
                通过简单的对话方式，让复杂的工作变得简单。
              </p>
              <div className="flex justify-center gap-3">
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm">自然语言处理</div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm">智能助手</div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm">多模型支持</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 