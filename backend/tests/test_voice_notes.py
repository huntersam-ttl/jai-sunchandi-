import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from voice_notes import validate_voice_path

def test_voice_paths():
    assert validate_voice_path("") == ""
    assert validate_voice_path("voices/72f45f09-bdb7-480a-8171-9ccaf4c066c1.webm")

@pytest.mark.parametrize("value", ["../private.mp3", "voices/../../private.mp3", "https://bad.test/a.mp3", "voices/plain.mp3", "voices/72f45f09-bdb7-480a-8171-9ccaf4c066c1.exe", None])
def test_rejects_invalid_voice_paths(value):
    with pytest.raises(ValueError):
        validate_voice_path(value)
