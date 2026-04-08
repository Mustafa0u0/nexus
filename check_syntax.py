import sys
import traceback

try:
    with open("nexus_server.py", "r", encoding="utf-8") as f:
        compile(f.read(), "nexus_server.py", "exec")
    print("Syntax OK")
except SyntaxError as e:
    print(f"Syntax Error: {e}")
    print(f"Line: {e.lineno}")
    print(f"Text: {e.text}")
except Exception as e:
    print(f"Error: {e}")
    traceback.print_exc()
