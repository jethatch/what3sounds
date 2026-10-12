// The Places page: one place, its address, and what that address sounds
// like through whichever vocabulary is chosen. The plainest statement of the
// idea; journeys.html does the rest.

import { GRIDS, formatArea } from "./grid.js";
import { fit, addressAt, soundsAt } from "./codebooks.js";
import { Vocabulary, itemCard } from "./vocab-ui.js";
import { geocode, formatLatLng } from "./geocode.js";
import { Band } from "./band.js";
import { Voice } from "./voices.js";
import { Player } from "./audio.js";

const BASEMAPS = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};
const CELL_COLOURS = { dark: "#ffe14d", light: "#17160f" };

const $ = (id) => document.getElementById(id);

const state = {
  grid: "h3",
  at: null, // { lat, lng, label }
  items: null,
  heard: false, // whether this visitor has started any sound yet
};

const band = new Band();
const player = new Player(band);
let voice = null;
let map;
let marker = null;
let theme = document.documentElement.dataset.theme;
let searching = null;

const grid = () => GRIDS[state.grid];
const vocabulary = new Vocabulary({ onChange: onCodebook, grid });

let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 7000);
}

// ---------------------------------------------------------------------------
// The link
// ---------------------------------------------------------------------------

function writeHash() {
  const params = new URLSearchParams();
  if (state.at) {
    params.set("at", `${state.at.lat.toFixed(5)},${state.at.lng.toFixed(5)}`);
    if (state.at.label) params.set("n", state.at.label);
  }
  if (state.grid !== "h3") params.set("gr", state.grid);
  const codebook = vocabulary.codebook;
  if (codebook) {
    params.set("cb", `${codebook.id}@${codebook.version}`);
    if (vocabulary.unlisted) params.set("cbu", codebook.url);
  }
  try {
    history.replaceState(null, "", `${location.pathname}${location.search}#${params}`);
  } catch (error) {
    // The link just goes stale.
  }
  // The Journeys page should open with the same grid and vocabulary.
  const carry = new URLSearchParams();
  for (const key of ["gr", "cb", "cbu"]) if (params.has(key)) carry.set(key, params.get(key));
  document.querySelector('.pages a[href^="./journeys"]').href = `./journeys.html#${carry}`;
}

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const at = (params.get("at") || "").match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (at && Math.abs(Number(at[1])) <= 90 && Math.abs(Number(at[2])) <= 180) {
    state.at = { lat: Number(at[1]), lng: Number(at[2]), label: (params.get("n") || "").slice(0, 120) };
  }
  if (Object.prototype.hasOwnProperty.call(GRIDS, params.get("gr") || "")) state.grid = params.get("gr");
  const named = (params.get("cb") || "").match(/^([a-z0-9][a-z0-9-]{0,59})(?:@(\d+\.\d+\.\d+))?$/);
  const address = params.get("cbu");
  if (!named && !address) return null;
  return { id: named ? named[1] : null, version: named ? named[2] : null, url: address && /^https?:\/\//.test(address) ? address.slice(0, 500) : null };
}

// ---------------------------------------------------------------------------
// The place
// ---------------------------------------------------------------------------

function addRouteLayers() {
  if (map.getSource("cell")) return;
  // Above the basemap's roads and buildings, below its labels.
  const layers = map.getStyle().layers;
  let top = layers.length - 1;
  while (top >= 0 && layers[top].type === "symbol") top--;
  const before = layers[top + 1] ? layers[top + 1].id : undefined;
  map.addSource("cell", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "cell-fill", type: "fill", source: "cell", paint: { "fill-color": "#ffd60a", "fill-opacity": 0.45 } }, before);
  map.addLayer({ id: "cell-line", type: "line", source: "cell", paint: { "line-color": CELL_COLOURS[theme], "line-width": 2 } }, before);
  drawCell();
}

