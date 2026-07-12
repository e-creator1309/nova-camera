#!/usr/bin/env python3
"""
setup-android-toolchain.py
===========================
One-shot installer for the Java + Android SDK/NDK + Gradle toolchain needed to
build an Expo/React Native Android app (expo prebuild + gradlew assembleDebug/
assembleRelease) from scratch on a fresh machine (e.g. a new Replit account/
workspace).

Why this script exists
-----------------------
Setting this toolchain up by hand takes a long time and has a few sharp edges
that are easy to trip over the first time:

  1. On Replit, the directory OUTSIDE your project/workspace folder (plain
     `$HOME`, e.g. `/home/runner`) has a small disk quota that is separate
     from the much larger workspace volume. The Android SDK + Gradle caches
     alone are several GB, so installing them under `$HOME` (the default
     location most guides use, e.g. `~/Android/Sdk`, `~/.gradle`) can blow
     that quota with a confusing "Disk quota exceeded" error that looks like
     you're out of disk space when you actually have tens of GB free.
     -> This script installs everything INSIDE the target directory you pass
        it (default: `./.toolcache` in the current working directory), never
        under bare `$HOME`.

  2. Gradle's Android Gradle Plugin will try to auto-download extra SDK
     components (build-tools/platform versions it wants that you didn't
     preinstall) the first time you build. That auto-download runs in a
     short-lived JVM that is prone to crashing (SIGBUS in hsperfdata) if the
     disk quota above is already tight. Preinstalling the exact versions your
     project needs avoids that path entirely.

  3. A JRE (java-only runtime) is not enough — Gradle/AGP need a full JDK
     (`javac`). This script installs the full Temurin JDK, not the JRE.

What it installs (all self-contained under --install-dir)
-----------------------------------------------------------
  - Eclipse Temurin JDK 17 (full JDK, includes javac)
  - Gradle (binary distribution)
  - Android SDK command-line tools + sdkmanager
  - Android platform-tools, a target platform, build-tools, an NDK, and CMake

Usage
-----
    python3 setup-android-toolchain.py
    python3 setup-android-toolchain.py --install-dir ./.toolcache \\
        --android-platform 36 --build-tools 36.0.0 --ndk-version 27.1.12297006

After it finishes, the script prints the exact environment variables you need
to set (JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT, NDK_HOME, and a PATH
addition). On Replit, set these as persistent env vars/secrets via the
environment variables pane (or ask the Agent to do it with `setEnvVars`) --
do NOT rely on editing ~/.bashrc on Replit, since `~/.bashrc` there is a
symlink into a read-only Nix store and edits to it silently don't persist.

The script is idempotent: re-running it skips any component that is already
correctly installed, so it's safe to re-run if a download gets interrupted.
"""

import argparse
import os
import platform
import shutil
import stat
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Defaults — matched to a typical modern Expo (SDK 54+) / React Native 0.81+
# Android project. Override via CLI flags if your project needs different
# versions (check android/build.gradle "Using the following versions" log
# line from a previous build attempt, or android/gradle.properties).
# ---------------------------------------------------------------------------
DEFAULT_JDK_VERSION = "17"
DEFAULT_GRADLE_VERSION = "8.14.3"
DEFAULT_ANDROID_PLATFORM = "36"
DEFAULT_BUILD_TOOLS = "36.0.0"
DEFAULT_NDK_VERSION = "27.1.12297006"
DEFAULT_CMAKE_VERSION = "3.22.1"

CMDLINE_TOOLS_URL = (
    "https://dl.google.com/android/repository/"
    "commandlinetools-linux-11076708_latest.zip"
)


def log(msg: str) -> None:
    print(f"[setup-android-toolchain] {msg}", flush=True)


def run(cmd, **kwargs):
    log(f"$ {' '.join(str(c) for c in cmd)}")
    return subprocess.run(cmd, check=True, **kwargs)


def download(url: str, dest: Path) -> None:
    if dest.exists():
        log(f"already downloaded: {dest.name}")
        return
    log(f"downloading {url} -> {dest}")
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url) as resp, open(tmp, "wb") as f:
        shutil.copyfileobj(resp, f)
    tmp.rename(dest)


def ensure_dir(p: Path) -> Path:
    p.mkdir(parents=True, exist_ok=True)
    return p


