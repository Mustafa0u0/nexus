"""
NEXUS v3.0 (Async/High-Performance)
===================================
Research-grade AI Interview Agent running on FastAPI + Asyncio.

Features:
- Non-blocking I/O
- Parallel CV/JD Analysis
- Structured Data Validation (Pydantic)
- Robust Error Handling
- Camera & Eye Contact Support
"""

import os
import shutil
import logging
import asyncio
import tempfile
import uvicorn
import json
import aiofiles
import time
import base64
import io
import zipfile
from pathlib import Path
from PyPDF2 import PdfReader
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import edge_tts
from dotenv import load_dotenv

# Load env immediately
load_dotenv()

# Import Core Logic
from nexus_core.orchestrator import orchestrator, SessionManager
from nexus_core.llm_gateway import llm_gateway
from nexus_core.structs import InterviewSession, EyeContactMetric, User, Job, Application
from nexus_core.storage import SQLiteSessionStore

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def safe_header(value: str, limit: int = 4000) -> str:
    if not value:
        return ""
    cleaned = value.replace("\r", " ").replace("\n", " ")
    return cleaned[:limit]

app = FastAPI(title="NEXUS Research Engine", version="3.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Transcript", "X-Response", "X-Score", "X-Complete", "X-Session-ID"]
)

# Shared store instance for HR portal
DB_PATH = Path(os.getenv("NEXUS_DB_PATH", "research_data/nexus.db"))
store = SQLiteSessionStore(DB_PATH)

# Video uploads directory
VIDEO_DIR = Path("interview_videos")
VIDEO_DIR.mkdir(parents=True, exist_ok=True)
INTERVIEW_AUDIO_DIR = Path("interview_audio")
INTERVIEW_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Runtime configuration
TEXT_ONLY = os.getenv("NEXUS_TEXT_ONLY", "0") == "1"
WARMUP_ENABLED = os.getenv("NEXUS_WARMUP", "1") == "1"
MAX_AUDIO_MB = int(os.getenv("NEXUS_MAX_AUDIO_MB", "10"))
STT_TIMEOUT_SEC = int(os.getenv("NEXUS_STT_TIMEOUT_SEC", "10"))
TTS_TIMEOUT_SEC = int(os.getenv("NEXUS_TTS_TIMEOUT_SEC", "12"))

# â”€â”€ HELPER: Audio Services â”€â”€

async def transcribe_audio(file_path: str) -> str:
    """Async wrapper for Whisper STT via Groq."""
    try:
        async with aiofiles.open(file_path, "rb") as f:
            content = await f.read()

        # Groq's async client for audio
        client = llm_gateway._get_client() # Get a client (key rotation)

        # We pass (filename, content) tuple to mimic file object for httpx
        transcription = await client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=("audio.webm", content),
            language="en"
        )
        return transcription.text.strip()
    except Exception as e:
        logger.error(f"STT Error: {e}")
        return "..." # Fallback for silence/error

async def generate_speech(text: str) -> str:
    """Generate TTS audio file asynchronously."""
    fd, output_path = tempfile.mkstemp(suffix=".mp3", prefix="nexus_resp_")
    os.close(fd)

    voices = [
        "en-GB-RyanNeural",    # British primary
        "en-GB-LibbyNeural",
        "en-GB-ThomasNeural"
    ]
    last_error = None
    for voice in voices:
        try:
            communicate = edge_tts.Communicate(text, voice, rate="+10%")
            await communicate.save(output_path)
            return output_path
        except Exception as e:
            last_error = e
            continue
    raise last_error

