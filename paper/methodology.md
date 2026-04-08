# 3. Methodology

## 3.1 Overview

This study presents NEXUS, an automated, evidence-grounded interview system
for competency assessment. The system adapts interview questions to each
candidate using a CV-JD gap analysis and produces scores that are explicitly
justified by direct transcript quotes. The core objective is to evaluate
whether structured, evidence-grounded LLM scoring can be used as a consistent
research instrument under controlled conditions.

## 3.2 System Components

| Component | Technology | Role |
| --- | --- | --- |
| Frontend | HTML/CSS/JS | Voice capture, UI, transcript display |
| Backend | FastAPI (Python) | API endpoints, orchestration, session control |
| LLM Gateway | Groq API | Structured parsing, scoring, question generation |
| STT | Whisper Large V3 (Groq) | Audio transcription |
| TTS | Edge-TTS (en-US-AndrewNeural) | AI interviewer voice |
| Persistence | SQLite | Session and report storage |

## 3.3 Model Configuration

| Task | Model | Temperature | Max Tokens | Notes |
| --- | --- | --- | --- | --- |
| Structured extraction / scoring | `llama-3.1-8b-instant` | 0.2 | 512 | JSON-validated |
| Dynamic interview responses | `llama-3.1-8b-instant` | 0.6 | 512 | Conversational |
| Fallback model 1 | `qwen-2.5-32b` | 0.2 / 0.6 | 512 | Used on failure |
| Fallback model 2 | `llama-3.3-70b-versatile` | 0.2 / 0.6 | 512 | Quality fallback |
| Speech-to-text | `whisper-large-v3` | n/a | n/a | Audio -> text |
| Text-to-speech | Edge-TTS | n/a | n/a | Text -> audio |

Note: The primary LLM can be overridden via `NEXUS_PRIMARY_MODEL`.

## 3.4 Interview Pipeline

### Phase 1: CV-JD Analysis
1. CV parsing into structured fields (skills, experience, education).
2. JD parsing into structured requirements.
3. Gap analysis to identify matched skills, missing skills, and probe areas.

### Phase 2: Question Generation
The system generates interview questions directly from the gap analysis.
Each question includes:
- `id`
- `question`
- `target_area`
- `category`
- `rubric_focus`
- `follow_up_hint` (optional)

### Phase 3: Evidence-Grounded Scoring
Each answer is scored on four dimensions:
- Relevance
- Depth
- Competency
- Communication

Every score includes:
1. A direct quote from the transcript as evidence.
2. A short reasoning statement justifying the score.

### Phase 4: Report Generation
The final report includes:
- Per-question scores and evidence
- Average rubric scores
- Recommendation summary
- Full transcript

## 3.5 Evaluation Protocol (Repeatability)

We use a repeatability harness to measure score variance across repeated runs:

1. Prepare fixed CV/JD pairs and scripted answers.
2. Run each case N times (default N=3).
3. Compute variance for average score and per-dimension scores.
4. Report any recommendation changes across runs.

The evaluation harness is provided in:
`tools/eval_harness.py` with cases in `tools/eval_cases.json`.

Example usage:
```
python tools/eval_harness.py --runs 3
```

## 3.6 Limitations

1. LLM scoring variability across runs.
2. STT errors propagate to scoring.
3. Prompt sensitivity and model drift.
4. No large-scale benchmark dataset; results are exploratory.

## 3.7 Ethical Considerations

- Participants provide informed consent.
- Camera usage is optional and explicitly opt-in.
- The system is a research prototype and not a hiring decision tool.
