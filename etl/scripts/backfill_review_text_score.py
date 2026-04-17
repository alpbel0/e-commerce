from __future__ import annotations

import re
from config import LOG_DIR
from db import get_connection
from utils import append_run_log

# ─── Sentiment Lexicon ────────────────────────────────────────────────────────
# Scores in [-1.0, 1.0]. 0.0 = neutral/factual/too-short/unclear.
_NEG: dict[str, float] = {
    "terrible": -0.9,
    "horrible": -0.9,
    "awful": -0.9,
    "worst": -0.9,
    "disaster": -0.9,
    "pathetic": -0.9,
    "refund": -0.8,
    "broken": -0.8,
    "defective": -0.8,
    "useless": -0.8,
    "garbage": -0.8,
    "trash": -0.8,
    "crap": -0.7,
    "junk": -0.7,
    "poor": -0.7,
    "bad": -0.6,
    "disappointed": -0.6,
    "waste": -0.6,
    "fail": -0.6,
    "failed": -0.6,
    "overpriced": -0.5,
    "boring": -0.5,
    "annoying": -0.5,
    "frustrating": -0.6,
    "irritating": -0.5,
    "uncomfortable": -0.5,
    "flimsy": -0.5,
    "cheap": -0.5,
    "stopped working": -0.8,
    "died": -0.7,
    "don't buy": -0.8,
    "do not buy": -0.8,
    "avoid": -0.7,
    "waste of money": -0.8,
    "not worth": -0.6,
    "not recommend": -0.6,
    "worse": -0.6,
    "never again": -0.6,
    "returning": -0.6,
    "returned": -0.6,
    "rip off": -0.8,
    "scam": -0.8,
    "fake": -0.7,
    "counterfeit": -0.7,
    "regret": -0.6,
    "hate": -0.8,
    "hated": -0.8,
    "despise": -0.8,
    "disgusting": -0.8,
    "nasty": -0.7,
    "pointless": -0.6,
    "unusable": -0.7,
    "unacceptable": -0.7,
    "misleading": -0.7,
    "as described": -0.1,  # often sarcastic
    "never received": -0.7,
    "never got": -0.7,
    "missing parts": -0.7,
    "doesn't work": -0.7,
    "does not work": -0.7,
    "doesn't fit": -0.5,
    "does not fit": -0.5,
    "fell apart": -0.7,
    "fall apart": -0.7,
    "broke after": -0.7,
    "broke within": -0.7,
    "stopped after": -0.7,
    "useless": -0.8,
}

_POS: dict[str, float] = {
    "excellent": 0.9,
    "perfect": 0.9,
    "amazing": 0.9,
    "outstanding": 0.9,
    "fantastic": 0.9,
    "superb": 0.9,
    "brilliant": 0.9,
    "masterpiece": 0.9,
    "gem": 0.8,
    "exceptional": 0.8,
    "incredible": 0.8,
    "wonderful": 0.8,
    "love": 0.8,
    "loved": 0.8,
    "loves": 0.8,
    "best": 0.8,
    "great": 0.7,
    "good": 0.5,
    "nice": 0.5,
    "well made": 0.6,
    "well-made": 0.6,
    "quality": 0.5,
    "recommend": 0.6,
    "recommended": 0.6,
    "highly recommend": 0.8,
    "highly recommended": 0.8,
    "must have": 0.7,
    "must-buy": 0.7,
    "satisfied": 0.6,
    "pleased": 0.6,
    "happy": 0.6,
    "delighted": 0.7,
    "thrilled": 0.8,
    "enjoyable": 0.6,
    "fun": 0.5,
    "engaging": 0.5,
    "entertaining": 0.5,
    "interesting": 0.5,
    "fascinating": 0.6,
    "informative": 0.5,
    "useful": 0.5,
    "helpful": 0.5,
    "valuable": 0.5,
    "worth": 0.5,
    "worth it": 0.6,
    "worth the money": 0.7,
    "value": 0.5,
    "bargain": 0.5,
    "deal": 0.5,
    "solid": 0.5,
    "sturdy": 0.5,
    "durable": 0.5,
    "comfortable": 0.5,
    "fit well": 0.5,
    "fits well": 0.5,
    "great value": 0.6,
    "five stars": 0.8,
    "5 stars": 0.8,
    "stars": 0.3,   # "gave 5 stars" context
    "accurate": 0.4,
    "as described": 0.4,   # positive when sincere
    "exactly": 0.4,
    "fast": 0.4,
    "quick": 0.4,
    "speedy": 0.4,
    "smooth": 0.4,
    "beautiful": 0.6,
    "gorgeous": 0.7,
    "stunning": 0.7,
    "elegant": 0.5,
    "impressive": 0.6,
    "reliable": 0.5,
    "efficient": 0.5,
    "easy": 0.4,
    "simple": 0.3,
    "intuitive": 0.5,
    "intuitively": 0.4,
    "lovely": 0.6,
    "exceeded": 0.6,
    "exceed": 0.6,
    "surpassed": 0.6,
    "surpass": 0.6,
    "beyond": 0.4,
    "impressed": 0.6,
}

