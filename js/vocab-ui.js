// The parts of the interface both pages share: choosing a codebook, saying
// whose it is and on what terms, and drawing one of its items.

import { loadIndex, offered, loadCodebook, loadLabels, conduct, credit, fit } from "./codebooks.js";
import { chordDiagram } from "./diagram.js";
import { formatArea } from "./grid.js";

const $ = (id) => document.getElementById(id);
const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// One item as a small card: its name, and a picture where there is one to
// draw (a chord box for the guitar, the strokes of a rhythm).
export function itemCard(item, className = "") {
  const name = item.renderer === "rhythm" && item.partTitle ? item.partTitle : item.name;
  // Names run from "C" to "A#maj7sus4#5/F#"; shrink the long ones to fit.
  const size = name.length > 13 ? "longest" : name.length > 10 ? "long" : "";
  let picture = "";
  if (item.renderer === "guitar") {
    picture = chordDiagram(item);
  } else if (item.renderer === "rhythm") {
    picture = `<span class="item-pattern" role="img" aria-label="${escapeHTML(item.pattern)}">${
      [...item.pattern].map((mark) => `<i class="${mark === "x" || mark === "X" ? "hit" : ""}"></i>`).join("")}</span>`;
  }
  return `<div class="chord-card ${item.renderer} ${className}"><span class="name ${size}">${escapeHTML(name)}</span>${picture}</div>`;
}

// What an item is called in a list (the chord chart, a link's text).
export function itemName(item) {
  return item.renderer === "rhythm" ? item.pattern.replace(/[.\-]/g, "·") : item.name;
}

