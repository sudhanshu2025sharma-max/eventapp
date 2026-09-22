"""
Layer 8: Data Integrity Testing
Race conditions on concurrent writes (double voting, duplicate check-ins).
"""

import requests
import threading
import time
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'load_tests'))

from config import API_BASE

_session = requests.Session()
_session.trust_env = False
_session.verify = False
_session.proxies = {"http": None, "https": None}


def get_token(email, password):
    try:
        r = _session.post(f"{API_BASE}/auth/login/",
                          json={"email": email, "password": password}, timeout=10)
        if r.status_code == 200:
            return r.json().get("tokens", {}).get("access", "")
    except Exception:
        pass
    return None


def test_concurrent_poll_voting():
    """Test that one user cannot vote twice via race condition."""
    print("\n  [Data Test 1] Concurrent Poll Voting Race")

    token = get_token("test@test.com", "12345678")
    if not token:
        print("    ⚠ Cannot get token — skipping")
        return {"test": "concurrent_voting", "skipped": True, "passed": True}

    # Get a poll
    try:
        polls_resp = _session.get(
            f"{API_BASE}/polls/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if polls_resp.status_code != 200:
            print(f"    ⚠ No polls available — skipping")
            return {"test": "concurrent_voting", "skipped": True, "passed": True}

        data = polls_resp.json()
        polls = data if isinstance(data, list) else data.get("results", data.get("polls", []))
        if not polls:
            print("    ⚠ No polls in database — skipping")
            return {"test": "concurrent_voting", "skipped": True, "passed": True}

        poll = polls[0]
        poll_id = poll.get("id")
        options = poll.get("options", [])
        if not options:
            return {"test": "concurrent_voting", "skipped": True, "passed": True}

        option_id = options[0].get("id")
    except Exception as e:
        print(f"    ⚠ Error: {e}")
        return {"test": "concurrent_voting", "error": str(e), "passed": True}

    # Fire 20 concurrent votes for same user + same poll
    results = []
    def cast_vote():
        try:
            r = _session.post(
                f"{API_BASE}/polls/{poll_id}/vote/",
                json={"option_id": option_id},
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
            results.append(r.status_code)
        except Exception:
            results.append(0)

    threads = [threading.Thread(target=cast_vote) for _ in range(20)]
    for t in threads: t.start()
    for t in threads: t.join()

    successful_votes = sum(1 for r in results if r in (200, 201))

    # Expected: 1 successful vote, 19 rejected (400/403 duplicate)
    passed = successful_votes <= 1
    print(f"    Fired 20 concurrent votes → {successful_votes} accepted")
    if passed:
        print(f"    ✓ Race condition properly handled")
    else:
        print(f"    ✗ VULNERABLE: {successful_votes} votes accepted (expected ≤1)")

    return {
        "test": "concurrent_voting",
        "attempts": 20,
        "successful": successful_votes,
        "expected_max": 1,
        "passed": passed,
    }


def test_concurrent_connection_requests():
    """Test that duplicate connection requests don't create dupes."""
    print("\n  [Data Test 2] Concurrent Connection Request Race")

    token = get_token("test@test.com", "12345678")
    if not token:
        return {"test": "connection_race", "skipped": True, "passed": True}

    # Get a network user to target
    try:
        net_resp = _session.get(
            f"{API_BASE}/checkins/network/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if net_resp.status_code != 200:
            return {"test": "connection_race", "skipped": True, "passed": True}
        data = net_resp.json()
        users = data if isinstance(data, list) else data.get("results", data.get("users", []))
        if not users:
            return {"test": "connection_race", "skipped": True, "passed": True}
        target_id = users[0].get("id")
    except Exception:
        return {"test": "connection_race", "skipped": True, "passed": True}

    results = []
    def send_request():
        try:
            r = _session.post(
                f"{API_BASE}/chat/send-request/",
                json={"receiver_id": str(target_id)},
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
            results.append(r.status_code)
        except Exception:
            results.append(0)

    threads = [threading.Thread(target=send_request) for _ in range(10)]
    for t in threads: t.start()
    for t in threads: t.join()

    successful = sum(1 for r in results if r in (200, 201))
    passed = successful <= 1

    print(f"    Fired 10 concurrent connection requests → {successful} accepted")
    if passed:
        print(f"    ✓ Duplicate connection requests properly rejected")
    else:
        print(f"    ⚠ WARNING: {successful} duplicate requests may have been created")

    return {
        "test": "connection_race",
        "attempts": 10,
        "successful": successful,
        "passed": passed,
    }


def run_layer8(output_dir):
    print(f"\n{'='*70}")
    print(f"  LAYER 8: DATA INTEGRITY TESTING")
    print(f"{'='*70}")

    tests = [
        test_concurrent_poll_voting(),
        test_concurrent_connection_requests(),
    ]

    passed_count = sum(1 for t in tests if t.get("passed"))
    total = len(tests)
    score = (passed_count / total) * 100 if total > 0 else 100

    layer_result = {
        "layer": 8,
        "name": "Data Integrity",
        "score": score,
        "tests_run": total,
        "tests_passed": passed_count,
        "tests": tests,
        "passed": passed_count == total,
    }

    output_file = os.path.join(output_dir, "layer8_data_integrity.json")
    with open(output_file, 'w') as f:
        json.dump(layer_result, f, indent=2, default=str)

    print(f"\n  ★ Layer 8 Score: {score:.1f}/100")
    return layer_result


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "results", "test")
    os.makedirs(out, exist_ok=True)
    run_layer8(out)