def safe_remove(path: str) -> None:
    """Best-effort cleanup for temp files."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def latest_message(session: InterviewSession, role: str | None = None) -> str:
    """Return the latest non-empty message from the conversation history."""
    for item in reversed(session.conversation_history):
        if role and item.get("role") != role:
            continue
        content = (item.get("content") or "").strip()
        if content:
            return content
    return ""


def get_session_audio_dir(session_id: str) -> Path:
    path = INTERVIEW_AUDIO_DIR / session_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_session_audio_assets(session_id: str) -> list[Path]:
    path = INTERVIEW_AUDIO_DIR / session_id
    if not path.exists():
        return []
    return sorted(file for file in path.iterdir() if file.is_file())


def persist_session_audio_asset(session_id: str, filename: str, source_path: str) -> Path:
    target = get_session_audio_dir(session_id) / filename
    shutil.copyfile(source_path, target)
    return target


def write_temp_attachment(suffix: str, writer) -> str:
    fd, output_path = tempfile.mkstemp(suffix=suffix, prefix="nexus_export_")
    os.close(fd)
    writer(output_path)
    return output_path


def build_transcript_export(app_id: str, app_model: Application, session: InterviewSession, report) -> str:
    lines = [
        "NEXUS Interview Transcript",
        "=========================",
        f"Application ID: {app_id}",
        f"Session ID: {session.id}",
        f"Candidate: {report.candidate.name if report.candidate else app_model.employee_name or 'Unknown'}",
        f"Role: {report.job.title if report.job else 'Unknown'}",
        f"Generated At: {report.generated_at.isoformat()}",
        "",
        "Transcript",
        "----------",
    ]

    transcript = report.transcript or session.conversation_history or []
    for turn in transcript:
        speaker = "NEXUS" if turn.get("role") == "assistant" else "Candidate"
        content = (turn.get("content") or "").strip()
        if content:
            lines.append(f"{speaker}: {content}")
            lines.append("")

    return "\n".join(lines).strip() + "\n"


def build_analytics_export(app_model: Application, session: InterviewSession, report) -> dict:
    eye_logs = session.eye_contact_logs or []
    gaze_on_screen_ratio = None
    avg_eye_confidence = None
    if eye_logs:
        gaze_on_screen_ratio = round(
            sum(1 for metric in eye_logs if metric.gaze_on_screen) / len(eye_logs) * 100,
            2,
        )
        avg_eye_confidence = round(
            sum(metric.confidence for metric in eye_logs) / len(eye_logs),
            4,
        )

    audio_assets = list_session_audio_assets(session.id)
    video_available = bool(app_model.video_path and Path(app_model.video_path).exists())

    return {
        "application_id": app_model.id,
        "session_id": session.id,
        "generated_at": report.generated_at.isoformat(),
        "candidate_name": report.candidate.name if report.candidate else app_model.employee_name,
        "job_title": report.job.title if report.job else None,
        "status": app_model.status,
        "summary": {
            "overall_score": report.rubric_scores.get("overall", 0),
            "recommendation": report.recommendation.recommendation,
            "hiring_confidence": report.recommendation.hiring_confidence,
            "questions_answered": report.questions_answered,
            "total_questions": report.total_questions,
            "transcript_turns": len(report.transcript or []),
        },
        "rubric_scores": report.rubric_scores,
        "gap_analysis": report.gap_analysis.model_dump(),
        "recommendation": report.recommendation.model_dump(),
        "per_question_scores": [item.model_dump() for item in report.per_question_scores],
        "response_latencies": report.response_latencies,
        "eye_contact": {
            "sample_count": len(eye_logs),
            "gaze_on_screen_ratio": gaze_on_screen_ratio,
            "average_confidence": avg_eye_confidence,
        },
        "assets": {
            "video_available": video_available,
            "audio_package_available": bool(audio_assets),
            "audio_clip_count": len(audio_assets),
        },
    }


async def get_application_report_context(app_id: str):
    app_model = store.get_application(app_id)
    if not app_model or not app_model.interview_session_id:
        raise HTTPException(404, "No interview found for this application")

    session = SessionManager.get_session(app_model.interview_session_id)
    if not session:
        raise HTTPException(404, "Interview session not found")

    try:
        report = await orchestrator.generate_final_report(app_model.interview_session_id)
    except ValueError:
        raise HTTPException(404, "Report not available yet")

    return app_model, session, report

# â”€â”€ ENDPOINTS â”€â”€

@app.get("/", response_class=HTMLResponse)
async def serve_landing():
    """Serve the role-selection landing page."""
    ui_path = Path("nexus_landing.html")
    if ui_path.exists():
        return HTMLResponse(content=ui_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>Landing page not found.</h1>")

@app.get("/candidate", response_class=HTMLResponse)
async def serve_candidate_ui():
    """Serve the candidate interview UI."""
    ui_path = Path("nexus_ui_v2.html")
    if not ui_path.exists():
        ui_path = Path("nexus_ui.html")
    if ui_path.exists():
        return HTMLResponse(content=ui_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>Candidate UI not found.</h1>")

@app.get("/hr", response_class=HTMLResponse)
async def serve_hr_ui():
    """Serve recruiter dashboard UI."""
    ui_path = Path("nexus_hr_ui.html")
    if ui_path.exists():
        return HTMLResponse(content=ui_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>HR dashboard file not found.</h1>")

# ── Interview Code System (no DB needed) ──

import random
import string

_interview_codes: dict[str, str] = {}  # code -> jd_text

def _gen_code(length=6) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@app.post("/create-interview")
async def create_interview(jd_text: str = Form(...)):
    """HR submits a JD and gets a short interview code back."""
    code = _gen_code()
    _interview_codes[code] = jd_text.strip()
    return {"code": code}

@app.get("/interview-codes")
async def list_interview_codes():
    """List all active interview codes (for HR dashboard)."""
    return [{"code": k, "jd_preview": v[:80] + "..." if len(v) > 80 else v} for k, v in _interview_codes.items()]

@app.post("/setup-by-code")
async def setup_by_code(
    code: str = Form(...),
    cv_text: str = Form(""),
    cv_file: UploadFile = File(None)
):
    """Candidate submits interview code + CV to start a session."""
    jd_text = _interview_codes.get(code.strip().upper())
    if not jd_text:
        return JSONResponse({"error": "Invalid interview code."}, status_code=404)

    # Reuse the existing setup logic
    try:
        if cv_file and not cv_text.strip():
            try:
                raw = await cv_file.read()
                filename = cv_file.filename or ""
                if filename.lower().endswith(".pdf"):
                    reader = PdfReader(io.BytesIO(raw))
                    cv_text = "\n".join(page.extract_text() or "" for page in reader.pages)
                else:
                    cv_text = raw.decode("utf-8", errors="ignore")
            except Exception:
                raise HTTPException(400, "Failed to read CV file.")

        if not cv_text.strip():
            raise HTTPException(400, "CV text is required.")

        session = SessionManager.create_session()
        logger.info(f"Created Session (code={code}): {session.id}")

        analysis_result = await orchestrator.analyze_candidate(session.id, cv_text, jd_text)

        if WARMUP_ENABLED:
            try:
                await llm_gateway.generate_text("System: Warmup", "Say OK.", max_tokens=5, temperature=0.2)
            except Exception as e:
                logger.warning(f"Warmup failed: {e}")

        try:
            name = analysis_result["cv"].name if analysis_result["cv"] else "there"
            first_q = await orchestrator.get_next_question(session.id)
            if first_q:
                welcome_prompt = f"Welcome '{name}' to the interview. Introduce yourself right now as NEXUS. Ask EXACTLY this question and nothing else: '{first_q}'. Be extremely brief, no more than 2 sentences total."
                welcome_text = await llm_gateway.generate_text("You are a professional interviewer.", welcome_prompt)
                audio_path = await asyncio.wait_for(generate_speech(welcome_text), timeout=TTS_TIMEOUT_SEC)
                try:
                    audio_bytes = Path(audio_path).read_bytes()
                    session.prefetched_welcome_audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
                except Exception:
                    session.prefetched_welcome_audio_b64 = None
                session.prefetched_welcome_audio = audio_path
                session.prefetched_welcome_text = welcome_text
                SessionManager.save_session(session)
        except Exception as e:
            logger.warning(f"Prefetch welcome failed: {e}")

        return {
            "session_id": session.id,
            "status": "ready",
            "candidate": analysis_result["cv"],
            "job": analysis_result["jd"],
            "gaps": analysis_result["gaps"],
        }
    except Exception as e:
        logger.exception("Setup by code failed")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/setup")
async def setup_session(
    cv_text: str = Form(""),
    jd_text: str = Form(...),
    cv_file: UploadFile = File(None)
):
    """
    Initialize a new interview session.
    Triggers parallel analysis of CV and JD.
    """
    try:
        if cv_file and not cv_text.strip():
            try:
                raw = await cv_file.read()
                filename = cv_file.filename or ""
                if filename.lower().endswith(".pdf"):
                    reader = PdfReader(io.BytesIO(raw))
                    cv_text = "\n".join(
                        page.extract_text() or "" for page in reader.pages
                    )
                else:
                    cv_text = raw.decode("utf-8", errors="ignore")
            except Exception:
                raise HTTPException(400, "Failed to read CV file.")

        if not cv_text.strip():
            raise HTTPException(400, "CV text is required.")

        # Create Session
        session = SessionManager.create_session()
        logger.info(f"Created Session: {session.id}")

        # Run Analysis (This is the heavy lifting)
        # We await it here so the client knows when it's ready.
        # For huge docs, could be background task + polling.
        analysis_result = await orchestrator.analyze_candidate(session.id, cv_text, jd_text)

        if WARMUP_ENABLED:
            try:
                await llm_gateway.generate_text("System: Warmup", "Say OK.", max_tokens=5, temperature=0.2)
            except Exception as e:
                logger.warning(f"Warmup failed: {e}")

        # Pre-generate welcome audio to remove first-turn latency
        try:
            name = analysis_result["cv"].name if analysis_result["cv"] else "there"
            first_q = await orchestrator.get_next_question(session.id)
            if first_q:
                welcome_prompt = f"Welcome '{name}' to the interview. Introduce yourself right now as NEXUS. Ask EXACTLY this question and nothing else: '{first_q}'. Be extremely brief, no more than 2 sentences total."
                welcome_text = await llm_gateway.generate_text("You are a professional interviewer.", welcome_prompt)
                audio_path = await asyncio.wait_for(generate_speech(welcome_text), timeout=TTS_TIMEOUT_SEC)
                try:
                    audio_bytes = Path(audio_path).read_bytes()
                    session.prefetched_welcome_audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
                except Exception:
                    session.prefetched_welcome_audio_b64 = None
                session.prefetched_welcome_audio = audio_path
                session.prefetched_welcome_text = welcome_text
                SessionManager.save_session(session)
        except Exception as e:
            logger.warning(f"Prefetch welcome failed: {e}")

        return {
            "session_id": session.id,
            "status": "ready",
            "candidate": analysis_result["cv"],
            "job": analysis_result["jd"],
            "gaps": analysis_result["gaps"],
            "questions_preview": [q.question for q in analysis_result["questions"]]
        }
    except Exception as e:
        logger.exception("Setup Failed")
        message = str(e)
        if "BadRequest" in message or "400" in message:
            return JSONResponse({"error": "LLM request failed. Check model availability or reduce input size."}, status_code=502)
        return JSONResponse({"error": message}, status_code=500)

@app.post("/start")
async def start_interview(session_id: str = Form(...), background_tasks: BackgroundTasks = None):
    """
    Begin the interview. Returns the welcome message audio.
    """
    session = SessionManager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    try:
        t0 = time.monotonic()
        session.status = "interviewing"
        SessionManager.save_session(session)

        # Generate Welcome
        name = session.cv_analysis.name if session.cv_analysis and session.cv_analysis.name else "there"
        first_q = await orchestrator.get_next_question(session_id)
        if not first_q:
            raise HTTPException(400, "Session not ready for interview.")

        if session.prefetched_welcome_audio_b64:
            welcome_text = session.prefetched_welcome_text or ""
            fd, cached_path = tempfile.mkstemp(suffix=".mp3", prefix="nexus_prefetch_")
            os.close(fd)
            Path(cached_path).write_bytes(base64.b64decode(session.prefetched_welcome_audio_b64))
            try:
                persist_session_audio_asset(session_id, "00_nexus_intro.mp3", cached_path)
            except Exception as e:
                logger.warning(f"Failed to persist intro audio for {session_id}: {e}")
            total_ms = int((time.monotonic() - t0) * 1000)
            response = FileResponse(
                cached_path,
                media_type="audio/mpeg",
                headers={
                    "X-Response": safe_header(welcome_text),
                    "X-Session-ID": session_id,
                    "X-Latency-LLM": "0",
                    "X-Latency-TTS": "0",
                    "X-Latency-Total": str(total_ms),
                    "Access-Control-Expose-Headers": "X-Response, X-Session-ID"
                }
            )
            if background_tasks:
                background_tasks.add_task(safe_remove, cached_path)
            session.prefetched_welcome_audio = None
            session.prefetched_welcome_audio_b64 = None
            session.prefetched_welcome_text = None
            SessionManager.save_session(session)
            return response

        welcome_prompt = f"Welcome the candidate named '{name}' to the interview. Briefly introduce yourself as NEXUS. Then ask the first question: '{first_q}'."
        t_llm_start = time.monotonic()
        welcome_text = await llm_gateway.generate_text("You are a professional interviewer.", welcome_prompt)
        llm_ms = int((time.monotonic() - t_llm_start) * 1000)

        if TEXT_ONLY:
            total_ms = int((time.monotonic() - t0) * 1000)
            return JSONResponse(
                {
                    "response": welcome_text,
                    "session_id": session_id
                },
                headers={
                    "X-Response": welcome_text[:4000] if welcome_text else "",
                    "X-Session-ID": session_id,
                    "X-Latency-LLM": str(llm_ms),
                    "X-Latency-Total": str(total_ms),
                    "Access-Control-Expose-Headers": "X-Response, X-Session-ID"
                }
            )

        # Generate Audio
        t_tts_start = time.monotonic()
        try:
            audio_path = await asyncio.wait_for(generate_speech(welcome_text), timeout=TTS_TIMEOUT_SEC)
        except asyncio.TimeoutError:
            return JSONResponse({"error": "TTS timed out. Please retry."}, status_code=504)
        try:
            persist_session_audio_asset(session_id, "00_nexus_intro.mp3", audio_path)
        except Exception as e:
            logger.warning(f"Failed to persist intro audio for {session_id}: {e}")
        tts_ms = int((time.monotonic() - t_tts_start) * 1000)
        total_ms = int((time.monotonic() - t0) * 1000)

        response = FileResponse(
            audio_path,
            media_type="audio/mpeg",
            headers={
                "X-Response": safe_header(welcome_text), # safe header length
                "X-Session-ID": session_id,
                "X-Latency-LLM": str(llm_ms),
                "X-Latency-TTS": str(tts_ms),
                "X-Latency-Total": str(total_ms),
                "Access-Control-Expose-Headers": "X-Response, X-Session-ID"
            }
        )
        if background_tasks:
            background_tasks.add_task(safe_remove, audio_path)
        return response
    except Exception as e:
        logger.error(f"Start Failed: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/chat")
async def chat_loop(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    eye_metrics: str = Form(None), # JSON string of EyeContactMetric list
    background_tasks: BackgroundTasks = None
):
    """
    Main Interview Loop: Audio In -> STT -> Logic -> TTS -> Audio Out
    Also accepts eye_metrics JSON string.
    """
    session = SessionManager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # Use a unique temp file for this request
    fd, temp_input = tempfile.mkstemp(suffix=".webm", prefix=f"input_{session_id}_")
    os.close(fd)

    try:
        t0 = time.monotonic()
        # Parse Eye Metrics
        metrics = []
        if eye_metrics:
            try:
                raw_list = json.loads(eye_metrics)
                for item in raw_list:
                    metrics.append(EyeContactMetric(**item))
            except Exception as e:
                logger.warning(f"Failed to parse eye metrics: {e}")

        # 1. Save Audio (Non-blocking read/write)
        max_bytes = MAX_AUDIO_MB * 1024 * 1024
        bytes_written = 0
        async with aiofiles.open(temp_input, "wb") as f:
            while content := await file.read(1024 * 1024): # 1MB chunks
                bytes_written += len(content)
                if bytes_written > max_bytes:
                    return JSONResponse({"error": "Audio too large."}, status_code=413)
                await f.write(content)

        # 2. Transcribe (STT)
        t_stt_start = time.monotonic()
        try:
            transcript = await asyncio.wait_for(transcribe_audio(temp_input), timeout=STT_TIMEOUT_SEC)
        except asyncio.TimeoutError:
            transcript = ""
        stt_ms = int((time.monotonic() - t_stt_start) * 1000)
        logger.info(f"[{session_id}] Candidate: {transcript}")

        if transcript:
            session.conversation_history.append({"role": "user", "content": transcript})
            SessionManager.save_session(session)

        turn_index = len(session.answers) + 1
        try:
            persist_session_audio_asset(session_id, f"{turn_index:02d}_candidate.webm", temp_input)
        except Exception as e:
            logger.warning(f"Failed to persist candidate audio for {session_id} turn {turn_index}: {e}")

        # 3. Process Answer (Logic Core)
        t_logic_start = time.monotonic()
        if not transcript or transcript == "...":
            response_text, is_complete = "I did not catch that. Please repeat your answer.", False
        else:
            session.status = "interviewing"
            SessionManager.save_session(session)
            response_text, is_complete = await orchestrator.process_answer(session_id, transcript, metrics)
        logic_ms = int((time.monotonic() - t_logic_start) * 1000)
        logger.info(f"[{session_id}] NEXUS: {response_text}")

        session.conversation_history.append({"role": "assistant", "content": response_text})
        SessionManager.save_session(session)

        # Headers for UI update
        latest_score = "0"
        if session.scores:
            latest_score = str(session.scores[-1].average_score)
        elif os.getenv("NEXUS_DEFER_SCORING", "0") == "1":
            latest_score = "pending"

        if TEXT_ONLY:
            total_ms = int((time.monotonic() - t0) * 1000)
            return JSONResponse(
                {
                    "transcript": transcript,
                    "response": response_text,
                    "score": latest_score,
                    "complete": is_complete
                },
                headers={
                    "X-Transcript": safe_header(transcript, limit=500),
                    "X-Response": safe_header(response_text), # Truncate for headers
                    "X-Score": latest_score,
                    "X-Complete": "true" if is_complete else "false",
                    "X-Latency-STT": str(stt_ms),
                    "X-Latency-Logic": str(logic_ms),
                    "X-Latency-Total": str(total_ms),
                    "Access-Control-Expose-Headers": "X-Transcript, X-Response, X-Score, X-Complete"
                }
            )

        # 4. Generate Speech (TTS)
        t_tts_start = time.monotonic()
        try:
            audio_path = await asyncio.wait_for(generate_speech(response_text), timeout=TTS_TIMEOUT_SEC)
        except asyncio.TimeoutError:
            return JSONResponse(
                {"error": "TTS timed out. Please repeat your answer."},
                status_code=504
            )
        try:
            persist_session_audio_asset(session_id, f"{turn_index:02d}_nexus.mp3", audio_path)
        except Exception as e:
            logger.warning(f"Failed to persist interviewer audio for {session_id} turn {turn_index}: {e}")
        tts_ms = int((time.monotonic() - t_tts_start) * 1000)
        total_ms = int((time.monotonic() - t0) * 1000)

        response = FileResponse(
            audio_path,
            media_type="audio/mpeg",
            headers={
                "X-Transcript": safe_header(transcript, limit=500),
                "X-Response": safe_header(response_text), # Truncate for headers
                "X-Score": latest_score,
                "X-Complete": "true" if is_complete else "false",
                "X-Latency-STT": str(stt_ms),
                "X-Latency-Logic": str(logic_ms),
                "X-Latency-TTS": str(tts_ms),
                "X-Latency-Total": str(total_ms),
                "Access-Control-Expose-Headers": "X-Transcript, X-Response, X-Score, X-Complete"
            }
        )
        if background_tasks:
            background_tasks.add_task(safe_remove, audio_path)
        return response

    except Exception as e:
        logger.error(f"Chat Loop Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        # Cleanup input file
        if os.path.exists(temp_input):
            os.remove(temp_input)

@app.get("/report")
async def get_report(session_id: str):
    """Generate and return the final JSON report."""
    try:
        report = await orchestrator.generate_final_report(session_id)
        return report
    except ValueError:
        raise HTTPException(404, "Session not found")
    except Exception as e:
        logger.error(f"Report Generation Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/debug/sessions")
async def debug_sessions():
    """List active sessions with metadata."""
    results = []
    for s in SessionManager.list_sessions():
        results.append({
            "id": s.id,
            "status": s.status,
            "candidate_name": s.cv_analysis.name if s.cv_analysis else None,
            "job_title": s.jd_analysis.title if s.jd_analysis else None,
            "questions_answered": len(s.scores) if s.scores else len(s.answers) if hasattr(s, 'answers') and s.answers else 0,
            "total_questions": len(s.questions) if s.questions else 0,
        })
    return results

@app.post("/reset")
async def reset_session(session_id: str = Form(...)):
    """Delete a session and its report."""
    try:
        SessionManager.delete_session(session_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Reset Failed: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# HR PORTAL API ENDPOINTS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

# â”€â”€ User Management â”€â”€

@app.post("/api/users/register")
async def register_user(name: str = Form(...), email: str = Form(...), role: str = Form(...)):
    """Register or login a user by email."""
    clean_name = name.strip()
    clean_email = email.strip().lower()
    clean_role = role.strip().lower()

    if clean_role not in {"hr", "employee"}:
        raise HTTPException(400, "Invalid user role")

    existing = store.get_user_by_email(clean_email)
    if existing:
        if existing.name != clean_name or existing.email != clean_email:
            existing = existing.model_copy(update={"name": clean_name, "email": clean_email})
            store.save_user(existing)
        return existing.model_dump()

    user = User(name=clean_name, email=clean_email, role=clean_role)
    store.save_user(user)
    return user.model_dump()

@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user.model_dump()

# â”€â”€ Job Management â”€â”€

@app.post("/api/jobs")
async def create_job(
    hr_user_id: str = Form(...),
    title: str = Form(...),
    description_text: str = Form(""),
    jd_file: UploadFile = File(None)
):
    """HR creates a job posting."""
    hr = store.get_user(hr_user_id)
    if not hr or hr.role != "hr":
        raise HTTPException(403, "Only HR users can create jobs")

    if jd_file and not description_text.strip():
        try:
            raw = await jd_file.read()
            filename = jd_file.filename or ""
            if filename.lower().endswith(".pdf"):
                reader = PdfReader(io.BytesIO(raw))
                description_text = "\n".join(page.extract_text() or "" for page in reader.pages)
            else:
                description_text = raw.decode("utf-8", errors="ignore")
        except Exception:
            raise HTTPException(400, "Failed to read JD file")

    if not description_text.strip():
        raise HTTPException(400, "Job description is required")

    job = Job(hr_user_id=hr_user_id, title=title, description_text=description_text)
    store.save_job(job)
    return job.model_dump()

@app.get("/api/jobs")
async def list_jobs(status: str = Query(None)):
    """List all jobs."""
    jobs = store.list_jobs(status=status)
    result = []
    for j in jobs:
        apps = store.list_applications_by_job(j.id)
        d = j.model_dump()
        d["applicant_count"] = len(apps)
        result.append(d)
    return result

@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    d = job.model_dump()
    d["applicant_count"] = len(store.list_applications_by_job(job_id))
    return d

# â”€â”€ Application Management â”€â”€

@app.post("/api/jobs/{job_id}/apply")
async def apply_for_job(
    job_id: str,
    employee_user_id: str = Form(...),
    cv_text: str = Form(""),
    cv_file: UploadFile = File(None)
):
    """Employee applies for a job."""
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    emp = store.get_user(employee_user_id)
    if not emp or emp.role != "employee":
        raise HTTPException(403, "Only employees can apply")

    existing = store.check_existing_application(job_id, employee_user_id)
    if existing:
        raise HTTPException(400, "Already applied to this job")

    if cv_file and not cv_text.strip():
        try:
            raw = await cv_file.read()
            filename = cv_file.filename or ""
            if filename.lower().endswith(".pdf"):
                reader = PdfReader(io.BytesIO(raw))
                cv_text = "\n".join(page.extract_text() or "" for page in reader.pages)
            else:
                cv_text = raw.decode("utf-8", errors="ignore")
        except Exception:
            raise HTTPException(400, "Failed to read CV file")

    if not cv_text.strip():
        raise HTTPException(400, "CV is required")

    app_model = Application(
        job_id=job_id,
        employee_user_id=employee_user_id,
        employee_name=emp.name,
        cv_text=cv_text
    )
    store.save_application(app_model)
    return app_model.model_dump()

@app.get("/api/applications/employee/{user_id}")
async def get_employee_applications(user_id: str):
    """Get all applications for an employee."""
    apps = store.list_applications_by_employee(user_id)
    result = []
    for a in apps:
        d = a.model_dump()
        job = store.get_job(a.job_id)
        d["job_title"] = job.title if job else "Unknown"
        d["job_description"] = job.description_text if job else ""
        result.append(d)
    return result

@app.get("/api/applications/job/{job_id}")
async def get_job_applications(job_id: str):
    """Get all applicants for a job (HR view)."""
    apps = store.list_applications_by_job(job_id)
    return [a.model_dump() for a in apps]

@app.post("/api/applications/{app_id}/invite")
async def invite_to_interview(app_id: str):
    """HR invites candidate to AI interview."""
    app_model = store.get_application(app_id)
    if not app_model:
        raise HTTPException(404, "Application not found")
    if app_model.status != "applied":
        raise HTTPException(400, f"Cannot invite: status is '{app_model.status}'")
    app_model.status = "invited"
    store.save_application(app_model)
    return app_model.model_dump()

@app.get("/api/applications/{app_id}")
async def get_application(app_id: str):
    """Get single application details."""
    app_model = store.get_application(app_id)
    if not app_model:
        raise HTTPException(404, "Application not found")
    d = app_model.model_dump()
    job = store.get_job(app_model.job_id)
    d["job_title"] = job.title if job else "Unknown"
    d["job_description"] = job.description_text if job else ""
    audio_assets = list_session_audio_assets(app_model.interview_session_id) if app_model.interview_session_id else []
    d["video_available"] = bool(app_model.video_path and Path(app_model.video_path).exists())
    d["audio_assets_available"] = bool(audio_assets)
    d["audio_clip_count"] = len(audio_assets)
    return d

# â”€â”€ Interview Session Bridge â”€â”€

@app.post("/api/interviews/{app_id}/setup")
async def setup_interview_for_application(app_id: str):
    """
    Creates an AI interview session for an application.
    Uses the application's CV and linked job's JD.
    """
    app_model = store.get_application(app_id)
    if not app_model:
        raise HTTPException(404, "Application not found")
    if app_model.status not in ("invited", "interviewing"):
        raise HTTPException(400, f"Cannot start interview: status is '{app_model.status}'")

    job = store.get_job(app_model.job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    # If there's already a session, return it
    if app_model.interview_session_id:
        existing = SessionManager.get_session(app_model.interview_session_id)
        if existing and existing.status != "completed":
            return {
                "session_id": existing.id,
                "status": existing.status,
                "app_id": app_id
            }

    # Create session via existing orchestrator
    session = SessionManager.create_session()
    app_model.interview_session_id = session.id
    app_model.status = "interviewing"
    store.save_application(app_model)

    try:
        analysis_result = await orchestrator.analyze_candidate(session.id, app_model.cv_text, job.description_text)

        if WARMUP_ENABLED:
            try:
                await llm_gateway.generate_text("System: Warmup", "Say OK.", max_tokens=5, temperature=0.2)
            except Exception as e:
                logger.warning(f"Warmup failed: {e}")

        # Pre-generate welcome audio
        try:
            name = analysis_result["cv"].name if analysis_result["cv"] else "there"
            first_q = await orchestrator.get_next_question(session.id)
            if first_q:
                welcome_prompt = f"Welcome '{name}' to the interview. Introduce yourself right now as NEXUS. Ask EXACTLY this question and nothing else: '{first_q}'. Be extremely brief, no more than 2 sentences total."
                welcome_text = await llm_gateway.generate_text("You are a professional interviewer.", welcome_prompt)
                audio_path = await asyncio.wait_for(generate_speech(welcome_text), timeout=TTS_TIMEOUT_SEC)
                try:
                    audio_bytes = Path(audio_path).read_bytes()
                    session.prefetched_welcome_audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
                except Exception:
                    session.prefetched_welcome_audio_b64 = None
                session.prefetched_welcome_audio = audio_path
                session.prefetched_welcome_text = welcome_text
                SessionManager.save_session(session)
        except Exception as e:
            logger.warning(f"Prefetch welcome failed: {e}")

        return {
            "session_id": session.id,
            "status": "ready",
            "app_id": app_id,
            "candidate": analysis_result["cv"],
            "job": analysis_result["jd"],
            "gaps": analysis_result["gaps"]
        }
    except Exception as e:
        logger.exception("Interview setup failed")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/interviews/{app_id}/complete")
async def complete_interview(app_id: str):
    """Mark an application's interview as completed."""
    app_model = store.get_application(app_id)
    if not app_model:
        raise HTTPException(404, "Application not found")
    app_model.status = "completed"
    store.save_application(app_model)
    return {"status": "ok"}


