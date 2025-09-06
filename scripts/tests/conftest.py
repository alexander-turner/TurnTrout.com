import tempfile
from pathlib import Path

import pytest


@pytest.fixture()
def temp_dir():
    """Creates a temporary directory and cleans up afterwards."""
    with tempfile.TemporaryDirectory() as dir_path:
        yield Path(dir_path)
