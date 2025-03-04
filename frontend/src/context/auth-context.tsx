"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { authAPI } from '@/lib/api';
import Cookies from 'js-cookie';

// 用户类型定义
export interface User {
  id: string | number;
  username: string;
  email: string;
}

// 认证上下文类型
export interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const defaultContext: AuthContextType = {
  user: null,
  setUser: () => {},
  isAuthenticated: false,
  login: () => {},
  logout: () => {}
};

// 创建认证上下文
const AuthContext = createContext<AuthContextType>(defaultContext);

// Token 存储的键名
const TOKEN_KEY = 'auth_token';
// 用户信息存储的键名
const USER_INFO_KEY = 'user_info';
// 保存重定向路径的键名
const REDIRECT_PATH_KEY = 'auth_redirect_path';

// 设置cookie的辅助函数
const setCookie = (name: string, value: string, expires = 7) => {
  Cookies.set(name, value, { expires, path: '/' });
};

// 删除cookie的辅助函数
const deleteCookie = (name: string) => {
  Cookies.remove(name, { path: '/' });
};

// 处理API错误的辅助函数
const handleApiError = (err: any): string => {
  console.error('API错误:', err);
  
  // 检查网络错误
  if (err.message === 'Failed to fetch') {
    return '无法连接到服务器，请检查网络连接和后端服务状态';
  }
  
  // 检查授权错误
  if (err.message.includes('401') || err.message.includes('403')) {
    return '认证失败，请检查您的账号和密码';
  }
  
  // 返回错误消息或默认错误
  return err.message || '发生未知错误，请稍后重试';
};

// 认证提供者组件
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 在组件挂载时，从localStorage检查用户信息
  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setIsAuthenticated(true);
        } catch (e) {
          console.error('Failed to parse user data:', e);
          localStorage.removeItem('user');
        }
      }
    };

    checkAuth();
  }, []);

  // 保存当前路径用于重定向
  useEffect(() => {
    // 只保存非认证相关路径
    if (pathname && 
        pathname !== '/login' && 
        pathname !== '/register' && 
        pathname !== '/forgot-password') {
      localStorage.setItem(REDIRECT_PATH_KEY, pathname);
    }
  }, [pathname]);

  const login = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// 认证钩子
export const useAuth = () => useContext(AuthContext);

// 获取当前令牌的辅助函数
export function getToken() {
  if (typeof window !== 'undefined') {
    // 首先尝试从localStorage获取token
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return token;
    
    // 如果localStorage中没有，尝试从cookie获取
    return Cookies.get(TOKEN_KEY) || null;
  }
  return null;
} 