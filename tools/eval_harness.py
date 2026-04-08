import argparse
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

from nexus_core.orchestrator import orchestrator, SessionManager


async def run_case(case, run_idx, out_dir):
    session = SessionManager.create_session()
    result = {
        "case_id": case["case_id"],
        "run_index": run_idx,
        "session_id": session.id,
        "started_at": datetime.utcnow().isoformat() + "Z",
        "scores": [],
        "rubric_avg": None,
        "recommendation": None,
    }

    await orchestrator.analyze_candidate(session.id, case["cv_text"], case["jd_text"])

    for answer in case.get("answers", []):
        response_text, is_complete = await orchestrator.process_answer(session.id, answer)
        result["scores"] = [
            {
                "question_id": s.question_id,
                "average_score": s.average_score,
                "scores": {
                    "relevance": s.scores.relevance.score,
                    "depth": s.scores.depth.score,
                    "competency": s.scores.competency.score,
                    "communication": s.scores.communication.score,
                },
            }
            for s in session.scores
        ]
        if is_complete:
            break

    report = await orchestrator.generate_final_report(session.id)
    result["rubric_avg"] = report.rubric_scores
    result["recommendation"] = report.recommendation.model_dump()
    result["ended_at"] = datetime.utcnow().isoformat() + "Z"

    out_path = out_dir / f"{case['case_id']}_run_{run_idx}.json"
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")


async def main():
    parser = argparse.ArgumentParser(description="NEXUS evaluation harness")
    parser.add_argument("--cases", default="tools/eval_cases.json", help="Path to test cases JSON")
    parser.add_argument("--runs", type=int, default=3, help="Number of repeat runs per case")
    parser.add_argument("--out", default="research_data/eval_runs", help="Output directory")
    args = parser.parse_args()

    cases_path = Path(args.cases)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    for case in cases:
        for run_idx in range(1, args.runs + 1):
            await run_case(case, run_idx, out_dir)


if __name__ == "__main__":
    if not os.getenv("GROQ_API_KEY"):
        raise SystemExit("GROQ_API_KEY is required in the environment.")
    asyncio.run(main())