// The cell this vocabulary reads the place as: everywhere inside it has the
// same address, and so the same sound.
function drawCell() {
  if (!map.getSource("cell")) return;
  const codebook = vocabulary.codebook;
  let data = { type: "FeatureCollection", features: [] };
  if (state.at && codebook) {
    const cell = grid().cellAt(state.at.lat, state.at.lng, fit(codebook, grid()).res);
    const ring = grid().boundary(cell).map(([lng, lat]) => {
      // Keep the outline on the same copy of the world as the pin.
      const shifted = lng + Math.round((state.at.lng - lng) / 360) * 360;
      return [shifted, Math.max(-85.05, Math.min(85.05, lat))];
    });
    data = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
  }
  map.getSource("cell").setData(data);
}

// Repaints everything that depends on the place, the grid or the codebook.
function renderPlace() {
  const codebook = vocabulary.codebook;
  $("grid-explain").textContent = grid().explain;
  drawCell();
  if (!state.at || !codebook) {
    state.items = null;
    $("address").hidden = true;
    $("now").replaceChildren();
    $("heard-hint").hidden = false;
    $("hear").disabled = true;
    $("share").disabled = true;
    return;
  }
  const reading = fit(codebook, grid());
  state.items = soundsAt(codebook, grid(), state.at.lat, state.at.lng);
  $("address").hidden = false;
  $("address-number").textContent = addressAt(codebook, grid(), state.at.lat, state.at.lng).toLocaleString("en");
  $("address-note").textContent = `${state.at.label || formatLatLng(state.at.lat, state.at.lng)}. One ${grid().cell} of ${formatArea(reading.areaM2)}, the size this vocabulary reads. The number is the place’s; everything below is the vocabulary’s.`;
  $("now").innerHTML = state.items.map((item) => itemCard(item)).join("");
  $("heard-hint").hidden = true;
  $("hear").disabled = false;
  $("share").disabled = false;
  if (voice) voice.prepare(state.items).catch(() => toast("Some of this vocabulary’s recordings didn’t load."));
}

function setPlace(lat, lng, label, { move = false, play = true } = {}) {
  state.at = { lat, lng, label: label || "" };
  $("place-input").value = label || formatLatLng(lat, lng);
  $("place-status").textContent = "";
  if (!marker) {
    const pin = document.createElement("div");
    pin.className = "marker-pin a";
    pin.innerHTML = '<svg viewBox="0 0 30 38" aria-hidden="true"><path d="M15 37C8 27 2 21 2 14a13 13 0 0 1 26 0c0 7-6 13-13 23z" stroke="#0d0d0f" stroke-width="1.5"/></svg>';
    marker = new maplibregl.Marker({ element: pin, anchor: "bottom" });
  }
  marker.setLngLat([lng, Math.max(-85, Math.min(85, lat))]).addTo(map);
  if (move) map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11), duration: 900 });
  renderPlace();
  writeHash();
  if (play) hear();
}

async function findPlace() {
  const text = $("place-input").value.trim();
  if (!text) return;
  if (searching) searching.abort();
  const mine = new AbortController();
  searching = mine;
  $("place-status").textContent = "Searching…";
  $("place-status").classList.remove("error");
  try {
    const results = await geocode(text, mine.signal);
    if (mine.signal.aborted) return;
    if (!results.length) {
      $("place-status").textContent = `No match for “${text}”. Try adding a city or country, or click the map.`;
      $("place-status").classList.add("error");
      return;
    }
    setPlace(results[0].lat, results[0].lng, results[0].label, { move: true, play: state.heard });
  } catch (error) {
    if (mine.signal.aborted) return;
    $("place-status").textContent = error.message;
    $("place-status").classList.add("error");
  }
}

// ---------------------------------------------------------------------------
// The sound
// ---------------------------------------------------------------------------

