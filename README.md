# NEXUS — AI-Powered Interview Platform

> Structured interviews with real-time AI assessment, competency-based scoring, and actionable hiring reports.

---

## Overview

NEXUS is an AI interview platform that automates structured interviews. Recruiters post job descriptions and generate interview codes. Candidates enter the code, upload their CV, and have a real-time voice conversation with an AI interviewer. The system scores each answer on a **6-dimension rubric**, generates a comprehensive evaluation report, and provides a hiring recommendation.

## Quick Start

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
# Clone the repository
git clone https://github.com/Mustafa0u0/nexus.git
cd nexus

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate    # Windows
source .venv/bin/activate # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### Environment Setup

Create a `.env` file:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### Run

```bash
python nexus_server_v2.py
```

Server starts at `http://localhost:8000`

---

## User Flow

```
┌─────────────────────────────────────────────────────────┐
│                    NEXUS Landing Page                     │
│                   http://localhost:8000                    │
│                                                          │
│     ┌──────────────┐        ┌──────────────┐             │
│     │  I'm a       │        │  I'm a       │             │
│     │  Candidate   │        │  Recruiter   │             │
│     └──────┬───────┘        └──────┬───────┘             │
└────────────┼───────────────────────┼─────────────────────┘
             │                       │
             ▼                       ▼
      /candidate                    /hr
             │                       │
             │                 1. Paste Job Description
             │                 2. Generate Interview Code
             │                 3. Share code with candidate
             │                       │
     1. Enter Interview Code         │
     2. Upload CV (PDF)              │
     3. Mic Test                     │
     4. AI Interview (voice)         │
     5. Interview Complete           │
             │                       │
             └───────────────────────┤
                                     │
                              View Evaluation Report
                              (Scores, Radar Chart,
                               Transcript, PDF Export)
```

---

## Architecture

```
nexus/
├── nexus_server_v2.py        # FastAPI server (all endpoints)
├── nexus_landing.html        # Landing page (role selection)
├── nexus_ui_v2.html          # Candidate interview UI
├── nexus_hr_ui.html          # HR dashboard & reports
├── nexus_core/
│   ├── orchestrator.py       # Interview orchestration brain
│   ├── structs.py            # Pydantic data models & rubric
│   ├── llm_gateway.py        # LLM API abstraction (Groq)
│   ├── storage.py            # SQLite session persistence
│   ├── engine.py             # Core interview engine
│   └── config.py             # Configuration
├── .env                      # API keys
├── requirements.txt          # Python dependencies
└── README_v2.md              # This file
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Landing page (role selection) |
| `GET` | `/candidate` | Candidate interview UI |
| `GET` | `/hr` | HR dashboard |
| `POST` | `/create-interview` | HR submits JD, gets 6-char code |
| `GET` | `/interview-codes` | List active interview codes |
| `POST` | `/setup-by-code` | Candidate submits code + CV |
| `POST` | `/setup` | Direct setup (CV + JD text) |
| `POST` | `/start` | Start interview session |
| `POST` | `/chat` | Send audio, get AI response |
| `GET` | `/report` | Generate evaluation report |
| `GET` | `/debug/sessions` | List all sessions |

---

## Scoring Rubric

NEXUS uses a **6-dimension competency rubric** based on industry best practices from Google, AIHR, SHRM, and Metaview.

### Dimensions & Weights

| # | Dimension | Weight | What It Measures |
|---|-----------|--------|------------------|
| 1 | **Technical Competency** | 25% | Domain knowledge, skill mastery, tool proficiency |
| 2 | **Problem Solving** | 20% | Analytical thinking, structured approach, trade-off analysis |
| 3 | **Communication** | 15% | Clarity, conciseness, ability to explain complex ideas |
| 4 | **Behavioral Fit** | 15% | Real examples using STAR method, teamwork, conflict resolution |
| 5 | **Adaptability** | 15% | Learning agility, handling ambiguity, growth mindset |
| 6 | **Role Alignment** | 10% | Direct match to JD requirements and responsibilities |

### Score Anchors (1-5 Scale)

| Score | Label | Description |
|-------|-------|-------------|
| **1** | Poor | No evidence. Irrelevant or concerning response. |
| **2** | Below Expectations | Minimal evidence. Vague, generic, or surface-level. |
| **3** | Meets Expectations | Adequate evidence. Shows competence with some examples. |
| **4** | Exceeds Expectations | Strong evidence. Detailed, specific, well-structured. |
| **5** | Exceptional | Outstanding. Expert-level with multiple concrete examples. |

### Weighted Score Formula

```
Final Score = (Technical × 0.25) + (Problem Solving × 0.20)
            + (Communication × 0.15) + (Behavioral Fit × 0.15)
            + (Adaptability × 0.15) + (Role Alignment × 0.10)
