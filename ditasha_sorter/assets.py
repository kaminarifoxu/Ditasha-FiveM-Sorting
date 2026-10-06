from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

MODEL_RE = re.compile(r'^(?P<component>p_)?(?P<name>[a-z0-9]+)_(?P<index>\d+)(?:_[a-z0-9]+)?$', re.I)
TEXTURE_RE = re.compile(r'^(?P<component>p_)?(?P<name>[a-z0-9]+)_diff_(?P<index>\d+)_(?P<variant>[a-z])(?:_[a-z0-9]+)?$', re.I)

@dataclass(frozen=True)
class AssetGroup:
    model: Path
    textures: tuple[Path, ...]
    key: str


def _stem_key(path: Path):
    stem = path.stem.lower().replace('-', '_').replace(' ', '_')
    m = MODEL_RE.match(stem)
    if not m:
        return None
    prefix = m.group('component') or ''
    return f"{prefix}{m.group('name')}:{int(m.group('index'))}"


def _texture_key(path: Path):
    stem = path.stem.lower().replace('-', '_').replace(' ', '_')
    m = TEXTURE_RE.match(stem)
    if not m:
        return None
    prefix = m.group('component') or ''
    return f"{prefix}{m.group('name')}:{int(m.group('index'))}", m.group('variant').lower()


def find_asset_groups(root: str | Path) -> list[AssetGroup]:
    root = Path(root)
    models = [p for p in root.rglob('*.ydd') if p.is_file()]
    textures = [p for p in root.rglob('*.ytd') if p.is_file()]

    by_key: dict[str, list[tuple[str, Path]]] = {}
    for tex in textures:
        parsed = _texture_key(tex)
        if parsed:
            key, variant = parsed
            by_key.setdefault(key, []).append((variant, tex))

    groups: list[AssetGroup] = []
    for model in models:
        key = _stem_key(model)
        candidates: list[tuple[str, Path]] = []
        if key:
            candidates.extend(by_key.get(key, []))

        # Fallback for custom packs that keep the same prefix/stem.
        if not candidates:
            base = model.stem.lower().replace('_u', '').replace('_r', '')
            for tex in textures:
                t = tex.stem.lower()
                if base in t or t.startswith(base):
                    candidates.append((t, tex))

        # Prefer textures located close to the model, then A-Z variant order.
        candidates = list({p.resolve(): (v, p) for v, p in candidates}.values())
        candidates.sort(key=lambda item: (
            0 if item[1].parent == model.parent else 1,
            item[0],
            item[1].name.lower(),
        ))
        groups.append(AssetGroup(model=model, textures=tuple(p for _, p in candidates), key=key or model.stem.lower()))

    groups.sort(key=lambda g: g.model.name.lower())
    return groups
