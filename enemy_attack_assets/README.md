# Enemy attack sprite sheets

This directory contains the four-frame attack sheets embedded by
`embed_enemy_attack_assets.py`.

- `png/normal`: runner, blob, tank, shooter source sheets.
- `png/elite`: all twelve elite-variant source sheets.
- `webp`: lossless runtime copies with matching pixels and alpha.
- `contact_sheet.png`: visual review of all 16 sheets.
- `qa_report.json`: dimensions, alpha and provenance checks.

The sheets were derived from the live standing enemy catalogs
`ENEMY_SPRITE_DATA` and `ELITE_SPRITE_DATA`. Corpse sprites are not valid source
material for this pipeline.
