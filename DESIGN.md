# Design notes: what3chords songs and what3sounds

*Written by Claude as a working record of what was built and decided. It is a preview document, not a finished statement by the project's authors.*

Last updated 28 October 2026.

This covers two sibling projects:

| Project | Repository | Live site |
|---|---|---|
| what3chords songs | github.com/jethatch/what3chords-songs | https://jethatch.github.io/what3chords-songs/ |
| what3sounds | github.com/jethatch/what3sounds | https://jethatch.github.io/what3sounds/ |

Both are static sites for GitHub Pages: no build step, no server code, no keyed services.

Two later projects grew out of these and keep their own records in their READMEs (with a list of open issues in `library/ISSUES.md` for the first):

| Project | Repository | Live site |
|---|---|---|
| what3birdsongs | github.com/jethatch/what3birdsongs | https://jethatch.github.io/what3birdsongs/ |
| what3birdsongs, Aotearoa New Zealand | github.com/jethatch/what3birdsongs-nz | https://jethatch.github.io/what3birdsongs-nz/ |

---

## 1. Where the idea comes from

**what3chords** (July 2020; David O'Sullivan, Luke Bergmann, Jim Thatcher, Nick Lally; github.com/DOSull/what3chords) is a satire of what3words. Every roughly one-square-metre cell on Earth gets an address of three guitar chords from one fixed table. The joke is that the chords are as arbitrary as what3words' words: one source writes its definitions onto the world.

**what3chords songs** rebuilds that and adds journeys.

**what3sounds** takes the satire seriously. It separates two layers that the original (and what3words) fuse:

- the **address**: a place becomes a grid cell, and the cell becomes one number;
- the **vocabulary**: something that reads that number as sounds.

The address stays shared. The vocabulary is opened to many authors as **codebooks**, each attributed, each on its contributors' terms. The source design note is `plural-codebooks.md`. Its terms and ideas emerged in conversation among the original authors, driven by Bergmann's lack of a sense of satire.

---

## 2. what3chords songs

### Features

- **Place to chords.** H3 cell at resolution 15 → base cell plus 15 base-7 digits, shuffled by a fixed permutation → one number → three digits in base 167,011 → three voicings from the chord table. Identical to the original (verified on tens of thousands of points).
- **Start and end by name.** Nominatim, with Photon as fallback; also `lat, lng`, map click, draggable pins.
- **Routes as chains of cells.**
  - *Hex walk*: greedy local routing, each step to the neighbour nearest the destination, computed in the browser.
  - *Follow roads*: public OSRM demo server; the cells the road passes through. Falls back to the walk if there is no route, no server, or a pin is far from any road.
  - Cell size is chosen so a trip has about 10, 28 or 75 stops at most (Short, Medium, Long).
- **Playback.** A marker travels the route; each stop plays its three chords, one bar each, or one chord per stop. Time signatures 4/4, 3/4, 6/8, 2/4, 5/4, 7/8; tempo 50–220; several strum patterns per signature. Changes apply at the next bar line.
- **Band.** Drums (synthesised) and bass (sampled) that follow each strum pattern, an optional drum style, a three-way mixer, eight guitar choices, and a Style menu that sets everything at once.
- **Simple default.** Start, end, Style, time signature, tempo, Go live and the player are always visible. Route options, Rhythm and Band fold away, each showing its current settings.
- **Sharing.** Everything is in the URL hash. Share button; "Play this song" prompt on arrival; link preview tags.
- **Download.** Offline render to mono WAV, in 16-second chunks so time grows linearly; capped at 10 minutes of audio.
- **Live sessions.** Follows the device's location. The cell you are in loops its chords (taken at the cell's centre, so it is repeatable). Cell size grows with speed. Ending a session leaves a replayable, shareable route and a downloadable recording.
- **"What is this?" panel**: history, the satire, the colonial-cartography argument, further reading.
- **A5 grid**: a second address system on equal-area pentagons. Resolution 23 (about 0.5 m²), same shuffle construction, multiplied by 4 to spread first chords over most of the table. A place gets different chords on each grid, on purpose.

### Decisions worth remembering

- H3 behaviour must never change; it has to match the original site.
- Chords sound as drawn (the original played a mirror image an octave out).
- Road-mode links re-ask the routing server, so they can drift. Hex-walk and recorded-route links rebuild exactly.
- A travelled route only goes into a link after an explicit confirmation.
- On A5 the first chord is far more local than on H3 (about half of places a kilometre apart differ, against one in twenty).
- A start-up guard refetches scripts once if a browser holds mismatched cached files after a deploy.

### Licensing

Under discussion with the original authors. The chord table and the electric guitar samples come from the original repository, which has no licence. The acoustic, nylon and bass samples have known terms (University of Iowa: unrestricted; Freesound/quartertone: CC BY 4.0; Karoryfer: CC0; via tonejs-instruments, CC BY 3.0).

---

## 3. what3sounds

### The two layers

```
point ──► grid cell (at the size the codebook reads) ──► shuffle ──► number N     shared
                                                                       │
                                                codebook (size K) ─────┤          chosen by the listener
                                                                       ▼
                             N stretched over the vocabulary, written in base K ──► items ──► renderer ──► sound
```

