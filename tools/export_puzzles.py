#!/usr/bin/env python3
"""Exports a slice of the app's puzzles (Lichess Puzzle Database, CC0) for the website.

Reads the app's puzzles.db and writes src/data/puzzles/:
    band-0400.json … band-2400.json   up to 300 puzzles per 200-point rating band
    daily.json                        366 puzzles rated 1000-1599, one per day of the year

Each puzzle is [id, fen, moves, rating, themes]: fen is the position BEFORE the opponent's
move, moves the UCI line as stored (the opponent's move first). The selection is
deterministic (ordered by id, every n-th), so re-running it gives the same files.
Standard library only: python3 tools/export_puzzles.py [path/to/puzzles.db]
"""
import json
import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.path.expanduser('~/proyectos/cheesCoach/app/src/main/assets/databases/puzzles.db')
OUT = os.path.join(ROOT, 'src', 'data', 'puzzles')
PER_BAND = 300
DAILY = 366
BANDS = range(400, 2600, 200)


def spread(rows, count):
    """Every n-th row, so the pick covers the whole id range instead of its start."""
    if len(rows) <= count:
        return rows
    step = len(rows) / count
    return [rows[int(i * step)] for i in range(count)]


def write(name, payload):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))


def main():
    db = sqlite3.connect(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB)
    rows = db.execute('SELECT puzzleId, fen, moves, rating, themes FROM puzzles ORDER BY puzzleId').fetchall()
    rows = [list(r) for r in rows if r[2] and len(r[2].split()) % 2 == 0]
    os.makedirs(OUT, exist_ok=True)

    daily = spread([r for r in rows if 1000 <= r[3] < 1600], DAILY)
    taken = {r[0] for r in daily}
    write('daily.json', {'puzzles': daily})

    for band in BANDS:
        top = band + 200 if band < 2400 else 10_000
        pick = spread([r for r in rows if band <= r[3] < top and r[0] not in taken], PER_BAND)
        write(f'band-{band:04d}.json', {'band': band, 'puzzles': pick})
    print(f'{len(rows)} puzzles read; daily {len(daily)}; {len(BANDS)} bands of up to {PER_BAND} → {OUT}')


if __name__ == '__main__':
    main()
