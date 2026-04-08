"""
NEXUS Interview Orchestrator
============================
Manages the lifecycle of interview sessions, including:
- Parallel CV/JD Analysis
- Gap Analysis & Question Generation
- Interview Flow Control (Q&A Loop)
- Scoring & Adaptive Follow-ups
- Persistent Storage
"""

import asyncio
import logging
import json
import os
import re
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from datetime import datetime

from .structs import (
    InterviewSession, CVAnalysis, JDAnalysis, GapAnalysis,
    Question, AnswerScore, AnswerScoreLLM, FinalReport, RubricScores,
    Recommendation, EyeContactMetric
)
from .llm_gateway import llm_gateway
from .storage import SQLiteSessionStore
from pydantic import BaseModel

class QuestionList(BaseModel):
    """Wrapper for structured question generation."""
    questions: List[Question]

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = Path("research_data/sessions")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(os.getenv("NEXUS_DB_PATH", "research_data/nexus.db"))
WRITE_JSON = os.getenv("NEXUS_WRITE_JSON", "0") == "1"

TURN_PREFIX_RE = re.compile(r"^\s*Turn\s+\d+\s*/\s*\d+\s*[:\-]?\s*", re.IGNORECASE)
TARGET_QUESTION_COUNT = 12
RUBRIC_DIMENSIONS = [
    "role_alignment",
    "technical_depth",
    "evidence_of_impact",
    "communication_clarity",
    "problem_solving",
    "star_compliance",
    "soft_skills",
    "adaptability",
    "culture_fit",
    "professionalism",
]


def _strip_turn_prefix(text: str) -> str:
    if not text:
        return text
    return TURN_PREFIX_RE.sub("", text).strip()


def _calculate_average_score(scores: RubricScores) -> float:
    total = sum(getattr(scores, dim).score for dim in RUBRIC_DIMENSIONS)
    return round(total / len(RUBRIC_DIMENSIONS), 2)

class SessionManager:
    """Session storage with JSON persistence."""
    _sessions: Dict[str, InterviewSession] = {}
    _store = SQLiteSessionStore(DB_PATH)

    @classmethod
    def load_all_sessions(cls):
        """Load sessions from disk on startup."""
        try:
            cls._sessions = cls._store.load_all_sessions()
        except Exception as e:
            logger.warning(f"Failed to load sessions from DB: {e}")
            cls._sessions = {}

        if cls._sessions:
            return

        for file in DATA_DIR.glob("*.json"):
            try:
                data = json.loads(file.read_text(encoding="utf-8"))
                session = InterviewSession.model_validate(data)
                cls._sessions[session.id] = session
                cls._store.save_session(session)
            except Exception as e:
                logger.warning(f"Failed to load session {file}: {e}")

    @classmethod
    def save_session(cls, session: InterviewSession):
        """Persist session to disk."""
        cls._store.save_session(session)
        if WRITE_JSON:
            path = DATA_DIR / f"{session.id}.json"
            path.write_text(session.model_dump_json(indent=2), encoding="utf-8")

    @classmethod
    def create_session(cls) -> InterviewSession:
        session = InterviewSession()
        cls._sessions[session.id] = session
        cls.save_session(session)
        return session

    @classmethod
    def get_session(cls, session_id: str) -> Optional[InterviewSession]:
        session = cls._sessions.get(session_id)
        if session:
            return session

        session = cls._store.load_session(session_id)
        if session:
            cls._sessions[session_id] = session
        return session

    @classmethod
    def list_sessions(cls):
        return cls._sessions.values()

    @classmethod
    def save_report(cls, report: FinalReport) -> None:
        cls._store.save_report(report)

    @classmethod
    def delete_session(cls, session_id: str) -> None:
        if session_id in cls._sessions:
            cls._sessions.pop(session_id, None)
        cls._store.delete_session(session_id)
        cls._store.delete_report(session_id)
        if WRITE_JSON:
            path = DATA_DIR / f"{session_id}.json"
            if path.exists():
                path.unlink()

# Load sessions immediately
SessionManager.load_all_sessions()


