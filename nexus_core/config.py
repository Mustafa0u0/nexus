
# ═════════════════════════════════════════════════════════════════════════
# NEXUS: AUTOMATED COMPETENCY ASSESSMENT SYSTEM (ACAS)
# Research Configuration & Constants
# ═════════════════════════════════════════════════════════════════════════

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ── SYSTEM PATHS ──
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "research_data"
SESSIONS_DIR = DATA_DIR / "sessions"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"
REPORTS_DIR = DATA_DIR / "reports"

# Ensure directories exist
for d in [DATA_DIR, SESSIONS_DIR, TRANSCRIPTS_DIR, REPORTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── API CONFIGURATION ──
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("CRITICAL ERROR: GROQ_API_KEY environment variable not set.")

# ── MODEL SELECTION (Methodology) ──
# Primary Model: Llama 3.3 70B (Production-grade, highest reasoning capability)
LLM_MODEL = "llama-3.3-70b-versatile"
LLM_TEMP = 0.6  # Balanced for creativity vs adherence to rubric
LLM_MAX_TOKENS = 4096

# Speech Models
STT_MODEL = "whisper-large-v3"       # OpenAI Whisper (State of the art open source)
TTS_VOICE = "en-US-GuyNeural"        # Microsoft Edge TTS (Professional male)
TTS_RATE = "+10%"                    # Slightly faster for natural flow

# ── SCORING RUBRIC (10-Dimension, 100-Point Scale) ──
SCORING_DIMENSIONS = {
    "role_alignment": {
        "label": "Role Alignment & Relevance",
        "description": "How well the candidate's past experience matches the JD. Uses industry-specific terminology.",
        "weight": 10,
    },
    "technical_depth": {
        "label": "Technical / Functional Depth",
        "description": "Hard skills mastery. Process description over mere tool name-dropping.",
        "weight": 10,
    },
    "evidence_of_impact": {
        "label": "Evidence of Impact",
        "description": "Focus on results over tasks. Data points, percentages, concrete outcomes.",
        "weight": 10,
    },
    "communication_clarity": {
        "label": "Communication Clarity & Conciseness",
        "description": "Structured thought flow, minimal filler words, easy to follow.",
        "weight": 10,
    },
    "problem_solving": {
        "label": "Problem-Solving & Critical Thinking",
        "description": "Step-by-step logic: Identification → Action → Resolution.",
        "weight": 10,
    },
    "star_compliance": {
        "label": "STAR Method Compliance",
        "description": "Behavioral answers contain Situation, Task, Action, Result components.",
        "weight": 10,
    },
    "soft_skills": {
        "label": "Soft Skills & Team Collaboration",
        "description": "Emphasis on collective success, collaboration, feedback, emotional intelligence.",
        "weight": 10,
    },
    "adaptability": {
        "label": "Adaptability & Learning Agility",
        "description": "Growth mindset. Mentions upskilling, adjusting, or pivoting.",
        "weight": 10,
    },
    "culture_fit": {
        "label": "Culture & Value Fit",
        "description": "Alignment with company mission and work style from JD.",
        "weight": 10,
    },
    "professionalism": {
        "label": "Professionalism & Professional Presence",
        "description": "Respectful, confident tone appropriate for the industry.",
        "weight": 10,
    },
}

# Total Score Classification Thresholds
SCORE_CLASSIFICATIONS = {
    "PLATINUM": (90, 100, "Immediate Hire / Move to Final Round"),
    "STRONG_FIT": (75, 89, "High potential; verify 1-2 weak areas"),
    "AVERAGE_FIT": (50, 74, "Requires more technical probing"),
    "NOT_RECOMMENDED": (0, 49, "Does not meet core competencies"),
}

# ── INTERVIEW PROTOCOL ──
TOTAL_INTERVIEW_QUESTIONS = 10       # Universal 10-Question Framework
MAX_FOLLOW_UPS_PER_QUESTION = 1      # Avoid interrogation loops
INTERVIEW_TIMEOUT_SECONDS = 1800     # 30 minute max duration