function onCodebook(codebook) {
  player.stop();
  if (voice) voice.dispose();
  voice = null;
  if (codebook.renderer === "guitar") {
    band.setGuitar("electric").catch(() => toast("The guitar didn’t load. Check your connection and try again."));
  } else {
    voice = new Voice(codebook);
  }
  player.voice = voice;
  player.beats = codebook.beats;
  renderPlace();
  writeHash();
  // The point of the page: the same address, heard differently.
  if (state.heard && state.items) hear();
}

async function hear() {
  if (!state.items) return;
  const items = state.items;
  const together = vocabulary.codebook.together;
  state.heard = true;
  $("hear").classList.add("busy");
  try {
    if (voice) await voice.prepare(items);
    await player.play({
      bars: together ? 2 : items.length,
      barAt: (bar) => (together ? { items, which: -1 } : { items: [items[bar]], which: bar }),
      ending: together ? null : [items[0]],
    });
  } catch (error) {
    toast(error.message || "The sound couldn’t start in this browser.");
  } finally {
    $("hear").classList.remove("busy");
  }
}

function frame() {
  requestAnimationFrame(frame);
  const cards = $("now").children;
  const position = player.state === "playing" ? player.position() : null;
  const which = position ? (position.ending ? 0 : position.info.which) : null;
  for (let i = 0; i < cards.length; i++) cards[i].classList.toggle("on", which !== null && (which === -1 || which === i));
}

async function share() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast("Link copied. It opens this place, on this grid, through this vocabulary.");
  } catch (error) {
    toast("Copy the address from your browser’s address bar; it already describes this place and vocabulary.");
  }
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

function setTheme(next) {
  theme = next;
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("w3s-theme", next); } catch (error) { /* private mode */ }
  map.setStyle(BASEMAPS[next]);
}

async function main() {
  const missing = ["maplibregl", "h3", "A5", "Tone"].filter((name) => !(name in window));
  if (missing.length) throw new Error("Some of the page’s libraries didn’t load. Check your connection and reload.");
  const ref = readHash();
  document.querySelector(`input[name="grid"][value="${state.grid}"]`).checked = true;

  map = new maplibregl.Map({
    container: "map",
    style: BASEMAPS[theme],
    center: state.at ? [state.at.lng, state.at.lat] : [-40, 30],
    zoom: state.at ? 11 : 1.6,
    maxZoom: 22,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.touchZoomRotate.disableRotation();
  map.dragRotate.disable();
  map.on("style.load", addRouteLayers);
  map.on("click", (event) => {
    const lng = ((((event.lngLat.lng + 180) % 360) + 360) % 360) - 180;
    setPlace(event.lngLat.lat, lng, "");
  });

  $("place-form").addEventListener("submit", (event) => {
    event.preventDefault();
    findPlace();
  });
  for (const input of document.querySelectorAll('input[name="grid"]')) {
    input.addEventListener("change", () => {
      state.grid = document.querySelector('input[name="grid"]:checked').value;
      vocabulary.render();
      renderPlace();
      writeHash();
      if (state.heard && state.items) hear();
    });
  }
  $("hear").addEventListener("click", hear);
  $("share").addEventListener("click", share);
  $("theme-toggle").addEventListener("click", () => setTheme(theme === "dark" ? "light" : "dark"));
  $("what-open").addEventListener("click", () => $("what").showModal());
  $("what").addEventListener("click", (event) => {
    if (event.target !== $("what")) return;
    const box = $("what").getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) $("what").close();
  });
  window.addEventListener("hashchange", () => location.reload());

  await vocabulary.start(ref);
  if (state.at) setPlace(state.at.lat, state.at.lng, state.at.label, { play: false });
  else renderPlace();
  writeHash();
  requestAnimationFrame(frame);
  $("loading").classList.add("done");
  try { sessionStorage.removeItem("w3s-refreshed"); } catch (error) { /* private mode */ }
}

main().catch((error) => {
  console.error(error);
  $("loading").classList.add("failed");
  $("loading-text").textContent = error.message || "Something went wrong while loading.";
});
