(() => {
  function showStatusError(msg) {
    const statusEl = document.getElementById("feedStatusText");
    if (statusEl) statusEl.textContent = msg;
  }

  function on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  if (!window.TumkurData || !window.TumkurFeatures) {
    showStatusError("Missing routes.js or features.js.");
    return;
  }

  const {
    TUMKUR_CENTER,
    LANDMARKS,
    ROUTES,
    STOPS,
    haversineMeters,
    bearingDegrees,
    setRouteStopMode,
    snapRoutesToRealRoads,
    createInitialFleet,
    repositionFleetOnRoutes,
    spawnLiveBus,
    stepFleet
  } = window.TumkurData;

  const {
    getScheduleInfo,
    getTrafficState,
    buildBottleneckGeoJSON,
    planPointToPointTrip,
    loadSavedCommutes,
    saveCommutesList,
    applySavedStopOverrides,
    recordMovedStop,
    recordAddedStop,
    clearStopOverrides,
    exportStopsSnippet,
    escHtml
  } = window.TumkurFeatures;

  const estimateFares = window.TumkurData.estimateFares || (() => null);

  applySavedStopOverrides(STOPS, ROUTES);

  function findStop(id) {
    return STOPS.find((s) => s.id === id) || null;
  }

  // --- Zero-API-Key Native Google Maps URL Builders ---
  const fmtLatLng = (coord) => `${Number(coord[1]).toFixed(6)},${Number(coord[0]).toFixed(6)}`;

  function openBusInGoogleMaps(bus) {
    const route = ROUTES.find((r) => r.id === bus.routeId);
    const busCoord = [bus.lng, bus.lat];
    const params = new URLSearchParams({ api: "1", travelmode: "driving" });

    if (myLocationCoord) {
      params.set("origin", fmtLatLng(myLocationCoord));
    }

    if (route && route.stops && route.stops.length >= 2) {
      const orderedStops = bus.direction >= 0 ? route.stops : [...route.stops].reverse();
      const destStop = orderedStops[orderedStops.length - 1];
      params.set("destination", fmtLatLng(destStop.coord));

      const waypoints = [busCoord];
      const mids = orderedStops.slice(0, -1).map((s) => s.coord);
      const step = Math.max(1, Math.ceil(mids.length / 5));
      for (let i = 0; i < mids.length && waypoints.length < 7; i += step) {
        if (haversineMeters(busCoord, mids[i]) > 250) {
          waypoints.push(mids[i]);
        }
      }
      params.set("waypoints", waypoints.map(fmtLatLng).join("|"));
    } else {
      params.set("destination", fmtLatLng(busCoord));
    }

    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener");
  }

  function openRouteInGoogleMaps(route) {
    if (!route || !route.stops || route.stops.length < 2) return;
    const first = route.stops[0].coord;
    const last = route.stops[route.stops.length - 1].coord;
    const params = new URLSearchParams({
      api: "1",
      origin: fmtLatLng(first),
      destination: fmtLatLng(last),
      travelmode: "driving"
    });

    const interior = route.stops.slice(1, -1).map((s) => s.coord);
    if (interior.length) {
      const step = Math.max(1, Math.ceil(interior.length / 7));
      const picked = [];
      for (let i = 0; i < interior.length && picked.length < 7; i += step) {
        picked.push(interior[i]);
      }
      params.set("waypoints", picked.map(fmtLatLng).join("|"));
    }

    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener");
  }

  function openTripInGoogleMaps(fromStop, toStop, hubStop = null) {
    if (!fromStop || !toStop) return;
    const params = new URLSearchParams({
      api: "1",
      origin: fmtLatLng(fromStop.coord),
      destination: fmtLatLng(toStop.coord),
      travelmode: "driving"
    });
    if (hubStop) {
      params.set("waypoints", fmtLatLng(hubStop.coord));
    }
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener");
  }

  // Highlighted Roads in both Street and Satellite Modes
  const MAP_STYLES = {
    street: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap"
        },
        roads: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256
        }
      },
      layers: [
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
          paint: { "raster-saturation": -0.22, "raster-contrast": 0.1 }
        },
        {
          id: "roads",
          type: "raster",
          source: "roads",
          paint: { "raster-opacity": 0.72, "raster-contrast": 0.28, "raster-saturation": 0.45 }
        }
      ]
    },
    satellite: {
      version: 8,
      sources: {
        imagery: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256,
          attribution: "© Esri"
        },
        roads: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256
        },
        places: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256
        }
      },
      layers: [
        { id: "imagery", type: "raster", source: "imagery", paint: { "raster-brightness-max": 0.88 } },
        { id: "roads", type: "raster", source: "roads", paint: { "raster-opacity": 1.0, "raster-contrast": 0.35, "raster-saturation": 0.55 } },
        { id: "places", type: "raster", source: "places", paint: { "raster-opacity": 0.9 } }
      ]
    }
  };

  // Core State (Stops OFF & Sidebar Hidden by Default)
  let fleet = createInitialFleet();
  let savedCommutes = loadSavedCommutes();
  let selectedRouteFilter = "ALL";
  let selectedBusId = null;
  let followBusActive = false;
  let largeBusIcons = true;
  let showStops = false;
  let showTraffic = true;
  let stopLangMode = "both";
  let drawerOpen = false;
  let activeTab = "fleet";
  let isExternalApiMode = false;
  let apiPollTimer = null;
  let gpsWatchId = null;
  let currentStyleName = "street";

  // Smooth Zoom Stutter-Prevention Flags
  let isZooming = false;
  let isMapMoving = false;

  // Locate Me & Closest Approaching Buses
  let myLocationCoord = null;
  let myLocationMarker = null;
  let nearbyBarOpen = false;

  // Stop Editor
  let editStopsMode = false;
  let addStopSubMode = false;

  // Pass-By Alert
  let alertConfig = { active: false, fleetKey: "ALL", coord: null, locLabel: "", radiusMeters: 1000 };
  let pickingAlertOnMap = false;
  let userAlertMarker = null;
  let lastAlertBusId = null;
  const alertPrevDist = new Map();
  const alertCooldowns = new Map();

  // Wake-Me Drop-Off Alarm
  let wakeConfig = {
    active: false,
    stopId: null,
    radiusMeters: 1000,
    mode: "gps",
    triggered: false,
    watchId: null,
    alarmInterval: null
  };

  let audioCtx = null;
  let deferredInstallPrompt = null;
  let stopMarkerEntries = [];
  let map = null;
  const mapEl = document.getElementById("map");

  // --- Audio Helpers ---
  function unlockAudio() {
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass && !audioCtx) audioCtx = new AudioClass();
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    } catch {
      // Ignore
    }
  }

  function playChime(freqs = [660, 880]) {
    try {
      unlockAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.16);
        gain.gain.setValueAtTime(0.2, now + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.16);
        osc.stop(now + idx * 0.16 + 0.3);
      });
    } catch {
      // Ignore
    }
  }

  // --- GPU Canvas Sprites (Zero-Stutter Native WebGL 2D Buses + Upright Route Badges) ---
  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function createTopDownBusImage(color, accent, isAC) {
    const w = 44;
    const h = isAC ? 96 : 82;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(15, 23, 42, 0.32)";
    drawRoundedRect(ctx, 8, 7, w - 12, h - 10, 9);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(2, 13, 6, 4);
    ctx.fillRect(w - 8, 13, 6, 4);

    ctx.fillStyle = "#ffffff";
    drawRoundedRect(ctx, 5, 3, w - 10, h - 8, 9);
    ctx.fill();

    ctx.fillStyle = color;
    drawRoundedRect(ctx, 7, 5, w - 14, h - 12, 7);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    drawRoundedRect(ctx, 9, 8, w - 18, 14, 4);
    ctx.fill();

    ctx.fillStyle = "rgba(148, 163, 184, 0.38)";
    ctx.fillRect(11, 10, w - 22, 4);

    ctx.fillStyle = "#fef08a";
    ctx.fillRect(9, 4, 6, 3);
    ctx.fillRect(w - 15, 4, 6, 3);

    ctx.fillStyle = isAC ? "#f8fafc" : "#e2e8f0";
    drawRoundedRect(ctx, 10, 25, w - 20, h - 38, 4);
    ctx.fill();

    if (isAC) {
      ctx.fillStyle = color;
      drawRoundedRect(ctx, 13, 33, w - 26, h - 54, 4);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      drawRoundedRect(ctx, 16, 37, w - 32, h - 62, 3);
      ctx.fill();
    } else {
      ctx.fillStyle = accent;
      ctx.fillRect(w / 2 - 2.5, 27, 5, h - 42);
      ctx.fillStyle = color;
      drawRoundedRect(ctx, 14, 40, w - 28, 16, 3);
      ctx.fill();
    }

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(10, h - 9, 6, 3);
    ctx.fillRect(w - 16, h - 9, 6, 3);

    return ctx.getImageData(0, 0, w, h);
  }

  function createRouteBadgeImage(label, color, isAC, isSelected = false) {
    const text = isAC ? `${label} AC` : label;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    const textW = Math.ceil(ctx.measureText(text).width);
    const w = Math.max(58, textW + 24);
    const h = 34;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
    drawRoundedRect(ctx, 2, 4, w - 4, h - 5, 14);
    ctx.fill();

    ctx.fillStyle = color;
    drawRoundedRect(ctx, 2, 2, w - 4, h - 6, 13);
    ctx.fill();

    ctx.lineWidth = isSelected ? 4 : 3;
    ctx.strokeStyle = isSelected ? "#fde047" : "#ffffff";
    ctx.stroke();

    ctx.font = "800 18px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, (h - 2) / 2);

    return ctx.getImageData(0, 0, w, h);
  }

  function registerBusSprites() {
    if (!map) return;

    const addIfMissing = (id, img) => {
      if (!map.hasImage(id)) {
        map.addImage(id, img, { pixelRatio: 2 });
      }
    };

    ROUTES.forEach((r) => {
      addIfMissing(`bus-${r.id}`, createTopDownBusImage(r.color, r.accent, Boolean(r.isAC)));
      addIfMissing(`badge-${r.id}`, createRouteBadgeImage(r.id, r.color, Boolean(r.isAC), false));
      addIfMissing(`badge-sel-${r.id}`, createRouteBadgeImage(r.id, r.color, Boolean(r.isAC), true));
    });

    addIfMissing("bus-LIVE", createTopDownBusImage("#2563eb", "#dbeafe", false));
    addIfMissing("badge-LIVE", createRouteBadgeImage("LIVE", "#2563eb", false, false));
    addIfMissing("badge-sel-LIVE", createRouteBadgeImage("LIVE", "#2563eb", false, true));
  }

  // --- Formatting & GeoJSON Builders ---
  function formatStopText(stop) {
    if (!stop) return "";
    const kn = stop.kn || stop.name;
    if (stopLangMode === "kn") return kn;
    if (stopLangMode === "en") return stop.name;
    return kn === stop.name ? stop.name : `${kn} · ${stop.name}`;
  }

  function formatStopPinHtml(stop) {
    const kn = escHtml(stop.kn || stop.name);
    const en = escHtml(stop.name);
    if (stopLangMode === "kn") return `<span class="stop-kn">${kn}</span>`;
    if (stopLangMode === "en") return `<span class="stop-en">${en}</span>`;
    return kn === en
      ? `<span class="stop-en">${en}</span>`
      : `<span class="stop-kn">${kn}</span><span class="stop-en">${en}</span>`;
  }

  function getBusNextStopDisplay(bus) {
    const stop = bus.nextStopId ? findStop(bus.nextStopId) : null;
    const label = stop ? formatStopText(stop) : bus.nextStopName || "En Route";
    return showStops ? label : `Direct → ${label}`;
  }

  function makeCircleGeoJSON(coord, radiusMeters) {
    if (!coord) return { type: "FeatureCollection", features: [] };
    const pts = [];
    const earthR = 6371000;
    const latRad = (coord[1] * Math.PI) / 180;
    const dLat = (radiusMeters / earthR) * (180 / Math.PI);
    const dLng = dLat / Math.cos(latRad);
    for (let i = 0; i <= 48; i++) {
      const theta = (i / 48) * Math.PI * 2;
      pts.push([coord[0] + Math.cos(theta) * dLng, coord[1] + Math.sin(theta) * dLat]);
    }
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pts] } }]
    };
  }

  function buildRouteGeoJSON() {
    return {
      type: "FeatureCollection",
      features: ROUTES.map((r) => ({
        type: "Feature",
        properties: {
          id: r.id,
          color: r.color,
          name: r.name,
          category: r.category,
          isAC: Boolean(r.isAC)
        },
        geometry: { type: "LineString", coordinates: r.path }
      }))
    };
  }

  function buildBusesGeoJSON() {
    const visible = getVisibleFleet();
    const now = performance.now();
    return {
      type: "FeatureCollection",
      features: visible.map((b) => {
        const hasRouteSprite = ROUTES.some((r) => r.id === b.routeId);
        const key = hasRouteSprite ? b.routeId : "LIVE";
        const isSel = b.id === selectedBusId;
        const isNew = Boolean(b.isNewUntil && b.isNewUntil > now);
        return {
          type: "Feature",
          properties: {
            id: b.id,
            routeId: b.routeId,
            heading: b.heading || 0,
            iconId: `bus-${key}`,
            badgeId: isSel ? `badge-sel-${key}` : `badge-${key}`,
            isSelected: isSel ? 1 : 0,
            isNew: isNew ? 1 : 0
          },
          geometry: { type: "Point", coordinates: [b.lng, b.lat] }
        };
      })
    };
  }

  function syncBusesWebGLLayer() {
    if (!map) return;
    const src = map.getSource("live-buses");
    if (src) src.setData(buildBusesGeoJSON());
  }

  function updateRouteSourceData() {
    if (!map) return;
    const src = map.getSource("tumkur-routes");
    if (src) src.setData(buildRouteGeoJSON());
  }

  function updateAlertZoneLayer() {
    if (!map) return;
    const src = map.getSource("alert-zone");
    if (src) {
      src.setData(
        alertConfig.active && alertConfig.coord
          ? makeCircleGeoJSON(alertConfig.coord, alertConfig.radiusMeters)
          : { type: "FeatureCollection", features: [] }
      );
    }
    const wakeSrc = map.getSource("wake-zone");
    if (wakeSrc) {
      const dest = wakeConfig.active && wakeConfig.stopId ? findStop(wakeConfig.stopId) : null;
      wakeSrc.setData(
        dest ? makeCircleGeoJSON(dest.coord, wakeConfig.radiusMeters) : { type: "FeatureCollection", features: [] }
      );
    }
  }

  function updateTrafficLayerVisibility() {
    if (!map) return;
    const vis = showTraffic ? "visible" : "none";
    if (map.getLayer("traffic-fill")) map.setLayoutProperty("traffic-fill", "visibility", vis);
    if (map.getLayer("traffic-border")) map.setLayoutProperty("traffic-border", "visibility", vis);
  }

  function applyBusIconSizeExpression() {
    if (!map || !map.getLayer("buses-icon")) return;
    const scaleBoost = largeBusIcons ? 1.0 : 0.76;
    map.setLayoutProperty("buses-icon", "icon-size", [
      "interpolate",
      ["linear"],
      ["zoom"],
      9.5, 0.42 * scaleBoost,
      12.5, 0.62 * scaleBoost,
      15.0, 0.88 * scaleBoost,
      17.5, 1.15 * scaleBoost
    ]);
    map.setLayoutProperty("buses-badge", "icon-size", [
      "interpolate",
      ["linear"],
      ["zoom"],
      9.5, 0.55 * scaleBoost,
      12.5, 0.72 * scaleBoost,
      15.0, 0.86 * scaleBoost
    ]);
  }

  // --- Attach Native WebGL Layers ---
  function attachMapLayers() {
    if (!map) return;
    registerBusSprites();

    map.addSource("traffic-zones", { type: "geojson", data: buildBottleneckGeoJSON() });
    map.addLayer({
      id: "traffic-fill",
      type: "fill",
      source: "traffic-zones",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.13 }
    });
    map.addLayer({
      id: "traffic-border",
      type: "line",
      source: "traffic-zones",
      paint: { "line-color": ["get", "color"], "line-width": 1.8, "line-dasharray": [3, 2] }
    });
    updateTrafficLayerVisibility();

    map.addSource("alert-zone", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "alert-zone-fill", type: "fill", source: "alert-zone", paint: { "fill-color": "#d97706", "fill-opacity": 0.14 } });
    map.addLayer({ id: "alert-zone-border", type: "line", source: "alert-zone", paint: { "line-color": "#d97706", "line-width": 2.2, "line-dasharray": [3, 2] } });

    map.addSource("wake-zone", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "wake-zone-fill", type: "fill", source: "wake-zone", paint: { "fill-color": "#6d28d9", "fill-opacity": 0.16 } });
    map.addLayer({ id: "wake-zone-border", type: "line", source: "wake-zone", paint: { "line-color": "#6d28d9", "line-width": 2.4, "line-dasharray": [4, 2] } });
    updateAlertZoneLayer();

    map.addSource("tumkur-routes", { type: "geojson", data: buildRouteGeoJSON() });

    map.addLayer({
      id: "routes-glow",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 7, 14, 13, 17, 18],
        "line-blur": 5,
        "line-opacity": 0.38
      }
    });

    map.addLayer({
      id: "routes-casing",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4.5, 14, 7.5, 17, 11],
        "line-opacity": 0.96
      }
    });

    map.addLayer({
      id: "routes-core",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.8, 14, 4.6, 17, 7],
        "line-opacity": 1.0
      }
    });

    map.addSource("live-buses", { type: "geojson", data: buildBusesGeoJSON() });

    map.addLayer({
      id: "buses-new-ring",
      type: "circle",
      source: "live-buses",
      filter: ["==", ["get", "isNew"], 1],
      paint: {
        "circle-radius": 18,
        "circle-color": "rgba(34, 197, 94, 0.25)",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#22c55e"
      }
    });

    map.addLayer({
      id: "buses-icon",
      type: "symbol",
      source: "live-buses",
      layout: {
        "icon-image": ["get", "iconId"],
        "icon-rotate": ["get", "heading"],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "symbol-sort-key": ["get", "isSelected"]
      }
    });

    map.addLayer({
      id: "buses-badge",
      type: "symbol",
      source: "live-buses",
      minzoom: 10.2,
      layout: {
        "icon-image": ["get", "badgeId"],
        "icon-rotation-alignment": "viewport",
        "icon-offset": [0, -30],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "symbol-sort-key": ["get", "isSelected"]
      }
    });

    applyBusIconSizeExpression();
    applyRouteLayerFilter();
  }

  function syncStopLabelZoomClass() {
    if (!map || !mapEl) return;
    const z = map.getZoom();
    mapEl.classList.toggle("show-major-stops", z >= 12.2);
    mapEl.classList.toggle("show-all-stops", z >= 13.8);
  }

  function applyRouteLayerFilter() {
    if (!map || !map.getLayer("routes-core")) return;

    const selectedBus = selectedBusId ? fleet.find((b) => b.id === selectedBusId) : null;
    let filter = null;

    if (selectedBus) {
      filter = ["==", ["get", "id"], selectedBus.routeId];
      map.setPaintProperty("routes-glow", "line-opacity", 0.56);
    } else {
      map.setPaintProperty("routes-glow", "line-opacity", 0.36);

      if (selectedRouteFilter === "CITY") {
        filter = ["==", ["get", "category"], "city"];
      } else if (selectedRouteFilter === "BLR") {
        filter = ["==", ["get", "category"], "bangalore"];
      } else if (selectedRouteFilter === "BLR_AC") {
        filter = ["==", ["get", "isAC"], true];
      } else if (selectedRouteFilter !== "ALL") {
        filter = ["==", ["get", "id"], selectedRouteFilter];
      }
    }

    map.setFilter("routes-core", filter);
    map.setFilter("routes-casing", filter);
    if (map.getLayer("routes-glow")) map.setFilter("routes-glow", filter);
    syncStopMarkerHighlight(selectedBus ? selectedBus.routeId : null);
  }

  function getVisibleFleet() {
    if (selectedRouteFilter === "ALL") return fleet;
    if (selectedRouteFilter === "CITY") return fleet.filter((b) => b.category === "city");
    if (selectedRouteFilter === "BLR") return fleet.filter((b) => b.category === "bangalore");
    if (selectedRouteFilter === "BLR_AC") return fleet.filter((b) => b.isAC);
    return fleet.filter((b) => b.routeId === selectedRouteFilter);
  }

  // --- Stop Markers ---
  function clearStopMarkers() {
    stopMarkerEntries.forEach(({ marker }) => marker.remove());
    stopMarkerEntries = [];
  }

  function initStopMarkers() {
    clearStopMarkers();
    if (!map || !showStops) return;

    stopMarkerEntries = STOPS.map((stop) => {
      const el = document.createElement("div");
      el.className = `bus-stop-pin ${stop.major ? "major" : ""} ${editStopsMode ? "draggable-edit" : ""}`;
      el.innerHTML = `<span class="bus-stop-dot">B</span><span class="bus-stop-label">${formatStopPinHtml(stop)}</span>`;

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (editStopsMode) {
          showToast(`Drag "${stop.name}" on the map to adjust its spot.`);
          return;
        }
        if (pickingAlertOnMap) {
          pickingAlertOnMap = false;
          mapEl.classList.remove("picking-location");
          setUserAlertLocation(stop.coord, formatStopText(stop));
          document.getElementById("alertModal").classList.remove("hidden");
          showToast(`Alert location set to ${formatStopText(stop)}.`);
          return;
        }
        const stopSel = document.getElementById("stopSelect");
        if (stopSel && findStop(stop.id)) {
          stopSel.value = stop.id;
          renderArrivalBoard();
          openDrawer("stops");
        }
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "left",
        draggable: editStopsMode
      })
        .setLngLat(stop.coord)
        .addTo(map);

      marker.on("dragend", () => {
        if (!editStopsMode) return;
        const pos = marker.getLngLat();
        recordMovedStop(stop.id, [pos.lng, pos.lat], STOPS, ROUTES);
        renderTripAndFares();
        renderArrivalBoard();
        showToast(`Saved "${stop.name}" → ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
      });

      return { stop, el, marker };
    });

    const activeBus = selectedBusId ? fleet.find((b) => b.id === selectedBusId) : null;
    syncStopMarkerHighlight(activeBus ? activeBus.routeId : null);
  }

  function syncStopMarkerPositions() {
    stopMarkerEntries.forEach(({ stop, marker }) => {
      const master = findStop(stop.id);
      if (master) marker.setLngLat(master.coord);
    });
  }

  function syncStopMarkerHighlight(activeRouteId) {
    stopMarkerEntries.forEach(({ stop, el }) => {
      if (!activeRouteId) {
        el.classList.remove("route-active", "dimmed");
      } else {
        const onRoute = (stop.routeIds || []).includes(activeRouteId);
        el.classList.toggle("route-active", onRoute);
        el.classList.toggle("dimmed", !onRoute);
      }
    });
  }

  function setStopEditorMode(active) {
    editStopsMode = active;
    addStopSubMode = false;
    mapEl.classList.remove("picking-location");
    document.getElementById("stopEditorBar").classList.toggle("hidden", !editStopsMode);
    document.getElementById("btnEditorAddMode").classList.remove("active");

    if (editStopsMode && !showStops) {
      showStops = true;
      const btn = document.getElementById("btnToggleStops");
      btn.classList.add("active");
      btn.textContent = "ON";
      setRouteStopMode(true);
      repositionFleetOnRoutes(fleet);
      updateRouteSourceData();
      syncBusesWebGLLayer();
    }

    initStopMarkers();
    if (editStopsMode) {
      document.getElementById("settingsModal").classList.add("hidden");
      showToast("Stop Editor ON: Drag any stop pin to adjust.");
    }
  }

  // --- Hideable Drawer & Native Touch Swipe-Down Gesture ---
  function openDrawer(tabName = null) {
    drawerOpen = true;
    document.getElementById("drawer").classList.remove("hidden-drawer");
    document.getElementById("bottomDock").classList.add("hidden");
    if (tabName) switchTab(tabName);
    if (activeTab === "fleet") renderFleetList();
    if (activeTab === "routes") renderRoutesTab();
    if (activeTab === "stops") renderArrivalBoard();
    if (activeTab === "fares") renderTripAndFares();
  }

  function hideDrawer() {
    drawerOpen = false;
    document.getElementById("drawer").classList.add("hidden-drawer");
    document.getElementById("bottomDock").classList.remove("hidden");
  }

  function initMobileDrawerSwipe() {
    const drawer = document.getElementById("drawer");
    const dragZone = drawer ? drawer.querySelector(".drawer-top") : null;
    if (!drawer || !dragZone) return;

    let startY = 0;
    let startX = 0;
    let currentDeltaY = 0;
    let isDragging = false;
    let prevY = 0;
    let prevTime = 0;
    let lastY = 0;
    let lastTime = 0;
    let suppressGripClickUntil = 0;

    const grip = document.getElementById("drawerGrip");
    if (grip) {
      grip.addEventListener(
        "click",
        (e) => {
          if (performance.now() < suppressGripClickUntil) {
            e.stopImmediatePropagation();
          }
        },
        true
      );
    }

    dragZone.addEventListener(
      "touchstart",
      (e) => {
        if (window.innerWidth > 820 || !drawerOpen || e.touches.length !== 1) return;
        const t = e.touches[0];
        startY = t.clientY;
        startX = t.clientX;
        prevY = lastY = t.clientY;
        prevTime = lastTime = performance.now();
        currentDeltaY = 0;
        isDragging = false;
      },
      { passive: true }
    );

    dragZone.addEventListener(
      "touchmove",
      (e) => {
        if (window.innerWidth > 820 || !drawerOpen || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dy = t.clientY - startY;
        const dx = t.clientX - startX;

        if (!isDragging) {
          if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
            isDragging = true;
            drawer.classList.add("dragging");
          } else {
            return;
          }
        }

        e.preventDefault();

        const now = performance.now();
        if (now - lastTime > 16) {
          prevY = lastY;
          prevTime = lastTime;
          lastY = t.clientY;
          lastTime = now;
        }

        currentDeltaY = dy;
        const visualY = dy >= 0 ? dy : Math.max(-18, dy * 0.16);
        drawer.style.transform = `translateY(${visualY}px)`;
      },
      { passive: false }
    );

    const finishDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      suppressGripClickUntil = performance.now() + 260;

      const now = performance.now();
      const recentMove = now - lastTime < 120;
      const velocityPxPerMs = recentMove
        ? (lastY - prevY) / Math.max(1, lastTime - prevTime)
        : 0;

      const sheetHeight = drawer.offsetHeight || 420;
      const shouldClose =
        currentDeltaY > Math.min(130, sheetHeight * 0.28) ||
        (currentDeltaY > 36 && velocityPxPerMs > 0.45);

      drawer.classList.remove("dragging");
      drawer.style.transform = "";

      if (shouldClose) {
        hideDrawer();
      }
    };

    dragZone.addEventListener("touchend", finishDrag, { passive: true });
    dragZone.addEventListener("touchcancel", finishDrag, { passive: true });
  }

  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${name}`);
    });
    if (name === "fleet") renderFleetList();
    if (name === "routes") renderRoutesTab();
    if (name === "stops") renderArrivalBoard();
    if (name === "fares") renderTripAndFares();
  }

  // --- Bus Selection ---
  function selectBus(busId, flyToBus = false) {
    const bus = fleet.find((b) => b.id === busId);
    if (!bus) return;

    selectedBusId = busId;
    if (window.innerWidth <= 820 && drawerOpen) hideDrawer();

    document.getElementById("busInspector").classList.remove("hidden");

    const tag = document.getElementById("inspRouteTag");
    tag.textContent = bus.routeId;
    tag.style.background = bus.color;
    document.getElementById("inspAcBadge").classList.toggle("hidden", !bus.isAC);
    document.getElementById("inspReg").textContent = bus.reg;

    const routeObj = ROUTES.find((r) => r.id === bus.routeId);
    const modeTag = showStops ? "" : " (Direct)";
    document.getElementById("selectedRouteText").textContent = routeObj
      ? `Route ${routeObj.id}${modeTag} · ${routeObj.name}`
      : `Route ${bus.routeId}${modeTag}`;
    document.getElementById("selectedRouteBanner").classList.remove("hidden");

    updateInspectorMetrics(bus);
    applyRouteLayerFilter();
    syncBusesWebGLLayer();
    if (drawerOpen && activeTab === "fleet") renderFleetList();

    if (flyToBus && map) {
      map.flyTo({
        center: [bus.lng, bus.lat],
        zoom: Math.max(map.getZoom(), 15.0),
        pitch: 0,
        bearing: 0,
        duration: 750
      });
    }
  }

  function clearSelectedBus() {
    selectedBusId = null;
    followBusActive = false;
    updateFollowButton();
    document.getElementById("busInspector").classList.add("hidden");
    document.getElementById("selectedRouteBanner").classList.add("hidden");
    applyRouteLayerFilter();
    syncBusesWebGLLayer();
    if (drawerOpen && activeTab === "fleet") renderFleetList();
  }

  function updateInspectorMetrics(bus) {
    const traffic = getTrafficState();
    const adjEta = Math.max(1, Math.round((bus.etaMin || 2) * traffic.multiplier));
    document.getElementById("inspService").textContent =
      bus.livery || (bus.isAC ? "AC Coach" : "City Bus");
    document.getElementById("inspSpeed").textContent =
      bus.speedKmh > 0 ? `${bus.speedKmh} km/h` : "At Stop";
    document.getElementById("inspNextStop").textContent = getBusNextStopDisplay(bus);
    document.getElementById("inspEtaCrowd").textContent =
      `${adjEta}m · ${bus.crowd || "Moderate"}`;
  }

  // --- Closest Approaching Buses ---
  function renderNearbyApproachingBuses() {
    if (!nearbyBarOpen || !myLocationCoord) return;
    const listEl = document.getElementById("nearbyBusesList");
    if (!listEl) return;

    const traffic = getTrafficState();
    const ranked = fleet
      .map((bus) => {
        const dist = haversineMeters([bus.lng, bus.lat], myLocationCoord);
        const toUser = bearingDegrees([bus.lng, bus.lat], myLocationCoord);
        const diff = Math.abs(((toUser - bus.heading + 540) % 360) - 180);
        const approaching = diff <= 95;
        const speedMps = Math.max(5, ((bus.speedKmh || 28) * 1000) / 3600);
        const etaMin = Math.max(1, Math.round((dist / speedMps / 60) * traffic.multiplier));
        return { bus, dist, approaching, etaMin };
      })
      .sort((a, b) => (a.approaching !== b.approaching ? (a.approaching ? -1 : 1) : a.dist - b.dist))
      .slice(0, 3);

    listEl.innerHTML = ranked
      .map(({ bus, dist, approaching, etaMin }) => {
        const dLabel = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
        return `
          <div class="nearby-item" data-nearby-id="${bus.id}">
            <div>
              <span class="route-tag" style="background:${bus.color}">${bus.routeId}</span>
              ${bus.isAC ? `<span class="ac-pill">AC</span>` : ""}
              <strong>${bus.reg}</strong>
              <div style="font-size:10.5px;color:var(--muted);margin-top:2px;">
                ${dLabel} · ${approaching ? "Approaching you" : "Nearby"}
              </div>
            </div>
            <div style="font-weight:800;color:var(--emerald)">~${etaMin}m</div>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll("[data-nearby-id]").forEach((row) => {
      row.addEventListener("click", () => selectBus(row.dataset.nearbyId, true));
    });
  }

  // --- Dropdown & Language Refresh ---
  function populateStopDropdown(selectEl, includePlaceholder = null, defaultId = null) {
    if (!selectEl) return;
    const prevVal = selectEl.value;
    const opts = [];
    if (includePlaceholder) opts.push(`<option value="">${includePlaceholder}</option>`);
    STOPS.forEach((s) => opts.push(`<option value="${s.id}">${escHtml(formatStopText(s))}</option>`));
    selectEl.innerHTML = opts.join("");
    if (prevVal && (prevVal === "" || findStop(prevVal))) {
      selectEl.value = prevVal;
    } else if (defaultId && findStop(defaultId)) {
      selectEl.value = defaultId;
    }
  }

  function refreshStopLanguageUI() {
    stopMarkerEntries.forEach(({ stop, el }) => {
      const labelEl = el.querySelector(".bus-stop-label");
      if (labelEl) labelEl.innerHTML = formatStopPinHtml(stop);
    });

    populateStopDropdown(document.getElementById("stopSelect"), null, "ksrtc");
    populateStopDropdown(document.getElementById("alertStopSelect"), "— Or pick a stop —");
    populateStopDropdown(document.getElementById("wakeStopSelect"), null, "majestic");
    populateStopDropdown(document.getElementById("fareFromSelect"), null, "ksrtc");
    populateStopDropdown(document.getElementById("fareToSelect"), null, "majestic");

    if (drawerOpen) {
      if (activeTab === "fleet") renderFleetList();
      if (activeTab === "routes") renderRoutesTab();
      if (activeTab === "stops") renderArrivalBoard();
      if (activeTab === "fares") renderTripAndFares();
    }
    if (selectedBusId) {
      const activeBus = fleet.find((b) => b.id === selectedBusId);
      if (activeBus) updateInspectorMetrics(activeBus);
    }
  }

  // --- Shareable Live Links ---
  async function copyOrShareUrl(paramsObj, titleText) {
    const url = new URL(window.location.href);
    url.search = "";
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
    const shareUrl = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({ title: titleText, text: titleText, url: shareUrl });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(`Live link copied for ${titleText}!`);
    } catch {
      window.prompt("Copy shareable live link:", shareUrl);
    }
  }

  function applyDeepLinkFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const busParam = params.get("bus");
    const routeParam = params.get("route");
    const fromParam = params.get("from");
    const toParam = params.get("to");

    if (busParam) {
      const found = fleet.find((b) => b.id === busParam);
      if (found) {
        selectBus(found.id, true);
        showToast(`Opened shared live bus ${found.routeId}`);
        return;
      }
    }

    if (routeParam && ROUTES.some((r) => r.id === routeParam)) {
      selectedRouteFilter = routeParam;
      renderRoutePills();
      applyRouteLayerFilter();
      syncBusesWebGLLayer();
      if (map) {
        const target = routeParam.startsWith("BLR-") ? LANDMARKS.corridor : LANDMARKS.tumkur;
        map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 850 });
      }
      showToast(`Opened shared Route ${routeParam}`);
      return;
    }

    if (fromParam && toParam && findStop(fromParam) && findStop(toParam)) {
      document.getElementById("fareFromSelect").value = fromParam;
      document.getElementById("fareToSelect").value = toParam;
      openDrawer("fares");
    }
  }

  // --- Saved Daily Commutes ---
  function renderSavedCommutes() {
    const bar = document.getElementById("savedCommutesBar");
    if (!bar) return;
    bar.innerHTML = savedCommutes
      .map(
        (c) => `
        <button class="commute-pill" data-commute-id="${c.id}">
          <span>★ ${escHtml(c.label)}</span>
          <span class="commute-del" data-del-commute="${c.id}">✕</span>
        </button>`
      )
      .join("");

    bar.querySelectorAll("[data-commute-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (e.target.dataset.delCommute) {
          e.stopPropagation();
          savedCommutes = savedCommutes.filter((c) => c.id !== e.target.dataset.delCommute);
          saveCommutesList(savedCommutes);
          renderSavedCommutes();
          showToast("Removed saved commute.");
          return;
        }
        const item = savedCommutes.find((c) => c.id === btn.dataset.commuteId);
        if (!item) return;
        document.getElementById("fareFromSelect").value = item.fromId;
        document.getElementById("fareToSelect").value = item.toId;
        openDrawer("fares");
        const fromStop = findStop(item.fromId);
        if (fromStop && map) {
          map.flyTo({ center: fromStop.coord, zoom: 13.8, pitch: 0, bearing: 0, duration: 800 });
        }
      });
    });
  }

  // --- Trip Planner + KSRTC Fares ---
  function renderTripAndFares() {
    const fromEl = document.getElementById("fareFromSelect");
    const toEl = document.getElementById("fareToSelect");
    const passEl = document.getElementById("farePassengerSelect");
    const summaryEl = document.getElementById("fareSummary");
    const tripEl = document.getElementById("tripPlanResults");
    const fareEl = document.getElementById("fareResults");
    if (!fromEl || !toEl || !passEl || !summaryEl || !tripEl || !fareEl) return;

    const plan = planPointToPointTrip({
      fromId: fromEl.value,
      toId: toEl.value,
      routes: ROUTES,
      stops: STOPS,
      fleet,
      findStop,
      estimateFares,
      haversineMeters,
      passengerType: passEl.value
    });

    if (!plan) {
      summaryEl.innerHTML = `<span>Pick two different stops to plan trips & estimate fares.</span>`;
      tripEl.innerHTML = "";
      fareEl.innerHTML = "";
      return;
    }

    const distKm = plan.fareEst ? plan.fareEst.distanceKm : "—";
    const trafficNote =
      plan.traffic.extraMin > 0
        ? `<span class="traffic-pill ${plan.traffic.state.severity === "heavy" ? "heavy" : ""}">+${plan.traffic.extraMin}m traffic</span>`
        : `<span class="free-pill">Clear</span>`;

    summaryEl.innerHTML = `
      <div class="summary-row">
        <span>Road Distance: <strong>${distKm} km</strong></span>
        ${trafficNote}
      </div>
      <div class="summary-row" style="font-size:11px;color:#1e40af;">
        <span>${plan.directOptions.length} direct route${plan.directOptions.length === 1 ? "" : "s"}</span>
        <button class="gmaps-mini-btn" id="btnOpenPlannedTripGmaps">Google Maps ↗</button>
      </div>
    `;

    on("btnOpenPlannedTripGmaps", "click", () => {
      openTripInGoogleMaps(plan.fromStop, plan.toStop, null);
    });

    let tripHtml = `<div class="section-subhead">Recommended Live Trips</div>`;
    if (plan.directOptions.length) {
      tripHtml += plan.directOptions
        .map((opt) => {
          const r = opt.route;
          const nextStr = opt.nextBus
            ? `Next in <strong>${opt.nextBus.etaMin}m</strong> (${opt.nextBus.bus.reg})`
            : `Next: ${opt.schedule.upcoming[0]}`;
          const priceStr = opt.fare === 0 ? "FREE (Shakti)" : `₹${opt.fare}`;
          return `
            <div class="trip-card">
              <div class="trip-top">
                <div>
                  <span class="route-tag" style="background:${r.color}">${r.id}</span>
                  ${r.isAC ? `<span class="ac-pill">AC</span>` : ""}
                  <strong>Direct</strong>
                </div>
                <strong style="color:var(--primary)">${priceStr} · ~${opt.rideMin}m</strong>
              </div>
              <div class="trip-meta">
                <span>${nextStr}</span>
                <div class="card-action-group">
                  <button class="gmaps-mini-btn" data-gmaps-trip="direct">Maps ↗</button>
                  <button class="fare-route-btn" data-jump-route="${r.id}" style="background:${r.color}">Track</button>
                </div>
              </div>
            </div>`;
        })
        .join("");
    }

    if (plan.transferOptions.length) {
      tripHtml += plan.transferOptions
        .map((opt) => `
          <div class="trip-card transfer">
            <div class="trip-top">
              <div>
                <span class="route-tag" style="background:${opt.leg1.color}">${opt.leg1.id}</span> →
                <span class="route-tag" style="background:${opt.leg2.color}">${opt.leg2.id}</span>
              </div>
              <strong style="color:#92400e">${opt.fare === 0 ? "FREE" : `~₹${opt.fare}`} · ~${opt.rideMin}m</strong>
            </div>
            <div class="trip-meta">
              <span>Transfer at <strong>${escHtml(formatStopText(opt.hubStop))}</strong></span>
              <div class="card-action-group">
                <button class="gmaps-mini-btn" data-gmaps-hub="${opt.hubStop.id}">Maps ↗</button>
                <button class="fare-route-btn" data-jump-route="${opt.leg1.id}" style="background:${opt.leg1.color}">Leg 1</button>
              </div>
            </div>
          </div>`)
        .join("");
    }

    if (!plan.directOptions.length && !plan.transferOptions.length) {
      tripHtml += `<div class="trip-card"><span>Connect via Tumakuru KSRTC Stand.</span></div>`;
    }
    tripEl.innerHTML = tripHtml;

    if (plan.fareEst && plan.fareEst.tiers.length) {
      fareEl.innerHTML =
        `<div class="section-subhead">KSRTC Fare Breakdown</div>` +
        plan.fareEst.tiers
          .map((t) => {
            const isFree = t.fare === 0;
            const discounted = t.fare < t.baseFare && !isFree;
            const priceHtml = isFree
              ? `<div class="fare-amount is-free">FREE</div><span class="free-pill">Shakti ₹0</span>`
              : `<div class="fare-amount">${discounted ? `<span class="fare-strike">₹${t.baseFare}</span>` : ""}₹${t.fare}</div>`;
            const adjDuration = t.durationMin + plan.traffic.extraMin;
            const routeButtons = (t.routeIds || [])
              .map((rid) => {
                const rt = ROUTES.find((r) => r.id === rid);
                return `<button class="fare-route-btn" data-jump-route="${rid}" style="background:${rt ? rt.color : "#334155"}">Live ${rid}</button>`;
              })
              .join("");
            return `
              <div class="fare-card ${t.isAC ? "ac-tier" : "non-ac-tier"}">
                <div class="fare-card-top">
                  <div>
                    <div class="fare-service-name">${t.name} ${t.isAC ? `<span class="ac-pill">AC</span>` : ""}</div>
                    <div class="fare-service-sub">${t.subtitle} · ~${adjDuration} min</div>
                  </div>
                  <div class="fare-price-box">${priceHtml}</div>
                </div>
                <div class="fare-route-chips">
                  <span style="font-size:10.5px;color:var(--muted)">${t.note}</span>
                  ${routeButtons}
                </div>
              </div>`;
          })
          .join("") +
        `<p class="fare-note">Calibrated to Karnataka's Nov 2026 KSRTC fares (₹10 min city · ₹100 Tumakuru–Bengaluru Express).</p>`;
    } else {
      fareEl.innerHTML = "";
    }

    const scrollBox = document.getElementById("tripAndFareScroll");
    scrollBox.querySelectorAll("[data-jump-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rid = btn.dataset.jumpRoute;
        selectedRouteFilter = rid;
        if (selectedBusId) clearSelectedBus();
        renderRoutePills();
        applyRouteLayerFilter();
        syncBusesWebGLLayer();
        hideDrawer();
        if (map) {
          const target = rid.startsWith("BLR-") ? LANDMARKS.corridor : LANDMARKS.tumkur;
          map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 850 });
        }
      });
    });

    scrollBox.querySelectorAll("[data-gmaps-trip]").forEach((btn) => {
      btn.addEventListener("click", () => openTripInGoogleMaps(plan.fromStop, plan.toStop, null));
    });

    scrollBox.querySelectorAll("[data-gmaps-hub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openTripInGoogleMaps(plan.fromStop, plan.toStop, findStop(btn.dataset.gmapsHub));
      });
    });
  }

  // --- Wake-Me Drop-Off Alarm ---
  function evaluateWakeMePosition(currentCoord) {
    if (!wakeConfig.active || !wakeConfig.stopId) return;
    const dest = findStop(wakeConfig.stopId);
    if (!dest) return;

    const dist = haversineMeters(currentCoord, dest.coord);
    const distStr = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
    document.getElementById("activeWakeChipText").textContent = `Wake-Me: ${dest.name} (${distStr})`;

    if (dist <= wakeConfig.radiusMeters && !wakeConfig.triggered) {
      wakeConfig.triggered = true;
      const msg = `You are ${distStr} from ${formatStopText(dest)}. Get ready to alight!`;
      document.getElementById("wakeAlertMsg").textContent = msg;
      document.getElementById("wakeAlertBanner").classList.remove("hidden");

      playChime([784, 988, 1175]);
      if (navigator.vibrate) navigator.vibrate([350, 150, 350, 150, 450]);
      clearInterval(wakeConfig.alarmInterval);
      wakeConfig.alarmInterval = setInterval(() => {
        playChime([784, 988, 1175]);
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      }, 3200);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Wake Up — ${dest.name} Ahead!`, { body: msg });
      }
    }
  }

  function armWakeMeAlarm() {
    const stopId = document.getElementById("wakeStopSelect").value;
    const radius = Number(document.getElementById("wakeRadiusSelect").value) || 1000;
    const mode = document.getElementById("wakeModeSelect").value;
    const dest = findStop(stopId);
    if (!dest) return showToast("Select a destination stop.");
    if (mode === "selectedBus" && !selectedBusId) {
      return showToast("Tap a bus on the map first, or switch source to My Live Phone GPS.");
    }

    disableWakeMeAlarm(true);
    unlockAudio();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    wakeConfig.active = true;
    wakeConfig.stopId = stopId;
    wakeConfig.radiusMeters = radius;
    wakeConfig.mode = mode;
    wakeConfig.triggered = false;

    if (mode === "gps") {
      if (!navigator.geolocation) {
        wakeConfig.active = false;
        return showToast("Phone GPS unavailable. Switch to Selected Live Bus.");
      }
      wakeConfig.watchId = navigator.geolocation.watchPosition(
        (pos) => evaluateWakeMePosition([pos.coords.longitude, pos.coords.latitude]),
        () => showToast("Waiting for phone GPS fix..."),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    document.getElementById("wakeModal").classList.add("hidden");
    document.getElementById("activeWakeChip").classList.remove("hidden");
    document.getElementById("activeWakeChipText").textContent = `Wake-Me: ${dest.name}`;
    document.getElementById("btnOpenWakeModal").classList.add("armed");
    updateAlertZoneLayer();
    if (map) map.flyTo({ center: dest.coord, zoom: Math.max(map.getZoom(), 13.8), duration: 750 });
    showToast(`Wake-Me armed for ${formatStopText(dest)}.`);
  }

  function disableWakeMeAlarm(silent = false) {
    if (wakeConfig.watchId !== null) {
      navigator.geolocation.clearWatch(wakeConfig.watchId);
      wakeConfig.watchId = null;
    }
    clearInterval(wakeConfig.alarmInterval);
    wakeConfig.alarmInterval = null;
    wakeConfig.active = false;
    wakeConfig.triggered = false;
    document.getElementById("activeWakeChip").classList.add("hidden");
    document.getElementById("wakeAlertBanner").classList.add("hidden");
    document.getElementById("btnOpenWakeModal").classList.remove("armed");
    document.getElementById("wakeModal").classList.add("hidden");
    updateAlertZoneLayer();
    if (!silent) showToast("Wake-Me alarm stopped.");
  }

  // --- Pass-By Bus Alert ---
  function initAlertModalOptions() {
    const fleetSel = document.getElementById("alertFleetSelect");
    fleetSel.innerHTML = [
      `<option value="ALL">All Live Buses (Tumakuru + BLR)</option>`,
      `<option value="CITY">All Tumakuru City Buses</option>`,
      `<option value="BLR">All Buses to Bengaluru</option>`,
      `<option value="BLR_AC">All AC Buses to Bengaluru</option>`,
      ...ROUTES.map((r) => `<option value="${r.id}">Route ${r.id}${r.isAC ? " [AC]" : ""} — ${r.name}</option>`)
    ].join("");

    const stopSel = document.getElementById("alertStopSelect");
    populateStopDropdown(stopSel, "— Or pick a stop —");
    stopSel.addEventListener("change", () => {
      const stop = findStop(stopSel.value);
      if (stop) setUserAlertLocation(stop.coord, formatStopText(stop));
    });

    populateStopDropdown(document.getElementById("wakeStopSelect"), null, "majestic");
  }

  function setUserAlertLocation(coord, label) {
    alertConfig.coord = coord;
    alertConfig.locLabel = label;
    document.getElementById("alertLocStatus").textContent = `Location: ${label}`;
    if (map) {
      if (!userAlertMarker) {
        const el = document.createElement("div");
        el.className = "user-alert-pin";
        userAlertMarker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
      } else {
        userAlertMarker.setLngLat(coord);
      }
      updateAlertZoneLayer();
    }
  }

  function matchesAlertFleet(bus, key) {
    if (key === "ALL") return true;
    if (key === "CITY") return bus.category === "city";
    if (key === "BLR") return bus.category === "bangalore";
    if (key === "BLR_AC") return Boolean(bus.isAC);
    return bus.routeId === key;
  }

  function evaluatePassByAlerts(now) {
    if (!alertConfig.active || !alertConfig.coord) return;

    const watched = fleet.filter((b) => matchesAlertFleet(b, alertConfig.fleetKey));
    let nearestBus = null;
    let nearestDist = Infinity;

    watched.forEach((bus) => {
      const dist = haversineMeters([bus.lng, bus.lat], alertConfig.coord);
      const prev = alertPrevDist.get(bus.id);
      alertPrevDist.set(bus.id, dist);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBus = bus;
      }

      const toUser = bearingDegrees([bus.lng, bus.lat], alertConfig.coord);
      const diff = Math.abs(((toUser - bus.heading + 540) % 360) - 180);
      const headingToward = diff <= 85;
      const closingIn = prev === undefined ? headingToward : dist < prev + 4;

      if (dist <= alertConfig.radiusMeters && headingToward && closingIn) {
        const lastAlerted = alertCooldowns.get(bus.id) || 0;
        if (now - lastAlerted > 75000) {
          alertCooldowns.set(bus.id, now);
          lastAlertBusId = bus.id;
          const speedMps = Math.max(5, ((bus.speedKmh || 28) * 1000) / 3600);
          const etaMin = Math.max(1, Math.round((dist / speedMps / 60) * getTrafficState().multiplier));
          const dStr = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
          const msg = `${bus.routeId}${bus.isAC ? " (AC)" : ""} · ${bus.reg} is ${dStr} away (~${etaMin}m) approaching ${alertConfig.locLabel}!`;
          document.getElementById("passAlertMsg").textContent = msg;
          document.getElementById("passAlertBanner").classList.remove("hidden");
          playChime([660, 880]);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`Bus ${bus.routeId} Passing Soon`, { body: msg });
          }
        }
      }
    });

    if (nearestBus) {
      const dStr = nearestDist < 1000 ? `${Math.round(nearestDist)} m` : `${(nearestDist / 1000).toFixed(1)} km`;
      document.getElementById("activeAlertChipText").textContent = `Alert: ${nearestBus.routeId} (${dStr})`;
    }
  }

  function armPassByAlert() {
    if (!alertConfig.coord) {
      const ksrtc = findStop("ksrtc") || STOPS[0];
      setUserAlertLocation(ksrtc.coord, formatStopText(ksrtc));
    }
    alertConfig.fleetKey = document.getElementById("alertFleetSelect").value;
    alertConfig.radiusMeters = Number(document.getElementById("alertRadiusSelect").value) || 1000;
    alertConfig.active = true;
    alertPrevDist.clear();
    alertCooldowns.clear();
    unlockAudio();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    document.getElementById("alertModal").classList.add("hidden");
    document.getElementById("activeAlertChip").classList.remove("hidden");
    document.getElementById("btnOpenAlertModal").classList.add("armed");
    updateAlertZoneLayer();
    if (map) map.flyTo({ center: alertConfig.coord, zoom: Math.max(map.getZoom(), 14.2), duration: 750 });
    showToast(`Pass-By alert active near ${alertConfig.locLabel}.`);
  }

  function disablePassByAlert() {
    alertConfig.active = false;
    document.getElementById("activeAlertChip").classList.add("hidden");
    document.getElementById("passAlertBanner").classList.add("hidden");
    document.getElementById("btnOpenAlertModal").classList.remove("armed");
    if (userAlertMarker) {
      userAlertMarker.remove();
      userAlertMarker = null;
    }
    updateAlertZoneLayer();
    document.getElementById("alertModal").classList.add("hidden");
    showToast("Pass-By alert disabled.");
  }

  // --- Drawer Lists ---
  function renderRoutePills() {
    const wrap = document.getElementById("routeFilterPills");
    if (!wrap) return;
    const acCount = fleet.filter((b) => b.isAC).length;
    const blrCount = fleet.filter((b) => b.category === "bangalore").length;
    const cityCount = fleet.filter((b) => b.category === "city").length;

    const items = [
      { id: "ALL", label: `All (${fleet.length})`, color: "#0f172a" },
      { id: "CITY", label: `Tumakuru (${cityCount})`, color: "#dc2626" },
      { id: "BLR", label: `To BLR (${blrCount})`, color: "#1d4ed8" },
      { id: "BLR_AC", label: `AC BLR (${acCount})`, color: "#0284c7" },
      ...ROUTES.map((r) => ({ id: r.id, label: r.isAC ? `${r.id} AC` : r.id, color: r.color }))
    ];

    wrap.innerHTML = items
      .map((item) => {
        const active = selectedRouteFilter === item.id;
        return `<button class="route-pill ${active ? "active" : ""}" data-route="${item.id}" ${active ? `style="background:${item.color}"` : ""}>${item.label}</button>`;
      })
      .join("");

    wrap.querySelectorAll(".route-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRouteFilter = btn.dataset.route;
        if (selectedBusId) clearSelectedBus();
        renderRoutePills();
        applyRouteLayerFilter();
        syncBusesWebGLLayer();
        renderFleetList();
        if (
          map &&
          (selectedRouteFilter === "BLR" ||
            selectedRouteFilter === "BLR_AC" ||
            selectedRouteFilter.startsWith("BLR-"))
        ) {
          map.flyTo({ ...LANDMARKS.corridor, pitch: 0, bearing: 0, duration: 850 });
        }
      });
    });
  }

  function renderFleetList() {
    const list = document.getElementById("fleetList");
    if (!list) return;
    const prevScroll = list.scrollTop;
    const query = (document.getElementById("fleetSearch")?.value || "").trim().toLowerCase();
    const now = performance.now();
    const traffic = getTrafficState();

    const visible = getVisibleFleet().filter((b) => {
      if (!query) return true;
      const stopDisp = getBusNextStopDisplay(b).toLowerCase();
      return (
        b.routeId.toLowerCase().includes(query) ||
        b.reg.toLowerCase().includes(query) ||
        (b.livery || "").toLowerCase().includes(query) ||
        stopDisp.includes(query) ||
        (query === "ac" && b.isAC)
      );
    });

    list.innerHTML = visible
      .map((b) => {
        const isNew = b.isNewUntil && b.isNewUntil > now;
        const adjEta = Math.max(1, Math.round((b.etaMin || 2) * traffic.multiplier));
        return `
        <div class="bus-card ${b.id === selectedBusId ? "selected" : ""}" data-id="${b.id}">
          <div class="bus-card-top">
            <div>
              <span class="route-tag" style="background:${b.color}">${b.routeId}</span>
              ${b.isAC ? `<span class="ac-pill">AC</span>` : ""}
              ${isNew ? `<span class="new-pill">NEW</span>` : ""}
              <span class="bus-reg">${b.reg}</span>
            </div>
            <span class="speed-pill ${b.speedKmh === 0 ? "stopped" : ""}">
              ${b.speedKmh > 0 ? `${b.speedKmh} km/h` : "STOPPED"}
            </span>
          </div>
          <div class="bus-card-sub">
            <span>${escHtml(getBusNextStopDisplay(b))}</span>
            <span>ETA ${adjEta}m</span>
          </div>
        </div>`;
      })
      .join("");

    list.scrollTop = prevScroll;
    list.querySelectorAll(".bus-card").forEach((card) => {
      card.addEventListener("click", () => selectBus(card.dataset.id, true));
    });
  }

  function renderRoutesTab() {
    const tabBtnRoutes = document.getElementById("tabBtnRoutes");
    if (tabBtnRoutes) tabBtnRoutes.textContent = `Routes`;

    const strip = document.getElementById("trafficStatusStrip");
    const traffic = getTrafficState();
    if (strip) {
      strip.innerHTML = `
        <span style="color:${traffic.color}">● ${traffic.level}</span>
        <span style="color:var(--muted);font-size:10.5px;">ETA Factor: ${traffic.multiplier}×</span>
      `;
    }

    const container = document.getElementById("routesList");
    if (!container) return;

    container.innerHTML = ROUTES.map((r) => {
      const activeCount = fleet.filter((b) => b.routeId === r.id).length;
      const sched = getScheduleInfo(r.id);
      return `
        <div class="route-card">
          <div class="route-card-head" data-filter-route="${r.id}">
            <div>
              <span class="route-tag" style="background:${r.color}">${r.id}</span>
              ${r.isAC ? `<span class="ac-pill">AC</span>` : ""}
              <span style="font-size:11px;color:var(--muted)">${r.livery}</span>
              <div class="route-card-title">${r.name}</div>
            </div>
            <span style="font-size:11px;color:var(--emerald);font-weight:800;white-space:nowrap">${activeCount} Live</span>
          </div>
          <div class="timetable-box">
            <div class="timetable-meta">
              <span>${sched.windowLabel}</span>
              <span>Every ${sched.freqMin}m</span>
            </div>
            <div class="timetable-deps">
              <span style="color:var(--muted)">Next:</span>
              ${sched.upcoming.map((t) => `<span class="dep-chip">${t}</span>`).join("")}
              <div class="card-action-group">
                <button class="gmaps-mini-btn" data-gmaps-route="${r.id}">Maps ↗</button>
                <button class="share-mini-btn" data-share-route="${r.id}">Share</button>
              </div>
            </div>
          </div>
          <div class="route-stops">
            ${r.stops.map((s) => `<div class="route-stop-row"><span>${escHtml(formatStopText(s))}</span><span>●</span></div>`).join("")}
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll("[data-filter-route]").forEach((el) => {
      el.addEventListener("click", () => {
        selectedRouteFilter = el.dataset.filterRoute;
        if (selectedBusId) clearSelectedBus();
        renderRoutePills();
        applyRouteLayerFilter();
        syncBusesWebGLLayer();
        hideDrawer();
        if (map) {
          const target = selectedRouteFilter.startsWith("BLR-") ? LANDMARKS.corridor : LANDMARKS.tumkur;
          map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 850 });
        }
      });
    });

    container.querySelectorAll("[data-gmaps-route]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const r = ROUTES.find((rt) => rt.id === btn.dataset.gmapsRoute);
        if (r) openRouteInGoogleMaps(r);
      });
    });

    container.querySelectorAll("[data-share-route]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        copyOrShareUrl({ route: btn.dataset.shareRoute }, `Route ${btn.dataset.shareRoute} Live Map`);
      });
    });
  }

  function renderArrivalBoard() {
    const stopSel = document.getElementById("stopSelect");
    const board = document.getElementById("arrivalBoard");
    if (!stopSel || !board) return;

    const stop = findStop(stopSel.value) || STOPS[0];
    const traffic = getTrafficState();
    const servingSet = new Set(stop.routeIds || []);
    const candidates = fleet.filter((b) => servingSet.size === 0 || servingSet.has(b.routeId));
    const pool = candidates.length > 0 ? candidates : fleet;

    const arrivals = pool
      .map((bus) => {
        const distM = haversineMeters([bus.lng, bus.lat], stop.coord);
        const speedMps = Math.max(5, ((bus.speedKmh || 28) * 1000) / 3600);
        const mins = Math.max(1, Math.round((distM / speedMps / 60) * traffic.multiplier));
        return { bus, distKm: (distM / 1000).toFixed(1), mins };
      })
      .sort((a, b) => a.mins - b.mins)
      .slice(0, 10);

    board.innerHTML = `
      <div class="board-title">LIVE ARRIVALS · ${escHtml(formatStopText(stop))}</div>
      ${arrivals
        .map(
          ({ bus, distKm, mins }) => `
        <div class="board-row">
          <span class="route-tag" style="background:${bus.color};text-align:center;margin:0">${bus.routeId}</span>
          <div>
            <div style="font-weight:700">${bus.reg} ${bus.isAC ? `<span class="ac-pill">AC</span>` : ""}</div>
            <div style="font-size:10.5px;color:var(--muted)">${distKm} km away · ${bus.livery}</div>
          </div>
          <div class="board-eta">${mins <= 1 ? "DUE" : `${mins}m`}</div>
        </div>`
        )
        .join("")}
    `;
  }

  function initStopBoardAndFares() {
    const stopSel = document.getElementById("stopSelect");
    populateStopDropdown(stopSel, null, "ksrtc");
    stopSel.addEventListener("change", renderArrivalBoard);

    const fareFrom = document.getElementById("fareFromSelect");
    const fareTo = document.getElementById("fareToSelect");
    const farePass = document.getElementById("farePassengerSelect");
    populateStopDropdown(fareFrom, null, "ksrtc");
    populateStopDropdown(fareTo, null, "majestic");

    fareFrom.addEventListener("change", renderTripAndFares);
    fareTo.addEventListener("change", renderTripAndFares);
    farePass.addEventListener("change", renderTripAndFares);

    on("btnSwapFareStops", "click", () => {
      const tmp = fareFrom.value;
      fareFrom.value = fareTo.value;
      fareTo.value = tmp;
      renderTripAndFares();
    });

    on("btnSaveCommute", "click", () => {
      const f = findStop(fareFrom.value);
      const t = findStop(fareTo.value);
      if (!f || !t || f.id === t.id) return showToast("Pick two different stops.");
      const id = `c-${f.id}-${t.id}`;
      if (savedCommutes.some((c) => c.id === id)) return showToast("Already saved.");
      const label = `${f.name.split(" ")[0]} → ${t.name.split(" ")[0]}`;
      savedCommutes.push({ id, label, fromId: f.id, toId: t.id });
      saveCommutesList(savedCommutes);
      renderSavedCommutes();
      showToast(`Saved "${label}"!`);
    });

    on("btnCheckFareFromStop", "click", () => {
      fareFrom.value = stopSel.value;
      if (fareTo.value === stopSel.value) fareTo.value = stopSel.value === "majestic" ? "ksrtc" : "majestic";
      switchTab("fares");
    });

    document.getElementById("gpsRouteSelect").innerHTML = ROUTES.map(
      (r) => `<option value="${r.id}">${r.id}${r.isAC ? " [AC]" : ""} — ${r.name}</option>`
    ).join("");

    renderSavedCommutes();
  }

  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), 3200);
  }

  function updateFleetCounters(suffix = "Direct Live") {
    document.getElementById("tabBtnFleet").textContent = `Fleet (${fleet.length})`;
    document.getElementById("dockFleetLabel").textContent = `Fleet (${fleet.length})`;
    document.getElementById("feedStatusText").textContent = `${fleet.length} Live · ${suffix}`;
  }

  function updateFollowButton() {
    const btn = document.getElementById("btnFollowBus");
    btn.classList.toggle("active-follow", followBusActive);
    btn.textContent = followBusActive ? "Following" : "Follow Bus";
  }

  // --- Event Listeners ---
  on("btnOpenDrawerFleet", "click", () => openDrawer("fleet"));
  on("btnOpenDrawerRoutes", "click", () => openDrawer("routes"));
  on("btnOpenDrawerPlan", "click", () => openDrawer("fares"));
  on("btnHideDrawer", "click", hideDrawer);
  on("drawerGrip", "click", hideDrawer);
  initMobileDrawerSwipe();

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  on("fleetSearch", "input", renderFleetList);

  document.querySelectorAll("[data-style]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-style]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentStyleName = btn.dataset.style;
      if (map) map.setStyle(MAP_STYLES[currentStyleName]);
    });
  });

  // Settings Modal
  on("btnOpenSettings", "click", () => document.getElementById("settingsModal").classList.remove("hidden"));
  on("btnCloseSettings", "click", () => document.getElementById("settingsModal").classList.add("hidden"));

  on("btnToggleStops", "click", (e) => {
    if (editStopsMode) setStopEditorMode(false);
    showStops = !showStops;
    e.target.classList.toggle("active", showStops);
    e.target.textContent = showStops ? "ON" : "OFF";
    setRouteStopMode(showStops);
    repositionFleetOnRoutes(fleet);
    updateRouteSourceData();
    syncBusesWebGLLayer();
    initStopMarkers();
    if (selectedBusId) {
      const b = fleet.find((x) => x.id === selectedBusId);
      if (b) updateInspectorMetrics(b);
    }
    showToast(showStops ? "Stops ON: Serving bus stops." : "Stops OFF: Direct road routes.");
  });

  on("btnToggleTraffic", "click", (e) => {
    showTraffic = !showTraffic;
    e.target.classList.toggle("active", showTraffic);
    e.target.textContent = showTraffic ? "ON" : "OFF";
    updateTrafficLayerVisibility();
  });

  on("btnLangToggle", "click", (e) => {
    const order = ["both", "kn", "en"];
    stopLangMode = order[(order.indexOf(stopLangMode) + 1) % order.length];
    const labels = { both: "EN + ಕನ್ನಡ", kn: "ಕನ್ನಡ", en: "English" };
    e.target.textContent = labels[stopLangMode];
    e.target.classList.toggle("active", stopLangMode !== "en");
    refreshStopLanguageUI();
  });

  on("btnScaleToggle", "click", (e) => {
    largeBusIcons = !largeBusIcons;
    e.target.classList.toggle("active", largeBusIcons);
    e.target.textContent = largeBusIcons ? "Large" : "Compact";
    applyBusIconSizeExpression();
  });

  // Locate Me + Closest Approaching Buses
  on("btnLocateMe", "click", (e) => {
    if (!navigator.geolocation) return showToast("Geolocation unavailable.");
    if (!map) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    followBusActive = false;
    updateFollowButton();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        myLocationCoord = [pos.coords.longitude, pos.coords.latitude];
        if (!myLocationMarker) {
          const el = document.createElement("div");
          el.className = "my-location-dot";
          myLocationMarker = new maplibregl.Marker({ element: el }).setLngLat(myLocationCoord).addTo(map);
        } else {
          myLocationMarker.setLngLat(myLocationCoord);
        }
        map.flyTo({ center: myLocationCoord, zoom: 15.5, pitch: 0, bearing: 0, duration: 850 });
        nearbyBarOpen = true;
        document.getElementById("nearbyBusesBar").classList.remove("hidden");
        renderNearbyApproachingBuses();
        btn.disabled = false;
        showToast(`Centered on your GPS (±${Math.round(pos.coords.accuracy)} m)`);
      },
      (err) => {
        btn.disabled = false;
        showToast(err.code === 1 ? "Location permission denied." : "Could not get GPS fix.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  });

  on("btnCloseNearbyBar", "click", () => {
    nearbyBarOpen = false;
    document.getElementById("nearbyBusesBar").classList.add("hidden");
  });

  // Stop Editor
  on("btnOpenEditStops", "click", () => setStopEditorMode(!editStopsMode));
  on("btnEditorDone", "click", () => setStopEditorMode(false));
  on("btnEditorAddMode", "click", (e) => {
    addStopSubMode = !addStopSubMode;
    e.target.classList.toggle("active", addStopSubMode);
    mapEl.classList.toggle("picking-location", addStopSubMode);
    if (addStopSubMode) showToast("Tap anywhere on the map to add a stop.");
  });
  on("btnEditorExport", async () => {
    const json = exportStopsSnippet(STOPS);
    try {
      await navigator.clipboard.writeText(json);
      showToast("Stop JSON copied to clipboard!");
    } catch {
      window.prompt("Copy Stop JSON:", json);
    }
  });
  on("btnEditorReset", () => {
    clearStopOverrides();
    showToast("Resetting custom stop edits...");
    setTimeout(() => window.location.reload(), 650);
  });

  // Quick Jump Landmarks & Nearest Stop
  document.querySelectorAll("[data-fly]").forEach((btn) => {
    btn.addEventListener("click", () => {
      followBusActive = false;
      updateFollowButton();
      const target = LANDMARKS[btn.dataset.fly];
      if (target && map) map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 850 });
    });
  });

  on("btnNearestStop", "click", () => {
    document.getElementById("settingsModal").classList.add("hidden");
    if (!navigator.geolocation) return showToast("Geolocation unavailable.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoord = [pos.coords.longitude, pos.coords.latitude];
        let nearest = STOPS[0];
        let bestDist = Infinity;
        STOPS.forEach((s) => {
          const d = haversineMeters(userCoord, s.coord);
          if (d < bestDist) {
            bestDist = d;
            nearest = s;
          }
        });
        document.getElementById("stopSelect").value = nearest.id;
        openDrawer("stops");
        if (map) map.flyTo({ center: nearest.coord, zoom: 15.5, duration: 850 });
        showToast(`Nearest stop: ${formatStopText(nearest)}`);
      },
      () => showToast("Location permission denied.")
    );
  });

  // Bus Sheet, Google Maps Launch, Wake-Me, Pass-By, Feed Modals
  on("btnCloseInspector", "click", clearSelectedBus);
  on("btnClearSelectedRoute", "click", clearSelectedBus);
  on("btnFollowBus", "click", () => {
    followBusActive = !followBusActive;
    updateFollowButton();
  });
  on("btnOpenBusGmaps", "click", () => {
    const bus = fleet.find((b) => b.id === selectedBusId);
    if (bus) openBusInGoogleMaps(bus);
  });
  on("btnShareBus", "click", () => {
    const bus = fleet.find((b) => b.id === selectedBusId);
    if (bus) copyOrShareUrl({ bus: bus.id, route: bus.routeId }, `Bus ${bus.routeId} (${bus.reg})`);
  });
  on("btnAlertThisRoute", "click", () => {
    const bus = fleet.find((b) => b.id === selectedBusId);
    if (bus) document.getElementById("alertFleetSelect").value = bus.routeId;
    document.getElementById("alertModal").classList.remove("hidden");
  });

  on("btnOpenWakeModal", "click", () => document.getElementById("wakeModal").classList.remove("hidden"));
  on("btnCloseWakeModal", "click", () => document.getElementById("wakeModal").classList.add("hidden"));
  on("btnArmWake", "click", armWakeMeAlarm);
  on("btnDisableWake", "click", () => disableWakeMeAlarm(false));
  on("btnStopWakeQuick", "click", () => disableWakeMeAlarm(false));
  on("btnDismissWakeAlert", "click", () => disableWakeMeAlarm(false));

  on("btnOpenAlertModal", "click", () => {
    if (!alertConfig.active && selectedRouteFilter) {
      document.getElementById("alertFleetSelect").value = selectedRouteFilter;
    }
    document.getElementById("alertModal").classList.remove("hidden");
  });
  on("btnCloseAlertModal", "click", () => document.getElementById("alertModal").classList.add("hidden"));
  on("btnAlertUseGps", "click", () => {
    if (!navigator.geolocation) return showToast("Geolocation unavailable.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserAlertLocation([pos.coords.longitude, pos.coords.latitude], "My Live GPS");
        showToast("Live GPS set for alert.");
      },
      () => showToast("GPS denied — tap the map or pick a stop.")
    );
  });
  on("btnAlertPickMap", "click", () => {
    pickingAlertOnMap = true;
    mapEl.classList.add("picking-location");
    document.getElementById("alertModal").classList.add("hidden");
    showToast("Tap anywhere on the map to set your alert location.");
  });
  on("btnArmAlert", "click", armPassByAlert);
  on("btnDisableAlert", "click", disablePassByAlert);
  on("btnStopAlertQuick", "click", disablePassByAlert);
  on("btnDismissPassAlert", "click", () => document.getElementById("passAlertBanner").classList.add("hidden"));
  on("btnLocateAlertBus", "click", () => {
    if (lastAlertBusId) {
      selectBus(lastAlertBusId, true);
      document.getElementById("passAlertBanner").classList.add("hidden");
    }
  });

  on("btnOpenFeedModal", "click", () => {
    document.getElementById("settingsModal").classList.add("hidden");
    document.getElementById("feedModal").classList.remove("hidden");
  });
  on("btnCloseFeedModal", "click", () => document.getElementById("feedModal").classList.add("hidden"));

  on("btnConnectApi", "click", async () => {
    const url = document.getElementById("apiUrlInput").value.trim();
    if (!url) return showToast("Enter a valid JSON URL.");
    clearInterval(apiPollTimer);
    isExternalApiMode = true;

    const poll = async () => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid format");
        const existingMap = new Map(fleet.map((b) => [b.id, b]));
        const now = performance.now();
        let newlyLiveCount = 0;

        fleet = data.map((item, idx) => {
          const id = String(item.id || `live-${idx}`);
          const prev = existingMap.get(id);
          const matchedRoute = ROUTES.find((rt) => rt.id === String(item.routeId));
          const lat = Number(item.lat);
          const lng = Number(item.lng);
          if (!prev) newlyLiveCount++;

          let heading = Number(item.heading);
          if (Number.isNaN(heading)) {
            heading =
              prev && haversineMeters([prev.lng, prev.lat], [lng, lat]) > 5
                ? bearingDegrees([prev.lng, prev.lat], [lng, lat])
                : prev?.heading || 0;
          }

          return {
            id,
            routeId: matchedRoute ? matchedRoute.id : String(item.routeId || "LIVE"),
            category: matchedRoute ? matchedRoute.category : "city",
            isAC: item.isAC !== undefined ? Boolean(item.isAC) : Boolean(matchedRoute?.isAC),
            color: matchedRoute ? matchedRoute.color : "#2563eb",
            accent: matchedRoute ? matchedRoute.accent : "#dbeafe",
            livery: item.livery || matchedRoute?.livery || "Live Feed",
            reg: item.reg || `LIVE-${idx + 1}`,
            lng: prev ? prev.lng : lng,
            lat: prev ? prev.lat : lat,
            targetLng: lng,
            targetLat: lat,
            heading,
            speedKmh: Math.round(Number(item.speed) || 0),
            braking: (Number(item.speed) || 0) < 5,
            crowd: item.crowd || "Live",
            nextStopId: null,
            nextStopName: item.nextStop || "Live GPS",
            etaMin: item.etaMin || 2,
            isExternal: true,
            isNewUntil: !prev ? now + 9000 : prev.isNewUntil || 0
          };
        });

        updateFleetCounters("Live API (3s)");
        syncBusesWebGLLayer();
        if (drawerOpen) renderFleetList();
        if (newlyLiveCount > 0 && existingMap.size > 0) {
          showToast(`${newlyLiveCount} new bus${newlyLiveCount > 1 ? "es" : ""} live!`);
        }
      } catch {
        showToast("Could not load JSON feed (check CORS/URL).");
      }
    };

    await poll();
    apiPollTimer = setInterval(poll, 3000);
    document.getElementById("feedModal").classList.add("hidden");
  });

  on("btnToggleGps", "click", (e) => {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
      fleet = fleet.filter((b) => b.id !== "my-gps-bus");
      e.target.textContent = "Start GPS";
      syncBusesWebGLLayer();
      showToast("GPS broadcast stopped.");
      return;
    }
    if (!navigator.geolocation) return showToast("Geolocation unavailable.");
    const r = ROUTES.find((rt) => rt.id === document.getElementById("gpsRouteSelect").value) || ROUTES[0];

    gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { longitude, latitude, heading, speed } = pos.coords;
        let myBus = fleet.find((b) => b.id === "my-gps-bus");
        if (!myBus) {
          myBus = {
            id: "my-gps-bus",
            routeId: r.id,
            category: r.category,
            isAC: Boolean(r.isAC),
            color: r.color,
            accent: r.accent,
            livery: r.livery,
            reg: "MY-GPS-LIVE",
            lng: longitude,
            lat: latitude,
            targetLng: longitude,
            targetLat: latitude,
            heading: heading || 0,
            speedKmh: Math.round((speed || 0) * 3.6),
            braking: false,
            crowd: "Live GPS",
            nextStopId: null,
            nextStopName: "Device GPS",
            etaMin: 1,
            isExternal: true,
            isNewUntil: performance.now() + 9000
          };
          fleet.unshift(myBus);
        } else {
          myBus.targetLng = longitude;
          myBus.targetLat = latitude;
          if (heading != null && !Number.isNaN(heading)) myBus.heading = heading;
          myBus.speedKmh = Math.round((speed || 0) * 3.6);
        }
        updateFleetCounters(`Broadcasting GPS (${r.id})`);
        selectBus("my-gps-bus", true);
      },
      () => showToast("Unable to read GPS."),
      { enableHighAccuracy: true }
    );

    e.target.textContent = "Stop GPS";
    document.getElementById("feedModal").classList.add("hidden");
  });

  on("btnResetSim", "click", () => {
    clearInterval(apiPollTimer);
    isExternalApiMode = false;
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
    fleet = createInitialFleet();
    clearSelectedBus();
    syncBusesWebGLLayer();
    updateFleetCounters("Direct Roads");
    renderRoutePills();
    document.getElementById("feedModal").classList.add("hidden");
    showToast("Back to simulated fleet.");
  });

  // PWA Install & Service Worker
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById("btnInstallPwa").classList.remove("hidden");
  });

  on("btnInstallPwa", "click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById("btnInstallPwa").classList.add("hidden");
  });

  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // =========================================================================
  // 1. BOOT UI & MAP
  // =========================================================================
  updateFleetCounters("Aligning roads...");
  initAlertModalOptions();
  renderRoutePills();
  initStopBoardAndFares();

  if (typeof maplibregl === "undefined") {
    showStatusError("MapLibre failed to load. Check internet.");
  } else {
    map = new maplibregl.Map({
      container: "map",
      style: MAP_STYLES.street,
      center: TUMKUR_CENTER,
      zoom: 13.4,
      pitch: 0,
      maxPitch: 0,
      bearing: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      antialias: true
    });

    map.touchZoomRotate.disableRotation();
    map.on("style.load", attachMapLayers);

    map.on("zoomstart", () => { isZooming = true; });
    map.on("zoomend", () => {
      isZooming = false;
      syncStopLabelZoomClass();
      syncBusesWebGLLayer();
    });
    map.on("movestart", () => { isMapMoving = true; });
    map.on("moveend", () => { isMapMoving = false; });
    syncStopLabelZoomClass();

    const handleBusLayerTap = (e) => {
      if (pickingAlertOnMap || (editStopsMode && addStopSubMode)) return;
      const feat = e.features && e.features[0];
      if (feat && feat.properties && feat.properties.id) {
        e.originalEvent.stopPropagation();
        selectBus(feat.properties.id, false);
      }
    };

    map.on("click", "buses-icon", handleBusLayerTap);
    map.on("click", "buses-badge", handleBusLayerTap);
    map.on("mouseenter", "buses-icon", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "buses-icon", () => (map.getCanvas().style.cursor = ""));
    map.on("mouseenter", "buses-badge", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "buses-badge", () => (map.getCanvas().style.cursor = ""));

    map.on("click", (e) => {
      if (editStopsMode && addStopSubMode) {
        addStopSubMode = false;
        document.getElementById("btnEditorAddMode").classList.remove("active");
        mapEl.classList.remove("picking-location");
        const enName = window.prompt("New Bus Stop Name (English):", "New Tumakuru Stop");
        if (!enName || !enName.trim()) return;
        const knName = window.prompt("Kannada Name (optional):", enName.trim()) || enName.trim();
        const newStop = {
          id: `custom-${Date.now()}`,
          name: enName.trim(),
          kn: knName.trim(),
          coord: [e.lngLat.lng, e.lngLat.lat],
          major: true,
          pinned: true,
          routeIds: []
        };
        recordAddedStop(newStop, STOPS);
        initStopMarkers();
        refreshStopLanguageUI();
        showToast(`Added "${newStop.name}"!`);
        return;
      }

      if (pickingAlertOnMap) {
        pickingAlertOnMap = false;
        mapEl.classList.remove("picking-location");
        setUserAlertLocation([e.lngLat.lng, e.lngLat.lat], "Pinned Location");
        document.getElementById("alertModal").classList.remove("hidden");
        showToast("Alert location pinned.");
      }
    });

    applyDeepLinkFromUrl();
  }

  // =========================================================================
  // 2. AUTO-DISPATCH & SMOOTH STUTTER-FREE ANIMATION LOOP
  // =========================================================================
  setInterval(() => {
    if (isExternalApiMode) return;
    const newBus = spawnLiveBus();
    fleet.unshift(newBus);

    if (fleet.length > 92) {
      const retireIdx = fleet.findIndex(
        (b) => b.id !== selectedBusId && !b.isExternal && b.id !== newBus.id
      );
      if (retireIdx > -1) fleet.splice(retireIdx, 1);
    }

    updateFleetCounters(`New ${newBus.routeId} live`);
    if (drawerOpen) {
      renderRoutePills();
      if (activeTab === "fleet") renderFleetList();
    }
    if (!isZooming) syncBusesWebGLLayer();
  }, 15000);

  let lastTime = performance.now();
  let lastGeoSync = 0;
  let lastUiTick = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    stepFleet(fleet, dt, showStops);

    if (!isZooming && now - lastGeoSync >= 50) {
      lastGeoSync = now;
      syncBusesWebGLLayer();
    }

    if (selectedBusId) {
      const activeBus = fleet.find((b) => b.id === selectedBusId);
      if (activeBus) {
        if (followBusActive && map && !isZooming) {
          map.easeTo({
            center: [activeBus.lng, activeBus.lat],
            pitch: 0,
            bearing: 0,
            duration: 280,
            easing: (t) => t
          });
        }
        if (now - lastUiTick > 600) {
          updateInspectorMetrics(activeBus);
        }
        if (wakeConfig.active && wakeConfig.mode === "selectedBus") {
          evaluateWakeMePosition([activeBus.lng, activeBus.lat]);
        }
      }
    }

    if (now - lastUiTick > 1100) {
      lastUiTick = now;
      evaluatePassByAlerts(now);
      if (!isMapMoving && !isZooming) {
        if (nearbyBarOpen) renderNearbyApproachingBuses();
        if (drawerOpen) {
          if (activeTab === "fleet") renderFleetList();
          if (activeTab === "stops") renderArrivalBoard();
        }
      }
    }
  }

  requestAnimationFrame(loop);

  // =========================================================================
  // 3. SNAP ROUTES TO REAL OSM ROADS
  // =========================================================================
  snapRoutesToRealRoads((route, done, total) => {
    repositionFleetOnRoutes(fleet, route.id);
    updateRouteSourceData();
    if (!isZooming) syncBusesWebGLLayer();
    syncStopMarkerPositions();
    if (drawerOpen && activeTab === "fares") renderTripAndFares();
    updateFleetCounters(
      done < total
        ? `Snapping roads (${done}/${total})...`
        : showStops
          ? "Serving Stops"
          : "Direct Roads"
    );
  }).then((snapped) => {
    if (snapped === 0) updateFleetCounters("Offline Fallback");
  });
})();
