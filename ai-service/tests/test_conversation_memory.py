from datetime import date

from app.main import _compact_conversation, _request_to_state
from app.schemas.chat import ChatRequest
from app.services.session_store import session_store


def create_request(conversation: list[dict], session_id: str = "session-1") -> ChatRequest:
    return ChatRequest.model_validate(
        {
            "sessionId": session_id,
            "message": "Bu da devam sorum",
            "currentDate": str(date.today()),
            "user": {
                "userId": "22222222-2222-2222-2222-222222222222",
                "email": "test@example.com",
                "role": "CORPORATE",
            },
            "accessScope": {
                "ownedStores": [
                    {"id": "33333333-3333-3333-3333-333333333333", "name": "Antigravity Tech"},
                ]
            },
            "conversation": conversation,
        }
    )


def test_compact_conversation_keeps_last_four_pairs():
    request = create_request(
        [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "q2"},
            {"role": "assistant", "content": "a2"},
            {"role": "user", "content": "q3"},
            {"role": "assistant", "content": "a3"},
            {"role": "user", "content": "q4"},
            {"role": "assistant", "content": "a4"},
            {"role": "user", "content": "q5"},
            {"role": "assistant", "content": "a5"},
        ]
    )

    compact = _compact_conversation(request)

    assert len(compact) == 4
    assert compact[0]["question"] == "q2"
    assert compact[-1]["answer_summary"] == "a5"


def test_request_to_state_prefers_request_conversation_over_session_memory():
    session_id = "session-prefers-request"
    session_store.clear_session(session_id)
    session_store.add_exchange(
        session_id=session_id,
        question="stale question",
        answer_summary="stale answer",
    )

    request = create_request(
        [
            {"role": "user", "content": "latest q1"},
            {"role": "assistant", "content": "latest a1"},
            {"role": "user", "content": "latest q2"},
            {"role": "assistant", "content": "latest a2"},
        ],
        session_id=session_id,
    )

    state = _request_to_state(request)

    assert len(state.conversation_memory) == 2
    assert state.conversation_memory[0]["question"] == "latest q1"
    assert state.conversation_memory[1]["answer_summary"] == "latest a2"


def test_request_to_state_falls_back_to_session_memory_when_request_conversation_missing():
    session_id = "session-fallback"
    session_store.clear_session(session_id)
    session_store.add_exchange(
        session_id=session_id,
        question="stored question",
        answer_summary="stored answer",
    )

    request = create_request([], session_id=session_id)
    state = _request_to_state(request)

    assert state.conversation_memory == [
        {"question": "stored question", "answer_summary": "stored answer"}
    ]
