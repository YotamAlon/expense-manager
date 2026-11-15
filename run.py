import os
import sys
import threading
import webbrowser

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure current directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from expense_app.app import app
from expense_app.database import init_db


def open_browser(port: int = 5000):
    url = f"http://127.0.0.1:{port}"
    webbrowser.open(url)


if __name__ == "__main__":
    init_db()

    is_frozen = getattr(sys, "frozen", False)
    debug_mode = not is_frozen and os.environ.get("FLASK_DEBUG", "1") == "1"

    print("=" * 60)
    print(" [*] ExpenseManager is running!")
    print(" [*] Access it locally at: http://127.0.0.1:5000")
    print("=" * 60)

    # Open browser automatically when running as frozen desktop app or when requested
    if is_frozen or os.environ.get("OPEN_BROWSER", "0") == "1":
        threading.Timer(1.0, open_browser, args=[5000]).start()

    app.run(host="127.0.0.1", port=5000, debug=debug_mode)
