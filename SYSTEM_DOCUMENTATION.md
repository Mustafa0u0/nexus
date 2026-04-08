# NEXUS System Documentation (Research Prototype)

This is the single source of truth for the NEXUS system. It is written to be
directly usable for the research paper and for maintenance.

## 1. System Summary

NEXUS is an evidence-grounded, voice-based interview system for competency
assessment. It:
1. Parses a candidate CV and a job description (JD).
2. Performs gap analysis.
3. Generates interview questions.
4. Runs a live audio interview loop (STT -> reasoning -> TTS).
5. Produces a structured report with scores and evidence quotes.

Latency features include warmup, prefetched welcome audio, and optional deferred
scoring to keep live interview response time low.

## 2. Architecture (Layered)

| Layer | Component | File | Responsibility |
| --- | --- | --- | --- |
| Presentation | FastAPI server | `nexus_server_v2.py` | HTTP endpoints, request validation, UI serving, audio I/O |
| Orchestration | InterviewOrchestrator | `nexus_core/orchestrator.py` | Session lifecycle, flow control, scoring, report |
| Service | Async LLM Gateway | `nexus_core/llm_gateway.py` | LLM calls, retries, key rotation, fallback |
| Data | Pydantic models | `nexus_core/structs.py` | Typed schemas for all data |
| Persistence | SQLite store | `nexus_core/storage.py` | Session/report storage |
| UI | Web UI | `nexus_ui_v2.html` | Interview UI, telemetry, report dashboard |

## 3. Data Flow

### 3.1 Setup Phase
1. Client sends CV + JD to `/setup`.
2. CV and JD are analyzed in parallel.
3. Gap analysis is computed.
4. Interview questions are generated.
5. Session is marked `ready`.
6. Optional warmup and welcome audio prefetch run here.

### 3.2 Interview Phase
1. Client sends audio to `/chat`.
2. STT transcribes audio.
3. Orchestrator scores the answer and chooses the next question.
4. TTS generates the response audio.
5. Client plays response and continues.

### 3.3 Report Phase
1. Client requests `/report`.
2. Orchestrator aggregates scores.
3. Recommendation is generated.
4. Report is saved and returned.

## 4. API Endpoints

| Endpoint | Method | Input | Output | Notes |
| --- | --- | --- | --- | --- |
| `/` | GET | None | HTML UI | Serves `nexus_ui_v2.html` |
| `/setup` | POST | `cv_text`, `jd_text`, `cv_file` | Session + gaps + question preview | Parallel CV/JD analysis |
| `/start` | POST | `session_id` | TTS audio | Welcome + first question |
| `/chat` | POST | `session_id`, audio, `eye_metrics` | TTS audio + headers | Main interview loop |
| `/report` | GET | `session_id` | JSON report | Final structured report |
| `/debug/sessions` | GET | None | Session list | Debug only |
| `/reset` | POST | `session_id` | JSON | Delete session + report |

## 5. Data Models (Core Types)

| Model | Purpose |
| --- | --- |
| `CVAnalysis` | Parsed CV data |
| `JDAnalysis` | Parsed JD data |
| `GapAnalysis` | Gap results and probe areas |
| `Question` | Interview question schema |
| `AnswerScore` | Scoring output with evidence |
| `FinalReport` | Full interview report |
| `InterviewSession` | Session state and history |

## 6. AI Models and Settings

### 6.1 Model Inventory

| Task | Provider | Model | Where Used | Notes |
| --- | --- | --- | --- | --- |
| CV parsing | Groq | `llama-3.3-70b-versatile` | `llm_gateway.generate_structured` | Schema validated |
| JD parsing | Groq | `llama-3.3-70b-versatile` | `llm_gateway.generate_structured` | Schema validated |
| Gap analysis | Groq | `llama-3.3-70b-versatile` | `llm_gateway.generate_structured` | CV + JD JSON |
| Question generation | Groq | `llama-3.3-70b-versatile` | `llm_gateway.generate_structured` | `QuestionList` |
| Scoring | Groq | `llama-3.3-70b-versatile` | `llm_gateway.generate_structured` | `AnswerScoreLLM` |
| Dynamic follow-up | Groq | `llama-3.1-8b-instant` | `llm_gateway.generate_text` | Low latency |
| Recommendation | Groq | `llama-3.3-70b-versatile` | `llm_gateway.generate_structured` | `Recommendation` |
| STT | Groq | `whisper-large-v3` | `transcribe_audio` | Audio -> text |
| TTS | Edge TTS | `en-GB-RyanNeural` | `generate_speech` | Text -> audio |

### 6.2 LLM Fallback

If the primary model fails, the gateway falls back:
1. `qwen-2.5-32b`
2. `llama-3.3-70b-versatile`

### 6.3 Temperature and Token Settings

