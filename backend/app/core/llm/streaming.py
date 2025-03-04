from typing import Any, Dict, List, Optional, AsyncGenerator
from asyncio import Queue
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult

from app.schemas.conversation import StreamResponse


class StreamingCallbackHandler(AsyncCallbackHandler):
    """Callback handler for streaming LLM responses"""
    
    def __init__(self):
        self.queue: Queue[str] = Queue()
        self.done = False
        self.tokens: List[str] = []
        self.error: Optional[str] = None

    async def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Run when LLM starts running"""
        self.done = False
        self.tokens = []

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Run on new token"""
        if token:
            await self.queue.put(token)

    async def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Run when LLM ends running"""
        self.done = True

    async def on_llm_error(self, error: Exception, **kwargs: Any) -> None:
        """Run when LLM errors"""
        self.error = str(error)
        self.done = True
        await self.queue.put(f"Error: {str(error)}")

    async def aiter(self) -> AsyncGenerator[str, None]:
        """Async iterator for tokens"""
        try:
            while not self.done or not self.queue.empty():
                token = await self.queue.get()
                yield token
                if self.done and self.queue.empty():
                    break
                if self.error:
                    raise Exception(self.error)
        except Exception as e:
            self.error = str(e)
            raise

    def get_accumulated_response(self) -> str:
        """Get the complete accumulated response"""
        return "".join(self.tokens) 