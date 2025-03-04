// API服务 - 处理所有与后端API的通信
import { apiClient } from './api-client';
import { User } from '@/context/auth-context';

// 获取API基础URL
export function getApiBaseUrl() {
  return 'http://localhost:8000';
}

// 认证相关API
export const authAPI = {
  // 登录函数
  async login(email: string, password: string) {
    return apiClient.postForm('/api/v1/auth/login', {
      'username': email,  // API需要username参数，但实际使用email
      'password': password,
    });
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<User> {
    return apiClient.get('/api/v1/auth/me');
  },

  // 注册新用户
  async register(email: string, username: string, password: string) {
    return apiClient.post('/api/v1/auth/register', {
      email,
      username,
      password,
      is_active: true,
      is_superuser: false
    }, true);
  },

  // 更新用户信息
  async updateUser(userId: number, data: Partial<User>) {
    return apiClient.put(`/api/v1/users/${userId}`, data);
  },

  // 更改密码
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    return apiClient.put(`/api/v1/users/${userId}/password`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }
};

// 对话相关API
export const conversationAPI = {
  // 获取对话列表
  async getConversations() {
    return apiClient.get('/api/v1/conversations');
  },

  // 获取单个对话
  async getConversation(id: number) {
    return apiClient.get(`/api/v1/conversations/${id}`);
  },

  // 创建新对话
  async createConversation(content: string, model: string) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('未找到认证令牌，请先登录');
    }

    const response = await fetch(`${getApiBaseUrl()}/api/v1/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: content.slice(0, 50),  // 使用消息内容的前50个字符作为标题
        model
      })
    });
    return response;
  },

  // 更新会话模型
  async updateConversationModel(conversationId: string | number, modelId: string) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('未找到认证令牌，请先登录');
    }

    const response = await fetch(`${getApiBaseUrl()}/api/v1/conversations/${conversationId}/model`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ model_id: modelId })
    });
    
    if (!response.ok) {
      throw new Error(`更新模型失败: ${response.status}`);
    }
    
    return await response.json();
  },

  // 重置对话链（当模型更改或对话行为需要重置时使用）
  async resetConversation(conversationId: string | number) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('未找到认证令牌，请先登录');
    }

    const response = await fetch(`${getApiBaseUrl()}/api/v1/conversations/${conversationId}/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`重置对话失败: ${response.status}`);
    }
    
    return await response.json();
  },

  // 发送消息
  async sendMessage(conversationId: string | number, content: string) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('未找到认证令牌，请先登录');
    }

    const response = await fetch(`${getApiBaseUrl()}/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });
    return response;
  },

  // 发送消息（流式响应）
  async sendMessageStream(conversationId: string | number, content: string, onMessage: (content: string) => void, onDone: () => void) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('未找到认证令牌，请先登录');
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/conversations/${conversationId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error(`发送消息失败: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('响应没有可读取的流');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 处理流式响应
      while (true) {
        const { value, done } = await reader.read();
        
        if (done) {
          onDone();
          break;
        }
        
        // 解码接收到的数据并发送给回调函数
        const text = decoder.decode(value, { stream: true });
        if (text) {
          onMessage(text);
        }
      }
    } catch (error) {
      console.error('读取流数据失败:', error);
      throw error;
    }
  },

  // 删除对话
  async deleteConversation(id: number) {
    return apiClient.delete(`/api/v1/conversations/${id}`);
  }
};

// 检查认证状态
export async function checkAuthStatus() {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/test-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // 如果认证失败，清除本地存储的token和用户信息
    if (!response.ok) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('检查认证状态出错:', e);
    return false;
  }
}

// 登出函数
export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  // 重定向到登录页面
  window.location.href = '/login';
}

// 登录并获取token
export async function login(username: string, password: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'username': username,
      'password': password
    })
  });
  
  if (!response.ok) {
    throw new Error(`登录失败: ${response.status}`);
  }
  
  const data = await response.json();
  localStorage.setItem('auth_token', data.access_token);
  return data;
}

// 注册新用户
export async function register(email: string, username: string, password: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      username,
      password,
      is_superuser: false
    })
  });
  
  if (!response.ok) {
    throw new Error(`注册失败: ${response.status}`);
  }
  
  return await response.json();
}

// MCP插件类型定义
export interface MCPPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  tags: string[];
  isInstalled: boolean;
  createdAt: string;
  updatedAt: string;
  repository?: string;
}

// MCP插件上传表单类型
export interface MCPPluginUpload {
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  file: File;
  repository?: string;
}

// MCP插件排序选项
export type PluginSortOption = 'popular' | 'newest' | 'name' | 'downloads';

// MCP插件API
export const mcpPluginAPI = {
  // 获取插件列表
  async getPlugins(search?: string, sortBy?: PluginSortOption, page = 1, limit = 20): Promise<{ items: MCPPlugin[], total: number }> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (sortBy) params.append('sort_by', sortBy);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await fetch(`${getApiBaseUrl()}/api/v1/plugins?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`获取插件列表失败: ${response.status}`);
    }

    return await response.json();
  },

  // 搜索插件
  async searchPlugins(options: { query?: string, sort?: PluginSortOption }): Promise<{ items: MCPPlugin[], total: number }> {
    const params = new URLSearchParams();
    if (options.query) params.append('query', options.query);
    if (options.sort) params.append('sort', options.sort);

    const response = await fetch(`${getApiBaseUrl()}/api/v1/plugins?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`搜索插件失败: ${response.status}`);
    }

    return await response.json();
  },

  // 从开源仓库搜索插件
  async searchRepositoryPlugins(repositoryUrl: string, query?: string): Promise<MCPPlugin[]> {
    const params = new URLSearchParams();
    params.append('repository_url', repositoryUrl);
    if (query) params.append('query', query);

    const response = await fetch(`${getApiBaseUrl()}/api/v1/plugins/repository/search?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`搜索仓库插件失败: ${response.status}`);
    }

    return await response.json();
  },

  // 获取插件详情
  async getPluginDetails(pluginId: string): Promise<MCPPlugin> {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/plugins/${pluginId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`获取插件详情失败: ${response.status}`);
    }

    return await response.json();
  },

  // 安装插件
  async installPlugin(pluginId: string, fromRepository = false): Promise<{ success: boolean, message: string }> {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/plugins/${pluginId}/install${fromRepository ? '?from_repository=true' : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`安装插件失败: ${response.status}`);
    }

    return await response.json();
  },

  // 卸载插件
  async uninstallPlugin(pluginId: string): Promise<{ success: boolean, message: string }> {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/plugins/${pluginId}/uninstall`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`卸载插件失败: ${response.status}`);
    }

    return await response.json();
  },

  // 上传插件
  async uploadPlugin(pluginData: MCPPluginUpload): Promise<MCPPlugin> {
    const formData = new FormData();
    formData.append('name', pluginData.name);
    formData.append('description', pluginData.description);
    formData.append('version', pluginData.version);
    formData.append('author', pluginData.author);
    formData.append('tags', JSON.stringify(pluginData.tags));
    formData.append('file', pluginData.file);
    
    if (pluginData.repository) {
      formData.append('repository', pluginData.repository);
    }

    const response = await fetch(`${getApiBaseUrl()}/api/v1/plugins/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`上传插件失败: ${response.status}`);
    }

    return await response.json();
  },

  // 获取已安装的插件
  async getInstalledPlugins(): Promise<MCPPlugin[]> {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/plugins/installed`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`获取已安装插件失败: ${response.status}`);
    }

    return await response.json();
  }
};