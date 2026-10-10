"""Only permit random private Storage paths, never arbitrary URLs."""
import re

VOICE_PATH = re.compile(
    r"^voices/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](webm|m4a|mp3|ogg)$"
)

def validate_voice_path(path: str) -> str:
    if not isinstance(path, str) or (path and not VOICE_PATH.fullmatch(path)):
        raise ValueError("Invalid voice note path")
    return path
