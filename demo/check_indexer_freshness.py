#!/usr/bin/env python3
"""Validate a Midnight Indexer tip response without printing runtime values."""

import argparse
import json
import sys
import time
from typing import Any, Dict, Optional


class FreshnessError(ValueError):
    """A fail-closed Indexer freshness classification."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _tip_timestamp_ms(payload: Any) -> int:
    if not isinstance(payload, dict) or payload.get("errors"):
        raise FreshnessError("malformed")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise FreshnessError("malformed")
    block = data.get("block")
    if not isinstance(block, dict):
        raise FreshnessError("malformed")
    timestamp = block.get("timestamp")
    if isinstance(timestamp, bool) or not isinstance(timestamp, int) or timestamp <= 0:
        raise FreshnessError("malformed")
    return timestamp


def check_indexer_freshness(
    payload: Dict[str, Any],
    *,
    now_ms: int,
    max_age_ms: int,
    max_future_skew_ms: int = 60_000,
) -> bool:
    if max_age_ms <= 0 or max_future_skew_ms < 0:
        raise FreshnessError("malformed")
    timestamp_ms = _tip_timestamp_ms(payload)
    age_ms = now_ms - timestamp_ms
    if age_ms < -max_future_skew_ms:
        raise FreshnessError("future")
    if age_ms > max_age_ms:
        raise FreshnessError("stale")
    return True


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check Midnight Indexer tip freshness")
    parser.add_argument("--max-age-seconds", type=int, default=300)
    parser.add_argument("--now-ms", type=int, default=None, help=argparse.SUPPRESS)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    now_ms: Optional[int] = args.now_ms
    if now_ms is None:
        now_ms = int(time.time() * 1_000)

    try:
        payload = json.load(sys.stdin)
        check_indexer_freshness(
            payload,
            now_ms=now_ms,
            max_age_ms=args.max_age_seconds * 1_000,
        )
    except (FreshnessError, json.JSONDecodeError, TypeError, ValueError) as error:
        code = error.code if isinstance(error, FreshnessError) else "malformed"
        print("INDEXER_NOT_FRESH: {}".format(code), file=sys.stderr)
        return 1

    print("INDEXER_FRESH")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
