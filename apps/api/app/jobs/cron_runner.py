import os
from pathlib import Path


def main() -> None:
    for entry in Path("/proc/1/environ").read_bytes().split(b"\0"):
        key, separator, value = entry.partition(b"=")
        if separator:
            os.environ[key.decode()] = value.decode()

    from app.jobs.daily import main as run_daily_job

    run_daily_job()


if __name__ == "__main__":
    main()
