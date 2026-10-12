# what3sounds

Every place has an address. What it sounds like depends on whose vocabulary you listen through.

what3sounds grew out of [what3chords](https://github.com/jethatch/what3chords-songs), a satire of what3words. what3words has one word list, owned by one company, and presents it as the place's address. what3chords copied that move with one table of guitar chords, so the chords came across as the place's chords, when they are really the guitar's chords applied to the place.

Here the two layers are pulled apart:

- The **address** is shared. A point falls in a grid cell, and the cell becomes one large number. The number means nothing by itself.
- A **codebook** is a vocabulary someone has contributed. It reads the number as a few of its own sounds, and the page says who made it and on what terms.

The same spot sounds one way through one codebook and another way through the next. Only the address belongs to the place. Each sound belongs to the people who wrote the codebook.

There are two pages:

- **Places** (`index.html`): choose a place, see its address, hear it through a vocabulary, change the vocabulary and hear the same address again.
- **Journeys** (`journeys.html`): pick a start and an end and hear the trip between them, with road routing, live sessions that follow your location, sharing and download. This is the whole of what3chords songs, with the chord table replaced by whichever codebook is chosen.

## What ships with it

| Codebook | Renderer | What it shows |
|---|---|---|
| Guitar chord voicings | `guitar` | The original what3chords table, credited to its authors. On the hexagon grid a place has the same three chords as on the original site. |
| Just-intonation sonorities (demo) | `ratios` | A small vocabulary with three items to a place, so a place is tens of square kilometres. |
| Ten-step struck tones (demo) | `samples` | Recordings, with the size of a place fixed, so its smallness decides how many tones a place gets. |
| Three-layer rhythm (demo) | `rhythm` | A vocabulary in three parts heard together, the address split between them. |

The three demonstrations were written for this project so that there is something to hear. They are nobody's tradition and say so. Real codebooks need contributors: see [CODEBOOKS.md](CODEBOOKS.md).

## How an address becomes a sound

1. **Address.** Find the grid cell containing the point, at the cell size the codebook reads. Take the cell's digits (its base cell and one digit per level on H3; its fifth-of-a-face and one digit per level on A5), deal them out every third one first so that neighbours don't sound alike, and read the result as one number. On H3 at level 15 this is exactly the original what3chords number.
2. **Fit.** A codebook either fixes how many items a place gets, in which case its size sets the finest cell it can tell apart, or fixes the cell size, in which case its size sets how many items a place gets. A codebook in parts gets one item from each part.
3. **Read.** Stretch the number evenly over the vocabulary (so every item can be reached, not only those at the start), then write it out with one digit per item, each digit in the base of the list it picks from. Each digit picks an item.
4. **Render.** `samples` plays recordings, `ratios` synthesises pitches from frequency ratios, `rhythm` sequences strokes. The guitar codebook has its own renderer: the strummed band from what3chords songs.

The grid can be switched between H3 hexagons and A5 pentagons. A place has a different address on each, so every vocabulary sounds different on each.

## Versions, hosting and withdrawal

- A shared link names the codebook and its version (`cb=guitar-chords@1.0.0`), because the same place only sounds the same through the same reading. If the codebook has since changed, the page says so.
- Codebooks can live on their contributors' own sites. The page's list (`codebooks/index.json`) points at manifests; anyone can also open an unlisted one by its address, and the link then carries that address (`cbu=`).
- A contributor withdraws a codebook by taking it down. The `revoked` list in `codebooks/index.json`, which names a codebook by its id or by its manifest's address, takes it off the menu and stops the page playing a copy that browsers may still hold.
- A codebook opened by its address is marked "unverified": nobody has checked the names it gives for itself.

## Terms and Local Contexts labels

Each codebook's contributors, statement, terms and [Local Contexts](https://localcontexts.org/) labels are shown beside it. The page also behaves as they ask: no download button where a codebook says not to download or carries a non-commercial label; a community-use-only codebook comes off the menu as soon as the page sees its label (it should not be put on the list at all); a seasonal one is refused outside its months, and left off the menu if the list records those months.

Two limits, stated plainly:

- **None of this is a lock.** Anyone can copy what a web page loads. Material that should be restricted should not be put in a codebook.
- **Labels can't be read live.** The Local Contexts Hub does not allow web pages to read it, and its current interface needs a key that a static page cannot keep secret. The page tries the Hub first and otherwise shows the copy carried in the manifest, says it is a copy and from what date, and links to the Hub.

## What this does not fix

The address layer is still anonymous: a global grid applied everywhere from outside, whichever of the two you pick. Places cannot refuse to sound. Plural codebooks fix half of the view-from-nowhere problem and make the other half easier to see.

## Run it

It is a static site with no build step.

```bash
python3 -m http.server 8767
```

Then open <http://localhost:8767>. To put it on GitHub Pages, deploy the `main` branch from the root folder. Live sessions need https, which Pages provides.

## What a link contains

Everything is in the part after `#`; nothing is sent to a server.

| Key | Meaning |
|---|---|
| `cb`, `cbu` | codebook `id@version`, and its manifest's address if it isn't on the list |
| `gr` | grid (`a5`; H3 when absent) |
| `at`, `n` | Places page: the place as `lat,lng`, and its label |
| `a`, `b`, `an`, `bn` | Journeys: start and end, and their labels |
| `m`, `l` | route mode (`road`) and song length (`short`, `long`) |
| `lv`, `lr` | a recorded route: encoded points, and cell sizes |
| `bpm`, `c` | tempo; `c=1` for one item per stop |
| `ts`, `p`, `g`, `d`, `bs` | guitar codebook only: time signature, strum, guitar, drums, bass |

## Layout

```
index.html          Places page
journeys.html       Journeys page
js/grid.js          the address layer: H3 and A5, cell -> number
js/codebooks.js     manifests, fitting, reading an address, labels, withdrawal
js/voices.js        the samples, ratios and rhythm renderers
js/vocab-ui.js      the vocabulary menu and "about this vocabulary" panel
js/places.js        Places page
js/app.js           Journeys page
js/audio.js         the player, offline rendering, live recording
js/band.js, js/patterns.js, js/chords.js, js/diagram.js   the guitar codebook's band
js/routing.js, js/live.js, js/link.js, js/geocode.js      trips, live sessions, links, place search
codebooks/          the list, the guitar manifest and the three demonstrations
tools/make_demos.py writes the demonstrations
```

## Credits and licence

- what3chords: David O'Sullivan, Luke Bergmann, Jim Thatcher and Nick Lally. The guitar chord table and electric guitar samples come from the [original](https://github.com/DOSull/what3chords); their licensing is under discussion with its authors, and until that is settled no licence is granted for reuse of this repository.
- Acoustic guitar samples: [University of Iowa Electronic Music Studios](https://theremin.music.uiowa.edu/MIS.html). Nylon guitar: [quartertone on Freesound](https://freesound.org/people/quartertone/packs/11573/) (CC BY 4.0). Electric bass: [Karoryfer Samples](https://www.karoryfer.com/karoryfer-samples) (CC0). All as edited for [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus Brosowsky (CC BY 3.0), then trimmed and re-encoded.
- Place search by Nominatim and Photon; road routes from the OSRM demo server; basemap © CARTO, map data © OpenStreetMap contributors. MapLibre GL JS, h3-js, a5-js and Tone.js load from jsDelivr at pinned versions.
- The idea of plural codebooks, and much of the wording above, is Luke Bergmann's.
