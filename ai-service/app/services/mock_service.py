"""Mock response generator for the Phase 2 chat endpoint."""

from app.schemas.chat import (
    ChatResponse,
    ErrorCode,
    ErrorResponse,
    ExecutionStepName,
    ExecutionStepResponse,
    ExecutionStepStatus,
    RoleType,
    TableResponse,
    TechnicalResponse,
    VisualizationResponse,
)


class MockService:
    """Generates contract-compatible mock responses for different roles."""

    def generate_response(
        self,
        request_id: str,
        message: str,
        role: RoleType,
        allowed_stores: list[str] | None = None,
    ) -> ChatResponse:
        message_lower = message.lower()

        if self._is_greeting(message_lower):
            return self._greeting(request_id)
        if self._is_privacy_risk(message_lower):
            return self._rejection(
                request_id,
                ErrorCode.PRIVACY_RISK,
                "Musteri iletisim bilgilerini listeleyemem. Musteri sayisi, sehir dagilimi veya segment analizi gibi aggregate bilgiler sunabilirim.",
            )
        if self._is_destructive(message_lower):
            return self._rejection(
                request_id,
                ErrorCode.DESTRUCTIVE_REQUEST,
                "Bu sistem yalnizca guvenli analytics sorgularini destekler. Yikici veritabani islemleri calistirilamaz.",
            )
        if self._is_out_of_scope(message_lower):
            return self._rejection(
                request_id,
                ErrorCode.OUT_OF_SCOPE,
                "Bu soru e-commerce analytics kapsami disinda. Satis, urun, magaza, siparis veya harcama analizleri hakkinda yardimci olabilirim.",
            )

        if role == RoleType.INDIVIDUAL:
            return self._individual_response(request_id)
        if role == RoleType.CORPORATE:
            return self._corporate_response(request_id, message_lower, allowed_stores or [])
        return self._admin_response(request_id)

    def _steps(self, sql_steps: bool = True) -> list[ExecutionStepResponse]:
        completed = ExecutionStepStatus.COMPLETED
        skipped = ExecutionStepStatus.SKIPPED
        return [
            ExecutionStepResponse(name=ExecutionStepName.GUARDRAILS, status=completed, message="Soru kapsam ve guvenlik acisindan incelendi.", debug_message="Mock: guardrails passed"),
            ExecutionStepResponse(name=ExecutionStepName.SCHEMA_CONTEXT, status=completed if sql_steps else skipped, message="Schema context hazirlandi." if sql_steps else "SQL gerektirmedigi icin atlandi.", debug_message="Mock: 12 tables loaded" if sql_steps else None),
            ExecutionStepResponse(name=ExecutionStepName.SQL_GENERATION, status=completed if sql_steps else skipped, message="SQL sorgusu olusturuldu." if sql_steps else "SQL uretimi atlandi.", debug_message="Mock: SELECT query generated" if sql_steps else None),
            ExecutionStepResponse(name=ExecutionStepName.SQL_VALIDATION, status=completed if sql_steps else skipped, message="SQL guvenlik kontrolunden gecti." if sql_steps else "SQL validasyonu atlandi.", debug_message="Mock: validation passed" if sql_steps else None),
            ExecutionStepResponse(name=ExecutionStepName.QUERY_EXECUTION, status=completed if sql_steps else skipped, message="Sorgu calistirildi." if sql_steps else "Query execution atlandi.", debug_message="Mock: 5 rows returned" if sql_steps else None),
            ExecutionStepResponse(name=ExecutionStepName.ANALYSIS, status=completed, message="Sonuc dogal dille ozetlendi.", debug_message="Mock: analysis complete"),
            ExecutionStepResponse(name=ExecutionStepName.VISUALIZATION, status=completed if sql_steps else skipped, message="Grafik ihtiyaci degerlendirildi." if sql_steps else "Grafik uretilmedi.", debug_message="Mock: bar chart generated" if sql_steps else None),
        ]

    def _table(self) -> TableResponse:
        return TableResponse(
            columns=["product_name", "quantity", "revenue"],
            rows=[
                ["Laptop Pro X", 45, 472500],
                ["Wireless Mouse", 120, 36000],
                ["USB-C Hub", 89, 26700],
                ["Mechanical Keyboard", 67, 53600],
                ["Monitor 27", 34, 102000],
            ],
            row_count=5,
        )

    def _visualization(self, chart_type: str = "bar") -> VisualizationResponse:
        return VisualizationResponse(
            type=chart_type,
            data={
                "data": [
                    {
                        "type": chart_type,
                        "x": ["Laptop Pro X", "Wireless Mouse", "USB-C Hub", "Keyboard", "Monitor"],
                        "y": [472500, 36000, 26700, 53600, 102000],
                    }
                ],
                "layout": {"title": "Son 30 Gun Satis Ozeti"},
            },
        )

    def _individual_response(self, request_id: str) -> ChatResponse:
        return ChatResponse(
            request_id=request_id,
            answer="Son 30 gunde kategori bazinda toplam harcamaniz 19.100 TL. En yuksek harcama elektronik kategorisinde.",
            language="tr",
            execution_steps=self._steps(),
            table=TableResponse(
                columns=["category", "spending"],
                rows=[["Elektronik", 15450], ["Giyim", 3200], ["Kitap", 450]],
                row_count=3,
            ),
            visualization=self._visualization("bar"),
            technical=TechnicalResponse(
                sql_summary="Personal spending grouped by category for last 30 days.",
                row_count=3,
                execution_ms=120,
            ),
        )

    def _corporate_response(self, request_id: str, message_lower: str, allowed_stores: list[str]) -> ChatResponse:
        store_name = next((store for store in allowed_stores if store.lower() in message_lower), "tum magazalariniz")
        return ChatResponse(
            request_id=request_id,
            answer=f"{store_name} icin son 30 gunde toplam ciro 2.345.600 TL. En cok satan urun Laptop Pro X oldu.",
            language="tr",
            execution_steps=self._steps(),
            table=self._table(),
            visualization=self._visualization("bar"),
            technical=TechnicalResponse(
                sql_summary="Top products by revenue scoped to allowed store IDs.",
                row_count=5,
                execution_ms=180,
            ),
        )

    def _admin_response(self, request_id: str) -> ChatResponse:
        return ChatResponse(
            request_id=request_id,
            answer="Platform genelinde son 30 gunde 45.670 siparis ve 12.890.450 TL ciro olustu.",
            language="tr",
            execution_steps=self._steps(),
            table=TableResponse(
                columns=["metric", "value"],
                rows=[["orders", 45670], ["revenue", 12890450], ["active_stores", 15]],
                row_count=3,
            ),
            visualization=self._visualization("line"),
            technical=TechnicalResponse(
                sql_summary="Platform-wide KPI summary for last 30 days.",
                row_count=3,
                execution_ms=210,
            ),
        )

    def _greeting(self, request_id: str) -> ChatResponse:
        return ChatResponse(
            request_id=request_id,
            answer="Merhaba. E-commerce analytics sorularinizda yardimci olabilirim.",
            language="tr",
            execution_steps=self._steps(sql_steps=False),
        )

    def _rejection(self, request_id: str, code: ErrorCode, answer: str) -> ChatResponse:
        return ChatResponse(
            request_id=request_id,
            answer=answer,
            language="tr",
            execution_steps=self._steps(sql_steps=False),
            error=ErrorResponse(code=code, message=answer),
            technical=TechnicalResponse(retry_count=0),
        )

    def _is_greeting(self, message: str) -> bool:
        return any(token in message for token in ["merhaba", "selam", "hello", "hi", "hey"])

    def _is_privacy_risk(self, message: str) -> bool:
        return any(token in message for token in ["email", "telefon", "adres", "kisisel"]) and "liste" in message

    def _is_destructive(self, message: str) -> bool:
        return any(token in message for token in ["drop", "delete", "truncate", "alter", "create table"])

    def _is_out_of_scope(self, message: str) -> bool:
        return any(token in message for token in ["hava durumu", "haber", "spor", "siyaset"])


mock_service = MockService()
