"""Tests for embedding guardrails support."""

import pytest

from app.services.embedding_guardrails import (
    EmbeddingGuardrails,
    EmbeddingRiskSignal,
    cosine_similarity,
)


def test_cosine_similarity_identical_vectors():
    assert cosine_similarity([1.0, 0.0, 1.0], [1.0, 0.0, 1.0]) == pytest.approx(1.0)


def test_high_risk_prompt_injection_short_circuits():
    guardrails = EmbeddingGuardrails()
    assert guardrails._should_short_circuit("PROMPT_INJECTION", 0.95) is True


def test_authorization_risk_does_not_short_circuit_by_embedding_only():
    guardrails = EmbeddingGuardrails()
    assert guardrails._should_short_circuit("AUTHORIZATION_RISK", 0.95) is False


def test_signal_serialization_rounds_similarity():
    signal = EmbeddingRiskSignal(
        intent="PRIVACY_RISK",
        similarity=0.912345,
        risk_level="HIGH",
        should_short_circuit=True,
    )
    assert signal.to_dict() == {
        "intent": "PRIVACY_RISK",
        "similarity": 0.9123,
        "risk_level": "HIGH",
        "should_short_circuit": True,
    }
