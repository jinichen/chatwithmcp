"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 使用客户端逻辑检查认证状态
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('auth_token')
        const userData = localStorage.getItem('user')
        
        if (token && userData) {
          // 如果已登录，重定向到conversations页面
          router.push('/conversations')
        } else {
          // 如果未登录，显示登录按钮
          setIsLoading(false)
        }
      } catch (e) {
        // 如果localStorage不可用或出错，显示登录按钮
        setIsLoading(false)
      }
    }
    
    checkAuth()
  }, [router])

  // 显示加载状态或主页内容
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p>正在加载...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold">ASA 智能对话系统</h1>
          <p className="mt-4 text-lg text-gray-400">
            一个强大的AI助手，帮助您完成各种任务
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <Button asChild className="w-full">
            <Link href="/login">登录</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/register">注册</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
