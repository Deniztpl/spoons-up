import json
from pathlib import Path

from app.main import app

DEFAULT_OUTPUT_PATH = Path(__file__).resolve().parents[2] / "openapi.json"


def export_openapi(output_path: Path = DEFAULT_OUTPUT_PATH) -> Path:
    content = json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    with output_path.open("w", encoding="utf-8", newline="\n") as output_file:
        output_file.write(content)
    return output_path


if __name__ == "__main__":
    export_openapi()
