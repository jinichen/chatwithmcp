"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Send, ArrowLeft, Loader2, AlertCircle, MessageSquare, User } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { conversationAPI, getApiBaseUrl } from '@/lib/api';

// 定义用户类型
interface User {
  id: string | number;
  username: string;
  email?: string;
}

// 定义消息类型
interface Message {
  id: string | number
  role: "user" | "assistant"
  content: string
  created_at: string
  conversation_id: string | number
}

// 定义会话类型
interface Conversation {
  id: string | number;  // Accept both string and number
  title: string;
  model: string;
  created_at: string;
  updated_at: string | null | undefined;  // Accept null or undefined
  user_id: string | number;  // Accept both string and number
  meta_data?: any;
}

// 分页响应类型
interface MessagePagination {
  total: number
  items: Message[]
  page: number
  size: number
}

// 定义模型信息类型
interface ModelInfo {
  id: string
  name: string
  provider: string
}

// 模拟会话数据
const MOCK_CONVERSATION: Conversation = {
  id: "1",
  title: "后端API集成测试",
  model: "GPT-4",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: "1"
};

// 模拟消息数据
const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    content: "你好，我想了解如何将前端连接到后端API。",
    created_at: new Date(Date.now() - 600000).toISOString(), // 10分钟前
    conversation_id: "1"
  },
  {
    id: "2",
    role: "assistant",
    content: "你好！将前端连接到后端API是一个常见的任务。通常，你需要使用Fetch API或Axios等工具来发送HTTP请求到后端服务器。\n\n首先，你需要知道后端API的地址和接口规范。然后，你可以使用`fetch`函数或`axios`库来发送请求，并处理响应数据。\n\n例如，使用Fetch API：\n```javascript\nfetch('http://localhost:8000/api/v1/conversations')\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error('Error:', error));\n```\n\n如果你的API需要身份验证，你通常需要在请求头中包含token：\n```javascript\nfetch('http://localhost:8000/api/v1/conversations', {\n  headers: {\n    'Authorization': `Bearer ${token}`\n  }\n})\n```\n\n你有具体遇到什么问题吗？",
    created_at: new Date(Date.now() - 540000).toISOString(), // 9分钟前
    conversation_id: "1"
  },
  {
    id: "3",
    role: "user",
    content: "我的后端API似乎返回404，不确定路径是否正确。",
    created_at: new Date(Date.now() - 480000).toISOString(), // 8分钟前
    conversation_id: "1"
  },
  {
    id: "4",
    role: "assistant",
    content: "遇到404错误通常意味着您请求的资源路径不存在。这可能有几个原因：\n\n1. API路径拼写错误 - 确保URL中没有拼写错误\n2. API版本不正确 - 检查是否使用了正确的API版本前缀（如`/api/v1/`）\n3. 后端服务器未正确配置路由 - 查看后端代码中的路由定义\n4. 后端服务器未运行 - 确保后端服务器正在运行\n\n我建议您：\n- 检查后端文档以确认正确的API路径\n- 使用`curl`或Postman等工具直接测试API\n- 查看后端服务器日志以获取更多信息\n- 确认后端服务器正在监听正确的端口\n\n例如，您可以使用以下命令测试API：\n```bash\ncurl -v http://localhost:8000/api/v1/conversations\n```\n\n这将显示请求的详细信息和服务器响应，帮助您诊断问题。",
    created_at: new Date(Date.now() - 420000).toISOString(), // 7分钟前
    conversation_id: "1"
  }
];

