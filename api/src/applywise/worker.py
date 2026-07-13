from __future__ import annotations

import os

from applywise.settings import positive_integer_environment, validate_runtime_environment


def main() -> None:
    validate_runtime_environment()
    command = worker_command()
    os.execvp(command[0], command)


def worker_command() -> list[str]:
    processes = positive_integer_environment("WORKER_PROCESSES", 1)
    threads = positive_integer_environment("WORKER_THREADS", 2)
    return [
        "dramatiq",
        "applywise.embedding_tasks:redis_broker",
        "--processes",
        str(processes),
        "--threads",
        str(threads),
        "--queues",
        "embeddings",
    ]


if __name__ == "__main__":
    main()
