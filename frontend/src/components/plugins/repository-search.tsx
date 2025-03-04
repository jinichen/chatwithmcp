"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Download, Loader2, Search, ExternalLink, ListFilter } from "lucide-react"
import { MCPPlugin, mcpPluginAPI } from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// 常用仓库列表
const COMMON_REPOSITORIES = [
  {
    name: "所有插件",
    url: "all",
    description: "显示所有可用插件"
  },
  {
    name: "编辑器和开发工具",
    url: "https://github.com/example/editor-plugins",
    description: "提供代码编辑、自动补全等功能的插件"
  },
  {
    name: "数据分析工具",
    url: "https://github.com/example/data-viz",
    description: "数据可视化和分析工具集"
  },
  {
    name: "AI工具集",
    url: "https://github.com/example/nlp-tools",
    description: "NLP、文本分析和机器学习插件"
  },
  {
    name: "图像处理库",
    url: "https://github.com/example/image-tools",
    description: "图像编辑和处理工具"
  },
  {
    name: "语音和音频工具",
    url: "https://github.com/example/speech-tools",
    description: "语音识别和处理插件"
  }
]

export function RepositorySearch() {
  const [repositoryUrl, setRepositoryUrl] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [isInstalling, setIsInstalling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plugins, setPlugins] = useState<MCPPlugin[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  
  // 在组件加载时自动搜索所有插件
  useEffect(() => {
    searchPlugins("all")
  }, [])
  
  // 获取所有唯一标签
  const allTags = plugins.length 
    ? [...new Set(plugins.flatMap(plugin => plugin.tags))]
    : []
  
  // 按分类过滤插件
  const filteredPlugins = activeCategory 
    ? plugins.filter(plugin => plugin.tags.includes(activeCategory))
    : plugins
  
  // 选择仓库
  const selectRepository = (url: string) => {
    setRepositoryUrl(url)
    searchPlugins(url)
  }
  
  // 搜索插件
  const searchPlugins = async (repoUrl: string, query?: string) => {
    setIsSearching(true)
    setError(null)
    setActiveCategory(null)
    
    try {
      const results = await mcpPluginAPI.searchRepositoryPlugins(
        repoUrl, 
        query || undefined
      )
      
      setPlugins(results)
      
      if (results.length === 0) {
        toast.info("没有找到插件，请尝试其他仓库或搜索条件")
      }
    } catch (err) {
      console.error("搜索仓库插件失败:", err)
      setError(err instanceof Error ? err.message : "搜索仓库插件失败")
      setPlugins([])
    } finally {
      setIsSearching(false)
    }
  }
  
  // 处理仓库搜索
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    searchPlugins(repositoryUrl, searchQuery.trim())
  }
  
  // 处理插件安装
  const handleInstall = async (plugin: MCPPlugin) => {
    setIsInstalling(plugin.id)
    
    try {
      const result = await mcpPluginAPI.installPlugin(plugin.id, true)
      
      if (result.success) {
        // 更新UI显示
        setPlugins(prev => 
          prev.map(p => 
            p.id === plugin.id ? { ...p, isInstalled: true } : p
          )
        )
        
        // 显示更详细的成功消息
        toast.success(
          <div className="space-y-2">
            <p className="font-medium">成功安装插件: {plugin.name}</p>
            <p className="text-xs opacity-90">插件已添加到您的已安装列表</p>
          </div>
        );
      } else {
        toast.error(`安装失败: ${result.message}`)
      }
    } catch (err) {
      console.error("安装插件失败:", err)
      
      // 显示更友好的错误消息
      toast.error(
        <div className="space-y-2">
          <p className="font-medium">安装插件失败</p>
          <p className="text-xs opacity-90">
            {err instanceof Error ? err.message : "插件安装过程中出现错误"}
          </p>
        </div>
      );
    } finally {
      setIsInstalling(null)
    }
  }
  
  // 获取仓库名称
  const getRepositoryName = (url: string) => {
    const repo = COMMON_REPOSITORIES.find(r => r.url === url)
    return repo ? repo.name : url
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">插件仓库</h2>
        <p className="text-muted-foreground mb-6">
          浏览、搜索和安装来自不同仓库的MCP插件，提升您的工作效率。
        </p>
        
        {/* 仓库选择 */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">选择仓库</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMMON_REPOSITORIES.map((repo) => (
              <Card 
                key={repo.url}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${
                  repositoryUrl === repo.url ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => selectRepository(repo.url)}
              >
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-md">{repo.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-muted-foreground">{repo.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        {/* 搜索表单 */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索关键词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  搜索中...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  搜索
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
      
      {/* 错误信息 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>搜索错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* 插件结果 */}
      {plugins.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">
                {getRepositoryName(repositoryUrl)}
              </h3>
              <Badge variant="secondary">{plugins.length} 个插件</Badge>
            </div>
            
            {repositoryUrl !== "all" && (
              <Badge variant="outline" className="flex items-center gap-1">
                <span>
                  {repositoryUrl === "all" 
                    ? "所有仓库" 
                    : new URL(repositoryUrl).hostname}
                </span>
                {repositoryUrl !== "all" && <ExternalLink className="h-3 w-3 ml-1" />}
              </Badge>
            )}
          </div>
          
          {/* 分类标签 */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 py-2">
              <Badge 
                variant={activeCategory === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setActiveCategory(null)}
              >
                全部
              </Badge>
              
              {allTags.map(tag => (
                <Badge 
                  key={tag}
                  variant={activeCategory === tag ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setActiveCategory(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {/* 插件列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlugins.map((plugin) => (
              <Card key={plugin.id} className="border hover:border-primary/50 transition-colors">
                <CardHeader className="p-4 space-y-1">
                  <CardTitle className="text-lg flex items-center justify-between">
                    {plugin.name}
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">v{plugin.version}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    作者: {plugin.author} | 下载: {plugin.downloads.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-muted-foreground mb-3">{plugin.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {plugin.tags.map((tag) => (
                      <span 
                        key={tag} 
                        className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${
                          activeCategory === tag 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-secondary text-secondary-foreground'
                        }`}
                        onClick={() => setActiveCategory(tag)}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {plugin.isInstalled ? "已安装" : "未安装"}
                  </span>
                  <Button 
                    size="sm" 
                    variant={plugin.isInstalled ? "outline" : "default"}
                    onClick={() => !plugin.isInstalled && handleInstall(plugin)}
                    disabled={plugin.isInstalled || isInstalling === plugin.id}
                  >
                    {isInstalling === plugin.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        安装中...
                      </>
                    ) : plugin.isInstalled ? (
                      "已安装"
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        安装
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* 空状态 */}
      {!isSearching && plugins.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ListFilter className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">没有找到插件</h3>
          <p className="text-muted-foreground max-w-md">
            没有找到匹配的插件。请尝试更改搜索关键词或选择其他仓库。
          </p>
        </div>
      )}
    </div>
  )
} 