class InterviewOrchestrator:
    """
    The Brain of NEXUS. Coordinates data flow between API, LLM, and Session.
    """

    @staticmethod
    async def analyze_candidate(session_id: str, cv_text: str, jd_text: str) -> Dict:
        """
        Step 1: Parallel Analysis of CV and JD, followed by Gap Analysis.
        """
        session = SessionManager.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        max_chars = int(os.getenv("NEXUS_MAX_INPUT_CHARS", "12000"))
        def _prep(text: str) -> str:
            cleaned = (text or "").replace("\x00", "").strip()
            if len(cleaned) > max_chars:
                logger.warning(f"Input truncated from {len(cleaned)} to {max_chars} chars")
                return cleaned[:max_chars]
            return cleaned

        cv_text = _prep(cv_text)
        jd_text = _prep(jd_text)
        if not cv_text or not jd_text:
            raise RuntimeError("CV and JD text must be provided.")

        session.cv_text = cv_text
        session.jd_text = jd_text
        session.status = "setup"
        SessionManager.save_session(session)

        # 1. Parallel Execution: CV Parsing & JD Parsing
        logger.info(f"Session {session_id}: Starting parallel analysis...")

        async def parse_cv():
            prompt = "Extract structured data from this CV:"
            return await llm_gateway.generate_structured(prompt, cv_text, CVAnalysis)

        async def parse_jd():
            prompt = "Extract structured requirements from this Job Description:"
            return await llm_gateway.generate_structured(prompt, jd_text, JDAnalysis)

        try:
            cv_data, jd_data = await asyncio.gather(parse_cv(), parse_jd())
            session.cv_analysis = cv_data
            session.jd_analysis = jd_data
            SessionManager.save_session(session)
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            raise RuntimeError(f"Failed to analyze documents: {str(e)}")

        # 2. Sequential Execution: Gap Analysis (Depends on CV & JD)
        logger.info(f"Session {session_id}: Analyzing gaps...")

        gap_prompt = """Compare the candidate's CV against the Job Description.
Identify matches, gaps, and areas to probe. Be critical but fair.
"""
        user_content = f"CV: {cv_data.model_dump_json()}\nJD: {jd_data.model_dump_json()}"

        try:
            gap_data = await llm_gateway.generate_structured(gap_prompt, user_content, GapAnalysis)
            session.gap_analysis = gap_data
            SessionManager.save_session(session)
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            raise RuntimeError(f"Failed to analyze gaps: {str(e)}")

<<<<<<< HEAD
        # 3. Question Generation (Universal 10-Question Recruitment Framework)
        logger.info(f"Session {session_id}: Generating 10 interview questions...")

        goals_prompt = """Generate EXACTLY 10 interview questions using the Universal 10-Question Recruitment Framework.
Adapt the tone based on the department (e.g., Sales = outcome-oriented; Tech/HR = analytical).

PHASE 1 – Context & Validation (2 Questions):
Q1: Role Alignment Opener – Ask how their background makes them the right fit for the JD challenges.
Q2: Major Impact Inquiry – A key JD responsibility; describe a time they delivered high-impact results.

PHASE 2 – Domain-Specific Competency (4 Questions):
Q3: Methodology & Workflow – "Walk me through your process for [Primary Task from JD]."
Q4: Tooling & Environment – Proficiency with specific software/systems from the JD.
Q5: Quality & Accuracy – "How do you ensure accuracy in [Key Deliverable from JD]?"
Q6: Scenario-Based Execution – A realistic "What if" scenario from a common industry hurdle.

PHASE 3 – Behavioral & Interpersonal (3 Questions):
Q7: Collaborative Problem Solving – Working with a difficult teammate or cross-functional team.
Q8: Adaptability & Learning – Learning a new system or adapting to a major strategic change.
Q9: Self-Management & Prioritization – Handling high-volume workload or competing deadlines.

PHASE 4 – Cultural Fit & Closing (1 Question):
Q10: Value Proposition – "Beyond skills, what professional habit or perspective do you bring
     that consistently improves the teams you work on?"
=======
        # 3. Question Generation (Universal 12-Question Recruitment Framework)
        logger.info(f"Session {session_id}: Generating {TARGET_QUESTION_COUNT} interview questions...")

        goals_prompt = """Generate EXACTLY 12 interview questions using the Universal 12-Question Recruitment Framework.