// Owns the codebook menu, the open-by-address form and the "about this
// vocabulary" panel. `onChange(codebook)` is called whenever a codebook has
// been loaded and is ready to be listened through.
export class Vocabulary {
  constructor({ onChange, grid }) {
    this.onChange = onChange;
    this.grid = grid; // () => the grid in use
    this.codebook = null;
    this.labels = null;
    this.listed = [];
    this.unlisted = false; // the codebook in use was opened by address
    this.wanted = null; // the version a link asked for, if it named one
    this.loading = 0;

    $("codebook").addEventListener("change", () => {
      const entry = this.listed.find((item) => item.id === $("codebook").value);
      if (entry) this.open(entry.manifest, false);
    });
    $("codebook-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const address = $("codebook-url").value.trim();
      if (address) this.open(address, true);
    });
  }

  // What the page should and shouldn't do with the codebook in use.
  get conduct() {
    return this.codebook ? conduct(this.codebook, this.labels) : { download: true, listed: true };
  }

  status(text, isError = false) {
    $("codebook-status").textContent = text;
    $("codebook-status").classList.toggle("error", isError);
  }

  // Starts with the codebook a link names ({ id, version, url }), or the
  // first one on the list. A link's codebook that can't be had falls back
  // to the first on the list, and says why.
  async start(ref) {
    await loadIndex();
    // Withdrawn and out-of-season codebooks are left off the menu. (One
    // whose labels keep it to its community shouldn't be on the list at
    // all; if one is, it comes off the menu as soon as that is known.)
    this.listed = offered();
    this.fillMenu();
    const named = ref && this.listed.find((entry) => entry.id === ref.id);
    this.wanted = ref && ref.version ? ref : null;
    const first = this.listed[0];
    if (ref && ref.url && !named) {
      if (await this.open(ref.url, true)) return;
    } else if (named) {
      if (await this.open(named.manifest, false)) return;
    } else if (ref && ref.id) {
      this.status(`The link asked for a codebook this page doesn’t know (“${ref.id}”), so this is ${first.title} instead.`, true);
      this.wanted = null;
      await this.open(first.manifest, false, true);
      return;
    }
    const why = $("codebook-status").textContent;
    this.wanted = null;
    await this.open(first.manifest, false, true);
    if (why && ref) this.status(`${why} This is ${first.title} instead.`, true);
  }

  fillMenu() {
    const options = this.listed.map((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.title;
      return option;
    });
    if (this.unlisted && this.codebook) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = `${this.codebook.title} (opened by address)`;
      options.push(option);
    }
    $("codebook").replaceChildren(...options);
    $("codebook").value = this.unlisted ? "" : this.codebook ? this.codebook.id : this.listed[0].id;
  }

  // Resolves to true if the codebook was loaded.
  async open(url, byAddress, quiet = false) {
    const attempt = ++this.loading;
    if (!quiet) this.status("Fetching the codebook…");
    let codebook;
    let labels = null;
    try {
      codebook = await loadCodebook(url);
      labels = await loadLabels(codebook);
    } catch (error) {
      if (attempt !== this.loading) return false;
      this.status(`That codebook can’t be used. ${error.message}`, true);
      this.fillMenu();
      return false;
    }
    if (attempt !== this.loading) return false;
    // Switch over, and switch back if anything that depends on the codebook
    // can't cope with it, so the page is never left between two.
    const before = { codebook: this.codebook, labels: this.labels, unlisted: this.unlisted, listed: this.listed };
    this.codebook = codebook;
    this.labels = labels;
    // A codebook on the list that turns out to be for its community only is
    // treated as if it had been opened by address: usable, not advertised.
    if (!conduct(codebook, labels).listed) this.listed = this.listed.filter((entry) => entry.id !== codebook.id);
    this.unlisted = !this.listed.some((entry) => entry.manifest === codebook.url);
    try {
      this.render();
      this.onChange(codebook);
    } catch (error) {
      console.warn(error);
      Object.assign(this, before);
      this.status("That codebook can’t be used. This page couldn’t make sense of it.", true);
      this.fillMenu();
      if (before.codebook) {
        this.render();
        this.onChange(before.codebook);
      }
      return false;
    }
    if (!quiet) this.status("");
    this.fillMenu();
    return true;
  }

  // The "about this vocabulary" panel. Called again when the grid changes,
  // since a codebook reads each grid differently.
  render() {
    const codebook = this.codebook;
    if (!codebook) return;
    const grid = this.grid();
    const reading = fit(codebook, grid);
    const parts = [];
    // Anyone can write any names into a manifest; say when nobody has checked.
    parts.push(`<p class="heard">Heard through the vocabulary of <strong>${escapeHTML(credit(codebook))}</strong>${
      this.unlisted ? ' <span class="badge warn">unverified</span>' : ""}${
      codebook.demo ? ' <span class="badge">demonstration</span>' : ""}</p>`);
    if (codebook.statement) parts.push(`<p class="statement">${escapeHTML(codebook.statement)}</p>`);

    const facts = [];
    const people = codebook.contributors.filter((person) => person.name);
    if (people.length) {
      facts.push(["By", people.map((person) => escapeHTML(person.name) + (person.role ? ` <span class="role">(${escapeHTML(person.role)})</span>` : "")).join(", ")]);
    }
    if (codebook.community) facts.push(["Community", escapeHTML(codebook.community)]);
    const count = codebook.positions.reduce((sum, position) => sum + position.count, 0).toLocaleString();
    facts.push(["Vocabulary", `${count} ${codebook.parts ? `items in ${codebook.positions.length} parts` : "items"}, version ${escapeHTML(codebook.version)}`]);
    let reads = `${reading.items} to a place${codebook.together ? ", heard together" : ""}. A place is one ${grid.cell} of ${formatArea(reading.areaM2)}.`;
    if (!reading.exact) reads += " The vocabulary is too small to tell every such place apart, so some share a sound.";
    facts.push(["On this grid", reads]);
    const terms = [codebook.terms.download ? "may be downloaded" : "not for download", codebook.terms.commercial ? "" : "not for commercial use"].filter(Boolean).join("; ");
    facts.push(["Terms", escapeHTML(terms + (codebook.terms.note ? `. ${codebook.terms.note}` : ""))]);
    parts.push(`<dl class="facts">${facts.map(([term, text]) => `<dt>${term}</dt><dd>${text}</dd>`).join("")}</dl>`);

    if (this.labels) {
      const { live, asOf, page, labels } = this.labels;
      const list = labels.map((label) => `<li><strong>${escapeHTML(label.name)}</strong>${
        label.community ? ` <span class="role">(${escapeHTML(label.community)})</span>` : ""}${
        label.text ? `<br>${escapeHTML(label.text)}` : ""}</li>`).join("");
      const source = live
        ? "Read just now from the Local Contexts Hub."
        : `These are a copy carried in the codebook${asOf ? `, as they stood on ${escapeHTML(asOf)}` : ""}; the Hub doesn’t let this page read them directly.`;
      parts.push(`<div class="labels"><p class="labels-title">Local Contexts labels</p>${
        list ? `<ul>${list}</ul>` : "<p>None listed.</p>"}<p class="fine">${source} <a href="${escapeHTML(page)}" target="_blank" rel="noopener">See them as they stand now</a>.</p></div>`);
    }
    if (this.wanted && this.wanted.id === codebook.id && this.wanted.version !== codebook.version) {
      parts.push(`<p class="notice">This link was made with version ${escapeHTML(this.wanted.version)} of this codebook. It is now version ${escapeHTML(codebook.version)}, a different reading, so places will not sound as they did.</p>`);
    }
    if (this.unlisted) {
      parts.push('<p class="notice">Opened by its address. It isn’t on this page’s list, so nobody here has checked who made it: the names above are only what the codebook says about itself.</p>');
    }
    $("codebook-about").innerHTML = parts.join("");
  }
}
