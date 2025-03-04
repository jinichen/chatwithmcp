from typing import AsyncGenerator, Dict, List, Optional
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.memory import ConversationBufferWindowMemory
from tenacity import retry, stop_after_attempt, wait_exponential
import json
import os
import glob
import httpx

from app.core.llm.providers import get_llm_provider, get_fallback_model
from app.core.llm.streaming import StreamingCallbackHandler
from app.core.config import settings


# 获取已安装的MCP插件列表
def get_installed_plugins():
    installed_file = os.path.join(settings.PLUGINS_DIR, "installed.json")
    try:
        with open(installed_file, "r") as f:
            return json.load(f)
    except:
        return []


class ConversationChain:
    def __init__(
        self,
        model_name: str,
        memory_size: int = 10,
        system_prompt: Optional[str] = None,
        user_id: Optional[int] = None,
        **kwargs
    ):
        self.model_name = model_name
        self.provider = get_llm_provider(model_name, streaming=True, **kwargs)
        self.memory = ConversationBufferWindowMemory(
            k=memory_size,
            return_messages=True,
            output_key="answer",
        )
        self.user_id = user_id
        
        # Set up the conversation prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt or "You are a helpful AI assistant."),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

    async def call_mcp_plugins(self, user_message: str, conversation_history: List) -> Optional[str]:
        """尝试调用已安装的MCP插件处理用户消息"""
        # 获取已安装的插件
        plugins = get_installed_plugins()
        if not plugins:
            return None
        
        # 准备对话历史
        history = []
        for msg in conversation_history:
            history.append({
                "role": "assistant" if isinstance(msg, AIMessage) else "user",
                "content": msg.content
            })
        
        # 构建请求数据
        request_data = {
            "message": user_message,
            "history": history,
            "model": self.model_name,
            "user_id": self.user_id
        }
        
        # 对每个插件尝试调用
        for plugin in plugins:
            try:
                # 查找插件服务地址
                if "repository" not in plugin or not plugin["repository"]:
                    continue
                
                # 根据plugin类型确定API端点
                plugin_api_url = f"{plugin['repository']}/api/plugin/{plugin['id']}/invoke"
                
                # 发送请求到插件服务
                print(f"调用MCP插件: {plugin['name']} ({plugin_api_url})")
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        plugin_api_url,
                        json=request_data,
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        if result.get("success") and result.get("data"):
                            print(f"MCP插件 {plugin['name']} 处理成功")
                            # 添加MCP插件标记到响应中
                            return f"[由MCP插件 {plugin['name']} 处理] {result['data']}"
                        else:
                            print(f"MCP插件 {plugin['name']} 处理失败: 没有有效的数据返回")
                    else:
                        print(f"MCP插件 {plugin['name']} 调用失败: {response.status_code}")
            
            except Exception as e:
                print(f"调用MCP插件 {plugin['name']} 时出错: {str(e)}")
                continue
        
        # 所有插件都处理失败，返回None
        return None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry_error_callback=lambda retry_state: retry_state.outcome.result()
    )
    async def generate_response(
        self,
        message: str,
    ) -> str:
        """Generate a complete response for the given message"""
        try:
            # 获取对话历史
            history = self.memory.load_memory_variables({})["history"]
            
            # 尝试调用MCP插件处理
            plugin_response = await self.call_mcp_plugins(message, history)
            if plugin_response:
                # 如果插件处理成功，使用插件的响应
                response_text = plugin_response
                
                # 保存到对话历史
                self.memory.save_context(
                    {"input": message},
                    {"answer": response_text}
                )
                
                return response_text
            
            # 如果没有插件处理，使用正常流程
            # Generate messages from prompt
            messages = await self.prompt.ainvoke({
                "history": history,
                "input": message
            })
            
            # Generate response
            response = await self.provider.model.ainvoke(messages)
            response_text = response.content
            
            # Save to memory
            self.memory.save_context(
                {"input": message},
                {"answer": response_text}
            )
            
            return response_text
            
        except Exception as e:
            # Try fallback model if available
            fallback_model = get_fallback_model(self.model_name)
            if fallback_model:
                self.model_name = fallback_model
                self.provider = get_llm_provider(fallback_model)
                return await self.generate_response(message)
            raise e

    async def astream_response(
        self,
        message: str,
    ) -> AsyncGenerator[str, None]:
        """Stream the response for the given message"""
        try:
            # Get conversation history
            history = self.memory.load_memory_variables({})["history"]
            
            # 尝试调用MCP插件处理
            plugin_response = await self.call_mcp_plugins(message, history)
            if plugin_response:
                # 如果插件处理成功，直接返回插件的响应
                yield plugin_response
                
                # 保存到对话历史
                self.memory.save_context(
                    {"input": message},
                    {"answer": plugin_response}
                )
                return
            
            # 如果没有插件处理，使用正常流程
            # Generate messages from prompt
            messages = await self.prompt.ainvoke({
                "history": history,
                "input": message
            })
            
            # Initialize variables for tracking the response
            response_text = ""
            
            # Stream the response directly from the model
            async for chunk in self.provider.model.astream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    delta = chunk.content
                    response_text += delta
                    yield delta
            
            # Save complete response to memory after streaming finishes
            if response_text:
                self.memory.save_context(
                    {"input": message},
                    {"answer": response_text}
                )
            
        except Exception as e:
            print(f"Error in astream_response: {str(e)}")
            # Try fallback model if available
            fallback_model = get_fallback_model(self.model_name)
            if fallback_model:
                print(f"Trying fallback model: {fallback_model}")
                self.model_name = fallback_model
                self.provider = get_llm_provider(fallback_model, streaming=True)
                async for chunk in self.astream_response(message):
                    yield chunk
            else:
                error_msg = f"Error: {str(e)}"
                yield error_msg
                raise e

    def get_conversation_history(self) -> List[Dict]:
        """Get the conversation history from memory"""
        history = self.memory.load_memory_variables({})["history"]
        return [
            {
                "role": "assistant" if isinstance(msg, AIMessage) else "user",
                "content": msg.content
            }
            for msg in history
        ]

    def clear_memory(self):
        """Clear the conversation memory"""
        self.memory.clear() 