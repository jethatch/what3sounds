# Contributing a codebook

A codebook is a vocabulary: a set of sounds, with the names of the people who made it and the terms they set. what3sounds reads a place's address through it. This page explains what a codebook is made of and how to offer one.

Before anything else: **a web page cannot keep anything private.** Whatever a codebook contains can be copied by anyone who opens the page. The question to ask is not "what restrictions should we add" but "is this something we want public." If the answer is no, it should not go into a codebook.

## What you provide

- **The sounds.** Recordings, or a description the page can synthesise from (frequency ratios, or stroke patterns).
- **Who made them**, in whatever words you choose, and a short statement of what the vocabulary is and what it is for.
- **Your terms**: whether it may be downloaded, whether commercial use is acceptable, and, if you use them, your [Local Contexts](https://localcontexts.org/) labels.

You host these yourself if you wish, on your own site or repository. The page fetches the codebook when a listener chooses it and keeps no copy. Taking it down withdraws it. (Your host has to allow other sites to read the files; on most static hosts, including GitHub Pages, it does.)

## The manifest

One JSON file describes a codebook.

```json
{
  "id": "example-three-voice",
  "version": "1.0.0",
  "title": "Three-voice sonorities",
  "contributors": [{"name": "…", "role": "singers and arrangers"}],
  "community": "…",
  "statement": "Who made this, how, and what it is for, in your words.",
  "localContexts": {
    "projectId": "00000000-0000-0000-0000-000000000000",
    "asOf": "2026-10-11",
    "labels": [{"name": "TK Attribution", "text": "Your community's wording for the label.", "community": "…"}]
  },
  "terms": {"download": false, "commercial": false},
  "address": {"items": 3},
  "renderer": "samples",
  "items": [{"label": "first", "audio": "audio/0000.mp3"}]
}
```

| Field | Meaning |
|---|---|
| `id` | Lower-case letters, digits and hyphens. Stays the same across versions. |
| `version` | Three numbers, `1.0.0`. See "Versions" below. |
| `title` | What listeners see in the menu. |
| `contributors` | A list of `{name, role}`. Shown beside the vocabulary. |
| `community` | Optional. If given, the page says "heard through *community*'s vocabulary" rather than listing names. |
| `statement` | Up to about 2,000 characters, shown as written. |
| `localContexts` | Optional. `projectId` is your project on the Local Contexts Hub. `labels` is a copy of the labels as they stood on the `asOf` date. |
| `terms` | `download: false` removes the download button for this vocabulary. `commercial: false` is shown to listeners. `months: [11, 12, 1, 2]` makes it available only in those months, with `note` to say why. |
| `address` | How the vocabulary is fitted to the grid. See below. |
| `renderer` | `samples`, `ratios` or `rhythm`. |
| `items` or `parts` | The vocabulary itself. |

### Renderers

- **`samples`** plays your own recordings. Each item is `{"label": …, "audio": "path or address"}`. Paths are relative to the manifest. MP3 plays everywhere; only the recordings for the places a listener visits are fetched.
- **`ratios`** synthesises pitches from frequency ratios, which suits tunings that are not twelve equal steps. Each item is `{"label": …, "ratios": [1, "5/4", "3/2"]}`: every ratio is sounded over `tuning.base` (in Hz, 220 if you don't say).
- **`rhythm`** sequences strokes. Each item is `{"label": …, "pattern": "x..x..x."}`: `x` is a stroke, `X` an accented one, `.` a rest, and the pattern fills one bar however many steps it has. `sound` is `clap`, `drum`, `shaker` or `wood`.

`beats` (optional, for any renderer) says how many beats each item lasts. Without it an item lasts one bar of whatever time signature the listener has chosen.

### Fitting a vocabulary to the grid

A place's address is one large number. The codebook reads it as a few of its items, by writing the number out with the vocabulary's size as the base. So the size of the vocabulary and the size of a "place" depend on each other, and you choose which to fix.

**Fix how many items a place gets** (`"address": {"items": 3}`). Then the vocabulary's size decides how fine a place can be: there have to be at least as many combinations as places.

| Items needed for three to a place | Hexagon (H3) | Cell area |
|---|---|---|
| 244 | level 6 | about 36 km² |
| 1,702 | level 9 | about 10.5 ha |
| 3,255 | level 10 | about 1.5 ha |
| 6,226 | level 11 | about 2,150 m² |
| 11,909 | level 12 | about 307 m² |
| 22,780 | level 13 | about 44 m² |
| 43,576 | level 14 | about 6.3 m² |
| 83,358 | level 15 | about 0.9 m² |

(These are a little above the figures you get from counting cells exactly, because the address numbering leaves some numbers unused.)

**Or fix the size of a place** (`"address": {"resolution": 11}`, an H3 level; the pentagon grid uses its nearest size). Then the vocabulary's size decides how many items a place gets. Eleven items at level 15 comes to fifteen per place.

**Vocabularies in parts.** Instead of `items`, give `parts`, each with its own `title` and `items` (and optionally its own `renderer` and `sound`). A place gets one item from each part, and the address is split between them, each part counted in its own base. By default the parts are heard one after another; `"address": {"together": true}` sounds them at once.

Two more options under `address`:

- `"scramble": false` turns off the shuffle that makes neighbouring places sound unrelated. Without it, places close together sound alike and the sound changes gradually across the map.
- `"spread"` is normally worked out for you: the address is multiplied up so that it ranges over your whole vocabulary rather than only the start of it. Give a number to fix it.

## Versions

If you add one item, the base changes and every place on Earth sounds different. So a published version is never edited. A change is a new version, which is a new reading, not a correction of the old one. Links that listeners share carry the version they heard (`cb=example-three-voice@1.0.0`); if the codebook has moved on, the page says so.

## Local Contexts labels

Labels are notices of protocol, not licences. The page shows them with your community's own wording and tries to behave as they ask:

- **TK Non-Commercial** (or `download: false`): no download button for this vocabulary.
- **TK Community Use Only**: the codebook is never put on the page's public list. It can still be opened by someone who has its address.
- **TK Seasonal**: use `terms.months` to say when it is available.

One limit, plainly: the Local Contexts Hub does not let web pages read it directly, so the page cannot fetch your current labels as it would like to. It tries, and when that fails it shows the copy in your manifest, says that it is a copy and from what date, and links to your project on the Hub. If you change your labels, update the copy.

## Getting listed

The page's list is `codebooks/index.json` in this repository. To be added, open an issue or a pull request with the address of your manifest. Being listed is optional: anyone with a manifest's address can open it with "Open another by address".

To withdraw a codebook, take the manifest down. To stop the page offering copies that browsers may still hold, ask for an entry in `revoked` in the same file:

```json
{"id": "example-three-voice", "version": "1.0.0", "reason": "Withdrawn by its contributors."}
```

Leave out `version` to withdraw every version.

## What this does not do

Any vocabulary here can be heard anywhere on Earth; codebooks are not tied to territories. Whether that is acceptable for your material is yours to decide, and it is a good reason to decide against contributing.

The address underneath is still a single global grid drawn by someone else. A codebook gives the sound an author. It does not give the place a say.
