from __future__ import annotations

import argparse
import hashlib
import urllib.request
from pathlib import Path

YUNET_URL = (
    "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    print(f"Downloading {url}")
    with urllib.request.urlopen(url, timeout=60) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if temporary.stat().st_size < 10_000 or temporary.read_bytes().startswith(
        b"version https://git-lfs"
    ):
        temporary.unlink(missing_ok=True)
        raise RuntimeError("downloaded file is a Git LFS pointer or an invalid model")
    temporary.replace(destination)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    print(f"Saved {destination} ({destination.stat().st_size} bytes, sha256={digest})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download public optional CV model assets")
    parser.add_argument("--force", action="store_true", help="replace an existing model")
    args = parser.parse_args()
    destination = Path("models/face_detection_yunet_2023mar.onnx")
    if destination.exists() and not args.force:
        print(f"Already exists: {destination}")
        return
    download(YUNET_URL, destination)


if __name__ == "__main__":
    main()
