#!/usr/bin/env python3
"""Write the demonstration codebooks that ship with what3sounds.

These are written by the project to exercise each renderer. They are not
anyone's tradition and are labelled as demonstrations. Real codebooks come
from contributors; see CODEBOOKS.md.

Usage: python3 tools/make_demos.py        (needs numpy and ffmpeg for the tones)
"""
import itertools
import json
import math
import os
import subprocess
import tempfile
import wave

import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = [{"name": "the what3sounds project", "role": "wrote this demonstration"}]


def write(folder, manifest):
    path = os.path.join(HERE, "codebooks", folder, "manifest.json")
    with open(path, "w") as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
        f.write("\n")
    count = sum(len(p["items"]) for p in manifest["parts"]) if "parts" in manifest else len(manifest["items"])
    print(f"{folder}: {count} items")


def just_sonorities():
    """432 sonorities in five-limit just intonation, for the 'ratios' renderer."""
    roots = ["1/1", "16/15", "9/8", "6/5", "5/4", "4/3", "45/32", "3/2", "8/5", "5/3", "9/5", "15/8"]
    shapes = ["4:5:6", "10:12:15", "6:8:9", "8:9:12", "2:3:4", "4:5:6:7", "6:7:9", "12:15:18:20",
              "8:10:12:15", "10:12:15:18", "5:6:7", "16:20:25"]
    registers = [("low", 0.5), ("mid", 1), ("high", 2)]
    items = []
    for (name, octave), root, shape in itertools.product(registers, roots, shapes):
        a, b = (int(x) for x in root.split("/"))
        parts = [int(x) for x in shape.split(":")]
        ratios = [round(octave * a / b * p / parts[0], 6) for p in parts]
        items.append({"label": f"{root} {shape} {name}", "ratios": ratios})
    write("just-sonorities", {
        "id": "just-sonorities-demo",
        "version": "1.0.0",
        "title": "Just-intonation sonorities (demo)",
        "demo": True,
        "contributors": PROJECT,
        "statement": "A demonstration written for this page, and nobody's tradition. Twelve whole-number chord shapes are built on each of twelve pitches of a five-limit just scale, in three registers: 432 sonorities, synthesised from their frequency ratios. It is here to show the ratios renderer, and what a small vocabulary costs. With 432 sonorities and three to a place, a place can be no finer than a cell tens of kilometres across.",
        "terms": {"download": True, "commercial": True},
        "address": {"items": 3},
        "renderer": "ratios",
        "tuning": {"base": 220},
        "items": items,
    })


def ten_step_tones():
    """48 struck-bar tones, ten equal steps to the octave, for the 'samples' renderer."""
    rate = 44100
    folder = os.path.join(HERE, "codebooks", "ten-step-tones", "audio")
    items = []
    for i in range(48):
        frequency = 130.0 * 2 ** (i / 10)
        seconds = 1.6
        t = np.arange(int(rate * seconds)) / rate
        tone = np.zeros_like(t)
        # A struck bar: its overtones are not whole multiples of the pitch.
        for multiple, level, decay in [(1, 1.0, 3.0), (2.756, 0.45, 6.0), (5.404, 0.2, 11.0)]:
            if frequency * multiple < rate / 2.2:
                tone += level * np.sin(2 * math.pi * frequency * multiple * t) * np.exp(-decay * t)
        tone *= np.minimum(1, t / 0.004)
        tone *= np.minimum(1, (seconds - t) / 0.08)
        tone = 0.7 * tone / np.max(np.abs(tone))
        name = f"{i + 1:02d}.mp3"
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            with wave.open(tmp.name, "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(rate)
                w.writeframes((tone * 32767).astype(np.int16).tobytes())
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-c:a", "libmp3lame",
                            "-b:a", "64k", os.path.join(folder, name)], check=True)
            os.unlink(tmp.name)
        items.append({"label": f"step {i + 1}", "audio": f"audio/{name}"})
    write("ten-step-tones", {
        "id": "ten-step-tones-demo",
        "version": "1.0.0",
        "title": "Ten-step struck tones (demo)",
        "demo": True,
        "contributors": PROJECT,
        "statement": "A demonstration written for this page, and nobody's tradition. Forty-eight recordings of a synthesised struck bar, tuned to ten equal steps in each octave. It is here to show the samples renderer, which plays recordings as they are, and the other way of fitting a vocabulary to the grid: this codebook fixes the size of a place (about a hectare and a half) and lets its own smallness decide how many tones a place gets, which comes to a seven-note phrase.",
        "terms": {"download": True, "commercial": True},
        "address": {"resolution": 10},
        "renderer": "samples",
        "beats": 1,
        "items": items,
    })


def patterns(steps, onsets, first):
    """Every pattern of `steps` with a number of onsets in `onsets`; `first`
    says whether step one must be struck (True), must not be (False)."""
    found = []
    for count in onsets:
        for struck in itertools.combinations(range(steps), count):
            if (0 in struck) != first:
                continue
            found.append({"pattern": "".join("x" if i in struck else "." for i in range(steps))})
    return found


def three_layer_rhythm():
    """Three parts heard together, each chosen separately: a mixed-radix codebook."""
    drum = patterns(12, [2, 3, 4], True)
    clap = patterns(12, [2, 3, 4], False)
    shaker = [p for p in patterns(12, [5, 6, 7], True)] + [p for p in patterns(12, [5, 6, 7], False)]
    for part in (drum, clap, shaker):
        for item in part:
            item["label"] = item["pattern"]
    write("three-layer-rhythm", {
        "id": "three-layer-rhythm-demo",
        "version": "1.0.0",
        "title": "Three-layer rhythm (demo)",
        "demo": True,
        "contributors": PROJECT,
        "statement": "A demonstration written for this page, and nobody's tradition. Every place gets a low drum pattern, a clap pattern and a shaker pattern, each a way of placing a few strokes on twelve steps, and hears the three together. It is here to show the rhythm renderer and a vocabulary in parts: the address is split three ways, each part with its own number of choices.",
        "terms": {"download": True, "commercial": True},
        "address": {"together": True},
        "renderer": "rhythm",
        "parts": [
            {"title": "drum", "sound": "drum", "items": drum},
            {"title": "clap", "sound": "clap", "items": clap},
            {"title": "shaker", "sound": "shaker", "items": shaker},
        ],
    })


if __name__ == "__main__":
    just_sonorities()
    ten_step_tones()
    three_layer_rhythm()
