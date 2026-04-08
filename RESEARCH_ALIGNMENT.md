# NEXUS Research Alignment & Architectural Evolution

## 1. The Core Research Problem
**"Why does the AI feel robotic and deaf?"**
The initial prototype (v1/v2) suffered from:
1.  **Static Scripts**: It followed a pre-generated JSON list of questions, ignoring the candidate's actual answers.
2.  **Amnesia**: The "Brain" (LLM) had no memory of previous turns, treating every question as an isolated event.
3.  **Latency**: Synchronous processing made the conversation feel disjointed and slow.

## 2. The Solution: "Dynamic Contextual AI" (v3.2)
We have shifted the architecture from a **"Question Dispenser"** to a **"Reactive Intelligence"**.

### A. The "Dynamic Brain" Architecture
Instead of generating 8 questions at the start, we now:
*   **Generate Goals, Not Questions**: The AI starts with 10 high-level objectives (e.g., "Verify Python Depth", "Assess System Design").
*   **Turn-by-Turn Generation**: After *every* user answer, the AI:
    1.  Analyzes the transcript.
    2.  Checks off satisfied goals.
    3.  Generates the *next* question in real-time to target remaining goals.
*   **Deep Memory Injection**: The full conversation history is injected into the LLM context for every single turn, allowing it to say things like *"You mentioned Docker earlier..."*.

### B. The "Luxury" User Experience
To match the intelligence upgrade, the UI was overhauled:
*   **Heads-Up Display (HUD)**: A dedicated status banner (Blue/Red/Yellow/Green) provides immediate feedback on system state (Listening vs Thinking).
*   **Hands-Free Capability**: The system automatically starts listening when the AI finishes speaking, mimicking natural conversation flow.
*   **Visual Assessment**: The final report is now a professional dashboard with competency heatmaps, not a raw JSON dump.

## 3. Future Roadmap & Limitations
*   **True Duplex Voice**: Currently, the system is "Half-Duplex" (Talk -> Listen -> Talk). True "Full Duplex" (interrupting naturally while speaking) requires a WebSocket architecture, which is planned for v4.
*   **Long-Term Memory**: Storing candidate profiles across multiple sessions using the new SQLite database (added in v3.2).

## 4. Summary of Recent Changes
- [x] **Refactored `orchestrator.py`**: Switched from static lists to dynamic goal-seeking logic.
- [x] **Updated `nexus_ui.html`**: Added State Banner and Auto-Listen.
- [x] **Database Integration**: Added SQLite storage for session persistence.
