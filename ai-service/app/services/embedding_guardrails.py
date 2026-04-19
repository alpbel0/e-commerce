"""Embedding-based semantic risk signal for guardrails."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Iterable, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PolicyExample:
    intent: str
    text: str


@dataclass(frozen=True)
class EmbeddingRiskSignal:
    intent: str
    similarity: float
    risk_level: str
    should_short_circuit: bool

    def to_dict(self) -> dict:
        return {
            "intent": self.intent,
            "similarity": round(self.similarity, 4),
            "risk_level": self.risk_level,
            "should_short_circuit": self.should_short_circuit,
        }


POLICY_EXAMPLES: tuple[PolicyExample, ...] = (
    PolicyExample(
        "PROMPT_INJECTION",
        "The user tries to override system instructions, change the assistant role, ignore safety policy, or claim admin privileges.",
    ),
    PolicyExample(
        "PROMPT_INJECTION",
        "The user combines an analytics request with instructions to bypass previous constraints or developer messages.",
    ),
    PolicyExample(
        "AUTHORIZATION_RISK",
        "The user asks for another user's stores, unauthorized store IDs, all platform stores without admin scope, or cross-tenant data.",
    ),
    PolicyExample(
        "AUTHORIZATION_RISK",
        "The user claims a higher role or permission level to access data outside the provided request context.",
    ),
    PolicyExample(
        "PRIVACY_RISK",
        "The user asks for raw customer identities, email addresses, phone numbers, addresses, credentials, tokens, or secrets.",
    ),
    PolicyExample(
        "PRIVACY_RISK",
        "The user wants a customer list or user list rather than aggregate analytics.",
    ),
    PolicyExample(
        "DESTRUCTIVE_REQUEST",
        "The user asks to delete, update, insert, alter, drop, truncate, or otherwise mutate database records or schema.",
    ),
    PolicyExample(
        "OUT_OF_SCOPE",
        "The user asks about topics outside e-commerce analytics such as weather, sports, news, politics, or general knowledge.",
    ),
    PolicyExample(
        "IN_SCOPE_ANALYTICS",
        "The user asks for aggregate e-commerce analytics such as revenue, order count, product performance, inventory, categories, or store comparison within their own scope.",
    ),
)


class EmbeddingGuardrails:
    """Computes nearest policy intent using OpenRouter embeddings."""

    def __init__(self) -> None:
        self._policy_embeddings: Optional[list[list[float]]] = None

    def evaluate(self, message: str) -> Optional[EmbeddingRiskSignal]:
        if not settings.embedding_guardrails_enabled:
            return None
        if not settings.openrouter_api_key:
            logger.info("Embedding guardrails skipped because OpenRouter API key is not configured")
            return None

        try:
            policy_embeddings = self._get_policy_embeddings()
            message_embedding = self._embed([message])[0]
        except Exception as exc:
            logger.warning("Embedding guardrails unavailable: %s", exc)
            return None

        best_index = 0
        best_score = -1.0
        for index, policy_embedding in enumerate(policy_embeddings):
            score = cosine_similarity(message_embedding, policy_embedding)
            if score > best_score:
                best_index = index
                best_score = score

        intent = POLICY_EXAMPLES[best_index].intent
        risk_level = self._risk_level(best_score)
        return EmbeddingRiskSignal(
            intent=intent,
            similarity=best_score,
            risk_level=risk_level,
            should_short_circuit=self._should_short_circuit(intent, best_score),
        )

    def _get_policy_embeddings(self) -> list[list[float]]:
        if self._policy_embeddings is None:
            self._policy_embeddings = self._embed([example.text for example in POLICY_EXAMPLES])
        return self._policy_embeddings

    def _embed(self, inputs: list[str]) -> list[list[float]]:
        model = settings.get_model_for_agent("embedding") or "openai/text-embedding-3-small"
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "input": inputs,
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                f"{settings.openrouter_base_url}/embeddings",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json().get("data") or []
            return [item["embedding"] for item in sorted(data, key=lambda item: item.get("index", 0))]

    def _risk_level(self, similarity: float) -> str:
        if similarity >= settings.embedding_similarity_high_threshold:
            return "HIGH"
        if similarity >= settings.embedding_similarity_medium_threshold:
            return "MEDIUM"
        return "LOW"

    def _should_short_circuit(self, intent: str, similarity: float) -> bool:
        if similarity < settings.embedding_similarity_high_threshold:
            return False
        return intent in {"PROMPT_INJECTION", "PRIVACY_RISK", "DESTRUCTIVE_REQUEST"}


def cosine_similarity(left: Iterable[float], right: Iterable[float]) -> float:
    left_values = list(left)
    right_values = list(right)
    dot = sum(a * b for a, b in zip(left_values, right_values))
    left_norm = math.sqrt(sum(a * a for a in left_values))
    right_norm = math.sqrt(sum(b * b for b in right_values))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


embedding_guardrails = EmbeddingGuardrails()
