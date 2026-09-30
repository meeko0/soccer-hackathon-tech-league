"""python -m ingest.cli --match 1959846 [--match 2007721 ...] [--force]"""

import argparse
import logging

from .pipeline import ingest_match


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest SkillCorner open-data matches.")
    parser.add_argument("--match", type=int, action="append", required=True, help="match id (repeatable)")
    parser.add_argument("--force", action="store_true", help="re-process even if cached")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    for match_id in args.match:
        meta = ingest_match(match_id, force=args.force)
        print(f"{match_id}: {meta['home']['short_name']} {meta['home']['score']}-"
              f"{meta['away']['score']} {meta['away']['short_name']}, "
              f"{meta['n_frames']} frames, {len(meta['slots'])} players")


if __name__ == "__main__":
    main()
