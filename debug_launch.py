import sys
import traceback

print("Checking nexus_server_v2...")
try:
    import nexus_server_v2
    print("Import successful!")
except Exception as e:
    print("CRASH DETECTED:")
    print("-" * 20)
    traceback.print_exc()
    print("-" * 20)