@app.get("/api/interviews/{app_id}/state")
async def get_interview_state(app_id: str):
    """Return the current saved state for an interview so the UI can resume after refresh."""
    app_model = store.get_application(app_id)
    if not app_model or not app_model.interview_session_id:
        raise HTTPException(404, "No interview found for this application")

    session = SessionManager.get_session(app_model.interview_session_id)
    if not session:
        raise HTTPException(404, "Interview session not found")

    last_turn = session.conversation_history[-1] if session.conversation_history else {}
    next_question = None
    if session.status != "completed":
        try:
            next_question = await orchestrator.get_next_question(session.id)
        except Exception:
            next_question = None

    latest_assistant = latest_message(session, "assistant")
    latest_user = latest_message(session, "user")

    if session.status == "completed":
        current_prompt = latest_assistant or "Thank you. Your interview has been submitted successfully."
    elif last_turn.get("role") == "assistant":
        current_prompt = (last_turn.get("content") or "").strip() or latest_assistant or next_question or ""
    elif last_turn.get("role") == "user":
        current_prompt = next_question or latest_assistant or ""
    else:
        current_prompt = latest_assistant or session.prefetched_welcome_text or next_question or ""

    return {
        "app_id": app_id,
        "session_id": session.id,
        "status": session.status,
        "current_question_index": session.current_question_index,
        "total_questions": len(session.questions),
        "current_prompt": current_prompt,
        "prompt_speaker": "NEXUS",
        "latest_user_transcript": latest_user,
        "last_role": last_turn.get("role"),
        "awaiting_answer": session.status == "interviewing",
        "video_path": app_model.video_path,
    }

