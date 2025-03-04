from typing import Dict, Optional, Type
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from pydantic_settings import BaseSettings
from functools import lru_cache
from pydantic import ConfigDict


class Settings(BaseSettings):
    GOOGLE_API_KEY: str
    OPENAI_API_KEY: str
    NVIDIA_API_KEY: str
    NVIDIA_API_BASE: str = "https://api.nvidia.com/v1/llm"

    model_config = ConfigDict(
        env_file=".env",
        extra="allow"  # Allow extra fields
    )


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()


class LLMProvider:
    """Base class for LLM providers"""
    def __init__(self, model_name: str, **kwargs):
        self.model_name = model_name
        self.kwargs = kwargs
        self._model: Optional[BaseChatModel] = None

    @property
    def model(self) -> BaseChatModel:
        if self._model is None:
            self._model = self._create_model()
        return self._model

    def _create_model(self) -> BaseChatModel:
        raise NotImplementedError


class GeminiProvider(LLMProvider):
    def _create_model(self) -> BaseChatModel:
        return ChatGoogleGenerativeAI(
            model_name=self.model_name,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=self.kwargs.get("temperature", 0.7),
            top_p=self.kwargs.get("top_p", 0.95),
            streaming=True,
            convert_system_message_to_human=True,
            max_output_tokens=2048,
        )


class OpenAIProvider(LLMProvider):
    def _create_model(self) -> BaseChatModel:
        return ChatOpenAI(
            model_name=self.model_name,
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=self.kwargs.get("temperature", 0.7),
            streaming=True,
        )


class NvidiaProvider(LLMProvider):
    def _create_model(self) -> BaseChatModel:
        return ChatNVIDIA(
            model_name=self.model_name,
            nvidia_api_key=settings.NVIDIA_API_KEY,
            nvidia_api_base=settings.NVIDIA_API_BASE,
            temperature=self.kwargs.get("temperature", 0.7),
            streaming=True,
        )


MODEL_CONFIGS = {
    "gemini-pro": {
        "provider_class": GeminiProvider,
        "provider": "Google",
        "name": "Gemini Pro",
        "model_name": "gemini-pro",
        "fallback": None,
    },
    "gpt-4": {
        "provider_class": OpenAIProvider,
        "provider": "OpenAI",
        "name": "GPT-4o Mini",
        "model_name": "gpt-4o-mini",
        "fallback": None,
    },
    "deepseek-ai/deepseek-r1": {
        "provider_class": NvidiaProvider,
        "provider": "NVIDIA",
        "name": "Deepseek",
        "model_name": "deepseek-ai/deepseek-r1",
        "description": "Deepseek R1 is an advanced large language model developed by Deepseek and available through NVIDIA AI Endpoints.",
        "fallback": None,
    },
}


def get_llm_provider(model_name: str, **kwargs) -> LLMProvider:
    """Factory function to create LLM provider instances"""
    # Check for empty model name
    if not model_name or model_name.strip() == "":
        # Get first available model as default
        default_model = next(iter(MODEL_CONFIGS.keys()), None)
        if not default_model:
            raise ValueError("No models configured and empty model name provided")
        print(f"Empty model name provided, using default: {default_model}")
        model_name = default_model
    
    config = MODEL_CONFIGS.get(model_name)
    if not config:
        # Get first available model as fallback
        default_model = next(iter(MODEL_CONFIGS.keys()), None)
        if default_model:
            print(f"Unsupported model: {model_name}, falling back to {default_model}")
            config = MODEL_CONFIGS.get(default_model)
        
        if not config:
            available_models = ", ".join(MODEL_CONFIGS.keys())
            raise ValueError(f"Unsupported model: {model_name}. Available models: {available_models}")
    
    provider_class = config["provider_class"]
    return provider_class(config["model_name"], **kwargs)


def get_fallback_model(model_name: str) -> Optional[str]:
    """Get fallback model name for a given model"""
    config = MODEL_CONFIGS.get(model_name)
    return config["fallback"] if config else None 