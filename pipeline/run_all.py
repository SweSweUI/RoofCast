"""
Run the full data pipeline in the correct order:

    ingest  ->  weather  ->  stats   (optionally -> TS forecast snapshot)

`ingest` DROPs and recreates the whole schema, so it must run first; `weather`
and `stats` append to the existing database.

Usage:  python3 pipeline/run_all.py            (data pipeline)
        python3 pipeline/run_all.py --snapshot (also persist forecast snapshot)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def run(label: str, args: list[str], cwd: Path = ROOT) -> None:
    print(f"\n{'='*70}\n▶ {label}\n{'='*70}")
    r = subprocess.run(args, cwd=str(cwd))
    if r.returncode != 0:
        print(f"✖ {label} failed (exit {r.returncode})")
        sys.exit(r.returncode)


def main() -> None:
    run("1/3  Ingestion (Excel → unified schema)", [sys.executable, str(HERE / "ingest.py")])
    run("2/3  Weather (Open-Meteo historical + live)", [sys.executable, str(HERE / "weather.py")])
    run("3/3  Statistics (lag analysis + validation)", [sys.executable, str(HERE / "stats.py")])

    if "--snapshot" in sys.argv:
        # best-effort: persist the base/wet/dry forecast snapshot via the TS engine
        try:
            run("4/4  Forecast snapshot (TS engine → forecast_weeks/trace_links)",
                ["npx", "tsx", "lib/forecast/snapshot.ts"])
        except FileNotFoundError:
            print("⚠ npx/tsx not found — skipping forecast snapshot (run `npm run snapshot`).")

    print("\n✅ Pipeline complete. Start the app with:  npm run dev")


if __name__ == "__main__":
    main()
