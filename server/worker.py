"""Standalone J.A.R.V.I.S. Temporal Worker process."""

import asyncio
import logging
import sys
from pathlib import Path

# Ensure d:\Jarvis is in sys.path
root = Path(__file__).resolve().parent.parent
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from server.memory import MemoryTool, Store
from server.temporal_engine import run_jarvis_worker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


async def main() -> None:
    store = Store()
    memory = MemoryTool()
    memory.bootstrap()
    print("Starting J.A.R.V.I.S. Temporal Worker...")
    await run_jarvis_worker(store, memory)


if __name__ == "__main__":
    asyncio.run(main())
