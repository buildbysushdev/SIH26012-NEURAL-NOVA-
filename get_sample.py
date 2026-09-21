import sys, io, urllib.request, urllib.parse, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
def get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())
# Full project detail
p = get("http://127.0.0.1:8000/project?work_id=" + urllib.parse.quote("WS/MP317/2024-2025/145098"))
print("=== /project response fields ===")
proj = p["project"]
for k, v in sorted(proj.items()):
    print(f"  {k}: {repr(v)[:80]}")
# Flagged project fields  
print("\n=== /flagged-projects top record fields ===")
f = get("http://127.0.0.1:8000/flagged-projects?limit=1")[0]
for k, v in sorted(f.items()):
    print(f"  {k}: {repr(v)[:80]}")
# Root health
print("\n=== / response ===")
h = get("http://127.0.0.1:8000/")
print(json.dumps(h, indent=2))
