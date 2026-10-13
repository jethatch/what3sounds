// Starting the map, and carrying on without it in a browser that can't
// draw one. The map needs WebGL, which a browser may have switched off or
// may refuse to use with the machine's graphics driver. Places, sounds,
// trips, sharing and downloads don't need the map.

// Stands in for the map, and for the pins and popups that go on it: any
// property of it is itself, any call returns itself, and read as a number
// it is 0. So `map.flyTo(...)` and
// `new parts.Marker(...).setLngLat(...).addTo(map)` simply do nothing.
function nothing() {
  const self = new Proxy(function () {}, {
    get: (target, key) => (key === Symbol.toPrimitive ? () => 0 : key === "then" ? undefined : self),
    set: () => true,
    apply: () => self,
    construct: () => self,
  });
  return self;
}

// Returns { map, parts, drawn }. `parts` is where pins and popups come from (the map library, or nothing). Without a
// map the page is marked "no-map" and its explanation is shown.
export function startMap(options) {
  try {
    // ?nomap shows the page as it is for a browser that can't draw the map.
    if (new URLSearchParams(location.search).has("nomap")) throw new Error("Map switched off by ?nomap");
    return { map: new maplibregl.Map(options), parts: maplibregl, drawn: true };
  } catch (error) {
    console.warn("No map:", error.message);
    document.getElementById(options.container).replaceChildren();
    document.body.classList.add("no-map");
    document.getElementById("map-missing").hidden = false;
    const none = nothing();
    return { map: none, parts: none, drawn: false };
  }
}