Adapt the tone based on the department (e.g., Sales = outcome-oriented; Tech/HR = analytical).

PHASE 1 - Context & Validation (2 Questions):
Q1: Role Alignment Opener - Ask the candidate to explain how their specific background or any previous skills or experiences that could be relevant fit for the challenges mentioned in the JD.
Q2: Major Impact Inquiry - Identify a key responsibility in the JD and ask the candidate to describe a time they delivered a high-impact result in a similar area.

PHASE 2 - Domain-Specific Competency (4 Questions):
Q3: Methodology & Workflow - "Walk me through your typical process for [Primary Task from JD]."
Q4: Tooling & Environment - Ask about proficiency with specific software or systems from the JD and how they use them to stay efficient.
Q5: Quality & Accuracy - "How do you ensure the quality and accuracy of your work when dealing with [Key Deliverable from JD]?"
Q6: Scenario-Based Execution - Generate a realistic "What if" scenario based on a common hurdle in that industry.

PHASE 3 - Deep Dive: Core Role Mastery (3 Questions):
PURPOSE: These 3 questions test whether the candidate truly understands the #1 core responsibility in the JD at a deep level. These are not surface-level questions. They should feel like a senior expert probing a peer.
Q7: Deep Technical Probe - Take the single most critical deliverable or responsibility from the JD and ask the candidate to explain their exact approach in granular detail, including step-by-step methodology, decision points, and edge cases they handle.
Q8: Failure & Recovery Scenario - Present a specific, realistic failure scenario related to the core responsibility and ask how they would diagnose the root cause and recover.
Q9: Expert-Level Trade-off - Ask a question that requires the candidate to weigh competing priorities or make a difficult technical or strategic judgment call related to the core JD responsibility.

PHASE 4 - Behavioral & Interpersonal (2 Questions):
Q10: Collaborative Problem Solving - Ask for an example of a time they had to work with a difficult teammate or a different department to achieve a common goal.
Q11: Adaptability, Learning & Self-Management - Ask about a time they had to learn a new system, adapt to a major strategic change, or manage competing deadlines under pressure. This should cover both adaptability and prioritization.

PHASE 5 - Cultural Fit & Closing (1 Question):
Q12: Value Proposition - "Beyond the technical requirements, what is one professional habit or perspective you bring that consistently improves the teams you work on?"
>>>>>>> e56b4f4 (fix the ai respond)

Each question must include:
- id (1..12)
- question (the text to ask)
- target_area (skill/competency)
- category (technical/behavioral/situational/competency/introduction/closing)
- rubric_focus (what a strong answer demonstrates)
- follow_up_hint (optional)
"""

        g_user_content = (
            f"CV Analysis: {cv_data.model_dump_json()}\n"
            f"JD Analysis: {jd_data.model_dump_json()}\n"
            f"Gap Analysis: {gap_data.model_dump_json()}"
        )

        try:
            g_list = await llm_gateway.generate_structured(
                goals_prompt,
                g_user_content,
                QuestionList,
                max_tokens=4096,
            )
            session.questions = g_list.questions
            session.status = "ready"
            SessionManager.save_session(session)
        except Exception as e:
            logger.error(f"Goal generation failed: {e}")
            raise RuntimeError(f"Failed to generate goals: {str(e)}")

        return {
            "cv": session.cv_analysis,
            "jd": session.jd_analysis,
            "gaps": session.gap_analysis,
            "questions": session.questions
        }

    @staticmethod
    async def get_next_question(session_id: str) -> Optional[str]:
        """
        Get the text of the next question to ask.
        """
        session = SessionManager.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        if not session.questions:
            session.status = "error"
            SessionManager.save_session(session)
            return None

        if session.current_question_index >= len(session.questions):
            session.status = "completed"
            SessionManager.save_session(session)
            return None

        q = session.questions[session.current_question_index]
        return _strip_turn_prefix(q.question)

    @staticmethod
    async def process_answer(session_id: str, transcript: str, eye_metrics: List[EyeContactMetric] = None) -> Tuple[str, bool]:
        """
        Process the candidate's answer:
        1. Log Eye Contact metrics.
        2. Score the answer (Async).
        3. Decide on follow-up.
        4. Return the next response (Follow-up or Next Question).
        """
        session = SessionManager.get_session(session_id)
        if not session or session.status == "completed":
            return "Interview is complete. Thank you.", True

        if not session.questions or session.current_question_index >= len(session.questions):
            session.status = "error"
            SessionManager.save_session(session)
            return "Interview setup is incomplete. Please restart the session.", True

        # 0. Log Eye Metrics
        if eye_metrics:
            session.eye_contact_logs.extend(eye_metrics)
            # Simple avg confidence check
            avg_conf = sum(m.confidence for m in eye_metrics) / len(eye_metrics) if eye_metrics else 0
            logger.info(f"Session {session_id}: Eye Contact Avg Confidence: {avg_conf:.2f}")

        current_q = session.questions[session.current_question_index]
        session.answers.append(
            {
                "question_id": current_q.id,
                "question_text": current_q.question,
                "answer_text": transcript,
            }
        )

        defer_scoring = os.getenv("NEXUS_DEFER_SCORING", "0") == "1"
        follow_up_reason = None
        # 1. Score Answer (or defer)
        logger.info(f"Session {session_id}: Processing answer to Q{current_q.id}...")

        score_prompt = """Score the candidate's answer using the Nexus 10-Dimension Evaluation Rubric.
