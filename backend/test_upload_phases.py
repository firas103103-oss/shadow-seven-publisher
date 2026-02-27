#!/usr/bin/env python3
"""
Shadow-7 — اختبار مرحلة مرحلة مع مراقبة السجلات
"""
import hashlib
import os
import sys
import tempfile
import time

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

API = os.environ.get("SHADOW7_API_URL", "http://127.0.0.1:8002").rstrip("/")


def phase(name: str, fn):
    print(f"\n{'='*50}")
    print(f"مرحلة: {name}")
    print("="*50)
    try:
        fn()
        print("  ✅ نجح")
        return True
    except Exception as e:
        print(f"  ❌ فشل: {e}")
        return False


def health():
    r = requests.get(f"{API}/api/shadow7/health", timeout=10)
    r.raise_for_status()
    d = r.json()
    print(f"  status={d.get('status')}, postgres={d.get('postgres')}, manuscripts_table={d.get('manuscripts_table')}")


def upload_file(size_kb: int, label: str):
    chunk = "كلمة " * 500
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
        path = f.name
        writes = (size_kb * 1024) // len(chunk.encode())
        for _ in range(max(1, writes)):
            f.write(chunk)
    with open(path, "rb") as f:
        content = f.read()
    size_actual = len(content)
    sha = hashlib.sha256(content).hexdigest()

    url = f"{API}/api/shadow7/manuscripts/upload"
    files = {"file": ("test.txt", content, "text/plain")}
    data = {"title": label, "content": "", "word_count": "100", "metadata": "{}"}

    r = requests.post(url, files=files, data=data, timeout=120)
    r.raise_for_status()
    resp = r.json()
    print(f"  حجم: {size_actual/1024:.1f} KB | id={resp.get('id')} | path={resp.get('file_path')}")

    # Verify checksum on host if storage accessible
    storage = os.environ.get("SHADOW7_STORAGE", "/var/www/shadow7/storage")
    rel = resp.get("file_path", "")
    full = os.path.join(storage, rel) if rel else ""
    if full and os.path.exists(full):
        with open(full, "rb") as f:
            if hashlib.sha256(f.read()).hexdigest() == sha:
                print("  SHA256: مطابق ✓")
    os.unlink(path)


def main():
    print("Shadow-7 — اختبار مرحلة مرحلة")
    print(f"API: {API}")
    phases_ok = 0

    if phase("1. Health Check", health):
        phases_ok += 1
    time.sleep(1)

    if phase("2. رفع ملف صغير (~100 KB)", lambda: upload_file(100, "test-small")):
        phases_ok += 1
    time.sleep(1)

    if phase("3. رفع ملف متوسط (~1 MB)", lambda: upload_file(1024, "test-medium")):
        phases_ok += 1
    time.sleep(1)

    if phase("4. رفع ملف كبير (~5 MB)", lambda: upload_file(5120, "test-large")):
        phases_ok += 1

    print("\n" + "="*50)
    print(f"النتيجة: {phases_ok}/4 مراحل نجحت")
    sys.exit(0 if phases_ok == 4 else 1)


if __name__ == "__main__":
    main()
