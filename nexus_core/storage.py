"""
SQLite-backed persistence for interview sessions and reports.
Keeps storage lightweight for research use while providing ACID guarantees.
"""

import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

from .structs import InterviewSession, FinalReport, User, Job, Application


class SQLiteSessionStore:
    """Store sessions and reports as JSON blobs in SQLite."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS reports (
                    session_id TEXT PRIMARY KEY,
                    generated_at TEXT NOT NULL,
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    role TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    hr_user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open',
                    created_at TEXT NOT NULL,
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS applications (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    employee_user_id TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'applied',
                    interview_session_id TEXT,
                    created_at TEXT NOT NULL,
                    data TEXT NOT NULL
                )
                """
            )
            conn.commit()

    # ── Session Methods (unchanged) ──

    def save_session(self, session: InterviewSession) -> None:
        payload = session.model_dump_json()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO sessions (id, created_at, status, data)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status,
                    data=excluded.data
                """,
                (session.id, session.created_at.isoformat(), session.status, payload),
            )
            conn.commit()

    def load_session(self, session_id: str) -> Optional[InterviewSession]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT data FROM sessions WHERE id = ?",
                (session_id,),
            ).fetchone()
            if not row:
                return None
            data = json.loads(row[0])
            return InterviewSession.model_validate(data)

    def load_all_sessions(self) -> Dict[str, InterviewSession]:
        sessions: Dict[str, InterviewSession] = {}
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute("SELECT data FROM sessions").fetchall()
            for (data_str,) in rows:
                try:
                    data = json.loads(data_str)
                    session = InterviewSession.model_validate(data)
                    sessions[session.id] = session
                except Exception:
                    continue
        return sessions

    def save_report(self, report: FinalReport) -> None:
        payload = report.model_dump_json()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO reports (session_id, generated_at, data)
                VALUES (?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    generated_at=excluded.generated_at,
                    data=excluded.data
                """,
                (report.session_id, report.generated_at.isoformat(), payload),
            )
            conn.commit()

    def delete_session(self, session_id: str) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()

    def delete_report(self, session_id: str) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM reports WHERE session_id = ?", (session_id,))
            conn.commit()

    # ── User Methods ──

    def save_user(self, user: User) -> None:
        normalized_email = user.email.strip().lower()
        normalized_name = user.name.strip()
        normalized_user = user.model_copy(update={"email": normalized_email, "name": normalized_name})
        payload = normalized_user.model_dump_json()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO users (id, name, email, role, created_at, data)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET data=excluded.data
                """,
                (
                    normalized_user.id,
                    normalized_user.name,
                    normalized_user.email,
                    normalized_user.role,
                    normalized_user.created_at.isoformat(),
                    payload,
                ),
            )
            conn.commit()

    def get_user(self, user_id: str) -> Optional[User]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT data FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                return None
            return User.model_validate(json.loads(row[0]))

    def get_user_by_email(self, email: str) -> Optional[User]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT data FROM users WHERE lower(email) = lower(?)",
                (email.strip(),),
            ).fetchone()
            if not row:
                return None
            return User.model_validate(json.loads(row[0]))

    # ── Job Methods ──

    def save_job(self, job: Job) -> None:
        payload = job.model_dump_json()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO jobs (id, hr_user_id, title, status, created_at, data)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET status=excluded.status, data=excluded.data
                """,
                (job.id, job.hr_user_id, job.title, job.status, job.created_at.isoformat(), payload),
            )
            conn.commit()

    def get_job(self, job_id: str) -> Optional[Job]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT data FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if not row:
                return None
            return Job.model_validate(json.loads(row[0]))

    def list_jobs(self, status: str = None) -> List[Job]:
        with sqlite3.connect(self.db_path) as conn:
            if status:
                rows = conn.execute("SELECT data FROM jobs WHERE status = ? ORDER BY created_at DESC", (status,)).fetchall()
            else:
                rows = conn.execute("SELECT data FROM jobs ORDER BY created_at DESC").fetchall()
            return [Job.model_validate(json.loads(r[0])) for r in rows]

    # ── Application Methods ──

    def save_application(self, app: Application) -> None:
        payload = app.model_dump_json()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO applications (id, job_id, employee_user_id, status, interview_session_id, created_at, data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET status=excluded.status, interview_session_id=excluded.interview_session_id, data=excluded.data
                """,
                (app.id, app.job_id, app.employee_user_id, app.status, app.interview_session_id, app.created_at.isoformat(), payload),
            )
            conn.commit()

    def get_application(self, app_id: str) -> Optional[Application]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT data FROM applications WHERE id = ?", (app_id,)).fetchone()
            if not row:
                return None
            return Application.model_validate(json.loads(row[0]))

    def list_applications_by_employee(self, employee_user_id: str) -> List[Application]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT data FROM applications WHERE employee_user_id = ? ORDER BY created_at DESC",
                (employee_user_id,)
            ).fetchall()
            return [Application.model_validate(json.loads(r[0])) for r in rows]

    def list_applications_by_job(self, job_id: str) -> List[Application]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT data FROM applications WHERE job_id = ? ORDER BY created_at DESC",
                (job_id,)
            ).fetchall()
            return [Application.model_validate(json.loads(r[0])) for r in rows]

    def check_existing_application(self, job_id: str, employee_user_id: str) -> Optional[Application]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT data FROM applications WHERE job_id = ? AND employee_user_id = ?",
                (job_id, employee_user_id)
            ).fetchone()
            if not row:
                return None
            return Application.model_validate(json.loads(row[0]))