```

### Evidence Requirement

Every score **must** include:
- A **direct quote** from the candidate's answer
- A **reasoning** explaining why the score was assigned

---

## Features

### Candidate Experience
- **Interview Code Entry** — enter the 6-char code from your recruiter
- **CV Upload** — PDF, DOC, or TXT
- **Microphone Test** — verify audio before starting
- **Real-time Voice Interview** — hold Tab to speak, release to send
- **Elapsed Timer** — see interview duration
- **Eye Tracking** — MediaPipe Face Mesh for gaze detection
- **Dark Mode** — toggle light/dark theme
- **No Scores Visible** — candidate never sees scoring

### Recruiter Experience
- **Post JD → Generate Code** — share with candidates
- **Active Codes Panel** — see all pending interviews
- **Session List** — auto-refreshing, color-coded status
- **Evaluation Report** with:
  - Gradient hero header with key stats
  - Radar chart (Chart.js) for rubric visualization
  - Animated score bars per dimension
  - Skill gap analysis
  - Per-question score breakdown table
  - Chat-style interview transcript
- **PDF Export** — print-optimized CSS
- **Dark Mode** — toggle light/dark theme

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python, FastAPI, Uvicorn |
| LLM | Groq API (Llama/Mixtral) |
| Speech-to-Text | Groq Whisper |
| Text-to-Speech | Edge TTS |
| Frontend | Vanilla HTML/CSS/JS |
| Charts | Chart.js |
| Eye Tracking | MediaPipe Face Mesh |
| Database | SQLite (sessions) |
| Data Models | Pydantic v2 |

---

## Deployment

### Local Development

```bash
python nexus_server_v2.py
# Open http://localhost:8000
```

### Production (VPS / Cloud)

1. **Set up a VPS** (AWS EC2, DigitalOcean, Render, Railway)
2. **Clone and install** (same as local setup)
3. **Run with Uvicorn**:
   ```bash
   uvicorn nexus_server_v2:app --host 0.0.0.0 --port 8000
   ```
4. **Use a process manager** (systemd, PM2, or Supervisor):
   ```bash
   # systemd service example
   [Unit]
   Description=NEXUS Interview Server
   After=network.target

   [Service]
   User=ubuntu
   WorkingDirectory=/home/ubuntu/nexus
   ExecStart=/home/ubuntu/nexus/.venv/bin/uvicorn nexus_server_v2:app --host 0.0.0.0 --port 8000
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
5. **Reverse proxy** with Nginx (for HTTPS):
   ```nginx
   server {
       listen 443 ssl;
       server_name nexus.yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/nexus.yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/nexus.yourdomain.com/privkey.pem;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "nexus_server_v2:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t nexus .
docker run -p 8000:8000 --env-file .env nexus
```

### Quick Deploy (Render / Railway)

1. Push to GitHub
2. Connect to [Render](https://render.com) or [Railway](https://railway.app)
3. Set the start command: `uvicorn nexus_server_v2:app --host 0.0.0.0 --port $PORT`
4. Add `GROQ_API_KEY` as an environment variable
5. Deploy

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key for LLM and STT |
| `NEXUS_DB_PATH` | ❌ | SQLite database path (default: `research_data/nexus.db`) |
| `WARMUP_ENABLED` | ❌ | Enable LLM warmup on session start (default: `true`) |
| `NEXUS_DEFER_SCORING` | ❌ | Defer scoring to report generation (default: `0`) |

---

## License

MIT