You MUST provide a direct quote as evidence for every score.
Provide a brief rationale for each score.

10 Dimensions (each scored 1-10):
<<<<<<< HEAD
1. role_alignment – Experience match to JD, industry-specific terminology.
2. technical_depth – Hard skills mastery, process description over name-dropping.
3. evidence_of_impact – Results over tasks. Data points, percentages, concrete outcomes.
4. communication_clarity – Clarity, minimal filler words, logical flow.
5. problem_solving – Step-by-step logic: Identification → Action → Resolution.
6. star_compliance – Situation, Task, Action, Result structure in behavioral answers.
7. soft_skills – Collaboration, teamwork, EQ keywords ("we", "team", "feedback").
8. adaptability – Growth mindset. Mentions upskilling, adjusting, or pivoting.
9. culture_fit – Alignment with company mission/values from JD.
10. professionalism – Respectful, confident tone appropriate for the industry.
=======
1. role_alignment - Experience match to JD, industry-specific terminology.
2. technical_depth - Hard skills mastery, process description over name-dropping.
3. evidence_of_impact - Results over tasks. Data points, percentages, concrete outcomes.
4. communication_clarity - Clarity, minimal filler words, logical flow.
5. problem_solving - Step-by-step logic: Identification -> Action -> Resolution.
6. star_compliance - Situation, Task, Action, Result structure in behavioral answers.
7. soft_skills - Collaboration, teamwork, EQ keywords such as "we", "team", and "feedback".
8. adaptability - Growth mindset. Mentions upskilling, adjusting, or pivoting.
9. culture_fit - Alignment with company mission or values from JD.
10. professionalism - Respectful, confident tone appropriate for the industry.
>>>>>>> e56b4f4 (fix the ai respond)

Score Anchors:
1-2 = Poor | 3-4 = Below | 5-6 = Meets | 7-8 = Exceeds | 9-10 = Exceptional
"""

        recent_history = session.conversation_history[-4:] if session.conversation_history else []
        user_content = f"""
Recent Conversation History (last 4 turns):
{json.dumps(recent_history, indent=2)}

Current Assessment:
Question: {current_q.question}
Target Area: {current_q.target_area}
Rubric Focus: {current_q.rubric_focus}

