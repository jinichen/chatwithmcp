"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertCircle, FileUp, Loader2, Plus, Tag, X } from "lucide-react"
import { MCPPluginUpload, mcpPluginAPI } from "@/lib/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"

interface UploadPluginDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UploadPluginDialog({ open: controlledOpen, onOpenChange }: UploadPluginDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTag, setCurrentTag] = useState("")
  const [formData, setFormData] = useState<Omit<MCPPluginUpload, 'file'>>({
    name: "",
    description: "",
    version: "",
    author: "",
    tags: [],
    repository: ""
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // 使用受控或非受控状态
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // 处理标签添加
  const handleAddTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }))
      setCurrentTag("")
    }
  }

  // 处理标签键盘事件
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  // 处理标签删除
  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      version: "",
      author: "",
      tags: [],
      repository: ""
    })
    setSelectedFile(null)
    setCurrentTag("")
    setError(null)
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!selectedFile) {
      setError("请选择插件文件上传")
      return
    }

    if (!formData.name || !formData.description || !formData.version || !formData.author) {
      setError("请填写所有必填字段")
      return
    }

    setIsSubmitting(true)

    try {
      const uploadData: MCPPluginUpload = {
        ...formData,
        file: selectedFile
      }

      const result = await mcpPluginAPI.uploadPlugin(uploadData)
      
      toast.success("插件上传成功")
      setOpen(false)
      resetForm()
    } catch (err) {
      console.error("上传插件失败:", err)
      setError(err instanceof Error ? err.message : "上传失败，请重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(newOpen) => {
      setOpen(newOpen)
      if (!newOpen) resetForm()
    }}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            上传MCP插件
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>上传MCP插件</DialogTitle>
          <DialogDescription>
            上传您的自定义MCP插件到商店。上传后需经过审核才会公开显示。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">插件名称 *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="插件名称"
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">版本 *</Label>
              <Input
                id="version"
                name="version"
                value={formData.version}
                onChange={handleInputChange}
                placeholder="如: 1.0.0"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">作者 *</Label>
            <Input
              id="author"
              name="author"
              value={formData.author}
              onChange={handleInputChange}
              placeholder="插件作者"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述 *</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="插件功能描述..."
              rows={3}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repository">仓库地址 (可选)</Label>
            <Input
              id="repository"
              name="repository"
              value={formData.repository || ""}
              onChange={handleInputChange}
              placeholder="如: https://github.com/yourname/plugin"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label>标签</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="添加标签..."
                  className="pl-8"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  disabled={isSubmitting}
                />
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleAddTag}
                disabled={isSubmitting || !currentTag.trim()}
              >
                添加
              </Button>
            </div>
            
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map(tag => (
                  <div 
                    key={tag}
                    className="flex items-center bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-sm"
                  >
                    {tag}
                    <button 
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">插件文件 *</Label>
            <div className="border rounded-md p-4 bg-muted/30">
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileUp className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {selectedFile ? selectedFile.name : "点击或拖放文件到此处上传"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      支持 .zip, .py, .js 文件
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".zip,.py,.js"
                    disabled={isSubmitting}
                    required
                  />
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>上传插件</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 