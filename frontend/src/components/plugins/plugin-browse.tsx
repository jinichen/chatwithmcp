"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Download, Loader2, Plus, Search } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { MCPPlugin, mcpPluginAPI, PluginSortOption } from "@/lib/api"
import { toast } from "sonner"

export function PluginBrowse() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentSort, setCurrentSort] = useState<PluginSortOption>("popular")
  const [plugins, setPlugins] = useState<MCPPlugin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInstalling, setIsInstalling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // 获取插件列表
  useEffect(() => {
    fetchPlugins()
  }, [currentSort])
  
  // 刷新插件列表
  const fetchPlugins = async (query?: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const results = await mcpPluginAPI.searchPlugins({
        query: query || searchQuery,
        sort: currentSort
      })
      
      setPlugins(results.items)
      
      if (results.items.length === 0 && query) {
        toast.info("没有找到匹配的插件")
      }
    } catch (err) {
      console.error("获取插件失败:", err)
      setError(err instanceof Error ? err.message : "获取插件列表失败")
      setPlugins([])
    } finally {
      setIsLoading(false)
    }
  }
  
  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPlugins(searchQuery)
  }
  
  // 处理排序变更
  const handleSortChange = (value: string) => {
    setCurrentSort(value as PluginSortOption)
  }
  
  // 处理插件安装
  const handleInstall = async (plugin: MCPPlugin) => {
    setIsInstalling(plugin.id)
    
    try {
      const result = await mcpPluginAPI.installPlugin(plugin.id)
      
      if (result.success) {
        toast.success(`成功安装插件: ${plugin.name}`)
        // 更新插件状态
        setPlugins(prev => 
          prev.map(p => p.id === plugin.id ? { ...p, isInstalled: true } : p)
        )
      } else {
        toast.error(`安装失败: ${result.message || "未知错误"}`)
      }
    } catch (err) {
      console.error("安装插件失败:", err)
      toast.error(err instanceof Error ? err.message : "安装插件失败")
    } finally {
      setIsInstalling(null)
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <h2 className="text-xl font-semibold">浏览插件</h2>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="搜索插件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-w-[200px]"
              />
              <Button type="submit" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </div>
          
          <Select
            value={currentSort}
            onValueChange={handleSortChange}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">最受欢迎</SelectItem>
              <SelectItem value="newest">最新发布</SelectItem>
              <SelectItem value="name">名称</SelectItem>
              <SelectItem value="downloads">下载量</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {isLoading ? (
        <div className="py-8">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">加载插件...</p>
          </div>
        </div>
      ) : plugins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plugins.map((plugin) => (
            <Card key={plugin.id} className="flex flex-col border hover:border-primary/50 transition-colors">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  {plugin.name}
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">v{plugin.version}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  作者: {plugin.author} | 下载量: {plugin.downloads.toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{plugin.description}</p>
                <div className="flex flex-wrap gap-1">
                  {plugin.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  更新于: {new Date(plugin.updatedAt).toLocaleDateString()}
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
      ) : (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">没有找到插件</p>
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={() => {
              setSearchQuery("")
              fetchPlugins("")
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            添加新插件
          </Button>
        </div>
      )}
    </div>
  )
} 