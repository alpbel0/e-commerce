from __future__ import annotations

import json
import os
import re
import sys
import time
from dataclasses import dataclass

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from etl.scripts.db import get_connection
from etl.scripts.utils import append_run_log

API_KEY = "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"
BASE_URL = "https://openrouter.ai/api/v1"

MODELS = [
    "google/gemma-3-27b-it:free",
    "google/gemma-3n-e2b-it:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-3-27b-it:free",
    "google/gemma-3-4b-it:free",
    "google/gemma-3n-e4b-it:free",
    "google/gemma-3n-e2b-it:free",
    "google/gemma-3-12b-it:free",
]

RETRY_DELAY = 25
REQUEST_DELAY = 1.0  # delay between requests (not retries)

OUT_DIR = os.path.join(os.path.dirname(__file__), "../../etl/logs")
os.makedirs(OUT_DIR, exist_ok=True)


def _call_model(model: str, review_text: str) -> tuple[float | None, str | None]:
    """Returns (score, error_msg). Both None = hard failure."""
    prompt = f"""You are a deterministic sentiment scoring engine for e-commerce review text.

Task:
Read the review text and assign a single sentiment score in the range [-1.0, 1.0].

Constraints:
- Use only the review text.
- Ignore star rating and all other fields.
- If the review is too short, vague, unclear, or mostly factual, return a score near 0.
- Do not exaggerate weak sentiment.
- Return JSON only, with no explanation.

Score rubric:
- -1.0 = extremely negative
- -0.5 = clearly negative
- 0.0 = neutral, mixed, or factual
- 0.5 = clearly positive
- 1.0 = extremely positive

Examples:
- "Terrible product, stopped working in one day" -> -0.9
- "It is okay, not bad, not great" -> 0.0
- "Excellent quality, highly recommended" -> 0.9

Required output:
{{"text_score": <number between -1.0 and 1.0>}}

Review:
{review_text}"""

    try:
        with httpx.Client(timeout=httpx.Timeout(60.0)) as client:
            response = client.post(
                f"{BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://ecommerce.local",
                    "X-Title": "ReviewTextScore",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 64,
                    "temperature": 0.0,
                },
            )

        if response.status_code == 429:
            return None, "rate_limited"

        if response.status_code != 200:
            return None, f"http_{response.status_code}"

        data = response.json()
        if "choices" not in data:
            return None, f"no_choices: {str(data)[:100]}"

        content = data["choices"][0]["message"]["content"].strip()
        match = re.search(r"\{[^}]+\}", content)
        if not match:
            return None, f"no_json: {content[:80]}"

        score = float(json.loads(match.group())["text_score"])
        return max(-1.0, min(1.0, score)), None

    except Exception as e:
        return None, f"exception: {e}"


def _score_with_fallback(review_text: str) -> float | None:
    """Try all models in order; return first successful score or None."""
    for model in MODELS:
        score, err = _call_model(model, review_text)
        if score is not None:
            return score
        if err == "rate_limited":
            time.sleep(RETRY_DELAY)
        else:
            time.sleep(2)  # other errors — short pause before next model
    return None


def main() -> None:
    print("Fetching reviews without text_score...")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, review_text FROM reviews WHERE text_score IS NULL")
            rows = cur.fetchall()

    total = len(rows)
    print(f"Total: {total} reviews to score")
    print(f"Models: {MODELS}\n")

    updated = 0
    failed = 0

    for i, (review_id, review_text) in enumerate(rows):
        print(f"[{i+1}/{total}] ", end="", flush=True)

        score = _score_with_fallback(review_text)

        if score is not None:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE reviews SET text_score = %s WHERE id = %s",
                        (score, review_id),
                    )
            updated += 1
            print(f"text_score={score:.4f}")
        else:
            failed += 1
            print("FAILED — all models exhausted")

        # Progress checkpoint
        if (i + 1) % 100 == 0:
            print(f"\n  Progress: {i+1}/{total} | updated={updated} | failed={failed}\n")

        time.sleep(REQUEST_DELAY)

    print(f"\nDONE: updated={updated}, failed={failed}")
    append_run_log([
        f"phase=5",
        f"step=score_reviews_llm",
        f"models={','.join(MODELS)}",
        f"total={total}",
        f"updated={updated}",
        f"failed={failed}",
    ])


if __name__ == "__main__":
    main()
