"""Lock private/student-list.json with the trip code and write it into site/index.html.

Run after editing the student list or changing the trip code:
    pip install cryptography
    python tools/lock_roster.py
Every run uses a fresh salt, so phones that already unlocked keep their list,
but the sync key changes too: run the SQL line this prints in Supabase,
or phones will show "Trip code changed: unlock again".
"""
import base64, hashlib, json, os, re, pathlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

root = pathlib.Path(__file__).resolve().parent.parent
code = (root / "private" / "trip-code.txt").read_text().strip()
norm = "".join(ch for ch in code.upper() if ch.isalnum())
teams = json.loads((root / "private" / "student-list.json").read_text(encoding="utf-8"))["teams"]

salt, iv, iters = os.urandom(16), os.urandom(12), 600000
# 64 bytes: first 32 = AES key for the list, last 32 = live sync key.
bits = PBKDF2HMAC(algorithm=hashes.SHA256(), length=64, salt=salt, iterations=iters).derive(norm.encode())
key, sync = bits[:32], bits[32:].hex()
data = AESGCM(key).encrypt(iv, json.dumps({"teams": teams}, ensure_ascii=False).encode("utf-8"), None)
locked = {"salt": base64.b64encode(salt).decode(), "iv": base64.b64encode(iv).decode(),
          "iter": iters, "data": base64.b64encode(data).decode()}

index_path = root / "site" / "index.html"
html = index_path.read_text(encoding="utf-8")
html, n = re.subn(r"const LOCKED_LIST = \{.*?\};", lambda m: "const LOCKED_LIST = " + json.dumps(locked) + ";", html, count=1, flags=re.S)
assert n == 1, "LOCKED_LIST not found in site/index.html"
index_path.write_text(html, encoding="utf-8")
print(f"Locked {sum(len(t['students']) for t in teams)} students in {len(teams)} teams into site/index.html")
print("Run in Supabase SQL editor (replace the old key so old phones must re-unlock):")
print("  delete from public.rc_secret; insert into public.rc_secret(k) values ('%s');" % hashlib.sha256(sync.encode()).hexdigest())