Candidate Answer: "{transcript}"
"""

        if not defer_scoring:
            try:
                llm_score = await llm_gateway.generate_structured(
                    score_prompt,
                    user_content,
                    AnswerScoreLLM,
                    max_tokens=3072,
                )
                if not llm_score.average_score:
<<<<<<< HEAD
                    dims = llm_score.scores
                    llm_score.average_score = round(
                        (dims.role_alignment.score +
                         dims.technical_depth.score +
                         dims.evidence_of_impact.score +
                         dims.communication_clarity.score +
                         dims.problem_solving.score +
                         dims.star_compliance.score +
                         dims.soft_skills.score +
                         dims.adaptability.score +
                         dims.culture_fit.score +
                         dims.professionalism.score) / 10
                    , 2)
=======
                    llm_score.average_score = _calculate_average_score(llm_score.scores)
>>>>>>> e56b4f4 (fix the ai respond)

                score_data = AnswerScore(
                    question_id=current_q.id,
                    question_text=current_q.question,
                    answer_text=transcript,
                    scores=llm_score.scores,
                    average_score=llm_score.average_score,
                    needs_follow_up=llm_score.needs_follow_up,
                    follow_up_reason=llm_score.follow_up_reason,
                )

                session.scores.append(score_data)
                follow_up_reason = llm_score.follow_up_reason
            except Exception as e:
                logger.error(f"Scoring failed: {e}")
        SessionManager.save_session(session)

        # 2. Check for Completion
        answered_question_ids = {item["question_id"] for item in session.answers}
        current_turn = len(answered_question_ids)
        turn_target = len(session.questions) if session.questions else TARGET_QUESTION_COUNT
        if current_turn >= turn_target:
             session.status = "completed"
             SessionManager.save_session(session)
             return "Thank you for your time. This concludes our technical interview. NEXUS is now compiling your final assessment.", True

        # 3. Dynamic Question Generation (React + Next Goal)
        logger.info(f"Session {session_id}: Generating dynamic turn {current_turn + 1}...")

        # Find unmet goals
        met_goal_ids = answered_question_ids | {score.question_id for score in session.scores}
        remaining_goals = [g for g in session.questions if g.id not in met_goal_ids]
        
        next_goal = remaining_goals[0] if remaining_goals else session.questions[-1]

        dynamic_prompt = f"""You are a human HR recruiter conducting a conversational interview.

TARGET AREA: {next_goal.target_area}
QUESTION CATEGORY: {next_goal.category}
PREPARED QUESTION: "{next_goal.question}"
WHAT A STRONG ANSWER SHOULD DEMONSTRATE: {next_goal.rubric_focus}
{f'FOLLOW-UP HINT: {next_goal.follow_up_hint}' if next_goal.follow_up_hint else ''}
{f'SCORE-BASED FOLLOW-UP REASON: {follow_up_reason}' if follow_up_reason else ''}

Last candidate answer: "{transcript}"

YOUR TASK:
- Naturally transition from their last answer and ask the PREPARED QUESTION above.
- You MAY rephrase the prepared question slightly to sound conversational, but you MUST keep the core intent and JD-specific details intact.
- If the last answer was weak or vague, ask a short follow-up to get specifics BEFORE moving to the prepared question.
- Do NOT water down the question into something generic. The question was tailored to the Job Description - keep it specific.

CRITICAL RULES:
- Never repeat a question you've already asked.
- Keep your response extremely brief (1-2 sentences maximum).
- Talk like a real human recruiter, not a robotic AI. No long preambles, no generic pleasantries, no "Great answer!" every time.
- Move the conversation forward naturally.

Conversation history (last 2 turns):
{json.dumps(session.conversation_history[-2:], indent=2)}
"""
        try:
            next_turn_text = await llm_gateway.generate_text(
                "System: Professional AI Interviewer",
                dynamic_prompt,
                temperature=0.6,
                max_tokens=256
            )
            next_turn_text = _strip_turn_prefix(next_turn_text)
            
            # Transition to next index for record keeping
            if session.current_question_index < len(session.questions):
                session.current_question_index += 1
            SessionManager.save_session(session)
            
            return next_turn_text, False

        except Exception as e:
            logger.error(f"Dynamic generation failed: {e}")
            return _strip_turn_prefix("Moving forward... " + next_goal.question), False

    @staticmethod
    async def generate_final_report(session_id: str) -> FinalReport:
        """
        Compile all data into a structured report.
        """
        session = SessionManager.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        logger.info(f"Session {session_id}: Generating final report...")

        # Calculate Aggregates
        scores = session.scores
        scored_question_ids = {score.question_id for score in session.scores}
        pending_answers = [
            item for item in session.answers
            if item["question_id"] not in scored_question_ids
        ]

        if pending_answers:
            for item in pending_answers:
                current_q = Question(
                    id=item["question_id"],
                    question=item["question_text"],
                    target_area="N/A",
                    category="competency",
                    rubric_focus="N/A",
                    follow_up_hint=None
                )
                score_prompt = """Score the candidate's answer using the Nexus 10-Dimension Evaluation Rubric.
