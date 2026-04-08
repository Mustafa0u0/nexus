
# ═════════════════════════════════════════════════════════════════════════
# NEXUS AI ENGINE
# Core Logic for Interview Gap Analysis and Question Generation
# ═════════════════════════════════════════════════════════════════════════

import json
import logging
from typing import Dict, List, Optional
from datetime import datetime
from groq import Groq

from .config import GROQ_API_KEY, LLM_MODEL, LLM_TEMP, LLM_MAX_TOKENS

# Setup Research-Grade Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NexusEngine:
    """
    Main engine for the NEXUS specific research methodology:
    1. Parse CV (Structured Extraction)
    2. Parse JD (Requirement Mapping)
    3. Gap Analysis (Comparative Logic)
    4. Adaptive Interview (Dynamic Q&A)
    """

    def __init__(self):
        try:
            self.client = Groq(api_key=GROQ_API_KEY)
            logger.info(f"✅ Research Engine Initialized with model: {LLM_MODEL}")
        except Exception as e:
            logger.critical(f"❌ Failed to initialize Groq client: {e}")
            raise

    # ── LLM WRAPPER ──
    def call_llm(self, messages: list, max_tokens: int = LLM_MAX_TOKENS) -> str:
        """Raw LLM call with research-grade error handling."""
        try:
            response = self.client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=LLM_TEMP,
                max_tokens=max_tokens,
                top_p=1,
                stream=False
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"LLM Inference Error: {e}")
            return "Internal processing error."

    def call_llm_json(self, messages: list, max_tokens: int = LLM_MAX_TOKENS) -> dict:
        """Structured Output (JSON) wrapper for data extraction."""
        messages[0]["content"] += "\nReturn ONLY valid JSON. No markdown ticks ```json."
        
        raw_text = self.call_llm(messages, max_tokens)
        
        # Cleanup common LLM formatting issues
        cleaned = raw_text.replace("```json", "").replace("```", "").strip()
        
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON Parse Error: {e}. Raw Output: {cleaned[:100]}...")
            # Fallback: simple dict or retry logic could be here
            return {}

    # ── METHODOLOGY: GAP ANALYSIS ──
    def analyze_resume_gap(self, cv_text: str, jd_text: str) -> dict:
        """
        Phase 1: Determine the gap between Candidate and Requirement.
        This forms the basis for QUESTION GENERATION.
        """
        logger.info("Executing Gap Analysis Protocol...")
        
        # 1. Parse CV structure
        cv_sys = "Extract structured data: name, skills (list), experience (years + list), education, projects."
        cv_data = self.call_llm_json([
            {"role": "system", "content": f"{cv_sys} Return JSON."},
            {"role": "user", "content": cv_text}
        ])
        
        # 2. Parse JD structure
        jd_sys = "Extract structured requirements: title, required_skills (list), preferred_skills, experience_min, responsibilities."
        jd_data = self.call_llm_json([
            {"role": "system", "content": f"{jd_sys} Return JSON."},
            {"role": "user", "content": jd_text}
        ])
        
        # 3. Compare (Gap Analysis)
        gap_sys = """Compare CV vs JD. Identify:
        - match_score (0-100)
        - matched_skills
        - missing_skills
        - probe_areas (ambiguities or weaknesses to test)
        Return JSON."""
        
        gap_data = self.call_llm_json([
            {"role": "system", "content": gap_sys},
            {"role": "user", "content": f"CV: {json.dumps(cv_data)}\nJD: {json.dumps(jd_data)}"}
        ])

        return {
            "cv": cv_data,
            "jd": jd_data,
            "gap": gap_data
        }

    # ── METHODOLOGY: UNIVERSAL 10-QUESTION FRAMEWORK ──
    def generate_interview_script(self, analysis_data: dict) -> list:
        """
        Phase 2: Generate Targeted Questions using the
        Universal 10-Question Recruitment Framework.
        """
        logger.info("Generating 10-Question Interview Script...")
        
        sys_prompt = """Generate EXACTLY 10 interview questions using the Universal 10-Question Recruitment Framework.
        Adapt the tone based on the department (e.g., Sales = outcome-oriented; Tech/HR = analytical).

        PHASE 1 – Context & Validation (2 Questions):
        Q1: Role Alignment Opener – Ask the candidate to explain how their specific background makes them
            the right fit for the challenges mentioned in the JD.
        Q2: Major Impact Inquiry – Identify a key responsibility in the JD and ask the candidate to describe
            a time they delivered a high-impact result in a similar area.

        PHASE 2 – Domain-Specific Competency (4 Questions):
        Q3: Methodology & Workflow – "Walk me through your typical process for [Primary Task from JD]."
        Q4: Tooling & Environment – Ask about proficiency with specific software/systems from the JD.
        Q5: Quality & Accuracy – "How do you ensure accuracy in [Key Deliverable from JD]?"
        Q6: Scenario-Based Execution – Generate a realistic "What if" scenario based on a common industry hurdle.

        PHASE 3 – Behavioral & Interpersonal (3 Questions):
        Q7: Collaborative Problem Solving – Example of working with a difficult teammate or cross-functional team.
        Q8: Adaptability & Learning – Time they had to learn a new system or adapt to a major strategic change.
        Q9: Self-Management & Prioritization – Handling high-volume workload or competing deadlines.

        PHASE 4 – Cultural Fit & Closing (1 Question):
        Q10: Value Proposition – "Beyond skills, what professional habit or perspective do you bring that
             consistently improves the teams you work on?"

        JSON Format per question:
        {
            "id": 1,
            "question": "text",
            "type": "behavioral/technical/situational",
            "target_competency": "skill name",
            "rubric_guide": "what a good answer looks like",
            "follow_up_hint": "if answer is vague, ask X"
        }
        """
        
        user_prompt = f"Gap Analysis Data: {json.dumps(analysis_data['gap'])}"
        
        result = self.call_llm_json([
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt}
        ])
        
        return result.get("questions", [])

    # ── METHODOLOGY: SCORING LOGIC (10-Dimension, 1-10 Scale) ──
    def score_candidate_response(self, question: dict, answer: str) -> dict:
        """
        Phase 3: Evidence-Based Scoring.
        Scores (1-10) must be justified by EXPLICIT QUOTES from the transcript.
        """
        if len(answer) < 5:
            return {"score": 0, "reasoning": "No answer provided.", "evidence": "N/A"}

        sys_prompt = """Score the response using the Nexus 10-Dimension Evaluation Rubric (1-10 per dimension).
        CRITICAL: Provide a direct QUOTE from the answer as evidence for each score.
        Reference the 'target_competency' and 'rubric_guide'.

        10 Dimensions (each 1-10):
        1. role_alignment – Experience match to JD.
        2. technical_depth – Hard skills mastery, process description.
        3. evidence_of_impact – Results, data points, percentages.
        4. communication_clarity – Clarity, minimal filler, logical flow.
        5. problem_solving – Step-by-step logic (Identify → Act → Resolve).
        6. star_compliance – Situation, Task, Action, Result structure.
        7. soft_skills – Collaboration, teamwork, EQ keywords.
        8. adaptability – Growth mindset, upskilling, pivoting.
        9. culture_fit – Alignment with company mission/values.
        10. professionalism – Tone, confidence, appropriateness.

        Score Anchors:
        1-2 = Poor | 3-4 = Below | 5-6 = Meets | 7-8 = Exceeds | 9-10 = Exceptional

        Return JSON:
        {
            "scores": {
                "role_alignment": {"score": N, "evidence": "quote", "reasoning": "..."},
                "technical_depth": {"score": N, "evidence": "quote", "reasoning": "..."},
                ... (all 10 dimensions)
            },
            "follow_up_needed": boolean (true if any score < 4)
        }
        """
        
        user_prompt = f"""
        Question: {question['question']}
        Target: {question['target_competency']}
        Rubric Guide: {question['rubric_guide']}
        
        Candidate Answer: "{answer}"
        """
        
        return self.call_llm_json([
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt}
        ])

    def generate_final_report(self, session_data: dict) -> dict:
        """Phase 4: Synthesis & Recommendation (100-Point Scale)."""
        logger.info(f"Synthesizing final report for Session {session_data.get('id')}")
        
        sys_prompt = """Act as a Senior Hiring Manager. Review the interview transcript and dimension scores.
        Total score is out of 100 (sum of 10 dimensions, each 1-10).

        Classification:
        90-100 = Platinum Candidate → Immediate Hire / Move to Final Round.
        75-89  = Strong Fit → High potential; verify 1-2 weak areas.
        50-74  = Average Fit → Requires more technical probing.
        Below 50 = Not Recommended → Does not meet core competencies.

        Return JSON:
        {
            "recommendation": "RECOMMEND/CONSIDER/DO NOT RECOMMEND",
            "summary": "Executive summary with total score and classification",
            "strengths": ["list"],
            "weaknesses": ["list"]
        }
        """
        
        # Calculate quantitative metrics across all 10 dimensions
        dim_names = [
            "role_alignment", "technical_depth", "evidence_of_impact",
            "communication_clarity", "problem_solving", "star_compliance",
            "soft_skills", "adaptability", "culture_fit", "professionalism"
        ]
        dim_totals = {d: 0 for d in dim_names}
        count = 0
        for s in session_data.get("history", []):
            result = s.get("result", {}).get("scores", {})
            if result:
                count += 1
                for d in dim_names:
                    dim_totals[d] += result.get(d, {}).get("score", 0)
        dim_avgs = {d: round(t / count, 1) if count else 0 for d, t in dim_totals.items()}
        total_score = sum(dim_avgs.values())
        
        transcript_text = "\n".join([f"Q: {q['question']}\nA: {q.get('answer', '')}" for q in session_data.get("history", [])])
        
        qualitative = self.call_llm_json([
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": f"Total Score: {total_score:.1f}/100\nDimension Averages: {json.dumps(dim_avgs)}\n\nTranscript:\n{transcript_text}"}
        ])
        
        return {
            "quantitative": {"total_score": total_score, "dimension_averages": dim_avgs},
            "qualitative": qualitative
        }

# Initializer for easy import
engine = NexusEngine()
