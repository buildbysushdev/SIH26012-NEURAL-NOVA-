"""
keep_tunnel_alive.py — Resilient Localtunnel Supervisor
Automatically restarts localtunnel if connection drops or server restarts.
"""
import subprocess
import time
import sys

SUBDOMAIN = "mplads-neural-nova-26102"
PORT = "8000"

def run_tunnel():
    cmd = ["npx", "--yes", "localtunnel", "--port", PORT, "--subdomain", SUBDOMAIN]
    while True:
        print(f"[*] Starting localtunnel on port {PORT} with subdomain {SUBDOMAIN}...")
        try:
            proc = subprocess.Popen(
                cmd,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            for line in proc.stdout:
                line_str = line.strip()
                if line_str:
                    print(f"[localtunnel] {line_str}", flush=True)
            proc.wait()
            print(f"[!] localtunnel exited with code {proc.returncode}. Restarting in 3 seconds...", flush=True)
        except Exception as e:
            print(f"[!] Error running tunnel: {e}. Retrying in 5 seconds...", flush=True)
        time.sleep(3)

if __name__ == "__main__":
    run_tunnel()
