"""Minimal stubs replacing langflow so the backend runs without it installed."""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Data:
    data: dict[str, Any] = field(default_factory=dict)


class Component:
    display_name: str = ""
    description: str = ""
    icon: str = ""
    inputs: list = []
    outputs: list = []


def _noop(**kwargs):
    return None


IntInput = _noop
MessageTextInput = _noop
DataInput = _noop
Output = _noop
