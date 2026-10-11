from __future__ import annotations

import argparse


def greet(name: str = "World") -> str:
    return f"Hello, {name}! Welcome to your Python project."


def main() -> None:
    parser = argparse.ArgumentParser(description="Simple starter Python app")
    parser.add_argument("--name", default="World", help="Name to greet")
    args = parser.parse_args()
    print(greet(args.name))


if __name__ == "__main__":
    main()
