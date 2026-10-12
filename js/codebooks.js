// The vocabulary layer. A codebook is a contributed, attributed set of
// sounds, described by a manifest file that can live anywhere on the web.
// It reads a place's address number as a few of its own items; the same
// address read through another codebook is a different sound.
//
// The page is a player, not an owner: it fetches a manifest when asked,
// shows who made it and on what terms, and stops offering one that its
// contributors have withdrawn.

import { loadChords, chordAt, chordCount } from "./chords.js";

const INDEX_URL = "./codebooks/index.json";
const HUB = "https://localcontextshub.org";
const RENDERERS = ["guitar", "samples", "ratios", "rhythm"];
const MAX_ITEMS = 250000;
const MAX_PARTS = 8;
const MAX_ITEMS_PER_PLACE = 24;
const LABEL_TIMEOUT_MS = 4000;

const clip = (value, length) => String(value == null ? "" : value).slice(0, length);

function absolute(url, base) {
  const resolved = new URL(url, base);
  if (resolved.protocol !== "https:" && resolved.protocol !== "http:") throw new Error("Only web addresses can be opened.");
  return resolved.href;
}

async function fetchJSON(url) {
  let response;
  try {
    response = await fetch(url, { cache: "no-cache" });
  } catch (error) {
    throw new Error("It couldn’t be reached. Its host may be down, or may not allow other sites to read it.");
  }
  if (!response.ok) throw new Error(`Its host answered with an error (${response.status}).`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error("What came back isn’t a codebook manifest.");
  }
}

// ---------------------------------------------------------------------------
// The list of known codebooks, and the ones that have been withdrawn
// ---------------------------------------------------------------------------

let index = null;

// { codebooks: [{ id, title, manifest }], revoked: [{ id, version, reason }] }
export async function loadIndex() {
  if (!index) {
    const raw = await fetchJSON(INDEX_URL);
    index = {
      codebooks: (raw.codebooks || []).map((entry) => ({
        id: clip(entry.id, 60),
        title: clip(entry.title, 80),
        manifest: absolute(entry.manifest, new URL(INDEX_URL, location.href)),
      })),
      revoked: (raw.revoked || []).map((entry) => ({
        id: clip(entry.id, 60), version: entry.version ? clip(entry.version, 20) : null, reason: clip(entry.reason, 300),
      })),
    };
  }
  return index;
}

function revocation(id, version) {
  return index && index.revoked.find((entry) => entry.id === id && (!entry.version || entry.version === version));
}

// ---------------------------------------------------------------------------
// Reading a manifest
// ---------------------------------------------------------------------------

function readItems(list, renderer, base) {
  if (!Array.isArray(list) || list.length < 2) throw new Error("A codebook needs at least two items.");
  if (list.length > MAX_ITEMS) throw new Error("That codebook has more items than this page will load.");
  return list.map((raw, i) => {
    const item = { name: clip(raw.label ?? raw.name ?? raw.id ?? i, 60), renderer };
    if (renderer === "samples") item.audio = absolute(raw.audio, base);
    if (renderer === "ratios") item.ratios = readRatios(raw.ratios);
    if (renderer === "rhythm") {
      item.pattern = clip(raw.pattern, 64);
      if (!/^[xX.\-]+$/.test(item.pattern)) throw new Error(`Item ${i} has a rhythm pattern this page can’t read.`);
    }
    return item;
  });
}

// "3/2", 1.5 or [3, 2]
function readRatios(list) {
  if (!Array.isArray(list) || !list.length || list.length > 12) throw new Error("A ratios item needs between 1 and 12 ratios.");
  return list.map((raw) => {
    let value = raw;
    if (Array.isArray(raw)) value = raw[0] / raw[1];
    else if (typeof raw === "string" && raw.includes("/")) value = Number(raw.split("/")[0]) / Number(raw.split("/")[1]);
    value = Number(value);
    if (!(value > 0 && value < 64)) throw new Error("A ratio is out of range.");
    return value;
  });
}

