import sys
import traceback

try:
    with open("nexus_server_v2.py", "r", encoding="utf-8") as f:
        compile(f.read(), "nexus_server_v2.py", "exec")
    print("Syntax OK")
except SyntaxError as e:
    print(f"Syntax Error: {e}")
    print(f"Line: {e.lineno}")
    print(f"Text: {e.text}")
except Exception as e:
    print(f"Error: {e}")
    traceback.print_exc()
