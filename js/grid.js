// The address layer. A grid divides the globe into cells at a range of
// sizes, and turns any one cell into a number. That number is the place's
// address; it means nothing until a codebook (see codebooks.js) reads it.
//
//   h3 - Uber's hexagons, the grid the original what3chords used.
//   a5 - Felix Palmer's equal-area pentagons.
//
// Points are [lat, lng]; cell outlines are GeoJSON-style [lng, lat] rings.
// Address numbers are BigInts: a small vocabulary read at a fine resolution
// needs more digits than a Number can hold exactly.

// Where digit i of `count` goes when the digits are dealt out coarse,
// middling, fine, coarse, middling, fine... so that neighbouring cells don't
// share most of their sound. For 15 digits this is the original what3chords
// permutation (SEVENS_FWD). A count that doesn't divide by three leaves its
// last one or two digits where they are.
function dealt(count) {
  const each = Math.floor(count / 3);
  const positions = [];
  for (let i = 0; i < count; i++) {
    positions.push(i < each * 3 ? (i % 3) * each + Math.floor(i / 3) : i);
  }
  return positions;
}

function arrange(digits, scramble) {
  if (!scramble) return digits;
  const positions = dealt(digits.length);
  const arranged = new Array(digits.length);
  digits.forEach((digit, i) => { arranged[positions[i]] = digit; });
  return arranged;
}

// Within a few metres of a pole the A5 library's answer depends on what it
// was last asked, so the same point could get different sounds. Stopping
// just short keeps it repeatable.
const A5_MAX_LAT = 89.9999;
const nearPole = (lat) => Math.max(-A5_MAX_LAT, Math.min(A5_MAX_LAT, lat));

const h3Grid = {
  id: "h3",
  name: "Hexagons (H3)",
  cell: "hexagon",
  cells: "hexagons",
  walk: "Hex walk",
  // The coarsest and finest cells an address may use. Resolution 15 is the
  // original's, a little under a square metre.
  minRes: 0,
  maxRes: 15,
  // Cell sizes for a live session: on foot, on a bike, driving in town, driving.
  liveRes: [11, 10, 9, 8],
  explain: "Uber’s H3 hexagons, the grid the original what3chords addressed the world with.",

  cellAt: (lat, lng, res) => h3.latLngToCell(lat, lng, res),
  centre: (cell) => h3.cellToLatLng(cell),
  boundary: (cell) => h3.cellToBoundary(cell, true),
  neighbours: (cell) => h3.gridDisk(cell, 1).filter((other) => other !== cell),
  // Centre-to-centre distance between neighbouring cells.
  spacingKm: (res) => Math.sqrt(3) * h3.getHexagonEdgeLengthAvg(res, "km"),
  // How finely to sample a road when collecting the cells it passes through.
  stepKm: (res) => h3.getHexagonEdgeLengthAvg(res, "km") / 3,
  areaM2: (res) => h3.getHexagonAreaAvg(res, "m2"),
  // Used only if a greedy walk gets stuck, which can happen where the grid
  // is distorted around one of its twelve pentagons.
  lineTo(from, to) {
    try {
      return h3.gridPathCells(from, to).slice(1);
    } catch (error) {
      return [to];
    }
  },

  // Every address at this resolution is below this.
  bound: (res) => 122n * 7n ** BigInt(res),
  // One of 122 base cells, then one base-7 digit per level.
  addressNumber(lat, lng, res, scramble = true) {
    const bits = BigInt("0x" + h3.latLngToCell(lat, lng, res));
    const digits = [];
    for (let level = 0; level < res; level++) digits.push((bits >> BigInt(3 * (14 - level))) & 7n);
    let n = (bits >> 45n) & 0x7fn;
    for (const digit of arrange(digits, scramble)) n = n * 7n + digit;
    return n;
  },
};

const a5Grid = {
  id: "a5",
  name: "Pentagons (A5)",
  cell: "pentagon",
  cells: "pentagons",
  walk: "Pentagon walk",
  // A5's two coarsest levels are numbered differently from the rest, and
  // its level 23 (about half a square metre) is the nearest to the
  // original's finest.
  minRes: 2,
  maxRes: 23,
  liveRes: [17, 15, 14, 13],
  explain: "The A5 grid of equal-area pentagons. The same place has a different address here, so every vocabulary sounds different on it.",

  cellAt: (lat, lng, res) => A5.lonLatToCell([lng, nearPole(lat)], res),
  centre(cell) {
    const [lng, lat] = A5.cellToLonLat(cell);
    return [lat, lng];
  },
  boundary: (cell) => A5.cellToBoundary(cell, { closedRing: true }),
  neighbours: (cell) => [...A5.uncompact(A5.gridDisk(cell, 1), A5.getResolution(cell))].filter((other) => other !== cell),
  spacingKm: (res) => Math.sqrt(A5.cellArea(res)) / 1000,
  stepKm: (res) => Math.sqrt(A5.cellArea(res)) / 5000,
  areaM2: (res) => A5.cellArea(res),
  lineTo: (from, to) => [to],

  bound: (res) => 60n * 4n ** BigInt(res - 1),
  // An A5 cell ID is: which of 60 fifths-of-a-face the cell is in, then two
  // bits per level for its place along a space-filling curve, then a single
  // 1 bit marking where the ID ends.
  addressNumber(lat, lng, res, scramble = true) {
    const id = A5.lonLatToCell([lng, nearPole(lat)], res);
    const marker = id & -id;
    const payload = id / (marker << 1n);
    const count = res - 1;
    const digits = [];
    for (let i = 0; i < count; i++) digits.push((payload >> BigInt(2 * (count - 1 - i))) & 3n);
    let n = payload >> BigInt(2 * count);
    for (const digit of arrange(digits, scramble)) n = n * 4n + digit;
    return n;
  },
};

export const GRIDS = { h3: h3Grid, a5: a5Grid };

// "about 0.9 m²", "about 2,150 m²", "about 10.5 ha", "about 36 km²"
export function formatArea(m2) {
  if (m2 < 10) return `about ${m2.toFixed(1)} m²`;
  if (m2 < 10000) return `about ${Math.round(m2).toLocaleString()} m²`;
  if (m2 < 1e6) return `about ${(m2 / 1e4).toFixed(m2 < 1e5 ? 1 : 0)} ha`;
  return `about ${Math.round(m2 / 1e6).toLocaleString()} km²`;
}
