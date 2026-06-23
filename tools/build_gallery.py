#!/usr/bin/env python3
"""Build gallery metadata and lightweight JPEG previews from the image factory."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
SOURCE = ROOT / "图片工厂"
PREVIEWS = SITE / "assets" / "previews"
INDEX = SOURCE / "索引" / "2026-06.md"


def load_keywords() -> dict[str, str]:
    result: dict[str, str] = {}
    if not INDEX.exists():
        return result
    pattern = re.compile(r"\|\s*([^|]+\.png)\)\s*\|")
    for line in INDEX.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|") or "[20" not in line:
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        match = pattern.search(line)
        if len(cells) >= 7 and match:
            result[Path(match.group(1)).name] = cells[4]
    return result


def image_dimensions(path: Path) -> tuple[int, int]:
    output = subprocess.check_output(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        text=True,
        stderr=subprocess.DEVNULL,
    )
    width = int(re.search(r"pixelWidth:\s*(\d+)", output).group(1))
    height = int(re.search(r"pixelHeight:\s*(\d+)", output).group(1))
    return width, height


def make_preview(source: Path, target: Path) -> None:
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "sips",
            "-Z",
            "1280",
            "-s",
            "format",
            "jpeg",
            "-s",
            "formatOptions",
            "76",
            str(source),
            "--out",
            str(target),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    keywords = load_keywords()
    images: list[dict[str, object]] = []
    paths = sorted(
        list((SOURCE / "横屏").glob("*/*.png"))
        + list((SOURCE / "竖屏").glob("*/*.png"))
    )
    for position, source in enumerate(paths):
        relative = source.relative_to(SOURCE)
        orientation, category = relative.parts[:2]
        digest = hashlib.sha1(str(relative).encode()).hexdigest()[:12]
        preview_name = f"{digest}.jpg"
        make_preview(source, PREVIEWS / preview_name)
        width, height = image_dimensions(source)
        date_match = re.match(r"(\d{4}-\d{2}-\d{2})", source.name)
        date = date_match.group(1) if date_match else ""
        title = source.stem.replace("-原版", "").replace(date + "-", "")
        images.append(
            {
                "id": digest,
                "title": title,
                "date": date,
                "orientation": orientation,
                "category": category,
                "keywords": keywords.get(source.name, ""),
                "width": width,
                "height": height,
                "size": source.stat().st_size,
                "preview": f"assets/previews/{preview_name}",
                "featured": position % 13 == 0 or width >= 3000,
            }
        )
    images.sort(key=lambda item: (item["date"], item["featured"]), reverse=True)
    (SITE / "data").mkdir(parents=True, exist_ok=True)
    (SITE / "data" / "gallery.json").write_text(
        json.dumps(images, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Built {len(images)} gallery entries in {SITE}")


if __name__ == "__main__":
    main()
