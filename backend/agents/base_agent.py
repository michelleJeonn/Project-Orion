"""Base agent with shared Claude API access and logging."""
from abc import ABC, abstractmethod
from typing import Any, Optional

import anthropic

from backend.config import settings
from backend.utils.logger import get_logger


class BaseAgent(ABC):
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model
        self.logger = get_logger(self.__class__.__name__)

    async def ask_claude(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        """Send a prompt to Claude and return the text response."""
        message = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    async def ask_claude_json(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 4096,
    ) -> Any:
        """Ask Claude and parse JSON from its response."""
        import json
        import re

        response = await self.ask_claude(
            system=system + "\n\nYou MUST respond with valid JSON only. No markdown, no explanation.",
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=0.1,
        )
        # Strip markdown code fences if present
        cleaned = re.sub(r"```(?:json)?\s*", "", response).strip().rstrip("`").strip()
        return json.loads(cleaned)
