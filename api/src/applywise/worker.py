import signal
import time

from applywise.settings import validate_runtime_environment

_running = True


def _stop(_signum: int, _frame: object) -> None:
    global _running
    _running = False


def main() -> None:
    validate_runtime_environment()
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    print("ApplyWise worker placeholder started.", flush=True)
    while _running:
        time.sleep(5)
    print("ApplyWise worker placeholder stopped.", flush=True)


if __name__ == "__main__":
    main()
