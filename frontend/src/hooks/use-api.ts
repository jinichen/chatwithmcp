import { useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";

interface ApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

// 自定义钩子，用于处理API请求的状态和错误
export function useApi<T = any, E extends Error = Error>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { logout } = useAuth();

  const execute = useCallback(
    async <R>(
      apiCall: () => Promise<R>,
      options?: ApiOptions
    ): Promise<R | null> => {
      try {
        setLoading(true);
        setError(null);

        const result = await apiCall();
        setData(result as unknown as T);
        options?.onSuccess?.(result);
        return result;
      } catch (err: any) {
        setError(err as E);
        options?.onError?.(err);

        // 如果是401错误，可能是令牌无效，自动登出
        if (err.message?.includes("401") || err.message?.includes("认证")) {
          logout();
        }
        return null;
      } finally {
        setLoading(false);
        options?.onComplete?.();
      }
    },
    [logout]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    error,
    loading,
    execute,
    reset,
  };
}

// 创建已预配置的API请求钩子
export function useAuthRequiredApi<T = any, E extends Error = Error>() {
  const { isAuthenticated } = useAuth();
  const api = useApi<T, E>();

  const execute = useCallback(
    async <R>(
      apiCall: () => Promise<R>,
      options?: ApiOptions
    ): Promise<R | null> => {
      if (!isAuthenticated) {
        const error = new Error("需要登录才能执行此操作") as E;
        api.reset();
        options?.onError?.(error);
        return null;
      }
      return api.execute(apiCall, options);
    },
    [api, isAuthenticated]
  );

  return {
    ...api,
    execute,
  };
} 