@app.post("/api/interviews/{app_id}/video")
async def upload_interview_video(app_id: str, file: UploadFile = File(...)):
    """Upload the recorded interview video and save it locally."""
    app_model = store.get_application(app_id)
    if not app_model:
        raise HTTPException(404, "Application not found")

    video_filename = f"{app_id}.webm"
    video_path = (VIDEO_DIR / video_filename).resolve()

    async with aiofiles.open(str(video_path), "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)

    app_model.video_path = str(video_path)
    store.save_application(app_model)
    return {"status": "ok", "video_path": str(video_path)}

@app.get("/api/interviews/{app_id}/video")
async def get_interview_video(app_id: str):
    """Stream the recorded interview video."""
    app_model = store.get_application(app_id)
    if not app_model or not app_model.video_path:
        raise HTTPException(404, "Video not found")
    if not Path(app_model.video_path).exists():
        raise HTTPException(404, "Video file missing")
    return FileResponse(app_model.video_path, media_type="video/webm")


@app.get("/api/interviews/{app_id}/video/download")
async def download_interview_video(app_id: str):
    """Download the recorded interview video."""
    app_model = store.get_application(app_id)
    if not app_model or not app_model.video_path:
        raise HTTPException(404, "Video not found")
    video_path = Path(app_model.video_path)
    if not video_path.exists():
        raise HTTPException(404, "Video file missing")
    return FileResponse(
        str(video_path),
        media_type="video/webm",
        filename=f"nexus-interview-{app_id}.webm",
    )

@app.get("/api/interviews/{app_id}/report")
async def get_interview_report(app_id: str):
    """Get AI interview report for an application (HR only)."""
    app_model = store.get_application(app_id)
    if not app_model or not app_model.interview_session_id:
        raise HTTPException(404, "No interview found for this application")
    try:
        report = await orchestrator.generate_final_report(app_model.interview_session_id)
        return report
    except ValueError:
        raise HTTPException(404, "Report not available yet")
    except Exception as e:
        logger.error(f"Report generation error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/interviews/{app_id}/transcript/download")
async def download_interview_transcript(app_id: str):
    """Download the whole interview transcript as text."""
    app_model, session, report = await get_application_report_context(app_id)
    transcript_text = build_transcript_export(app_id, app_model, session, report)
    return Response(
        content=transcript_text,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="nexus-interview-{app_id}-transcript.txt"',
        },
    )


