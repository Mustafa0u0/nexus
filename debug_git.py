import subprocess

def run(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(f"COMMAND: {cmd}")
    print(f"STDOUT: {result.stdout}")
    print(f"STDERR: {result.stderr}")
    print(f"RETURNCODE: {result.returncode}")
    print("-" * 20)

run("git status")
run("git remote -v")
run("dir")