// Turns a manifest into what the rest of the page uses. `positions` is one
// entry per kind of item a place gets; a plain codebook has a single
// position that is read as many times as its address asks for.
async function read(manifest, url) {
  const renderer = manifest.renderer;
  if (!RENDERERS.includes(renderer)) throw new Error(`It asks for a renderer this page doesn’t have (“${clip(renderer, 30)}”).`);
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(manifest.id || "")) throw new Error("It has no usable id.");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || "")) throw new Error("It has no version number.");

  const address = manifest.address || {};
  const positions = [];
  if (renderer === "guitar") {
    // The what3chords table is too big to write out item by item.
    await loadChords(absolute(manifest.items.table, url));
    positions.push({ title: "", count: chordCount(), at: (i) => ({ ...chordAt(i), renderer }) });
  } else if (Array.isArray(manifest.parts)) {
    if (manifest.parts.length < 2 || manifest.parts.length > MAX_PARTS) throw new Error("It has too many or too few parts.");
    for (const part of manifest.parts) {
      const kind = part.renderer || renderer;
      if (!RENDERERS.includes(kind) || kind === "guitar") throw new Error("One of its parts asks for a renderer this page doesn’t have.");
      const items = readItems(part.items, kind, url);
      for (const item of items) {
        item.sound = clip(part.sound || manifest.sound || "", 20);
        item.partTitle = clip(part.title, 40);
      }
      positions.push({ title: clip(part.title, 40), count: items.length, at: (i) => items[i] });
    }
  } else {
    const items = readItems(manifest.items, renderer, url);
    for (const item of items) item.sound = clip(manifest.sound || "", 20);
    positions.push({ title: "", count: items.length, at: (i) => items[i] });
  }

  const local = manifest.localContexts || null;
  return {
    url,
    id: manifest.id,
    version: manifest.version,
    title: clip(manifest.title, 80) || manifest.id,
    contributors: (manifest.contributors || []).slice(0, 20).map((person) => ({ name: clip(person.name, 80), role: clip(person.role, 80) })),
    community: clip(manifest.community, 120),
    statement: clip(manifest.statement, 2000),
    demo: Boolean(manifest.demo),
    terms: {
      download: !(manifest.terms && manifest.terms.download === false),
      commercial: !(manifest.terms && manifest.terms.commercial === false),
      months: manifest.terms && Array.isArray(manifest.terms.months)
        ? manifest.terms.months.map(Number).filter((month) => month >= 1 && month <= 12) : null,
      note: clip(manifest.terms && manifest.terms.note, 300),
    },
    localContexts: local && /^[0-9a-f-]{36}$/i.test(local.projectId || "") ? {
      projectId: local.projectId.toLowerCase(),
      asOf: clip(local.asOf, 20),
      labels: (local.labels || []).slice(0, 20).map((label) => (
        typeof label === "string" ? { name: clip(label, 80), text: "" } : { name: clip(label.name, 80), text: clip(label.text, 1000), community: clip(label.community, 120) }
      )),
    } : null,
    renderer,
    positions,
    parts: Array.isArray(manifest.parts) && renderer !== "guitar",
    // Parts can be heard one after another, or all at once.
    together: Boolean(address.together) && Array.isArray(manifest.parts),
    address: {
      items: Number.isInteger(address.items) ? Math.max(1, Math.min(MAX_ITEMS_PER_PLACE, address.items)) : null,
      resolution: address.resolution ?? null,
      scramble: address.scramble !== false,
      spread: address.spread ?? "fill",
    },
    // Renderer settings, all optional.
    tuning: { base: Number(manifest.tuning && manifest.tuning.base) || 220, voice: clip(manifest.tuning && manifest.tuning.voice, 20) },
    beats: Number(manifest.beats) > 0 ? Math.min(32, Number(manifest.beats)) : null,
    fits: new Map(),
  };
}

// Fetches and checks a codebook. Throws an Error whose message can be shown
// to a listener.
export async function loadCodebook(manifestUrl) {
  const url = absolute(manifestUrl, location.href);
  await loadIndex().catch(() => null);
  const manifest = await fetchJSON(url);
  const codebook = await read(manifest, url);
  const withdrawn = revocation(codebook.id, codebook.version);
  if (withdrawn) {
    throw new Error(`This codebook has been withdrawn by its contributors and is no longer offered here.${withdrawn.reason ? ` ${withdrawn.reason}` : ""}`);
  }
  if (codebook.terms.months && !codebook.terms.months.includes(new Date().getMonth() + 1)) {
    throw new Error(`Its contributors make this codebook available only at certain times of year, and this isn’t one of them.${codebook.terms.note ? ` ${codebook.terms.note}` : ""}`);
  }
  return codebook;
}

// ---------------------------------------------------------------------------
// Fitting a codebook to a grid, and reading an address through it
// ---------------------------------------------------------------------------

// Nearest resolution on `grid` to an H3 resolution, by cell area.
function matchingResolution(grid, h3Res) {
  if (grid.id === "h3") return h3Res;
  const target = Math.log(h3.getHexagonAreaAvg(Math.max(0, Math.min(15, h3Res)), "m2"));
  let best = grid.minRes;
  for (let res = grid.minRes; res <= grid.maxRes; res++) {
    if (Math.abs(Math.log(grid.areaM2(res)) - target) < Math.abs(Math.log(grid.areaM2(best)) - target)) best = res;
  }
  return best;
}

