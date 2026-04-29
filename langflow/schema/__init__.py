from dataclasses import dataclass, field
from typing import Any


@dataclass
class Data:
    data: dict[str, Any] = field(default_factory=dict)
