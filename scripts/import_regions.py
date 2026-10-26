#!/usr/bin/env python3
"""Extract the assembled map (not the separately arranged copies) from the original SVG."""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path, help='Directory containing color.txt, subregions.svg, and svg/')
args = parser.parse_args()
ns = '{http://www.w3.org/2000/svg}'
names = {}
for line in (args.source / 'color.txt').read_text().splitlines():
    if line.strip():
        fields = line.split('|')
        names[int(fields[0])] = fields[1].strip()
if set(names) != set(range(2, 20)):
    raise SystemExit('Expected the 18 original region IDs, 2–19')
paths = {el.get('id'): el for el in ET.parse(args.source / 'subregions.svg').getroot().iter(ns + 'path')}
colors = ['#c7816a', '#c9a46b', '#a3b97e', '#d7bd78', '#86ad96', '#b5a1b8', '#d19b78', '#91a9be', '#b4c599', '#d4a895', '#87b9b5', '#c5b886', '#9cab7d', '#93b6ca', '#b2a1c7', '#80aaa2', '#a8b7ce', '#cbb799']
regions = []
for index, number in enumerate(sorted(names)):
    piece = next(ET.parse(args.source / f'svg/{number}.svg').getroot().iter(ns + 'path'))
    original_id = piece.get('id').split('-')[0]
    path = paths[original_id]
    if path.get('transform'):
        raise SystemExit(f'Unexpected transform for {original_id}; do not discard it')
    regions.append(dict(id=number, name=names[number], color=colors[index], d=path.attrib['d']))
out = Path(__file__).resolve().parents[1] / 'public/assets/regions.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(regions, ensure_ascii=False, separators=(',', ':')))
print(f'Imported {len(regions)} regions into {out}')
