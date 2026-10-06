from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path

REPO = 'kaminarifoxu/Ditasha-FiveM-Sorting'
LATEST_RELEASE_API = f'https://api.github.com/repos/{REPO}/releases/latest'
EXPECTED_ASSET = 'Ditasha-FiveM-Sorting.exe'


@dataclass
class UpdateInfo:
    available: bool
    version: str
    download_url: str
    release_url: str = ''
    notes: str = ''


def _version_tuple(value: str) -> tuple[int, ...]:
    value = value.strip().lower().lstrip('v')
    result = []
    for part in value.split('.'):
        digits = ''.join(ch for ch in part if ch.isdigit())
        result.append(int(digits or 0))
    return tuple(result)


def check_for_update(current_version: str) -> UpdateInfo | None:
    request = urllib.request.Request(
        LATEST_RELEASE_API,
        headers={
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Ditasha-FiveM-Sorting-Updater',
        },
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        payload = json.loads(response.read().decode('utf-8'))

    tag = str(payload.get('tag_name') or '').strip()
    if not tag:
        return None

    asset = next(
        (
            item for item in (payload.get('assets') or [])
            if str(item.get('name', '')).lower() == EXPECTED_ASSET.lower()
        ),
        None,
    )
    if not asset:
        return None

    latest = tag.lstrip('v')
    return UpdateInfo(
        available=_version_tuple(latest) > _version_tuple(current_version),
        version=latest,
        download_url=str(asset.get('browser_download_url') or ''),
        release_url=str(payload.get('html_url') or ''),
        notes=str(payload.get('body') or ''),
    )


def _download(url: str, destination: Path):
    request = urllib.request.Request(url, headers={'User-Agent': 'Ditasha-FiveM-Sorting-Updater'})
    with urllib.request.urlopen(request, timeout=60) as response, destination.open('wb') as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)


def download_and_install_update(info: UpdateInfo):
    if not info.download_url:
        raise RuntimeError('Release terbaru tidak memiliki EXE.')
    if os.name != 'nt' or not getattr(sys, 'frozen', False):
        raise RuntimeError('Auto install hanya tersedia pada aplikasi EXE Windows.')

    current_exe = Path(sys.executable).resolve()
    temp_dir = Path(tempfile.mkdtemp(prefix='ditasha_update_'))
    downloaded_exe = temp_dir / EXPECTED_ASSET
    updater = temp_dir / 'Ditasha-Apply-Update.cmd'
    current_pid = os.getpid()

    _download(info.download_url, downloaded_exe)
    if not downloaded_exe.exists() or downloaded_exe.stat().st_size < 1024:
        raise RuntimeError('File update yang didownload tidak valid.')

    updater.write_text(
        '@echo off\n'
        'title Ditasha FiveM Sorting Updater\n'
        'echo Menutup versi lama...\n'
        f'taskkill /PID {current_pid} /T >nul 2>&1\n'
        'timeout /t 2 /nobreak >nul\n'
        'echo Memasang versi baru...\n'
        f'copy /Y "{downloaded_exe}" "{current_exe}" >nul\n'
        'if errorlevel 1 (\n'
        '  echo Update gagal. Jalankan aplikasi dari folder yang bisa ditulis, atau jalankan sebagai Administrator.\n'
        '  pause\n'
        '  exit /b 1\n'
        ')\n'
        f'start "" "{current_exe}"\n'
        'echo Update selesai.\n',
        encoding='utf-8',
    )

    subprocess.Popen(['cmd.exe', '/c', str(updater)], cwd=str(temp_dir))
