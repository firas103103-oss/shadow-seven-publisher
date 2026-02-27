#!/usr/bin/env python3
"""
Shadow-7 Publisher — Upload Integrity Test
Simulates 100k-word document upload and verifies integrity via checksum.
Runs until SUCCESS or max attempts.
"""
import hashlib
import os
import sys
import tempfile
import time

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

API_BASE = os.environ.get("SHADOW7_API_URL", "http://localhost:8002")
MAX_ATTEMPTS = 5
TARGET_WORDS = 100_000  # Simulate 100k-word payload


def create_dummy_file(size_words: int = TARGET_WORDS) -> tuple[str, str]:
    """Create a temporary TXT file simulating a large manuscript. Returns (path, sha256)."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
        path = f.name
        chunk = "كلمة " * 1000  # 1000 words per write
        for _ in range(size_words // 1000):
            f.write(chunk)
        remainder = size_words % 1000
        if remainder:
            f.write("كلمة " * remainder)
    with open(path, "rb") as f:
        h = hashlib.sha256(f.read()).hexdigest()
    return path, h


def upload_and_verify(file_path: str, expected_sha: str) -> bool:
    """Upload file and verify integrity. Returns True on SUCCESS."""
    title = os.path.basename(file_path).replace(".txt", "")
    with open(file_path, "rb") as f:
        content_bytes = f.read()
    word_count = len(content_bytes.decode("utf-8", errors="ignore").split())

    url = f"{API_BASE.rstrip('/')}/api/shadow7/manuscripts/upload"
    files = {"file": (os.path.basename(file_path), content_bytes, "text/plain")}
    data = {
        "title": title,
        "content": content_bytes.decode("utf-8", errors="replace")[:50000],
        "word_count": str(word_count),
        "metadata": "{}",
    }

    try:
        r = requests.post(url, files=files, data=data, timeout=120)
        r.raise_for_status()
        resp = r.json()
        file_path_resp = resp.get("file_path")
        if not file_path_resp:
            print("  ⚠ No file_path in response")
            return False

        # Verify stored file integrity
        storage_base = os.environ.get("SHADOW7_STORAGE", "/var/www/shadow7/storage")
        full_path = os.path.join(storage_base, file_path_resp)
        if os.path.exists(full_path):
            with open(full_path, "rb") as f:
                stored_sha = hashlib.sha256(f.read()).hexdigest()
            if stored_sha == expected_sha:
                print(f"  ✅ SUCCESS — Checksum verified (SHA256 match)")
                return True
            print(f"  ❌ Checksum mismatch: expected {expected_sha[:16]}..., got {stored_sha[:16]}...")
        else:
            print(f"  ⚠ Stored file not found at {full_path}")
        return False
    except requests.RequestException as e:
        print(f"  ❌ Request error: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


def main():
    print("Shadow-7 Publisher — Upload Integrity Test")
    print(f"API: {API_BASE}")
    print(f"Target: ~{TARGET_WORDS} words")
    print("-" * 50)

    path, sha = create_dummy_file()
    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"Created dummy file: {path} ({size_mb:.2f} MB, SHA256: {sha[:16]}...)")

    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"\nAttempt {attempt}/{MAX_ATTEMPTS}...")
        if upload_and_verify(path, sha):
            os.unlink(path)
            print("\n" + "=" * 50)
            print("SUCCESS — Publisher swallowed the payload without error.")
            sys.exit(0)
        time.sleep(2)

    os.unlink(path)
    print("\n" + "=" * 50)
    print(f"FAILED after {MAX_ATTEMPTS} attempts.")
    sys.exit(1)


if __name__ == "__main__":
    main()