| Task Type | Temperature | Max Tokens | Notes |
| --- | --- | --- | --- |
| Structured outputs | 0.2 | 1024 | Enforced JSON schema |
| Free-form interview text | 0.6 | 256 | Low latency responses |

## 7. Voice and Audio

### 7.1 TTS Voices (Fallback Chain)
The system attempts voices in order:
1. `en-GB-RyanNeural`
2. `en-GB-LibbyNeural`
3. `en-GB-ThomasNeural`

Rate: `+10%` (normal speed, slightly faster than default).

### 7.2 STT
STT uses Groq `whisper-large-v3` with English language hint.

## 8. Persistence and Storage

### 8.1 SQLite
Sessions and reports are stored as JSON blobs in SQLite:
- Default DB: `research_data/nexus.db`
- Override: `NEXUS_DB_PATH`

### 8.2 Prefetch Cache
Welcome audio is generated during `/setup` and cached in SQLite as base64.
This avoids a cold first turn on `/start`, including after restarts.

### 8.3 JSON Mirroring (Optional)
Set `NEXUS_WRITE_JSON=1` to also write session JSON files to:
`research_data/sessions/`

## 9. UI and UX

### 9.1 Interview UI
- Modern glass-style UI in `nexus_ui_v2.html`.
- Live status banner shows state: idle, listening, processing, thinking, speaking.
- Latency strip shows STT, logic, and TTS timing.
- Mic button animates (listening, speaking, processing).

### 9.2 Report Dashboard (Recruiter-Friendly)
- Executive summary cards (recommendation, score, completion, match score).
- Rubric scores with progress bars.
- Gap analysis chips (matched, missing, probe).
- Per-question scoring table.
- Interview transcript section (question and answer pairs).
- Technical appendix JSON hidden behind a click.

## 10. Reliability and Error Handling

| Feature | Implementation | File |
| --- | --- | --- |
| Retry + backoff | `tenacity` retry wrapper | `nexus_core/llm_gateway.py` |
| Key rotation | Round-robin client selection | `nexus_core/llm_gateway.py` |
| Model fallback | Cascade on failure | `nexus_core/llm_gateway.py` |
| Session persistence | SQLite store | `nexus_core/storage.py` |
| Input truncation | CV/JD size guard | `nexus_core/orchestrator.py` |
| Timeouts | STT/TTS bounded waits | `nexus_server_v2.py` |
| Header sanitization | Strip newline in headers | `nexus_server_v2.py` |

## 11. Performance Features (Speed)

1. Warmup: Optional LLM warmup during `/setup`.
2. Prefetch: Pre-generate welcome audio in `/setup`.
3. Deferred scoring: Store answers during interview, score at `/report`.
4. Bounded timeouts for STT/TTS.
5. Latency headers returned for each interview call.

## 12. Latency Headers

The server returns:
- `X-Latency-STT`
- `X-Latency-Logic`
- `X-Latency-TTS`
- `X-Latency-Total`

## 13. Session Reset

`/reset` clears session state and reports. The UI reset button also stops audio
and camera streams.

## 14. CV File Upload

During `/setup`, CV can be:
- Pasted text, or
- `.txt/.md/.rtf` file upload.

If both are provided, pasted text is used unless empty.

## 15. Configuration

Required:
```
GROQ_API_KEY=your_key_here
```

Optional:
```
GROQ_API_KEY_2=key2
GROQ_API_KEY_3=key3
NEXUS_DB_PATH=research_data/nexus.db
NEXUS_WRITE_JSON=0
NEXUS_PRIMARY_MODEL=llama-3.1-8b-instant
NEXUS_STRUCTURED_MODEL=llama-3.3-70b-versatile
NEXUS_FAST_TEXT_MODEL=llama-3.1-8b-instant
NEXUS_TEXT_ONLY=0
NEXUS_WARMUP=1
NEXUS_DEFER_SCORING=1
NEXUS_MAX_INPUT_CHARS=12000
NEXUS_MAX_AUDIO_MB=10
NEXUS_STT_TIMEOUT_SEC=10
NEXUS_TTS_TIMEOUT_SEC=12
```

## 16. Research Limitations (Must Report)

1. LLM scoring variability across runs.
2. STT errors propagate to scoring.
3. Prompt sensitivity and model drift.
4. No large-scale benchmark dataset yet.

## 17. Suggested Evaluation Protocol

1. Prepare 5 to 10 fixed interviews.
2. Run each 3 times.
3. Report variance in:
   - Average score
   - Recommendation class
   - Per-dimension rubric scores
4. Include limitations in the paper.

## 18. Runbook

Install:
```
pip install -r requirements.txt
```

Run:
```
python nexus_server_v2.py
```

Open:
```
http://localhost:8000
```
