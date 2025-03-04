"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Loader2, Package, Trash2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  Dialog, 
  DialogContent,
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog"
import { MCPPlugin, mcpPluginAPI } from "@/lib/api"
import { toast } from "sonner"

export function InstalledPlugins() {
  const [plugins, setPlugins] = useState<MCPPlugin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pluginToUninstall, setPluginToUninstall] = useState<MCPPlugin | null>(null)
  const [isUninstalling, setIsUninstalling] = useState(false)

  // 获取已安装的插件
  useEffect(() => {
    const fetchInstalledPlugins = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const installedPlugins = await mcpPluginAPI.getInstalledPlugins()
        setPlugins(installedPlugins)
      } catch (err) {
        console.error("获取已安装插件失败:", err)
        setError(err instanceof Error ? err.message : "获取已安装插件失败")
      } finally {
        setIsLoading(false)
      }
    }

    fetchInstalledPlugins()
  }, [])

  // 确认卸载插件
  const confirmUninstall = (plugin: MCPPlugin) => {
    setPluginToUninstall(plugin)
  }

  // 处理插件卸载
  const handleUninstall = async () => {
    if (!pluginToUninstall) return
    
    setIsUninstalling(true)
    
    try {
      const result = await mcpPluginAPI.uninstallPlugin(pluginToUninstall.id)
      
      if (result.success) {
        // 从列表中移除已卸载的插件
        setPlugins(prev => prev.filter(p => p.id !== pluginToUninstall.id))
        toast.success(`成功卸载插件: ${pluginToUninstall.name}`)
      } else {
        toast.error(`卸载失败: ${result.message}`)
      }
    } catch (err) {
      console.error("卸载插件失败:", err)
      toast.error(err instanceof Error ? err.message : "卸载插件失败")
    } finally {
      setIsUninstalling(false)
      setPluginToUninstall(null)
    }
  }

  // 关闭卸载确认对话框
  const closeUninstallDialog = () => {
    if (!isUninstalling) {
      setPluginToUninstall(null)
    }
  }

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('zh-CN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">已安装的插件</h2>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="h-20 w-full" />
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-between">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-1/4" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-card">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">没有已安装的插件</h3>
          <p className="text-muted-foreground mb-4">
            浏览插件商店并安装插件以增强您的AI助手
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plugins.map((plugin) => (
            <Card key={plugin.id} className="border hover:border-primary/50 transition-colors">
              <CardHeader className="p-4 space-y-1">
                <CardTitle className="text-lg flex items-center justify-between">
                  {plugin.name}
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">v{plugin.version}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  作者: {plugin.author} | 安装于: {formatDate(plugin.updatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground mb-3">{plugin.description}</p>
                <div className="flex flex-wrap gap-1">
                  {plugin.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-end items-center">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive hover:bg-destructive/10"
                  onClick={() => confirmUninstall(plugin)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  卸载
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* 卸载确认对话框 */}
      <Dialog open={!!pluginToUninstall} onOpenChange={closeUninstallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认卸载插件</DialogTitle>
            <DialogDescription>
              您确定要卸载插件 "{pluginToUninstall?.name}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive" className="border-amber-500 bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>警告</AlertTitle>
            <AlertDescription>
              卸载此插件可能会影响某些依赖它的功能。
            </AlertDescription>
          </Alert>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={closeUninstallDialog}
              disabled={isUninstalling}
            >
              取消
            </Button>
            <Button 
              variant="destructive"
              onClick={handleUninstall}
              disabled={isUninstalling}
            >
              {isUninstalling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  卸载中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  确认卸载
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 