// How this codebook reads this grid:
//   res      the cell size its addresses use
//   radices  how many items there are to choose from at each position
//   spread   what the address is multiplied by so that it ranges over the
//            whole vocabulary rather than only the start of it
//   exact    false if the vocabulary is too small to tell every cell apart
//            even at the grid's coarsest level
// Two ways to fit, as the manifest declares. Fix the number of items a place
// gets, and the vocabulary's size sets how fine a place can be. Or fix the
// resolution, and its size sets how many items a place gets.
export function fit(codebook, grid) {
  if (codebook.fits.has(grid.id)) return codebook.fits.get(grid.id);
  const clamp = (res) => Math.max(grid.minRes, Math.min(grid.maxRes, res));
  const { address, positions } = codebook;
  let res;
  let radices;
  if (codebook.parts || address.resolution == null) {
    const count = codebook.parts ? positions.length : address.items || 3;
    radices = codebook.parts ? positions.map((position) => BigInt(position.count)) : new Array(count).fill(BigInt(positions[0].count));
    const capacity = radices.reduce((product, radix) => product * radix, 1n);
    res = grid.maxRes;
    while (res > grid.minRes && grid.bound(res) > capacity) res--;
  } else {
    const wanted = typeof address.resolution === "object" ? address.resolution[grid.id] : matchingResolution(grid, Number(address.resolution));
    res = clamp(Number.isInteger(wanted) ? wanted : grid.maxRes);
    const size = BigInt(positions[0].count);
    radices = [size];
    while (radices.reduce((product, radix) => product * radix, 1n) < grid.bound(res) && radices.length < MAX_ITEMS_PER_PLACE) radices.push(size);
  }
  const capacity = radices.reduce((product, radix) => product * radix, 1n);
  const exact = grid.bound(res) <= capacity;
  let spread = 1n;
  const declared = typeof address.spread === "object" ? address.spread[grid.id] : address.spread;
  if (Number.isInteger(declared) && declared > 0) spread = BigInt(declared);
  else if (exact) spread = capacity / grid.bound(res);
  if (spread < 1n || grid.bound(res) * spread > capacity) spread = 1n;
  const result = { res, radices, spread, capacity, exact, items: radices.length, areaM2: grid.areaM2(res) };
  codebook.fits.set(grid.id, result);
  return result;
}

// The place's address number on this grid, at the size this codebook reads.
export function addressAt(codebook, grid, lat, lng) {
  const { res } = fit(codebook, grid);
  return grid.addressNumber(lat, lng, res, codebook.address.scramble);
}

// The items a place gets: its address, written out with one digit per
// position (each position in its own base), each digit picking an item.
export function soundsAt(codebook, grid, lat, lng) {
  const { radices, spread, capacity } = fit(codebook, grid);
  let n = (addressAt(codebook, grid, lat, lng) * spread) % capacity;
  const digits = new Array(radices.length);
  for (let i = radices.length - 1; i >= 0; i--) {
    digits[i] = Number(n % radices[i]);
    n /= radices[i];
  }
  return digits.map((digit, i) => {
    const position = codebook.positions[codebook.parts ? i : 0];
    return { ...position.at(digit), part: codebook.parts ? i : 0 };
  });
}

// ---------------------------------------------------------------------------
// Local Contexts labels
// ---------------------------------------------------------------------------

// Resolves to { live, asOf, page, labels: [{ name, text, community }] }, or
// null for a codebook that names no Local Contexts project.
//
// The Hub is asked first, so a community's changes show as soon as they are
// made. At the time of writing the Hub does not let web pages read it, so
// this falls back to the copy in the manifest and says that it is a copy.
export async function loadLabels(codebook) {
  const local = codebook.localContexts;
  if (!local) return null;
  const page = `${HUB}/projects/${local.projectId}`;
  try {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), LABEL_TIMEOUT_MS);
    const response = await fetch(`${HUB}/api/v1/projects/${local.projectId}/`, { signal: stop.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(String(response.status));
    const project = await response.json();
    const labels = [...(project.tk_labels || []), ...(project.bc_labels || []), ...(project.notice || [])].map((label) => ({
      name: clip(label.name, 80),
      text: clip(label.label_text || label.default_text, 1000),
      community: clip(label.community && label.community.name, 120),
    }));
    return { live: true, asOf: "", page, labels };
  } catch (error) {
    return { live: false, asOf: local.asOf, page, labels: local.labels };
  }
}

// What the page should and shouldn't do with this codebook, going by its
// terms and its labels. None of this is a lock (anyone can read a web
// page's files); it is the page behaving as it was asked to.
export function conduct(codebook, labels) {
  const names = (labels ? labels.labels : codebook.localContexts ? codebook.localContexts.labels : []).map((label) => label.name);
  const has = (pattern) => names.some((name) => pattern.test(name));
  return {
    download: codebook.terms.download && !has(/non-?\s?commercial/i),
    listed: !has(/community use only/i),
  };
}

// "Ana Example and Bo Sample", for "heard through …'s vocabulary".
export function credit(codebook) {
  const names = codebook.contributors.map((person) => person.name).filter(Boolean);
  if (codebook.community) return codebook.community;
  if (!names.length) return "an unnamed contributor";
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
