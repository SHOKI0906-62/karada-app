"""日本食品標準成分表（本表）の Excel から、アプリで使う data/foods.json を作る。

使い方： python3 tools/convert_mext.py 本表.xlsx data/foods.json
取り出すのは 食品番号・食品名・エネルギー(kcal)・たんぱく質・脂質・炭水化物（可食部100gあたり）。
"""
import json
import re
import sys

import openpyxl

COL = {'group': 0, 'code': 1, 'name': 3, 'kcal': 6, 'p': 9, 'f': 12, 'c': 20}
EXPECT = {6: 'ENERC_KCAL', 9: 'PROT-', 12: 'FAT-', 20: 'CHOCDF-'}


def num(v):
    """'(11.3)' → 11.3、'Tr'（微量）→ 0、'-'（未測定）→ 0"""
    if v is None:
        return 0
    s = str(v).strip().strip('()（）')
    if s in ('', '-', '*', 'Tr', 'tr'):
        return 0
    try:
        return round(float(s), 1)
    except ValueError:
        return 0


def clean(name):
    name = str(name).replace('　', ' ')
    return re.sub(r'\s+', ' ', name).strip()


def main(src, dst):
    ws = openpyxl.load_workbook(src, read_only=True, data_only=True)['表全体']
    rows = list(ws.iter_rows(values_only=True))
    ids = rows[11]
    for i, want in EXPECT.items():
        assert ids[i] == want, f'列{i}が {ids[i]}（{want} のはず）。表の形が変わっています'
    foods = []
    for r in rows[12:]:
        if not r[COL['code']] or not r[COL['name']]:
            continue
        foods.append([
            str(r[COL['code']]),
            clean(r[COL['name']]),
            int(round(num(r[COL['kcal']]))),
            num(r[COL['p']]),
            num(r[COL['f']]),
            num(r[COL['c']]),
        ])
    out = {
        'source': '文部科学省「日本食品標準成分表（八訂）増補2023年」本表を加工して作成',
        'columns': ['code', 'name', 'kcal', 'p', 'f', 'c'],
        'foods': foods,
    }
    with open(dst, 'w', encoding='utf-8') as fp:
        json.dump(out, fp, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(foods)} 品目を書き出しました → {dst}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