You MUST provide a direct quote as evidence for every score.
<<<<<<< HEAD
=======
Provide a brief rationale for each score.

>>>>>>> e56b4f4 (fix the ai respond)
10 Dimensions (each 1-10): role_alignment, technical_depth, evidence_of_impact,
communication_clarity, problem_solving, star_compliance, soft_skills, adaptability,
culture_fit, professionalism.
Score 1-10. 1-2=Poor, 3-4=Below, 5-6=Meets, 7-8=Exceeds, 9-10=Exceptional.
"""
                user_content = f"""
Question: {current_q.question}
Target Area: {current_q.target_area}
Rubric Focus: {current_q.rubric_focus}

Candidate Answer: "{item['answer_text']}"
"""
                try:
                    llm_score = await llm_gateway.generate_structured(
                        score_prompt,
                        user_content,
                        AnswerScoreLLM,
                        max_tokens=3072,
                    )
                    if not llm_score.average_score:
<<<<<<< HEAD
                        dims = llm_score.scores
                        llm_score.average_score = round(
                            (dims.role_alignment.score +
                             dims.technical_depth.score +
                             dims.evidence_of_impact.score +
                             dims.communication_clarity.score +
                             dims.problem_solving.score +
                             dims.star_compliance.score +
                             dims.soft_skills.score +
                             dims.adaptability.score +
                             dims.culture_fit.score +
                             dims.professionalism.score) / 10
                        , 2)
=======
                        llm_score.average_score = _calculate_average_score(llm_score.scores)
>>>>>>> e56b4f4 (fix the ai respond)
                    session.scores.append(
                        AnswerScore(
                            question_id=item["question_id"],
                            question_text=item["question_text"],
                            answer_text=item["answer_text"],
                            scores=llm_score.scores,
                            average_score=llm_score.average_score,
                            needs_follow_up=llm_score.needs_follow_up,
                            follow_up_reason=llm_score.follow_up_reason,
                        )
                    )
                except Exception as e:
                    logger.error(f"Deferred scoring failed: {e}")
            SessionManager.save_session(session)
            scores = session.scores
        dims_config = [
            ("role_alignment", 0.10), ("technical_depth", 0.10),
            ("evidence_of_impact", 0.10), ("communication_clarity", 0.10),
            ("problem_solving", 0.10), ("star_compliance", 0.10),
            ("soft_skills", 0.10), ("adaptability", 0.10),
            ("culture_fit", 0.10), ("professionalism", 0.10)
        ]
        rubric_avg = {name: 0.0 for name, _ in dims_config}
        rubric_avg["overall"] = 0.0

        if scores:
            for dim, _ in dims_config:
                total = sum(getattr(s.scores, dim).score for s in scores)
                rubric_avg[dim] = round(total / len(scores), 2)
            rubric_avg["overall"] = round(sum(s.average_score for s in scores) / len(scores), 2)

        # Generate Recommendation
        rec_prompt = "Review the interview scores and generate a hiring recommendation."
        rec_context = f"""
Candidate: {session.cv_analysis.name}
Role: {session.jd_analysis.title}
Scores: {rubric_avg}
Detailed Scores: {[s.model_dump_json() for s in scores]}
"""
        recommendation = await llm_gateway.generate_structured(rec_prompt, rec_context, Recommendation)

        report = FinalReport(
            session_id=session.id,
            generated_at=datetime.now(),
            candidate=session.cv_analysis,
            job=session.jd_analysis,
            gap_analysis=session.gap_analysis,
            interview_duration="N/A", # Calc later
            total_questions=len(session.questions),
            questions_answered=len({item["question_id"] for item in session.answers}) or len(session.scores),
            rubric_scores=rubric_avg,
            per_question_scores=session.scores,
            recommendation=recommendation,
            transcript=session.conversation_history,
            response_latencies=session.timings,
            model_info={"provider": "Groq", "model": llm_gateway.primary_model}
        )

        SessionManager.save_report(report)
        return report

orchestrator = InterviewOrchestrator()