- **Grids**: H3 hexagons or A5 pentagons (the listener chooses). `js/grid.js` gives the address number for any cell size on either. On H3 at level 15 it is the original what3chords number.
- **Codebooks**: a JSON manifest, which can live on its contributors' own site. `js/codebooks.js` reads and checks it, fits it to the grid, and reads an address through it.

### Fitting a codebook to a grid

A manifest declares one of:

- **items per place fixed** (`address.items`, default 3): the vocabulary's size sets the finest cell it can tell apart;
- **cell size fixed** (`address.resolution`): its size sets how many items a place gets;
- **parts**: one item from each part, the address split in mixed radix; heard in sequence or together (`address.together`).

Options: `scramble: false` for gradual change across space; `spread` (default "fill", which stretches addresses evenly over the vocabulary so every item is reachable).

### Renderers

| Renderer | Items are | Sound |
|---|---|---|
| `samples` | recordings | played as they are; only fetched for places listened to |
| `ratios` | frequency ratios over a base pitch | synthesised; suits non-equal tunings |
| `rhythm` | stroke patterns | sequenced on a simple percussive sound |
| `guitar` | the what3chords table | the strummed band; only this page's own guitar codebook may use it |

### What ships

- **Guitar chord voicings**: the original table, credited to its four authors. Same chords as what3chords on both grids.
- **Three demonstrations**, written for the project and labelled as nobody's tradition: just-intonation sonorities (`ratios`, three to a place), ten-step struck tones (`samples`, fixed cell size, seven to a place), three-layer rhythm (`rhythm`, three parts heard together).

No vocabulary from a real tradition is invented. Those need contributors (`CODEBOOKS.md`).

### Attribution, terms and conduct

- The page states whose vocabulary is being heard, with the contributors' statement, terms and Local Contexts labels.
- **Labels cannot be read live**: the Local Contexts Hub blocks web pages and its current interface needs a key. The page tries the Hub, then shows a dated copy from the manifest and says it is a copy.
- **Behaviour follows terms and labels**: no download for `download: false` or a non-commercial label; community-use-only codebooks come off the menu; seasonal ones are refused out of season.
- **Versions**: links carry `cb=id@version`. A changed version is a new reading; the page warns, it cannot replay the old one.
- **Hosting**: a list (`codebooks/index.json`) plus open-by-address (`cbu=`). A `revoked` list withdraws a codebook by id or manifest address.
- **Unverified**: a codebook opened by address is marked unverified, since anyone can write any names into a manifest.

### Two pages

- **Places** (`index.html`): one place, its address number, heard through the chosen vocabulary. The landing page.
- **Journeys** (`journeys.html`): trips, road mode, live sessions, sharing and download, through whichever codebook is chosen. Guitar-only controls are hidden for other codebooks.

### What it does not do

- Nothing is enforced. Anyone can copy what a web page loads; restricted material should not go into a codebook.
- The address layer is still one anonymous global grid, whichever of the two is picked. Places cannot refuse to sound. Plural codebooks fix half of the view-from-nowhere problem and make the other half easier to see.
- The address number changes with the vocabulary, because each reads a different cell size.

---

## 4. How the work is done

- Each part is built on a branch, tested in the browser, then reviewed by a Sonnet subagent acting as critic and tester.
- Critic passes are kept short and narrowly scoped; long ones were interrupted twice.
- Nothing is published without the owner's sign-off.
- Sound has only been checked by measurement, never by ear. Real phones, real GPS and Safari are untested.

---

## 5. Status (28 October 2026)

- **what3chords songs**: the "What is this?" panel and the A5 grid are merged into `main` and published. A last, narrowly scoped critic pass before the merge found nothing to fix: H3 behaviour and old links are unchanged. Since then: MIDI export (planned routes and live sessions), a Safari fix for the mixer layout, a fix for hidden inputs that let the page scroll, and a page that still works without the map where a browser can't draw it.
- **what3sounds**: published with GitHub Pages from `main`. Places is the landing page; a two-tab switch under the title and a link under each place's sounds lead to Journeys, carrying the place, grid and vocabulary along.
- Jim Thatcher's chapter is cited by its title, "Address.Error.503", in both projects.
- Text written by Claude is marked as preview text in both READMEs, in `CODEBOOKS.md`, in the pages' panels, and in the descriptions of the codebooks that ship with what3sounds. The "What is this?" text in what3chords songs was supplied by Jim Thatcher.

**Still open**

- Licensing, with the original authors.
- Review of the preview text by the authors.
- Listening tests by ear, and tests on real phones, real GPS and Safari.
- The what3sounds critic re-checked the fixes made after its review (28 October 2026). Most are sound. Five problems remain to fix: an empty codebook menu (every codebook out of season or withdrawn) breaks the page; a listed but community-only codebook is wrongly badged "unverified"; a link to a withdrawn or out-of-season codebook gives the wrong reason; some raw browser error messages can reach readers; and changing place without playing doesn't cancel a pending play.
- MIDI files from what3chords songs have not been tried in a music program.
- No vocabulary from a real tradition ships; those wait for contributors.
