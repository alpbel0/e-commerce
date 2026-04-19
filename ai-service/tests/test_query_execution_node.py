"""Tests for query execution node parameter defaults."""

from datetime import date

from app.graph.nodes.query_execution_node import _default_end_date, _default_start_date


def test_default_date_range_uses_current_date_context():
    assert _default_start_date("2026-04-18") == date(2026, 3, 19)
    assert _default_end_date("2026-04-18") == date(2026, 4, 19)


def test_default_date_range_handles_invalid_current_date():
    assert isinstance(_default_start_date("bad-date"), date)
    assert isinstance(_default_end_date("bad-date"), date)
