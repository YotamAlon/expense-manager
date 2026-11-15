"""
Build script to compile ExpenseManager into a standalone executable using PyInstaller.

Usage:
    python build.py [--onedir]

Default:
    Builds a single standalone executable in dist/ExpenseManager.exe
"""

import os
import sys
import shutil
import subprocess

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def clean_previous_builds():
    """Removes previous build and dist directories."""
    print("[*] Cleaning previous build artifacts...")
    for folder in ["build", "dist"]:
        path = os.path.join(BASE_DIR, folder)
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
            print(f"    Removed {folder}/")

    spec_file = os.path.join(BASE_DIR, "ExpenseManager.spec")
    if os.path.exists(spec_file):
        os.remove(spec_file)
        print("    Removed ExpenseManager.spec")


def build_executable(onefile: bool = True):
    """Executes PyInstaller with all required asset bundles and flags."""
    sep = os.pathsep  # ';' on Windows, ':' on Unix

    templates_src = os.path.join(BASE_DIR, "expense_app", "templates")
    static_src = os.path.join(BASE_DIR, "expense_app", "static")

    add_data_templates = f"{templates_src}{sep}expense_app/templates"
    add_data_static = f"{static_src}{sep}expense_app/static"

    pyinstaller_args = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=ExpenseManager",
        "--clean",
        "--noconfirm",
        "--add-data",
        add_data_templates,
        "--add-data",
        add_data_static,
    ]

    if onefile:
        pyinstaller_args.append("--onefile")
    else:
        pyinstaller_args.append("--onedir")

    # Entry point
    pyinstaller_args.append(os.path.join(BASE_DIR, "run.py"))

    print("\n[*] Compiling ExpenseManager with PyInstaller...")
    print(f"    Mode: {'--onefile (Single Executable)' if onefile else '--onedir (Directory)'}")
    print(f"    Templates: {templates_src}")
    print(f"    Static Assets: {static_src}\n")

    result = subprocess.run(pyinstaller_args, cwd=BASE_DIR)

    if result.returncode != 0:
        print(f"\n[!] Build failed with return code {result.returncode}")
        sys.exit(result.returncode)

    ext = ".exe" if sys.platform == "win32" else ""
    if onefile:
        dist_path = os.path.join(BASE_DIR, "dist", f"ExpenseManager{ext}")
    else:
        dist_path = os.path.join(BASE_DIR, "dist", "ExpenseManager")

    print("\n" + "=" * 65)
    print(" [OK] Build successful!")
    print(f" Output executable: {dist_path}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    clean_previous_builds()
    use_onefile = "--onedir" not in sys.argv
    build_executable(onefile=use_onefile)
