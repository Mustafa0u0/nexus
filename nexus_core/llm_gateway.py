"""
NEXUS Async LLM Gateway
=======================
Handles asynchronous interactions with Groq API, including:
- Key Rotation (Round-Robin)
- Robust Retry Logic (Exponential Backoff)
- Structured Output Parsing (Pydantic Integration)
"""

import os
import json
import random
import logging
from typing import List, Optional, Type, TypeVar, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

from groq import AsyncGroq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from pydantic import BaseModel, ValidationError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

T = TypeVar("T", bound=BaseModel)

class AsyncLLMGateway:
    """
    Gateway for asynchronous LLM interactions with failover and key rotation.
    """

    def __init__(self):
        self.api_keys: List[str] = self._load_api_keys()
        if not self.api_keys:
            logger.critical("No GROQ_API_KEY found! Please set GROQ_API_KEY in .env")
            raise ValueError("No GROQ_API_KEY found")

        self.clients: List[AsyncGroq] = [AsyncGroq(api_key=k) for k in self.api_keys]
        self.current_client_idx = 0

        # Models configuration
        self.primary_model = os.getenv("NEXUS_PRIMARY_MODEL", "llama-3.1-8b-instant")
        self.fast_text_model = os.getenv("NEXUS_FAST_TEXT_MODEL", self.primary_model)
        self.structured_model = os.getenv("NEXUS_STRUCTURED_MODEL", "llama-3.3-70b-versatile")
        self.fallback_models = [
            "qwen-2.5-32b",      # Strong reasoning alternative
            "llama-3.3-70b-versatile" # High-quality fallback
        ]

        logger.info(f"✅ LLM Gateway initialized with {len(self.clients)} API keys")

    def _load_api_keys(self) -> List[str]:
        """Load API keys from environment variables and .env file."""
        keys = []

        # Check standard environment variables
        env_vars = ["GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEY_3"]
        for var_name in env_vars:
            key = os.getenv(var_name)
            if key and key not in keys:
                keys.append(key)

        # Fallback: check manually loaded .env if needed (though dotenv handles it)
        if not keys:
            # try finding in a local .env file manually if python-dotenv failed
            env_path = Path(".env")
            if env_path.exists():
                with open(env_path, "r") as f:
                    for line in f:
                        if line.startswith("GROQ_API_KEY"):
                            parts = line.strip().split("=", 1)
                            if len(parts) == 2:
                                key = parts[1].strip().strip('"').strip("'")
                                if key and key not in keys:
                                    keys.append(key)

        return keys

    def _get_client(self) -> AsyncGroq:
        """Get the next client in rotation."""
        client = self.clients[self.current_client_idx]
        # Rotate for next call
        self.current_client_idx = (self.current_client_idx + 1) % len(self.clients)
        return client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception)
    )
    async def _call_api_raw(self, messages: List[Dict[str, str]], model: str, temperature: float = 0.7, max_tokens: int = 1024) -> str:
        """
        Raw API call with retry logic.
        """
        client = self._get_client()
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"API Call Failed ({model}): {str(e)}")
            # If rate limited, force rotate to next key immediately
            if "429" in str(e):
                logger.warning("Rate limit hit, rotating key immediately.")
                self.current_client_idx = (self.current_client_idx + 1) % len(self.clients)
            raise e

    async def generate_text(self, system_prompt: str, user_prompt: str, temperature: float = 0.7, max_tokens: int = 256) -> str:
        """
        Generate raw text response.
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        # Try primary model first
        try:
            return await self._call_api_raw(messages, self.fast_text_model, temperature, max_tokens=max_tokens)
        except Exception:
            # Fallback cascade
            for model in self.fallback_models:
                try:
                    logger.warning(f"Falling back to model: {model}")
                    return await self._call_api_raw(messages, model, temperature, max_tokens=max_tokens)
                except Exception:
                    continue
            raise RuntimeError("All models failed.")

    async def generate_structured(self, system_prompt: str, user_prompt: str, response_model: Type[T], max_tokens: int = 1024) -> T:
        """
        Generate a structured JSON response and validate it against a Pydantic model.
        """
        schema = response_model.model_json_schema()

        # Enhance system prompt with schema instruction
        enhanced_system_prompt = f"""{system_prompt}

You must return a valid JSON object that strictly adheres to this schema:
{json.dumps(schema, indent=2)}

Return ONLY the JSON object. Do not wrap it in markdown code blocks.
"""

        # Structured outputs are more reliable with a higher-capacity model.
        raw_response = await self._call_api_raw(
            messages=[
                {"role": "system", "content": enhanced_system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=self.structured_model,
            temperature=0.2,
            max_tokens=max_tokens,
        )

        # Clean up response (sometimes LLMs still wrap in ```json ... ```)
        cleaned_response = raw_response.strip()
        if cleaned_response.startswith("```"):
            cleaned_response = cleaned_response.strip("`").replace("json\n", "").replace("json", "")

        def _extract_json(text: str) -> str:
            if "{" in text and "}" in text:
                first = text.find("{")
                last = text.rfind("}")
                return text[first:last + 1]
            return text

        def _strict_prompt() -> str:
            return f"""{system_prompt}

Return ONLY a valid JSON object that matches the schema exactly.
Do not include any extra text, markdown, or commentary.

Schema:
{json.dumps(schema, indent=2)}
"""

        try:
            cleaned_response = _extract_json(cleaned_response)
            data = json.loads(cleaned_response)
            return response_model.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Failed to parse structured output: {e}")
            logger.debug(f"Raw response: {raw_response}")

        # Retry with strict prompt on structured model
        strict_prompt = _strict_prompt()
        retry_response = await self._call_api_raw(
            messages=[
                {"role": "system", "content": strict_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=self.structured_model,
            temperature=0.1,
            max_tokens=max_tokens,
        )
        retry_cleaned = _extract_json(retry_response.strip())
        try:
            data = json.loads(retry_cleaned)
            return response_model.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e2:
            logger.error(f"Retry failed to parse structured output: {e2}")
            logger.debug(f"Retry response: {retry_response}")

        # Final fallback: try strict prompt with fallback models
        for model in self.fallback_models:
            if model == self.structured_model:
                continue
            try:
                fallback_response = await self._call_api_raw(
                    messages=[
                        {"role": "system", "content": strict_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    model=model,
                    temperature=0.1,
                    max_tokens=max_tokens,
                )
                fallback_cleaned = _extract_json(fallback_response.strip())
                data = json.loads(fallback_cleaned)
                return response_model.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as e3:
                logger.warning(f"Structured parse failed on fallback {model}: {e3}")
                logger.debug(f"Fallback response ({model}): {fallback_response}")

        raise ValueError(f"LLM failed to generate valid JSON for {response_model.__name__}")

# Global Gateway Instance
llm_gateway = AsyncLLMGateway()
