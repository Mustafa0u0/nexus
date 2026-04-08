"""
NEXUS Core Data Structures
==========================
Pydantic models for strict type validation and structured LLM outputs.
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, model_validator
from datetime import datetime
import uuid

# ─── CV & JD ANALYSIS MODELS ────────────────────────────────────────────────

class Experience(BaseModel):
    title: str = Field(..., description="Job title")
    company: str = Field(..., description="Company name")
    duration: str = Field(..., description="Duration of employment")
    highlights: List[str] = Field(default_factory=list, description="Key achievements or responsibilities")

class Education(BaseModel):
    degree: str = Field(..., description="Degree obtained")
    institution: str = Field(..., description="University or institution")
    year: str = Field(..., description="Year of graduation")

class CVAnalysis(BaseModel):
    name: Optional[str] = Field(None, description="Candidate's full name")
    skills: List[str] = Field(default_factory=list, description="List of technical and soft skills")
    experience_years: float = Field(0.0, description="Total years of professional experience")
    experiences: List[Experience] = Field(default_factory=list, description="Work history")
    education: List[Education] = Field(default_factory=list, description="Educational background")
    projects: List[str] = Field(default_factory=list, description="Notable projects")
    tools: List[str] = Field(default_factory=list, description="Tools and technologies used")
    summary: str = Field("", description="Brief professional summary")

class JDAnalysis(BaseModel):
    title: str = Field(..., description="Job title")
    company: Optional[str] = Field(None, description="Company name")
    required_skills: List[str] = Field(default_factory=list, description="Mandatory skills")
    preferred_skills: List[str] = Field(default_factory=list, description="Nice-to-have skills")
    experience_required: str = Field("", description="Experience requirement text")
    education_required: str = Field("", description="Education requirement text")
    key_responsibilities: List[str] = Field(default_factory=list, description="Core duties")
    soft_skills: List[str] = Field(default_factory=list, description="Required soft skills")
    summary: str = Field("", description="Brief role summary")

# ─── GAP ANALYSIS MODELS ────────────────────────────────────────────────────

class ProbeArea(BaseModel):
    area: str = Field(..., description="The specific skill or gap to probe")
    reason: str = Field(..., description="Why this needs investigation")
    priority: Literal["high", "medium", "low"] = Field("medium", description="Importance of this probe")

class GapAnalysis(BaseModel):
    match_score: float = Field(..., ge=0, le=100, description="Overall alignment score (0-100)")
    matched_skills: List[str] = Field(default_factory=list, description="Skills present in both CV and JD")
    missing_skills: List[str] = Field(default_factory=list, description="Required skills missing from CV")
    experience_gap: str = Field("None", description="Analysis of experience gap")
    education_match: bool = Field(True, description="Whether education requirements are met")
    strengths: List[str] = Field(default_factory=list, description="Candidate's key strengths")
    concerns: List[str] = Field(default_factory=list, description="Potential red flags or concerns")
    probe_areas: List[ProbeArea] = Field(default_factory=list, description="Areas requiring interview verification")

# ─── INTERVIEW CONTENT MODELS ───────────────────────────────────────────────

<<<<<<< HEAD
class Question(BaseModel):
    id: int = Field(..., description="Question sequence number")
    question: str = Field(..., description="The actual question text to speak")
    target_area: str = Field(..., description="The competency or gap being assessed")
    category: Literal["technical", "behavioral", "situational", "competency", "introduction", "closing"] = Field(..., description="Type of question")
    rubric_focus: str = Field(..., description="What a strong answer should demonstrate")
    follow_up_hint: Optional[str] = Field(None, description="Hint for generating a follow-up if needed")

class ScoreDetail(BaseModel):
    score: int = Field(..., ge=1, le=10, description="Score from 1 to 10")
    evidence: str = Field(..., description="Direct quote from the candidate's answer")
    reasoning: str = Field(..., description="Explanation for the assigned score")

class RubricScores(BaseModel):
    """
    Nexus 10-Dimension Evaluation Rubric (100-Point Scale)
    Each dimension scored 1-10. Total = sum of all dimensions.

    Score Anchors (1-10):
        1-2  = Poor: No evidence or entirely unrelated.
        3-4  = Below Expectations: Minimal evidence. Vague or surface-level.
        5-6  = Meets Expectations: Adequate evidence with some examples.
        7-8  = Exceeds Expectations: Strong evidence. Detailed and well-structured.
        9-10 = Exceptional: Outstanding, expert-level with concrete data-driven examples.
    """
    role_alignment: ScoreDetail = Field(
        ..., description="How well the candidate's experience matches the JD. Industry-specific terminology. (10 pts)")
    technical_depth: ScoreDetail = Field(
        ..., description="Hard skills mastery. Process description over mere tool name-dropping. (10 pts)")
    evidence_of_impact: ScoreDetail = Field(
        ..., description="Results over tasks. Data points, percentages, concrete outcomes. (10 pts)")
    communication_clarity: ScoreDetail = Field(
        ..., description="Structured thought flow, minimal filler words, easy to follow. (10 pts)")
    problem_solving: ScoreDetail = Field(
        ..., description="Step-by-step logic: Identification → Action → Resolution. (10 pts)")
    star_compliance: ScoreDetail = Field(
        ..., description="Behavioral answers contain Situation, Task, Action, Result components. (10 pts)")
    soft_skills: ScoreDetail = Field(
        ..., description="Emphasis on collective success, collaboration, feedback, EQ. (10 pts)")
    adaptability: ScoreDetail = Field(
        ..., description="Growth mindset. Mentions upskilling, adjusting, or pivoting. (10 pts)")
    culture_fit: ScoreDetail = Field(
        ..., description="Alignment with company mission and work style from JD. (10 pts)")
    professionalism: ScoreDetail = Field(
        ..., description="Respectful, confident tone appropriate for the industry. (10 pts)")

class AnswerScore(BaseModel):
    question_id: int = Field(..., description="ID of the question answered")
    question_text: str = Field(..., description="The question text")
    answer_text: str = Field(..., description="The candidate's response")
    scores: RubricScores = Field(..., description="Structured scores across 10 dimensions")
    average_score: float = Field(..., description="Mean of dimension scores (out of 10)")
    needs_follow_up: bool = Field(False, description="Whether a follow-up is recommended")
    follow_up_reason: Optional[str] = Field(None, description="Reason for follow-up")

class AnswerScoreLLM(BaseModel):
    """LLM-only payload for scoring before hydration with question/answer metadata."""
    scores: RubricScores = Field(..., description="Structured scores across 10 dimensions")
    average_score: float = Field(0.0, description="Mean of dimension scores (out of 10)")
    needs_follow_up: bool = Field(False, description="Whether a follow-up is recommended")
    follow_up_reason: Optional[str] = Field(None, description="Reason for follow-up")
=======
class Question(BaseModel):
    id: int = Field(..., description="Question sequence number")
    question: str = Field(..., description="The actual question text to speak")
    target_area: str = Field(..., description="The competency or gap being assessed")
    category: Literal["technical", "behavioral", "situational", "competency", "introduction", "closing"] = Field(..., description="Type of question")
    rubric_focus: str = Field(..., description="What a strong answer should demonstrate")
    follow_up_hint: Optional[str] = Field(None, description="Hint for generating a follow-up if needed")

class ScoreDetail(BaseModel):
    score: int = Field(..., ge=0, le=10, description="Score from 1 to 10")
    evidence: str = Field(..., description="Direct quote from the candidate's answer")
    reasoning: str = Field(..., description="Explanation for the assigned score")


def _coerce_legacy_score_detail(detail: Any, source: str) -> Dict[str, Any]:
    if isinstance(detail, ScoreDetail):
        payload = detail.model_dump()
    elif isinstance(detail, dict):
        payload = dict(detail)
    else:
        payload = {"score": detail}

    try:
        score = int(payload.get("score", 0) or 0)
    except (TypeError, ValueError):
        score = 0

    # Legacy sessions used a 1-5 rubric. Expand them to the new 1-10 scale.
    if 0 <= score <= 5:
        score = min(score * 2, 10)

    evidence = payload.get("evidence") or f"Migrated from legacy rubric field '{source}'."
    reasoning = payload.get("reasoning") or f"Migrated from legacy rubric field '{source}'."

    return {
        "score": score,
        "evidence": evidence,
        "reasoning": reasoning,
    }


class RubricScores(BaseModel):
    """
    10-Dimension interview rubric used by the NEXUS orchestrator.

    Legacy 6-dimension session data is migrated into this schema automatically
    so existing saved sessions can still be loaded and reported on.
    """
    role_alignment: ScoreDetail = Field(..., description="Experience match to JD, domain vocabulary, and relevance.")
    technical_depth: ScoreDetail = Field(..., description="Hard skills mastery, process depth, and real implementation knowledge.")
    evidence_of_impact: ScoreDetail = Field(..., description="Use of concrete outcomes, metrics, ownership, and business impact.")
    communication_clarity: ScoreDetail = Field(..., description="Clarity, structure, brevity, and understandable delivery.")
    problem_solving: ScoreDetail = Field(..., description="Root-cause thinking, decision quality, and structured execution.")
    star_compliance: ScoreDetail = Field(..., description="Use of Situation, Task, Action, Result in behavioral responses.")
    soft_skills: ScoreDetail = Field(..., description="Collaboration, teamwork, emotional intelligence, and stakeholder handling.")
    adaptability: ScoreDetail = Field(..., description="Learning agility, resilience, prioritization, and response to change.")
    culture_fit: ScoreDetail = Field(..., description="Alignment with company values, mission, and operating style.")
    professionalism: ScoreDetail = Field(..., description="Professional tone, confidence, composure, and candidate maturity.")

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_schema(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        if "technical_depth" in data or "communication_clarity" in data:
            return data

        legacy_fields = {
            "technical_competency",
            "problem_solving",
            "communication",
            "behavioral_fit",
            "adaptability",
            "role_alignment",
        }
        if not legacy_fields.intersection(data):
            return data

        technical = _coerce_legacy_score_detail(data.get("technical_competency"), "technical_competency")
        problem_solving = _coerce_legacy_score_detail(data.get("problem_solving"), "problem_solving")
        communication = _coerce_legacy_score_detail(data.get("communication"), "communication")
        behavioral_fit = _coerce_legacy_score_detail(data.get("behavioral_fit"), "behavioral_fit")
        adaptability = _coerce_legacy_score_detail(data.get("adaptability"), "adaptability")
        role_alignment = _coerce_legacy_score_detail(data.get("role_alignment"), "role_alignment")

        return {
            "role_alignment": role_alignment,
            "technical_depth": technical,
            "evidence_of_impact": technical,
            "communication_clarity": communication,
            "problem_solving": problem_solving,
            "star_compliance": behavioral_fit,
            "soft_skills": behavioral_fit,
            "adaptability": adaptability,
            "culture_fit": behavioral_fit,
            "professionalism": communication,
        }

class AnswerScore(BaseModel):
    question_id: int = Field(..., description="ID of the question answered")
    question_text: str = Field(..., description="The question text")
    answer_text: str = Field(..., description="The candidate's response")
    scores: RubricScores = Field(..., description="Structured scores across 10 rubric dimensions")
    average_score: float = Field(..., description="Mean of dimension scores")
    needs_follow_up: bool = Field(False, description="Whether a follow-up is recommended")
    follow_up_reason: Optional[str] = Field(None, description="Reason for follow-up")

class AnswerScoreLLM(BaseModel):
    """LLM-only payload for scoring before hydration with question/answer metadata."""
    scores: RubricScores = Field(..., description="Structured scores across 10 rubric dimensions")
    average_score: float = Field(0.0, description="Mean of dimension scores")
    needs_follow_up: bool = Field(False, description="Whether a follow-up is recommended")
    follow_up_reason: Optional[str] = Field(None, description="Reason for follow-up")
>>>>>>> e56b4f4 (fix the ai respond)

class Recommendation(BaseModel):
    recommendation: Literal["RECOMMEND", "CONSIDER", "DO NOT RECOMMEND"] = Field(..., description="Hiring recommendation")
    summary: str = Field(..., description="Executive summary")
    strengths: List[str] = Field(default_factory=list, description="Key strengths identified")
    areas_for_development: List[str] = Field(default_factory=list, description="Areas needing improvement")
    hiring_confidence: float = Field(..., ge=0, le=100, description="Confidence in the recommendation")

class FinalReport(BaseModel):
    session_id: str
    generated_at: datetime
    candidate: CVAnalysis
    job: JDAnalysis
    gap_analysis: GapAnalysis
    interview_duration: Optional[str]
    total_questions: int
    questions_answered: int
    rubric_scores: Dict[str, float]
    per_question_scores: List[AnswerScore]
    recommendation: Recommendation
    transcript: List[Dict]
    response_latencies: List[Dict]
    model_info: Dict[str, str]

# ─── SESSION STATE ──────────────────────────────────────────────────────────

class EyeContactMetric(BaseModel):
    timestamp: float
    gaze_on_screen: bool
    confidence: float

class InterviewSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.now)
    status: Literal["idle", "setup", "ready", "interviewing", "completed", "error"] = "idle"

    # Input Data
    cv_text: str = ""
    jd_text: str = ""

    # Analysis Data
    cv_analysis: Optional[CVAnalysis] = None
    jd_analysis: Optional[JDAnalysis] = None
    gap_analysis: Optional[GapAnalysis] = None

    # Interview Flow
    questions: List[Question] = Field(default_factory=list)
    current_question_index: int = 0
    conversation_history: List[Dict] = Field(default_factory=list) # Raw chat logs
    scores: List[AnswerScore] = Field(default_factory=list)
    answers: List[Dict] = Field(default_factory=list)

    # Metadata
    timings: List[Dict] = Field(default_factory=list)
    models_used: List[str] = Field(default_factory=list)
    followed_up_questions: List[int] = Field(default_factory=list) # IDs of questions we've already followed up on

    # Prefetched audio
    prefetched_welcome_audio: Optional[str] = None
    prefetched_welcome_text: Optional[str] = None
    prefetched_welcome_audio_b64: Optional[str] = None

    # Camera / Eye Tracking
    eye_contact_logs: List[EyeContactMetric] = Field(default_factory=list)

# ─── HR PORTAL MODELS ───────────────────────────────────────────────────────

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    role: Literal["hr", "employee"]
    created_at: datetime = Field(default_factory=datetime.now)

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hr_user_id: str
    title: str
    description_text: str
    status: Literal["open", "closed"] = "open"
    created_at: datetime = Field(default_factory=datetime.now)

class Application(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    employee_user_id: str
    employee_name: str = ""
    cv_text: str = ""
    status: Literal["applied", "invited", "interviewing", "completed"] = "applied"
    interview_session_id: Optional[str] = None
    video_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
