"use client"

import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">账户设置</h1>
      
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <div className="bg-primary text-white flex items-center justify-center h-full text-xl">
                {user?.username.charAt(0).toUpperCase()}
              </div>
            </Avatar>
            <div>
              <h2 className="text-lg font-medium">{user?.username}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {user?.is_superuser && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded mt-1 inline-block">
                  管理员
                </span>
              )}
            </div>
          </div>
          
          <div className="grid gap-4 pt-4">
            <div className="grid gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input id="username" defaultValue={user?.username} />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" defaultValue={user?.email} />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="password">新密码</Label>
              <Input id="password" type="password" placeholder="输入新密码" />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input id="confirmPassword" type="password" placeholder="再次输入新密码" />
            </div>
            
            <Button className="w-full mt-4">保存更改</Button>
          </div>
        </div>
      </Card>
      
      <Card className="p-6">
        <h2 className="text-lg font-medium mb-4">偏好设置</h2>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="language">默认语言</Label>
            <select
              id="language"
              className="w-full rounded-md border border-input px-3 py-2 bg-background"
            >
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
          
          <Button className="w-full">保存偏好</Button>
        </div>
      </Card>
    </div>
  );
} 