@app.get("/api/interviews/{app_id}/analytics/download")
async def download_interview_analytics(app_id: str):
    """Download interview analytics as JSON."""
    app_model, session, report = await get_application_report_context(app_id)
    analytics_payload = build_analytics_export(app_model, session, report)
    return Response(
        content=json.dumps(analytics_payload, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="nexus-interview-{app_id}-analytics.json"',
        },
    )


@app.get("/api/interviews/{app_id}/report/download")
async def download_interview_report(app_id: str):
    """Download the final report JSON."""
    _, _, report = await get_application_report_context(app_id)
    return Response(
        content=report.model_dump_json(indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="nexus-interview-{app_id}-report.json"',
        },
    )


@app.get("/api/interviews/{app_id}/audio/download")
async def download_interview_audio_package(app_id: str, background_tasks: BackgroundTasks):
    """Download persisted interview audio assets as a zip package."""
    app_model = store.get_application(app_id)
    if not app_model or not app_model.interview_session_id:
        raise HTTPException(404, "No interview found for this application")

    audio_assets = list_session_audio_assets(app_model.interview_session_id)
    if not audio_assets:
        raise HTTPException(404, "Audio package not available for this interview")

    def _write_zip(output_path: str) -> None:
        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for asset in audio_assets:
                archive.write(asset, arcname=f"audio/{asset.name}")

    zip_path = write_temp_attachment(".zip", _write_zip)
    background_tasks.add_task(safe_remove, zip_path)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"nexus-interview-{app_id}-audio.zip",
    )


@app.get("/api/interviews/{app_id}/bundle/download")
async def download_interview_bundle(app_id: str, background_tasks: BackgroundTasks):
    """Download transcript, analytics, report, and available media in one zip."""
    app_model, session, report = await get_application_report_context(app_id)
    audio_assets = list_session_audio_assets(session.id)
    transcript_text = build_transcript_export(app_id, app_model, session, report)
    analytics_payload = build_analytics_export(app_model, session, report)
    video_path = Path(app_model.video_path) if app_model.video_path else None

    def _write_zip(output_path: str) -> None:
        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("transcript.txt", transcript_text)
            archive.writestr("analytics.json", json.dumps(analytics_payload, indent=2))
            archive.writestr("report.json", report.model_dump_json(indent=2))
            if video_path and video_path.exists():
                archive.write(video_path, arcname=f"video/{video_path.name}")
            for asset in audio_assets:
                archive.write(asset, arcname=f"audio/{asset.name}")

    zip_path = write_temp_attachment(".zip", _write_zip)
    background_tasks.add_task(safe_remove, zip_path)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"nexus-interview-{app_id}-bundle.zip",
    )

if __name__ == "__main__":
    uvicorn.run("nexus_server_v2:app", host="0.0.0.0", port=8000, reload=True)
