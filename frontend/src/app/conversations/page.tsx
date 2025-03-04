"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageSquare, Plus, ArrowRight, Clock, Trash2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { format } from "date-fns"
import { checkAuthStatus, conversationAPI } from '@/lib/api';
import { useRouter } from "next/navigation"
import { toast } from "sonner"

// 定义会话类型
interface Conversation {
  id: string | number;  // Accept both string and number
  title: string;
  model: string;
  created_at: string;
  updated_at: string | null | undefined;  // Accept null or undefined
  user_id: string | number;  // Accept both string and number
  meta_data?: any;
  message_count?: number;
  last_message?: string;
}

// 分页响应类型
interface ConversationPagination {
  total: number
  items: Conversation[]
  page: number
  size: number
}

// 模拟会话数据
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    title: "对话 1",
    model: "gpt-3.5-turbo",
    created_at: "2024-03-20T10:00:00Z",
    updated_at: "2024-03-20T10:30:00Z",
    user_id: "1",
    message_count: 10,
    last_message: "这是最后一条消息"
  },
  {
    id: "2",
    title: "对话 2",
    model: "gpt-4",
    created_at: "2024-03-19T15:00:00Z",
    updated_at: "2024-03-19T16:00:00Z",
    user_id: "1",
    message_count: 5,
    last_message: "另一个对话的最后消息"
  },
  {
    id: "3",
    title: "对话 3",
    model: "gpt-3.5-turbo",
    created_at: "2024-03-18T09:00:00Z",
    updated_at: "2024-03-18T10:00:00Z",
    user_id: "1",
    message_count: 3,
    last_message: "第三个对话的最后消息"
  }
];

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [useBackend, setUseBackend] = useState(true) // 默认尝试使用后端API
  const [usingMock, setUsingMock] = useState(false) // 默认不使用模拟数据
  const router = useRouter()

  // 将fetchConversations移到useEffect外部，使其可以在组件内其他地方调用
  const fetchConversations = async () => {
    setIsLoading(true)
    setError(null)
    setDebugInfo("正在尝试连接到后端API...")
    
    // 如果不使用后端，直接使用模拟数据
    if (!useBackend) {
      setTimeout(() => {
        setConversations(MOCK_CONVERSATIONS)
        setUsingMock(true)
        setDebugInfo("使用了模拟数据，没有连接后端API")
        setIsLoading(false)
      }, 1000)
      return
    }
    
    try {
      // 检查认证状态
      const token = localStorage.getItem('auth_token')
      if (!token) {
        // 如果未认证，重定向到登录页面
        setDebugInfo("未找到认证令牌，将跳转到登录页面")
        setTimeout(() => {
          router.push('/login')
        }, 1000)
        return
      }
      
      // 获取认证令牌
      setDebugInfo(`找到认证令牌，尝试使用令牌访问API`)
      
      // 修正API路径
      const apiUrl = 'http://localhost:8000/api/v1/conversations'
      console.log("开始请求后端API:", apiUrl)
      setDebugInfo(`正在连接后端 API: ${apiUrl}...`)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      })
      
      setDebugInfo(`API响应状态码: ${response.status}`)
      console.log("API响应状态码:", response.status)
      
      if (response.status === 401 || response.status === 403) {
        // 认证失败，清除本地存储并重定向到登录页面
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
        setDebugInfo("认证已过期或无效，将跳转到登录页面")
        setTimeout(() => {
          router.push('/login')
        }, 1000)
        return
      }
      
      if (!response.ok) {
        throw new Error(`API错误: ${response.status}`)
      }
      
      const data = await response.json()
      console.log("API返回数据:", data)
      
      if (data && data.items) {
        setConversations(data.items)
        setDebugInfo(`成功获取 ${data.items.length} 个对话`)
      } else {
        throw new Error("API返回的数据格式不正确")
      }
    } catch (err) {
      console.error('获取对话列表失败:', err)
      setDebugInfo(`后端API连接失败: ${err instanceof Error ? err.message : '未知错误'}。将使用模拟数据代替。`)
      // 使用模拟数据作为备用
      setConversations(MOCK_CONVERSATIONS)
      setUsingMock(true)
    } finally {
      setIsLoading(false)
    }
  }

  // 从后端API获取会话列表
  useEffect(() => {
    fetchConversations()
  }, [useBackend])

  // 切换数据来源
  const toggleDataSource = () => {
    setUseBackend(!useBackend)
  }

  // 格式化日期时间
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date)
    } catch (e) {
      return dateString || '未知日期'
    }
  }

  // 添加删除对话的处理函数
  const handleDeleteConversation = async (id: string | number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("确定要删除这个对话吗？此操作不可恢复。")) {
      return;
    }
    
    try {
      await conversationAPI.deleteConversation(Number(id));
      toast.success("删除成功", {
        description: "对话已成功删除",
      });
      // 重新加载对话列表
      setIsLoading(true);
      // 调用已定义的函数fetchConversations来刷新对话列表
      fetchConversations();
    } catch (error) {
      console.error("删除对话失败:", error);
      toast.error("删除失败", {
        description: "删除对话时出现错误，请稍后再试",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl animate-in fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">对话列表</h1>
        <Button 
          onClick={() => router.push('/conversations/new')}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          新建对话
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6 animate-in fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {debugInfo && (
        <Alert className="mb-6 animate-in fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>调试信息</AlertTitle>
          <AlertDescription className="break-all">{debugInfo}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          // 骨架屏加载状态
          Array(6).fill(0).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
              </CardContent>
              <CardFooter className="border-t p-4 flex justify-between">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-8 w-16 rounded-full" />
              </CardFooter>
            </Card>
          ))
        ) : conversations.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">还没有对话</h2>
            <p className="text-muted-foreground mb-4">
              开始您的第一个AI对话吧！
            </p>
            <Button 
              onClick={() => router.push('/conversations/new')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              新建对话
            </Button>
          </div>
        ) : (
          conversations.map((conversation) => (
            <Card 
              key={conversation.id} 
              className="overflow-hidden transition-all hover:shadow-md hover:border-primary/50 group"
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="truncate text-lg">{conversation.title}</CardTitle>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {conversation.model}
                  </span>
                </div>
                <CardDescription className="truncate">
                  {conversation.message_count || 0} 条消息
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <p className="text-muted-foreground text-sm line-clamp-2">
                  {conversation.last_message || "没有消息内容"}
                </p>
              </CardContent>
              
              <CardFooter className="border-t p-4 flex justify-between items-center">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {format(new Date(conversation.updated_at || conversation.created_at), "yyyy-MM-dd HH:mm")}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="hidden group-hover:flex h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                    title="删除对话"
                    onClick={(e) => handleDeleteConversation(conversation.id, e)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    asChild
                    className="h-8"
                  >
                    <Link href={`/conversations/${conversation.id}`} className="flex items-center gap-1">
                      查看
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
} 