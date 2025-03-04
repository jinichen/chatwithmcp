import { getToken } from "@/context/auth-context";

// 根据环境获取 API URL
// 开发环境使用 localhost，生产环境使用相对路径（假设前后端部署在同一域名下）
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }
  // 对于生产环境，使用相对路径
  return '';
};

const API_BASE_URL = getApiBaseUrl();

// 创建一个API客户端，自动处理认证令牌
class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // 发送GET请求
  async get<T>(path: string, skipAuth = false): Promise<T> {
    return this.request<T>("GET", path, undefined, skipAuth);
  }

  // 发送POST请求
  async post<T>(path: string, data?: any, skipAuth = false): Promise<T> {
    return this.request<T>("POST", path, data, skipAuth);
  }

  // 发送PUT请求
  async put<T>(path: string, data?: any, skipAuth = false): Promise<T> {
    return this.request<T>("PUT", path, data, skipAuth);
  }

  // 发送DELETE请求
  async delete<T>(path: string, skipAuth = false): Promise<T> {
    return this.request<T>("DELETE", path, undefined, skipAuth);
  }

  // 通用请求方法
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    skipAuth = false
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // 如果需要认证且有令牌，则添加认证头
    if (!skipAuth) {
      const token = getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    // 构建请求选项
    const options: RequestInit = {
      method,
      headers,
      credentials: 'include', // 包含 cookies
    };

    // 对于POST/PUT请求，添加请求体
    if (data) {
      if (headers["Content-Type"] === "application/json") {
        options.body = JSON.stringify(data);
      } else if (data instanceof FormData) {
        options.body = data;
        // 当使用FormData时，删除Content-Type头，让浏览器自动设置
        delete headers["Content-Type"];
      }
    }

    try {
      // 发送请求
      console.log(`Sending ${method} request to: ${url}`);
      const response = await fetch(url, options);

      // 处理响应
      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.detail || '请求失败');
        } catch (e) {
          throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }
      }

      // 检查内容类型，如果是JSON则解析，否则返回原始响应
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      }

      return response as unknown as T;
    } catch (error) {
      console.error(`API 请求错误 (${method} ${url}):`, error);
      throw error;
    }
  }

  // 特殊处理表单数据POST（如登录表单）
  async postForm<T>(path: string, data: Record<string, string>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const formData = new URLSearchParams();
    
    for (const key in data) {
      formData.append(key, data[key]);
    }
    
    const options: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
      credentials: 'include', // 包含 cookies
    };
    
    try {
      console.log(`Sending form POST request to: ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.detail || '请求失败');
        } catch (e) {
          throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }
      }
      
      return response.json();
    } catch (error) {
      console.error(`API 表单请求错误 (POST ${url}):`, error);
      throw error;
    }
  }
}

// 创建单例实例
export const apiClient = new ApiClient(API_BASE_URL); 