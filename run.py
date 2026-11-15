import os
import sys

# Ensure current directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from expense_app.app import app
from expense_app.database import init_db
from expense_app.sample_data import generate_sample_files

if __name__ == "__main__":
    init_db()
    generate_sample_files()
    print("=" * 60)
    print(" 🚀 ExpenseManager Web Application is running!")
    print(" 🌐 Access it locally at: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host="127.0.0.1", port=5000, debug=True)