def check_disk_space(target: Path, min_gb: float = 8.0) -> None:
    """Warn (don't fail) if the target volume looks too small for a full
    Android toolchain install (~6-8GB for SDK+NDK+Gradle caches)."""
    usage = shutil.disk_usage(target if target.exists() else target.parent)
    free_gb = usage.free / (1024 ** 3)
    if free_gb < min_gb:
        log(
            f"WARNING: only {free_gb:.1f}GB free at {target}. The Android "
            f"SDK + NDK + Gradle caches need ~6-8GB. If this path is your "
            f"$HOME directory (not your project/workspace volume), consider "
            f"installing under your project directory instead, since $HOME "
            f"often has a much smaller quota on hosted dev environments."
        )


# ---------------------------------------------------------------------------
# JDK
# ---------------------------------------------------------------------------

def install_jdk(install_dir: Path, version: str) -> Path:
    jdk_root = install_dir / f"jdk{version}"
    if (jdk_root / "bin" / "javac").exists():
        log(f"JDK {version} already installed at {jdk_root}")
        return jdk_root

    log(f"installing Temurin JDK {version} ...")
    api_url = (
        f"https://api.adoptium.net/v3/binary/latest/{version}/ga/linux/x64/"
        f"jdk/hotspot/normal/eclipse"
    )
    archive = install_dir / f"temurin-jdk{version}.tar.gz"
    download(api_url, archive)

    extract_tmp = ensure_dir(install_dir / f"_extract_jdk{version}")
    with __import__("tarfile").open(archive) as tar:
        tar.extractall(extract_tmp)
    # Adoptium tarballs contain a single top-level dir like jdk-17.0.x+y
    (extracted_root,) = [d for d in extract_tmp.iterdir() if d.is_dir()]
    if jdk_root.exists():
        shutil.rmtree(jdk_root)
    extracted_root.rename(jdk_root)
    shutil.rmtree(extract_tmp, ignore_errors=True)
    archive.unlink(missing_ok=True)
    log(f"JDK {version} installed at {jdk_root}")
    return jdk_root


# ---------------------------------------------------------------------------
# Gradle
# ---------------------------------------------------------------------------

def install_gradle(install_dir: Path, version: str) -> Path:
    gradle_root = install_dir / f"gradle-{version}"
    if (gradle_root / "bin" / "gradle").exists():
        log(f"Gradle {version} already installed at {gradle_root}")
        return gradle_root

    log(f"installing Gradle {version} ...")
    url = f"https://services.gradle.org/distributions/gradle-{version}-bin.zip"
    archive = install_dir / f"gradle-{version}-bin.zip"
    download(url, archive)

    extract_tmp = ensure_dir(install_dir / "_extract_gradle")
    with zipfile.ZipFile(archive) as zf:
        zf.extractall(extract_tmp)
    (extracted_root,) = [d for d in extract_tmp.iterdir() if d.is_dir()]
    if gradle_root.exists():
        shutil.rmtree(gradle_root)
    extracted_root.rename(gradle_root)
    shutil.rmtree(extract_tmp, ignore_errors=True)
    archive.unlink(missing_ok=True)
    log(f"Gradle {version} installed at {gradle_root}")
    return gradle_root


# ---------------------------------------------------------------------------
# Android SDK
# ---------------------------------------------------------------------------

