from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

SUPPORTED_EXTENSIONS = {'.ydd', '.ytd', '.ymt', '.ymf', '.yft', '.ydr'}

CATEGORY_PATTERNS = [
    ('hair', (r'(^|[\^_])hair(_|\d|$)', r'hair_diff')),
    ('clothes/tops', (r'(^|[\^_])jbib_', r'(^|[\^_])uppr_', r'(^|[\^_])torso_')),
    ('clothes/pants', (r'(^|[\^_])lowr_', r'(^|[\^_])legs_')),
    ('clothes/shoes', (r'(^|[\^_])feet_', r'(^|[\^_])shoe_')),
    ('clothes/undershirts', (r'(^|[\^_])decl_', r'(^|[\^_])teef_')),
    ('clothes/accessories', (r'(^|[\^_])accs_', r'(^|[\^_])task_', r'(^|[\^_])hand_')),
    ('clothes/hats', (r'(^|[\^_])p_head_', r'(^|[\^_])hat_')),
    ('clothes/masks', (r'(^|[\^_])berd_', r'(^|[\^_])head_', r'(^|[\^_])mask_')),
    ('clothes/glasses', (r'(^|[\^_])p_eyes_', r'(^|[\^_])eyes_', r'(^|[\^_])glass')),
    ('clothes/ears', (r'(^|[\^_])p_ears_', r'(^|[\^_])ears_')),
    ('clothes/watches', (r'(^|[\^_])p_lwrist_', r'(^|[\^_])p_rwrist_', r'watch')),
    ('clothes/bracelets', (r'bracelet', r'wrist')),
]

FREEMODE_MARKERS = ('mp_m_freemode_01', 'mp_f_freemode_01')

@dataclass
class ScannedFile:
    source: str
    filename: str
    extension: str
    category: str
    confidence: str
    reason: str
    size: int

@dataclass
class SortSummary:
    source: str
    output: str
    mode: str
    copied: int = 0
    moved: int = 0
    skipped_identical: int = 0
    conflicts: int = 0
    ignored: int = 0

    def to_dict(self):
        return asdict(self)


def _normalized_name(path: Path) -> str:
    return path.stem.lower().replace('-', '_').replace(' ', '_')


def _same_stem_model_exists(path: Path) -> bool:
    stem = path.stem.lower()
    parent = path.parent
    for ext in ('.ydd', '.ydr'):
        if (parent / f'{stem}{ext}').exists():
            return True
    return False


def classify_file(path: Path) -> tuple[str, str, str]:
    ext = path.suffix.lower()
    name = _normalized_name(path)

    if ext not in SUPPORTED_EXTENSIONS:
        return 'ignored', 'high', 'Unsupported extension'

    for category, patterns in CATEGORY_PATTERNS:
        if any(re.search(pattern, name) for pattern in patterns):
            return category, 'high', f'Filename matches {category} naming pattern'

    if any(marker in name for marker in FREEMODE_MARKERS):
        if ext == '.ymt':
            return 'clothes/metadata', 'high', 'Freemode apparel metadata (.ymt)'
        return 'clothes/other', 'medium', 'Freemode asset without a recognized component prefix'

    if ext == '.ydd':
        return 'peds', 'medium', 'Standalone .ydd model without clothing naming markers'

    if ext == '.ytd' and _same_stem_model_exists(path):
        return 'peds', 'medium', 'Texture has a matching standalone model in the same folder'

    if ext == '.ymt':
        return 'metadata/unknown', 'low', 'Metadata file could not be tied to a known freemode pack'

    if ext in {'.ydr', '.yft'}:
        return 'other_models', 'low', 'Model type is ambiguous; kept separate instead of guessing'

    return 'unsorted', 'low', 'No safe classification rule matched'


def scan_folder(source: str | Path, output: str | Path | None = None) -> list[ScannedFile]:
    source_path = Path(source).resolve()
    output_path = Path(output).resolve() if output else None
    results: list[ScannedFile] = []

    for root, dirs, files in os.walk(source_path):
        root_path = Path(root)
        if output_path:
            dirs[:] = [d for d in dirs if (root_path / d).resolve() != output_path]
        dirs[:] = [d for d in dirs if d not in {'.git', '__pycache__'}]

        for filename in files:
            path = root_path / filename
            category, confidence, reason = classify_file(path)
            if category == 'ignored':
                continue
            results.append(ScannedFile(
                source=str(path), filename=filename, extension=path.suffix.lower(),
                category=category, confidence=confidence, reason=reason, size=path.stat().st_size,
            ))
    return results


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def _resource_for_category(category: str) -> tuple[str, str]:
    if category == 'peds':
        return '[ditasha_peds]', 'stream'
    if category == 'hair':
        return '[ditasha_hair]', 'stream'
    if category.startswith('clothes/'):
        sub = category.split('/', 1)[1]
        return '[ditasha_clothes]', f'stream/{sub}'
    if category.startswith('metadata/'):
        return '[ditasha_misc]', 'metadata'
    if category == 'other_models':
        return '[ditasha_misc]', 'other_models'
    return '[ditasha_unsorted]', 'files'


def sort_files(scanned: Iterable[ScannedFile], source: str | Path, output: str | Path, mode: str = 'copy') -> SortSummary:
    source_path = Path(source).resolve()
    output_path = Path(output).resolve()
    output_path.mkdir(parents=True, exist_ok=True)
    summary = SortSummary(source=str(source_path), output=str(output_path), mode=mode)
    conflicts = []

    for item in scanned:
        src = Path(item.source)
        resource, subfolder = _resource_for_category(item.category)
        dest_dir = output_path / resource / subfolder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / src.name

        if dest.exists():
            if _sha256(src) == _sha256(dest):
                summary.skipped_identical += 1
                continue
            conflict_dir = output_path / '_conflicts' / resource.strip('[]') / item.category.replace('/', '_')
            conflict_dir.mkdir(parents=True, exist_ok=True)
            short_hash = _sha256(src)[:8]
            conflict_dest = conflict_dir / f'{src.stem}__{short_hash}{src.suffix}'
            shutil.copy2(src, conflict_dest)
            summary.conflicts += 1
            conflicts.append({'source': str(src), 'existing': str(dest), 'saved_as': str(conflict_dest), 'category': item.category})
            continue

        if mode == 'move':
            shutil.move(str(src), str(dest))
            summary.moved += 1
        else:
            shutil.copy2(src, dest)
            summary.copied += 1

    if conflicts:
        (output_path / 'conflicts.json').write_text(json.dumps(conflicts, indent=2), encoding='utf-8')

    (output_path / 'sort-report.json').write_text(json.dumps(summary.to_dict(), indent=2), encoding='utf-8')
    return summary
