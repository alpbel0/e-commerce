from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


@dataclass(frozen=True)
class CurrencyRate:
    base_currency: str
    target_currency: str
    rate: Decimal


def normalize_currency(currency: str) -> str:
    if not currency or not currency.strip():
        raise ValueError("currency is required")
    return currency.strip().upper()


def money_in_usd(amount: Decimal | str | float | int, from_currency: str, rates: dict[tuple[str, str], Decimal]) -> Decimal:
    amount_decimal = Decimal(str(amount))
    source_currency = normalize_currency(from_currency)
    if source_currency == "USD":
        return amount_decimal

    rate = rates.get(("USD", source_currency))
    if rate is None:
        raise ValueError(f"Missing currency rate for USD -> {source_currency}")
    return (amount_decimal / rate).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)


def convert_between(
    amount: Decimal | str | float | int,
    from_currency: str,
    to_currency: str,
    rates: dict[tuple[str, str], Decimal],
) -> Decimal:
    source_currency = normalize_currency(from_currency)
    target_currency = normalize_currency(to_currency)
    amount_decimal = Decimal(str(amount))

    if source_currency == target_currency:
        return amount_decimal.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    usd_amount = money_in_usd(amount_decimal, source_currency, rates)
    if target_currency == "USD":
        return usd_amount

    rate = rates.get(("USD", target_currency))
    if rate is None:
        raise ValueError(f"Missing currency rate for USD -> {target_currency}")
    return (usd_amount * rate).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