def install_android_sdk(
    install_dir: Path,
    jdk_root: Path,
    platform: str,
    build_tools: str,
    ndk_version: str,
    cmake_version: str,
) -> Path:
    sdk_root = install_dir / "android-sdk"
    cmdline_tools_dir = sdk_root / "cmdline-tools" / "latest"
    sdkmanager = cmdline_tools_dir / "bin" / "sdkmanager"

    env = os.environ.copy()
    env["JAVA_HOME"] = str(jdk_root)
    env["PATH"] = f"{jdk_root / 'bin'}:{env.get('PATH', '')}"

    if not sdkmanager.exists():
        log("installing Android SDK command-line tools ...")
        ensure_dir(sdk_root)
        archive = install_dir / "cmdline-tools.zip"
        download(CMDLINE_TOOLS_URL, archive)

        extract_tmp = ensure_dir(install_dir / "_extract_cmdline_tools")
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(extract_tmp)
        ensure_dir(cmdline_tools_dir.parent)
        if cmdline_tools_dir.exists():
            shutil.rmtree(cmdline_tools_dir)
        (extract_tmp / "cmdline-tools").rename(cmdline_tools_dir)
        shutil.rmtree(extract_tmp, ignore_errors=True)
        archive.unlink(missing_ok=True)

        # Make sure all binaries are executable (zip extraction can drop +x)
        for exe_dir in ["bin"]:
            for f in (cmdline_tools_dir / exe_dir).glob("*"):
                f.chmod(f.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

    # Accept all licenses non-interactively.
    log("accepting Android SDK licenses ...")
    proc = subprocess.Popen(
        [str(sdkmanager), f"--sdk_root={sdk_root}", "--licenses"],
        stdin=subprocess.PIPE,
        env=env,
    )
    proc.communicate(input=b"y\n" * 20)

    packages = [
        "platform-tools",
        f"platforms;android-{platform}",
        f"build-tools;{build_tools}",
        f"ndk;{ndk_version}",
        f"cmake;{cmake_version}",
    ]
    log(f"installing SDK packages: {', '.join(packages)}")
    run(
        [str(sdkmanager), f"--sdk_root={sdk_root}", *packages],
        env=env,
    )

    log(f"Android SDK ready at {sdk_root}")
    return sdk_root


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if platform.system() != "Linux" or platform.machine() not in ("x86_64", "AMD64"):
        log(
            f"WARNING: this script targets linux/x86_64 (Replit's environment). "
            f"Detected {platform.system()}/{platform.machine()} — downloads may fail."
        )

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--install-dir",
        default="./.toolcache",
        help="Where to install everything. Must NOT be your bare $HOME on Replit "
        "(small quota there) — default is a .toolcache folder in the current "
        "directory, which should be inside your project/workspace volume.",
    )
    parser.add_argument("--jdk-version", default=DEFAULT_JDK_VERSION)
    parser.add_argument("--gradle-version", default=DEFAULT_GRADLE_VERSION)
    parser.add_argument("--android-platform", default=DEFAULT_ANDROID_PLATFORM)
    parser.add_argument("--build-tools", default=DEFAULT_BUILD_TOOLS)
    parser.add_argument("--ndk-version", default=DEFAULT_NDK_VERSION)
    parser.add_argument("--cmake-version", default=DEFAULT_CMAKE_VERSION)
    args = parser.parse_args()

    install_dir = ensure_dir(Path(args.install_dir).resolve())
    check_disk_space(install_dir)

    jdk_root = install_jdk(install_dir, args.jdk_version)
    gradle_root = install_gradle(install_dir, args.gradle_version)
    sdk_root = install_android_sdk(
        install_dir,
        jdk_root,
        args.android_platform,
        args.build_tools,
        args.ndk_version,
        args.cmake_version,
    )
    ndk_root = sdk_root / "ndk" / args.ndk_version

    env_lines = [
        f'JAVA_HOME="{jdk_root}"',
        f'ANDROID_HOME="{sdk_root}"',
        f'ANDROID_SDK_ROOT="{sdk_root}"',
        f'NDK_HOME="{ndk_root}"',
        f'GRADLE_HOME="{gradle_root}"',
    ]
    path_addition = f"{jdk_root}/bin:{gradle_root}/bin:{sdk_root}/platform-tools"

    env_file = install_dir / "android-tools.env"
    env_file.write_text(
        "\n".join(f"export {line}" for line in env_lines)
        + f'\nexport PATH="{path_addition}:$PATH"\n'
    )

    print("\n" + "=" * 78)
    print("DONE. Toolchain installed under:", install_dir)
    print("=" * 78)
    print(f"\nA ready-to-source env file was written to:\n  {env_file}\n")
    print("On Replit specifically, environment variables set via shell files")
    print("(~/.bashrc, ~/.profile) usually do NOT persist across tool calls or")
    print("workflow restarts. Instead, set these as persistent env vars, e.g.")
    print("by asking the Agent to run `setEnvVars`, or via the Secrets/")
    print("Env Vars pane, with these exact values:\n")
    for line in env_lines:
        key, _, val = line.partition("=")
        print(f"  {key} = {val.strip(chr(34))}")
    print(f"\n  PATH addition (prepend): {path_addition}\n")
    print("Then verify with:")
    print("  java -version && javac -version && gradle -v && sdkmanager --version")
    print("\nYou can now run, inside your Expo project:")
    print("  npx expo prebuild --platform android --no-install")
    print("  cd android && ./gradlew assembleDebug")
    print("=" * 78)


if __name__ == "__main__":
    main()