export default function ConversationPage() {
  const router = useRouter()
  const params = useParams()
  const conversationId = params.id as string
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [useBackend, setUseBackend] = useState(true) // 默认尝试使用后端API
  const [usingMock, setUsingMock] = useState(false) // 默认不使用模拟数据
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  // 添加用户状态
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // 获取当前用户信息
  useEffect(() => {
    try {
      const userJson = localStorage.getItem('user')
      if (userJson) {
        const userData = JSON.parse(userJson)
        setCurrentUser(userData)
      }
    } catch (err) {
      console.error('获取用户信息失败:', err)
    }
  }, [])

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // 加载会话数据
  useEffect(() => {
    const fetchConversationData = async () => {
      setIsLoading(true)
      setError(null)
      setDebugInfo("正在尝试连接到后端API...")
      
      // 如果不使用后端，直接使用模拟数据
      if (!useBackend) {
        setTimeout(() => {
          // 使用现有的MOCK_CONVERSATION变量
          setConversation(MOCK_CONVERSATION)
          setMessages(MOCK_MESSAGES)
          setUsingMock(true)
          setDebugInfo("使用了模拟数据，没有连接后端API")
          setIsLoading(false)
        }, 1000)
        return
      }
      
      try {
        // 获取认证令牌
        const token = localStorage.getItem('auth_token')
        if (!token) {
          throw new Error('未找到认证令牌，请先登录')
        }
        
        // 修正API路径 - 获取会话详情
        const apiBaseUrl = 'http://localhost:8000/api/v1/conversations'
        console.log(`请求会话详情: ${apiBaseUrl}/${conversationId}`)
        setDebugInfo(`正在连接后端获取会话详情: ${apiBaseUrl}/${conversationId}...`)
        
        const convResponse = await fetch(`${apiBaseUrl}/${conversationId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        })
        
        setDebugInfo(`会话详情API响应状态码: ${convResponse.status}`)
        
        if (!convResponse.ok) {
          throw new Error(`获取会话详情API错误: ${convResponse.status}`)
        }
        
        const conversationData = await convResponse.json()
        setConversation(conversationData)
        
        // Set the selected model based on the conversation data
        if (conversationData.model) {
          setSelectedModel(conversationData.model)
        }
        
        // 获取会话消息
        await fetchMessages()
        
      } catch (err) {
        console.error('获取会话数据失败:', err)
        setDebugInfo(`后端API连接失败: ${err instanceof Error ? err.message : '未知错误'}。将使用模拟数据代替。`)
        // 使用模拟数据作为备用
        setConversation(MOCK_CONVERSATION)
        setMessages(MOCK_MESSAGES)
        setUsingMock(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversationData()
  }, [conversationId, useBackend])

  // 发送消息后自动滚动到底部
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 获取可用的模型列表
  useEffect(() => {
    const fetchModels = async () => {
      try {
        // 获取认证令牌
        const token = localStorage.getItem('auth_token')
        if (!token) {
          setError("未找到认证令牌，请先登录")
          return
        }

        const response = await fetch("http://localhost:8000/api/v1/models", {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          throw new Error("获取模型列表失败")
        }
        
        const data = await response.json()
        console.log("Models API response:", JSON.stringify(data, null, 2)) // 更详细的日志
        
        // 适应后端返回的数据格式
        const modelList = Array.isArray(data) ? data : data.data || data.items || data.models || []
        console.log("Processed model list:", JSON.stringify(modelList, null, 2)) // 打印处理后的模型列表
        
        // Log each model for debugging
        modelList.forEach((model: ModelInfo, index: number) => {
          console.log(`Model ${index}:`, {
            id: model.id,
            name: model.name,
            provider: model.provider,
            display: `${model.provider} - ${model.name}`
          })
        })
        
        setModels(modelList)
        setError(null)
        setDebugInfo(`成功获取 ${modelList.length} 个模型，第一个模型数据: ${JSON.stringify(modelList[0])}`)
      } catch (err) {
        console.error("获取模型列表失败:", err)
        setError(err instanceof Error ? err.message : "获取模型列表失败，请检查网络连接或重新登录")
      } finally {
        setIsLoadingModels(false)
      }
    }

    fetchModels()
  }, [])

  // 处理模型选择
  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId)
    if (conversationId !== 'new') {
      try {
        console.log(`Changing model to: ${modelId}`)
        setDebugInfo(`正在更新模型为: ${modelId}...`)
        setError(null) // Clear any previous errors
        
        // 更新会话模型
        try {
          const updatedConversation = await conversationAPI.updateConversationModel(conversationId, modelId)
          setConversation(updatedConversation)
          console.log(`Model updated successfully:`, updatedConversation)
          setDebugInfo(`成功更新模型为 ${modelId}`)
          
          // 对话链已在后端重置，无需单独调用reset
          // 重新加载消息以反映新的状态
          await fetchMessages()
        } catch (modelError) {
          console.error('更新模型失败:', modelError)
          // 尝试普通更新端点作为备选
          try {
            setDebugInfo(`尝试使用备用方法更新模型...`)
            const response = await fetch(`${getApiBaseUrl()}/api/v1/conversations/${conversationId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
              },
              body: JSON.stringify({ model: modelId })
            });
            
            if (!response.ok) {
              throw new Error(`更新失败: ${response.status}`);
            }
            
            const updatedConversation = await response.json();
            setConversation(updatedConversation);
            setDebugInfo(`已使用备用方法更新模型，正在重置对话链...`);
            
            // 需要单独重置对话链
            await conversationAPI.resetConversation(conversationId);
            setDebugInfo(`成功更新模型为 ${modelId} 并重置对话链`);
            await fetchMessages();
          } catch (fallbackError) {
            console.error('备用更新方法也失败:', fallbackError);
            throw modelError; // 抛出原始错误
          }
        }
      } catch (error) {
        console.error('更新模型失败:', error)
        setError(error instanceof Error ? error.message : '更新模型失败')
        setDebugInfo(`更新模型失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }

  // 发送新消息
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !selectedModel || isSending) return
    
    const tempId = Date.now().toString()
    const userMessage: Message = {
      id: tempId,
      role: "user",
      content: newMessage,
      created_at: new Date().toISOString(),
      conversation_id: conversationId
    }
    
    // 添加用户消息到列表
    setMessages(prev => [...prev, userMessage])
    setNewMessage("")
    setIsSending(true)
    
    // 如果使用模拟数据，模拟AI响应
    if (usingMock) {
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "这是一个模拟的AI回复。在实际应用中，这将由后端API返回。",
          created_at: new Date().toISOString(),
          conversation_id: conversationId
        }
        setMessages(prev => [...prev, assistantMessage])
        setIsSending(false)
      }, 2000)
      return
    }
    
    try {
      if (conversationId === 'new') {
        console.log('Creating new conversation...')
        const response = await conversationAPI.createConversation(newMessage, selectedModel);
        const newConversation = (await response.json()) as Conversation;
        router.push(`/conversations/${newConversation.id}`);
        return;
      }

      // 创建一个临时的AI消息用于流式更新
      const tempAssistantId = `assistant-${Date.now()}`
      const tempAssistantMessage: Message = {
        id: tempAssistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        conversation_id: conversationId
      }
      
      setMessages(prev => [...prev, tempAssistantMessage])
      
      // 使用流式响应
      await conversationAPI.sendMessageStream(
        conversationId,
        newMessage,
        // 处理每个新的内容片段
        (content: string) => {
          setMessages(prev => prev.map(msg => 
            msg.id === tempAssistantId
              ? { ...msg, content: msg.content + content }
              : msg
          ))
        },
        // 处理完成
        () => {
          setIsSending(false)
          setDebugInfo("流式响应完成")
        }
      )
      
    } catch (err) {
      console.error('发送消息失败:', err)
      setDebugInfo(`发送消息失败: ${err instanceof Error ? err.message : '未知错误'}`)
      setError(err instanceof Error ? err.message : '发送消息失败')
      
      // 移除临时消息
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
      
    } finally {
      setIsSending(false)
    }
  }

  // 切换数据来源
  const toggleDataSource = () => {
    setUseBackend(!useBackend)
  }

  // 处理按键事件，支持Ctrl+Enter或Command+Enter发送消息
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSendMessage(e as unknown as React.FormEvent)
    }
  }

  // 格式化日期时间
  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm')
    } catch (e) {
      return ''
    }
  }

  // 获取会话消息的函数
  const fetchMessages = async () => {
    try {
      // 获取认证令牌
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('未找到认证令牌，请先登录')
      }
      
      const apiBaseUrl = 'http://localhost:8000/api/v1/conversations'
      console.log(`请求消息列表: ${apiBaseUrl}/${conversationId}/messages`)
      setDebugInfo(`正在连接后端获取消息列表: ${apiBaseUrl}/${conversationId}/messages...`)
      
      const msgResponse = await fetch(`${apiBaseUrl}/${conversationId}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      })
      
      setDebugInfo(`消息列表API响应状态码: ${msgResponse.status}`)
      
      if (!msgResponse.ok) {
        throw new Error(`获取消息列表API错误: ${msgResponse.status}`)
      }
      
      const messageData: MessagePagination = await msgResponse.json()
      setMessages(messageData.items)
      setDebugInfo(`成功获取 ${messageData.items.length} 条消息`)
      
    } catch (err) {
      console.error('获取消息失败:', err)
      setError(err instanceof Error ? err.message : '获取消息失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col space-y-4 h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon"
            asChild
          >
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          
          <h1 className="text-xl font-semibold truncate">
            {conversation?.title || '加载中...'}
          </h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select 
            value={selectedModel} 
            onValueChange={handleModelChange}
            disabled={isLoadingModels || isSending}
          >
            <SelectTrigger className="w-auto min-w-[180px] h-9">
              <SelectValue placeholder="选择模型..." />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive" className="my-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {debugInfo && (
        <Alert className="my-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>调试信息</AlertTitle>
          <AlertDescription className="break-all">{debugInfo}</AlertDescription>
        </Alert>
      )}
      
      {/* 消息列表区域 */}
      <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-1 md:p-4">
        {isLoading ? (
          <div className="space-y-4 p-4">
            <div className="flex items-start space-x-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
            <div className="flex items-start space-x-4 justify-end">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4 ml-auto" />
                <Skeleton className="h-16 w-full" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">没有消息</h3>
            <p className="text-muted-foreground">
              开始发送消息来与AI助手交流。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={cn(
                  "flex items-start space-x-3 animate-in fade-in",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <Avatar className="flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      AI
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div 
                  className={cn(
                    "message-bubble",
                    message.role === "user" ? "message-bubble user" : "message-bubble assistant",
                  )}
                >
                  <div className="prose dark:prose-invert max-w-none">
                    {message.content.split("\n").map((line, i) => {
                      // 简单处理换行符，保留格式
                      return <p key={i}>{line}</p>;
                    })}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(message.created_at), "HH:mm • yyyy-MM-dd")}
                  </div>
                </div>
                
                {message.role === "user" && (
                  <Avatar className="flex-shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {currentUser?.username?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* 消息输入区域 */}
      <div className="sticky bottom-0 pt-2">
        <form onSubmit={handleSendMessage} className="relative">
          <Textarea
            ref={inputRef}
            placeholder="输入您的消息..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[80px] w-full resize-none rounded-lg border border-input bg-card pr-12"
            disabled={isSending}
            onKeyDown={(e) => {
              // 支持按Ctrl+Enter发送
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isSending) {
                e.preventDefault();
                handleSendMessage(e as unknown as React.FormEvent);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute bottom-3 right-3"
            disabled={isSending || !newMessage.trim()}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-2">
          按 Ctrl + Enter 快速发送消息
        </p>
      </div>
    </div>
  )
} 