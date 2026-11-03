"""Checks the puzzle files written by tools/export_puzzles.py: python3 -m unittest tests/test_export.py"""
import json
import os
import unittest

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'puzzles')
BANDS = list(range(400, 2600, 200))


def load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


class ExportTest(unittest.TestCase):
    def test_eleven_bands_with_ratings_inside_them(self):
        self.assertEqual(len(BANDS), 11)  # 400, 600 … 2400; the last one holds 2400-2599
        for band in BANDS:
            data = load(f'band-{band:04d}.json')
            self.assertEqual(data['band'], band)
            self.assertTrue(0 < len(data['puzzles']) <= 300)
            for _id, fen, moves, rating, themes in data['puzzles']:
                self.assertTrue(band <= rating < band + 200 or (band == 2400 and rating >= 2400))
                self.assertEqual(len(moves.split()) % 2, 0)  # opponent's move, then the player's answers

    def test_daily_has_366_puzzles_none_in_the_bands(self):
        daily = load('daily.json')['puzzles']
        self.assertEqual(len(daily), 366)
        self.assertTrue(all(1000 <= p[3] < 1600 for p in daily))
        band_ids = {p[0] for b in BANDS for p in load(f'band-{b:04d}.json')['puzzles']}
        self.assertFalse(band_ids & {p[0] for p in daily})

    def test_band_files_stay_small(self):
        for band in BANDS:
            self.assertLess(os.path.getsize(os.path.join(DATA, f'band-{band:04d}.json')), 60_000)


if __name__ == '__main__':
    unittest.main()