_AMPLIFIERS = {"very": 1.4, "really": 1.3, "extremely": 1.6, "absolutely": 1.5,
               "so": 1.3, "incredibly": 1.5, "particularly": 1.2, "quite": 1.1}
_NEGATORS = {"not", "no", "never", "neither", "nobody", "nothing", "nowhere",
             "hardly", "barely", "scarcely", "doesn't", "doesn", "don", "didn",
             "won", "wouldn", "can", "couldn", "isn", "aren", "wasn", "weren"}

_SHORT_THRESHOLD = 30
_NEUTRAL_REPEAT_RATIO = 0.4  # if same-char ratio > 40% -> likely nonsense


def _score_sentiment(text: str | None) -> float | None:
    """Return a sentiment score in [-1.0, 1.0] or None if unscoreable."""
    if not text or not text.strip():
        return None

    raw = text.strip()
    if len(raw) < _SHORT_THRESHOLD:
        return 0.0

    # Check for gibberish / excessive repetition
    alpha = [c.isalpha() for c in raw]
    if alpha and sum(alpha) / len(alpha) < 0.5:
        return None
    if len(raw) > 3:
        repeat_ratio = sum(1 for i in range(len(raw) - 1) if raw[i] == raw[i + 1]) / (len(raw) - 1)
        if repeat_ratio > _NEUTRAL_REPEAT_RATIO:
            return 0.0

    # Tokenize
    tokens = re.findall(r"\b\w+\b", raw.lower())

    scores: list[float] = []
    negate = False
    amp = 1.0

    for i, token in enumerate(tokens):
        if token in _NEGATORS:
            negate = True
            continue
        if token in _AMPLIFIERS:
            amp = _AMPLIFIERS[token]
            continue

        s: float | None = None
        if token in _POS:
            s = _POS[token]
        elif token in _NEG:
            s = _NEG[token]

        if s is not None:
            # Multi-word phrase detection (look-ahead for bigrams)
            combined = token
            if i + 1 < len(tokens):
                combined = f"{token} {tokens[i + 1]}"
            if combined in _POS:
                s = _POS[combined]
            elif combined in _NEG:
                s = _NEG[combined]

            if negate:
                s = -s
                negate = False

            s = max(-1.0, min(1.0, s * amp))
            scores.append(s)
            amp = 1.0

    if not scores:
        return 0.0

    # Weighted average (recent tokens weighted higher)
    total_w, weighted = 0.0, 0.0
    for i, s in enumerate(scores):
        w = 1.0 + (i / max(len(scores) - 1, 1)) * 0.5
        weighted += s * w
        total_w += w

    result = weighted / total_w
    return max(-1.0, min(1.0, round(result, 4)))


# ─── Main ────────────────────────────────────────────────────────────────────────

def backfill_review_text_scores(batch_size: int = 500) -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM reviews WHERE text_score IS NULL")
            total = cur.fetchone()[0]

            cur.execute("SELECT id, review_text FROM reviews WHERE text_score IS NULL")
            rows = cur.fetchall()

    updated = 0
    skipped = 0

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        updates: list[tuple] = []
        for row in batch:
            review_id, review_text = row
            score = _score_sentiment(review_text)
            if score is None:
                skipped += 1
            else:
                updates.append((score, review_id))

        if updates:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.executemany(
                        "UPDATE reviews SET text_score = %s WHERE id = %s",
                        updates,
                    )
            updated += len(updates)

        # Progress log every 5k
        processed = min(i + batch_size, len(rows))
        if processed % 5000 == 0 or processed == len(rows):
            print(f"  progress: {processed}/{total} ({updated} updated, {skipped} skipped)")

    append_run_log([
        f"phase=5",
        f"step=backfill_review_text_scores",
        f"total_null={total}",
        f"updated={updated}",
        f"skipped={skipped}",
    ])
    return {"total_null": total, "updated": updated, "skipped": skipped}


def main() -> None:
    print("Starting review text_score backfill ...")
    result = backfill_review_text_scores()
    print(
        "BACKFILL COMPLETE: "
        f"total_null={result['total_null']}, "
        f"updated={result['updated']}, "
        f"skipped={result['skipped']}"
    )


if __name__ == "__main__":
    main()