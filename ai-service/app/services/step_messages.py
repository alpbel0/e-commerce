"""Standardized step message formatters for execution steps.

Ensures consistent user-facing messages across all nodes while
separating internal debug information.
"""

from typing import Optional


# === User-facing message templates ===

STEP_MESSAGES = {
    "GUARDRAILS": {
        "pending": "Guvenlik ve kapsam kontrolu yapiliyor...",
        "running": "Soru guvenlik acisindan inceleniyor.",
        "completed": "Soru kapsam ve guvenlik acisindan incelendi.",
        "failed": "Guvenlik kontrolu tamamlanamadi.",
        "skipped": "Guvenlik kontrolu atlandi.",
    },
    "SCHEMA_CONTEXT": {
        "pending": "Sema bilgileri yukleniyor...",
        "running": "Veritabani semasi hazirlaniyor.",
        "completed": "Veritabani semasi hazirlandi ({table_count} tablo).",
        "failed": "Sema bilgileri yuklenemedi.",
        "skipped": "Sema bilgileri gerektirmedigi icin atlandi.",
    },
    "SQL_GENERATION": {
        "pending": "SQL sorgusu olusturuluyor...",
        "running": "Sorgu olusturuluyor, lutfen bekleyin.",
        "completed": "SQL sorgusu olusturuldu.",
        "failed": "SQL sorgusu olusturulamadi.",
        "skipped": "SQL uretimi gerektirmedigi icin atlandi.",
    },
    "SQL_VALIDATION": {
        "pending": "SQL guvenlik kontrolu yapiliyor...",
        "running": "SQL guvenlik kurallarina gore kontrol ediliyor.",
        "completed": "SQL guvenlik kontrolunden gecti.{defaults}",
        "failed": "SQL guvenlik kontrolunden gecmedi: {error}",
        "skipped": "SQL validasyonu atlandi.",
    },
    "QUERY_EXECUTION": {
        "pending": "Sorgu calistiriliyor...",
        "running": "Sorgu veritabaninda calistiriliyor.",
        "completed": "Sorgu basariyla calistirildi ({row_count} satir dondu).",
        "failed": "Sorgu calistirilamadi: {error}",
        "skipped": "Sorgu calistirmasi atlandi.",
    },
    "ERROR_REPAIR": {
        "pending": "Sorgu duzeltiliyor...",
        "running": "Onceki hata duzeltiliyor (deneme {attempt}/{max}).",
        "completed": "Sorgu basariyla duzeltildi.",
        "failed": "Sorgu duzeltilemedi (en fazla {max} deneme yapildi).",
        "skipped": "Hata duzeltme atlandi.",
    },
    "ANALYSIS": {
        "pending": "Sonuclar analiz ediliyor...",
        "running": "Veriler analiz ediliyor.",
        "completed": "Sonuclar analiz edildi ve yanit olusturuldu.",
        "failed": "Analiz tamamlanamadi.",
        "skipped": "Analiz atlandi.",
    },
    "VISUALIZATION": {
        "pending": "Grafik hazirlaniyor...",
        "running": "Gorsel grafik hazirlaniyor.",
        "completed": "Grafik olusturuldu: {chart_type}.",
        "failed": "Grafik olusturulamadi.",
        "skipped": "Grafik gerekli gorulmedi.",
    },
}


def get_user_message(step_name: str, status: str, **kwargs) -> str:
    """
    Get standardized user-facing message for a step.

    Args:
        step_name: ExecutionStepName value
        status: Current status (pending/running/completed/failed/skipped)
        **kwargs: Format arguments for the message template

    Returns:
        Localized user-facing message string
    """
    templates = STEP_MESSAGES.get(step_name, {})
    template = templates.get(status, templates.get("completed", ""))

    if kwargs:
        try:
            return template.format(**kwargs)
        except KeyError:
            return template
    return template


def create_step(
    name: str,
    status: str,
    user_message: str = "",
    debug_message: Optional[str] = None,
) -> dict:
    """
    Create a standardized execution step dict.

    Args:
        name: Step name (ExecutionStepName value)
        status: Current status
        user_message: User-facing message (uses template if empty)
        debug_message: Internal debug message (not exposed to users)

    Returns:
        Dict suitable for appending to execution_steps
    """
    # Use template if no custom user message provided
    if not user_message:
        user_message = get_user_message(name, status)

    return {
        "name": name,
        "status": status,
        "message": user_message,
        "debug_message": debug_message,
    }


def start_step(name: str, debug_context: str = "") -> dict:
    """
    Create a RUNNING step entry when a step begins.

    Args:
        name: Step name
        debug_context: Internal context about what's starting

    Returns:
        Dict with status=running
    """
    return create_step(
        name=name,
        status="running",
        user_message=get_user_message(name, "running"),
        debug_message=f"Started: {debug_context}" if debug_context else None,
    )


def complete_step(
    name: str,
    user_message: str = "",
    debug_context: str = "",
    **format_kwargs
) -> dict:
    """
    Create a COMPLETED step entry.

    Args:
        name: Step name
        user_message: Custom user message (uses template if empty)
        debug_context: Internal debug info
        **format_kwargs: Arguments for message template formatting

    Returns:
        Dict with status=completed
    """
    if not user_message:
        user_message = get_user_message(name, "completed", **format_kwargs)

    return create_step(
        name=name,
        status="completed",
        user_message=user_message,
        debug_message=debug_context if debug_context else None,
    )


def fail_step(
    name: str,
    error: str,
    user_message: str = "",
    debug_context: str = "",
) -> dict:
    """
    Create a FAILED step entry.

    Args:
        name: Step name
        error: Error description
        user_message: Custom user message (uses template if empty)
        debug_context: Internal debug info

    Returns:
        Dict with status=failed
    """
    if not user_message:
        user_message = get_user_message(name, "failed", error=error[:100])

    return create_step(
        name=name,
        status="failed",
        user_message=user_message,
        debug_message=f"Failed: {error}. Debug: {debug_context}" if debug_context else f"Failed: {error}",
    )


def skip_step(name: str, reason: str = "") -> dict:
    """
    Create a SKIPPED step entry.

    Args:
        name: Step name
        reason: Reason for skipping

    Returns:
        Dict with status=skipped
    """
    return create_step(
        name=name,
        status="skipped",
        user_message=get_user_message(name, "skipped"),
        debug_message=f"Skipped: {reason}" if reason else None,
    )
