"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import { PluginBrowse } from "@/components/plugins/plugin-browse"
import { InstalledPlugins } from "@/components/plugins/installed-plugins"
import { RepositorySearch } from "@/components/plugins/repository-search"
import { UploadPluginDialog } from "@/components/plugins/upload-plugin-dialog"

export default function StorePage() {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MCP插件商店</h1>
          <p className="text-muted-foreground">
            浏览、安装和管理您的MCP插件，提升您的生产力和工作流程
          </p>
        </div>
        
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          上传插件
        </Button>
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="browse">浏览插件</TabsTrigger>
          <TabsTrigger value="installed">已安装</TabsTrigger>
          <TabsTrigger value="repository">仓库搜索</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <PluginBrowse />
        </TabsContent>

        <TabsContent value="installed" className="space-y-4">
          <InstalledPlugins />
        </TabsContent>

        <TabsContent value="repository" className="space-y-4">
          <RepositorySearch />
        </TabsContent>
      </Tabs>

      <UploadPluginDialog 
        open={isUploadDialogOpen} 
        onOpenChange={setIsUploadDialogOpen}
      />
    </div>
  )
} 