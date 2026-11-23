(() => {
  function showStatusError(msg) {
    const statusEl = document.getElementById("feedStatusText");
    if (statusEl) statusEl.textContent = msg;
    const list = document.getElementById("fleetList");
    if (list && !list.innerHTML.trim()) {
      list.innerHTML = `<div style="padding:12px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px;line-height:1.5;"><strong>Startup Error:</strong> ${msg}</div>`;
    }
  }

  function on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  if (!window.TumkurData || !window.TumkurFeatures) {
    showStatusError("routes.js or features.js failed to load. Check all files are in the same folder.");
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

  // Apply any user-dragged / custom added stops saved in localStorage BEFORE map & fleet boot
  applySavedStopOverrides(STOPS, ROUTES);

  function findStop(id) {
    return STOPS.find((s) => s.id === id) || null;
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
          attribution: "© OpenStreetMap contributors"
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
          paint: { "raster-saturation": -0.25, "raster-contrast": 0.12 }
        },
        {
          id: "roads",
          type: "raster",
          source: "roads",
          paint: { "raster-opacity": 0.72, "raster-contrast": 0.3, "raster-saturation": 0.45 }
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
          attribution: "© Esri World Imagery"
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
        { id: "places", type: "raster", source: "places", paint: { "raster-opacity": 0.92 } }
      ]
    }
  };

  // Core App State
  let fleet = createInitialFleet();
  let savedCommutes = loadSavedCommutes();
  let selectedRouteFilter = "ALL";
  let selectedBusId = null;
  let followBusActive = false;
  let boostScale = true;
  let showStops = true;
  let showTraffic = true;
  let stopLangMode = "both"; // "both" | "kn" | "en"
  let isExternalApiMode = false;
  let apiPollTimer = null;
  let gpsWatchId = null;
  let currentStyleName = "street";

  // Locate Me & Closest Approaching Buses State
  let myLocationCoord = null;
  let myLocationMarker = null;
  let nearbyBarOpen = false;

  // Stop Editor State
  let editStopsMode = false;
  let addStopSubMode = false;

  // Pass-By Alert State
  let alertConfig = {
    active: false,
    fleetKey: "ALL",
    coord: null,
    locLabel: "",
    radiusMeters: 1000
  };
  let pickingAlertOnMap = false;
  let userAlertMarker = null;
  let lastAlertBusId = null;
  const alertPrevDist = new Map();
  const alertCooldowns = new Map();

  // Destination Drop-Off Alarm (Wake-Me) State
  let wakeConfig = {
    active: false,
    stopId: null,
    radiusMeters: 1000,
    mode: "gps", // "gps" | "selectedBus"
    triggered: false,
    watchId: null,
    alarmInterval: null
  };

  let audioCtx = null;
  let deferredInstallPrompt = null;

  const busMarkers = new Map();
  let stopMarkerEntries = [];
  let map = null;
  let inspector3D = null;
  const mapEl = document.getElementById("map");

  // --- Audio & Notification Helpers ---
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

  function getInspector3D() {
    if (inspector3D) return inspector3D;
    if (!window.Bus3D || !window.THREE) return null;
    try {
      const canvas = document.getElementById("inspectorCanvas");
      if (!canvas) return null;
      inspector3D = new window.Bus3D.BusInspector3D(canvas);
      return inspector3D;
    } catch (err) {
      console.warn("3D Inspector WebGL fallback:", err);
      return null;
    }
  }

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
        dest
          ? makeCircleGeoJSON(dest.coord, wakeConfig.radiusMeters)
          : { type: "FeatureCollection", features: [] }
      );
    }
  }

  function updateTrafficLayerVisibility() {
    if (!map) return;
    const vis = showTraffic ? "visible" : "none";
    if (map.getLayer("traffic-fill")) map.setLayoutProperty("traffic-fill", "visibility", vis);
    if (map.getLayer("traffic-border")) map.setLayoutProperty("traffic-border", "visibility", vis);
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

  function updateRouteSourceData() {
    if (!map) return;
    const src = map.getSource("tumkur-routes");
    if (src) src.setData(buildRouteGeoJSON());
  }

  function attachMapLayers() {
    if (!map) return;

    // 1. Traffic Bottleneck Zones
    map.addSource("traffic-zones", {
      type: "geojson",
      data: buildBottleneckGeoJSON()
    });
    map.addLayer({
      id: "traffic-fill",
      type: "fill",
      source: "traffic-zones",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.14 }
    });
    map.addLayer({
      id: "traffic-border",
      type: "line",
      source: "traffic-zones",
      paint: { "line-color": ["get", "color"], "line-width": 2, "line-dasharray": [3, 2] }
    });
    updateTrafficLayerVisibility();

    // 2. Pass-By Alert Zone & Wake-Me Destination Zone
    map.addSource("alert-zone", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "alert-zone-fill", type: "fill", source: "alert-zone", paint: { "fill-color": "#d97706", "fill-opacity": 0.14 } });
    map.addLayer({ id: "alert-zone-border", type: "line", source: "alert-zone", paint: { "line-color": "#d97706", "line-width": 2.2, "line-dasharray": [3, 2] } });

    map.addSource("wake-zone", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "wake-zone-fill", type: "fill", source: "wake-zone", paint: { "fill-color": "#6d28d9", "fill-opacity": 0.16 } });
    map.addLayer({ id: "wake-zone-border", type: "line", source: "wake-zone", paint: { "line-color": "#6d28d9", "line-width": 2.4, "line-dasharray": [4, 2] } });
    updateAlertZoneLayer();

    // 3. Highlighted Bus Routes (Glow + High-Contrast White Casing + Vivid Core)
    map.addSource("tumkur-routes", {
      type: "geojson",
      data: buildRouteGeoJSON()
    });

    map.addLayer({
      id: "routes-glow",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 14,
        "line-blur": 6,
        "line-opacity": 0.42
      }
    });

    map.addLayer({
      id: "routes-casing",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": currentStyleName === "satellite" ? 8.5 : 7.5,
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
        "line-width": 4.8,
        "line-opacity": 1.0
      }
    });

    // 4. Three.js 3D Buses Custom WebGL Layer
    if (window.Bus3D && window.THREE) {
      try {
        const busLayer = window.Bus3D.createMapBusLayer({
          originLng: TUMKUR_CENTER[0],
          originLat: TUMKUR_CENTER[1],
          getFleet: () => getVisibleFleet(),
          getBoostScale: () => boostScale,
          getSelectedBusId: () => selectedBusId
        });
        map.addLayer(busLayer);
      } catch (err) {
        console.warn("3D bus layer warning:", err);
      }
    }

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
      map.setPaintProperty("routes-core", "line-width", 6.5);
      map.setPaintProperty("routes-casing", "line-width", 10.5);
      if (map.getLayer("routes-glow")) {
        map.setPaintProperty("routes-glow", "line-width", 18);
        map.setPaintProperty("routes-glow", "line-opacity", 0.58);
      }
    } else {
      map.setPaintProperty("routes-core", "line-width", 4.8);
      map.setPaintProperty("routes-casing", "line-width", currentStyleName === "satellite" ? 8.5 : 7.5);
      if (map.getLayer("routes-glow")) {
        map.setPaintProperty("routes-glow", "line-width", 14);
        map.setPaintProperty("routes-glow", "line-opacity", 0.42);
      }

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

  // --- Bus Stop Markers & Drag-and-Drop Stop Editor ---
  function initStopMarkers() {
    if (!map) return;
    stopMarkerEntries.forEach(({ marker }) => marker.remove());

    stopMarkerEntries = STOPS.map((stop) => {
      const el = document.createElement("div");
      el.className = `bus-stop-pin ${stop.major ? "major" : ""} ${editStopsMode ? "draggable-edit" : ""}`;
      el.innerHTML = `<span class="bus-stop-dot">B</span><span class="bus-stop-label">${formatStopPinHtml(stop)}</span>`;

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (editStopsMode) {
          showToast(`Drag "${stop.name}" directly on the map to adjust its position.`);
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
          switchTab("stops");
        }
        const rList = (stop.routeIds || []).length ? stop.routeIds.join(", ") : "Custom Stop";
        showToast(`${formatStopText(stop)} · ${rList}`);
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
        const newCoord = [pos.lng, pos.lat];
        recordMovedStop(stop.id, newCoord, STOPS, ROUTES);
        renderTripAndFares();
        renderArrivalBoard();
        showToast(`Saved "${stop.name}" → ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
      });

      return { stop, el, marker };
    });

    const activeBus = selectedBusId ? fleet.find((b) => b.id === selectedBusId) : null;
    syncStopMarkerHighlight(activeBus ? activeBus.routeId : null);
  }

  function setStopEditorMode(active) {
    editStopsMode = active;
    addStopSubMode = false;
    mapEl.classList.remove("picking-location");
    document.getElementById("btnOpenEditStops").classList.toggle("active", editStopsMode);
    document.getElementById("stopEditorBar").classList.toggle("hidden", !editStopsMode);
    document.getElementById("btnEditorAddMode").classList.remove("active");

    if (editStopsMode && !showStops) {
      // Automatically show stops so the user can drag them
      showStops = true;
      const btn = document.getElementById("btnToggleStops");
      btn.classList.add("active");
      btn.textContent = "Stops: ON";
      setRouteStopMode(true);
      updateRouteSourceData();
    }

    stopMarkerEntries.forEach(({ el, marker }) => {
      marker.setDraggable(editStopsMode);
      el.classList.toggle("draggable-edit", editStopsMode);
      el.classList.toggle("stops-hidden", !showStops);
    });

    if (editStopsMode) {
      showToast("Stop Editor ON: Drag any stop pin to its exact spot.");
    }
  }

  function syncStopMarkerPositions() {
    stopMarkerEntries.forEach(({ stop, marker }) => {
      const master = findStop(stop.id);
      if (master) marker.setLngLat(master.coord);
    });
  }

  function syncStopMarkerHighlight(activeRouteId) {
    stopMarkerEntries.forEach(({ stop, el }) => {
      el.classList.toggle("stops-hidden", !showStops);
      if (!activeRouteId) {
        el.classList.remove("route-active", "dimmed");
      } else {
        const onRoute = (stop.routeIds || []).includes(activeRouteId);
        el.classList.toggle("route-active", onRoute);
        el.classList.toggle("dimmed", !onRoute);
      }
    });
  }

  function populateStopDropdown(selectEl, includePlaceholder = null, defaultId = null) {
    if (!selectEl) return;
    const prevVal = selectEl.value;
    const opts = [];
    if (includePlaceholder) {
      opts.push(`<option value="">${includePlaceholder}</option>`);
    }
    STOPS.forEach((s) => {
      opts.push(`<option value="${s.id}">${escHtml(formatStopText(s))}</option>`);
    });
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
    populateStopDropdown(document.getElementById("alertStopSelect"), "— Or pick a Tumakuru / BLR stop as your location —");
    populateStopDropdown(document.getElementById("wakeStopSelect"), null, "majestic");
    populateStopDropdown(document.getElementById("fareFromSelect"), null, "ksrtc");
    populateStopDropdown(document.getElementById("fareToSelect"), null, "majestic");

    renderFleetList();
    renderRoutesTab();
    renderArrivalBoard();
    renderTripAndFares();

    if (selectedBusId) {
      const activeBus = fleet.find((b) => b.id === selectedBusId);
      if (activeBus) updateInspectorMetrics(activeBus);
    }
  }

  // --- Closest Approaching Buses (Locate Me) ---
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
      .sort((a, b) => {
        if (a.approaching !== b.approaching) return a.approaching ? -1 : 1;
        return a.dist - b.dist;
      })
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
            <div style="text-align:right;font-weight:800;color:var(--emerald)">~${etaMin} min</div>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll("[data-nearby-id]").forEach((row) => {
      row.addEventListener("click", () => selectBus(row.dataset.nearbyId, true));
    });
  }

  // --- Bus Markers & Selection ---
  function syncBusMarkers() {
    if (!map) return;
    const visible = getVisibleFleet();
    const visibleIds = new Set(visible.map((b) => b.id));
    const now = performance.now();

    for (const [id, marker] of busMarkers.entries()) {
      if (!visibleIds.has(id)) {
        marker.remove();
        busMarkers.delete(id);
      }
    }

    visible.forEach((bus) => {
      const isNew = Boolean(bus.isNewUntil && bus.isNewUntil > now);
      let marker = busMarkers.get(bus.id);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "bus-map-badge";
        el.style.background = bus.color;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          selectBus(bus.id, false);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([bus.lng, bus.lat])
          .addTo(map);
        busMarkers.set(bus.id, marker);
      } else {
        marker.setLngLat([bus.lng, bus.lat]);
      }

      const el = marker.getElement();
      el.classList.toggle("selected", bus.id === selectedBusId);
      el.classList.toggle("is-new", isNew);

      const expectedHtml = `${bus.routeId}${bus.isAC ? `<span class="badge-ac">AC</span>` : ""}${isNew ? `<span class="badge-new">NEW</span>` : ""}`;
      if (el.innerHTML !== expectedHtml) {
        el.innerHTML = expectedHtml;
      }
    });
  }

  function selectBus(busId, flyToBus = false) {
    const bus = fleet.find((b) => b.id === busId);
    if (!bus) return;

    selectedBusId = busId;
    document.getElementById("busInspector").classList.remove("hidden");

    const tag = document.getElementById("inspRouteTag");
    tag.textContent = bus.routeId;
    tag.style.background = bus.color;

    const acBadge = document.getElementById("inspAcBadge");
    if (acBadge) acBadge.classList.toggle("hidden", !bus.isAC);

    document.getElementById("inspReg").textContent = bus.reg;

    const routeObj = ROUTES.find((r) => r.id === bus.routeId);
    const banner = document.getElementById("selectedRouteBanner");
    if (banner) {
      const modeTag = showStops ? "" : " (Direct Route)";
      document.getElementById("selectedRouteText").textContent = routeObj
        ? `Route ${routeObj.id}${modeTag}: ${routeObj.name}`
        : `Route ${bus.routeId}${modeTag}`;
      banner.classList.remove("hidden");
    }

    const insp = getInspector3D();
    if (insp) {
      insp.resize();
      insp.setBus(bus);
    }

    updateInspectorMetrics(bus);
    applyRouteLayerFilter();
    renderFleetList();

    if (flyToBus && map) {
      map.flyTo({
        center: [bus.lng, bus.lat],
        zoom: Math.max(map.getZoom(), 15.2),
        pitch: 0,
        bearing: 0,
        duration: 800
      });
    }
  }

  function clearSelectedBus() {
    selectedBusId = null;
    followBusActive = false;
    updateFollowButton();
    document.getElementById("busInspector").classList.add("hidden");
    const banner = document.getElementById("selectedRouteBanner");
    if (banner) banner.classList.add("hidden");
    applyRouteLayerFilter();
    renderFleetList();
  }

  function updateInspectorMetrics(bus) {
    const traffic = getTrafficState();
    const adjEta = Math.max(1, Math.round((bus.etaMin || 2) * traffic.multiplier));
    const svc = document.getElementById("inspService");
    if (svc) svc.textContent = bus.livery || (bus.isAC ? "AC Coach" : "City Bus");
    document.getElementById("inspSpeed").textContent =
      bus.speedKmh > 0 ? `${bus.speedKmh} km/h` : "At Stop";
    document.getElementById("inspNextStop").textContent = getBusNextStopDisplay(bus);
    const etaCrowd = document.getElementById("inspEtaCrowd");
    if (etaCrowd) {
      etaCrowd.textContent = `${adjEta} min · ${bus.crowd || "Moderate"}`;
    }
  }

  // --- Shareable Live Bus / Route Links ---
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
      showToast(`Live link copied! Share it to open ${titleText}.`);
    } catch {
      window.prompt("Copy this shareable live link:", shareUrl);
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
        showToast(`Opened shared live bus ${found.routeId} (${found.reg})`);
        return;
      }
    }

    if (routeParam && ROUTES.some((r) => r.id === routeParam)) {
      selectedRouteFilter = routeParam;
      renderRoutePills();
      applyRouteLayerFilter();
      renderFleetList();
      if (map) {
        const target = routeParam.startsWith("BLR-") ? LANDMARKS.corridor : LANDMARKS.tumkur;
        map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 900 });
      }
      showToast(`Opened shared Route ${routeParam}`);
      return;
    }

    if (fromParam && toParam && findStop(fromParam) && findStop(toParam)) {
      document.getElementById("fareFromSelect").value = fromParam;
      document.getElementById("fareToSelect").value = toParam;
      renderTripAndFares();
      switchTab("fares");
    }
  }

  // --- Saved Daily Commutes ---
  function renderSavedCommutes() {
    const bar = document.getElementById("savedCommutesBar");
    if (!bar) return;
    bar.innerHTML = savedCommutes
      .map(
        (c) => `
        <button class="commute-pill" data-commute-id="${c.id}" title="Open saved commute">
          <span>★ ${escHtml(c.label)}</span>
          <span class="commute-del" data-del-commute="${c.id}" title="Remove">✕</span>
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
        renderTripAndFares();
        switchTab("fares");
        const fromStop = findStop(item.fromId);
        if (fromStop && map) {
          map.flyTo({ center: fromStop.coord, zoom: 13.8, pitch: 0, bearing: 0, duration: 850 });
        }
      });
    });
  }

  // --- Point-to-Point Trip Planner + KSRTC Fare Estimator ---
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
      summaryEl.innerHTML = `<span>Select two different stops to plan your trip & compare KSRTC fares.</span>`;
      tripEl.innerHTML = "";
      fareEl.innerHTML = "";
      return;
    }

    const distKm = plan.fareEst ? plan.fareEst.distanceKm : "—";
    const trafficNote =
      plan.traffic.extraMin > 0
        ? `<span class="traffic-pill ${plan.traffic.state.severity === "heavy" ? "heavy" : ""}">+${plan.traffic.extraMin}m traffic (${plan.traffic.hotspots.map((h) => h.name.split(" ")[0]).slice(0, 2).join(", ")})</span>`
        : `<span class="free-pill">Traffic Clear</span>`;

    summaryEl.innerHTML = `
      <div class="summary-row">
        <span>Road Distance: <strong>${distKm} km</strong></span>
        ${trafficNote}
      </div>
      <div class="summary-row" style="font-size:11px;color:#1e40af;">
        <span>${plan.directOptions.length} direct route${plan.directOptions.length === 1 ? "" : "s"} found</span>
        <span>${plan.traffic.state.level}</span>
      </div>
    `;

    // Render Recommended Trip Plans (Direct + 1-Transfer)
    let tripHtml = `<div class="section-subhead">Recommended Live Trips</div>`;

    if (plan.directOptions.length) {
      tripHtml += plan.directOptions
        .map((opt) => {
          const r = opt.route;
          const nextStr = opt.nextBus
            ? `Next bus in <strong>${opt.nextBus.etaMin} min</strong> (${opt.nextBus.bus.reg})`
            : `Scheduled: ${opt.schedule.upcoming[0]}`;
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
                <button class="fare-route-btn" data-jump-route="${r.id}" style="background:${r.color}">Track Live</button>
              </div>
            </div>`;
        })
        .join("");
    }

    if (plan.transferOptions.length) {
      tripHtml += plan.transferOptions
        .map((opt) => {
          const priceStr = opt.fare === 0 ? "FREE" : `~₹${opt.fare}`;
          return `
            <div class="trip-card transfer">
              <div class="trip-top">
                <div>
                  <span class="route-tag" style="background:${opt.leg1.color}">${opt.leg1.id}</span>
                  → <span class="route-tag" style="background:${opt.leg2.color}">${opt.leg2.id}</span>
                  <strong>1 Transfer</strong>
                </div>
                <strong style="color:#92400e">${priceStr} · ~${opt.rideMin}m</strong>
              </div>
              <div class="trip-meta">
                <span>Change at <strong>${escHtml(formatStopText(opt.hubStop))}</strong></span>
                <button class="fare-route-btn" data-jump-route="${opt.leg1.id}" style="background:${opt.leg1.color}">Leg 1 Live</button>
              </div>
            </div>`;
        })
        .join("");
    }

    if (!plan.directOptions.length && !plan.transferOptions.length) {
      tripHtml += `<div class="trip-card"><span>Connect via Tumakuru KSRTC Stand for this stop pair.</span></div>`;
    }

    tripEl.innerHTML = tripHtml;

    // Render KSRTC Fare Comparison Cards
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
            const routeButtons =
              t.routeIds && t.routeIds.length > 0
                ? t.routeIds
                    .map((rid) => {
                      const rt = ROUTES.find((r) => r.id === rid);
                      return `<button class="fare-route-btn" data-jump-route="${rid}" style="background:${rt ? rt.color : "#334155"}">Live ${rid}</button>`;
                    })
                    .join("")
                : "";

            return `
              <div class="fare-card ${t.isAC ? "ac-tier" : "non-ac-tier"}">
                <div class="fare-card-top">
                  <div>
                    <div class="fare-service-name">
                      ${t.name} ${t.isAC ? `<span class="ac-pill">AC</span>` : ""}
                    </div>
                    <div class="fare-service-sub">${t.subtitle} · ~${adjDuration} min</div>
                  </div>
                  <div class="fare-price-box">${priceHtml}</div>
                </div>
                <div class="fare-route-chips">
                  <span style="font-size:10.5px;color:var(--muted)">${t.note}</span>
                  ${routeButtons}
                </div>
              </div>
            `;
          })
          .join("") +
        `<p class="fare-note">Calibrated to Karnataka's Nov 2026 KSRTC fares (₹10 min city · ₹100 Tumakuru–Bengaluru Express). Travel times include active NH-48 / Tumakuru bottlenecks.</p>`;
    } else {
      fareEl.innerHTML = "";
    }

    document.getElementById("tripAndFareScroll").querySelectorAll("[data-jump-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rid = btn.dataset.jumpRoute;
        selectedRouteFilter = rid;
        if (selectedBusId) clearSelectedBus();
        renderRoutePills();
        applyRouteLayerFilter();
        switchTab("fleet");
        renderFleetList();
        if (map) {
          const target = rid.startsWith("BLR-") ? LANDMARKS.corridor : LANDMARKS.tumkur;
          map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 900 });
        }
      });
    });
  }

  // --- Destination Drop-Off Alarm (Wake-Me Alert) ---
  function evaluateWakeMePosition(currentCoord) {
    if (!wakeConfig.active || !wakeConfig.stopId) return;
    const dest = findStop(wakeConfig.stopId);
    if (!dest) return;

    const dist = haversineMeters(currentCoord, dest.coord);
    const distStr = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
    const chipText = document.getElementById("activeWakeChipText");
    if (chipText) {
      chipText.textContent = `Wake-Me: ${dest.name} (${distStr} left)`;
    }

    if (dist <= wakeConfig.radiusMeters && !wakeConfig.triggered) {
      wakeConfig.triggered = true;
      const msg = `You are ${distStr} from ${formatStopText(dest)}. Get ready to get off!`;
      document.getElementById("wakeAlertMsg").textContent = msg;
      document.getElementById("wakeAlertBanner").classList.remove("hidden");

      // Repeating alarm chime + vibration until dismissed
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
      return showToast("First click a bus on the map to track, or switch source to My Live Phone GPS.");
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
        return showToast("GPS unavailable on this device. Switch to Selected Live Bus mode.");
      }
      wakeConfig.watchId = navigator.geolocation.watchPosition(
        (pos) => evaluateWakeMePosition([pos.coords.longitude, pos.coords.latitude]),
        () => showToast("Waiting for phone GPS fix for Wake-Me alarm..."),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    document.getElementById("wakeModal").classList.add("hidden");
    document.getElementById("activeWakeChip").classList.remove("hidden");
    document.getElementById("activeWakeChipText").textContent = `Wake-Me: ${dest.name} armed`;
    const btn = document.getElementById("btnOpenWakeModal");
    btn.classList.add("armed");
    btn.textContent = "Wake-Me: ON";
    updateAlertZoneLayer();
    if (map) {
      map.flyTo({ center: dest.coord, zoom: Math.max(map.getZoom(), 13.8), pitch: 0, bearing: 0, duration: 800 });
    }
    showToast(`Wake-Me alarm armed for ${formatStopText(dest)} (${radius >= 1000 ? radius / 1000 + " km" : radius + " m"}).`);
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
    const btn = document.getElementById("btnOpenWakeModal");
    btn.classList.remove("armed");
    btn.textContent = "Wake-Me";
    document.getElementById("wakeModal").classList.add("hidden");
    updateAlertZoneLayer();
    if (!silent) showToast("Wake-Me destination alarm stopped.");
  }

  // --- Pass-By Fleet Alert Engine ---
  function initAlertModalOptions() {
    const fleetSel = document.getElementById("alertFleetSelect");
    if (fleetSel) {
      fleetSel.innerHTML = [
        `<option value="ALL">All Live Buses (Tumakuru + Bengaluru)</option>`,
        `<option value="CITY">All Tumakuru City Buses</option>`,
        `<option value="BLR">All Buses to Bengaluru</option>`,
        `<option value="BLR_AC">All AC Buses to Bengaluru</option>`,
        ...ROUTES.map(
          (r) => `<option value="${r.id}">Route ${r.id}${r.isAC ? " [AC]" : ""} — ${r.name}</option>`
        )
      ].join("");
    }

    const stopSel = document.getElementById("alertStopSelect");
    populateStopDropdown(stopSel, "— Or pick a Tumakuru / BLR stop as your location —");
    if (stopSel) {
      stopSel.addEventListener("change", () => {
        const stop = findStop(stopSel.value);
        if (stop) setUserAlertLocation(stop.coord, formatStopText(stop));
      });
    }

    populateStopDropdown(document.getElementById("wakeStopSelect"), null, "majestic");
  }

  function setUserAlertLocation(coord, label) {
    alertConfig.coord = coord;
    alertConfig.locLabel = label;
    const statusEl = document.getElementById("alertLocStatus");
    if (statusEl) {
      statusEl.textContent = `Location set: ${label} (${coord[1].toFixed(4)}, ${coord[0].toFixed(4)})`;
    }

    if (map) {
      if (!userAlertMarker) {
        const el = document.createElement("div");
        el.className = "user-alert-pin";
        el.title = "Your Pass-By Alert Location";
        userAlertMarker = new maplibregl.Marker({ element: el })
          .setLngLat(coord)
          .addTo(map);
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

  function formatFleetKeyLabel(key) {
    if (key === "ALL") return "All Buses";
    if (key === "CITY") return "Tumakuru City";
    if (key === "BLR") return "BLR Buses";
    if (key === "BLR_AC") return "AC to BLR";
    return `Route ${key}`;
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

      const toUserBearing = bearingDegrees([bus.lng, bus.lat], alertConfig.coord);
      const diff = Math.abs(((toUserBearing - bus.heading + 540) % 360) - 180);
      const headingToward = diff <= 85;
      const closingIn = prev === undefined ? headingToward : dist < prev + 4;

      if (dist <= alertConfig.radiusMeters && headingToward && closingIn) {
        const lastAlerted = alertCooldowns.get(bus.id) || 0;
        if (now - lastAlerted > 75000) {
          alertCooldowns.set(bus.id, now);
          triggerPassByAlert(bus, dist);
        }
      }
    });

    const chipText = document.getElementById("activeAlertChipText");
    if (chipText) {
      if (nearestBus) {
        const distStr =
          nearestDist < 1000 ? `${Math.round(nearestDist)} m` : `${(nearestDist / 1000).toFixed(1)} km`;
        chipText.textContent =
          `Alert: ${formatFleetKeyLabel(alertConfig.fleetKey)} · Nearest ${nearestBus.routeId} (${distStr})`;
      } else {
        chipText.textContent = `Alert: ${formatFleetKeyLabel(alertConfig.fleetKey)} · Scanning...`;
      }
    }
  }

  function triggerPassByAlert(bus, distMeters) {
    lastAlertBusId = bus.id;
    const traffic = getTrafficState();
    const speedMps = Math.max(5, ((bus.speedKmh || 28) * 1000) / 3600);
    const etaMin = Math.max(1, Math.round((distMeters / speedMps / 60) * traffic.multiplier));
    const distLabel =
      distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`;

    const msg = `Route ${bus.routeId}${bus.isAC ? " (AC)" : ""} · ${bus.reg} is ${distLabel} away (~${etaMin} min) and about to pass ${alertConfig.locLabel}!`;
    document.getElementById("passAlertMsg").textContent = msg;
    document.getElementById("passAlertBanner").classList.remove("hidden");

    playChime([660, 880]);

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Bus ${bus.routeId} Passing Soon`, { body: msg });
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
    const btn = document.getElementById("btnOpenAlertModal");
    btn.classList.add("armed");
    btn.textContent = "Alert: ON";
    updateAlertZoneLayer();
    if (map) {
      map.flyTo({ center: alertConfig.coord, zoom: Math.max(map.getZoom(), 14.2), pitch: 0, bearing: 0, duration: 750 });
    }
    showToast(`Alert active for ${formatFleetKeyLabel(alertConfig.fleetKey)} near ${alertConfig.locLabel}.`);
  }

  function disablePassByAlert() {
    alertConfig.active = false;
    document.getElementById("activeAlertChip").classList.add("hidden");
    document.getElementById("passAlertBanner").classList.add("hidden");
    const btn = document.getElementById("btnOpenAlertModal");
    btn.classList.remove("armed");
    btn.textContent = "Pass-By Alert";
    if (userAlertMarker) {
      userAlertMarker.remove();
      userAlertMarker = null;
    }
    updateAlertZoneLayer();
    document.getElementById("alertModal").classList.add("hidden");
    showToast("Pass-by bus alert disabled.");
  }

  // --- UI Lists & Timetable Rendering ---
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
      { id: "BLR_AC", label: `AC to BLR (${acCount})`, color: "#0284c7" },
      ...ROUTES.map((r) => ({ id: r.id, label: r.isAC ? `${r.id} AC` : r.id, color: r.color }))
    ];

    wrap.innerHTML = items
      .map((item) => {
        const active = selectedRouteFilter === item.id;
        const style = active ? `style="background:${item.color}"` : "";
        return `<button class="route-pill ${active ? "active" : ""}" data-route="${item.id}" ${style}>${item.label}</button>`;
      })
      .join("");

    wrap.querySelectorAll(".route-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRouteFilter = btn.dataset.route;
        if (selectedBusId) clearSelectedBus();
        renderRoutePills();
        applyRouteLayerFilter();
        renderFleetList();
        if (
          map &&
          (selectedRouteFilter === "BLR" ||
            selectedRouteFilter === "BLR_AC" ||
            selectedRouteFilter.startsWith("BLR-"))
        ) {
          map.flyTo({ ...LANDMARKS.corridor, pitch: 0, bearing: 0, duration: 900 });
        }
      });
    });
  }

  function renderFleetList() {
    const searchEl = document.getElementById("fleetSearch");
    const list = document.getElementById("fleetList");
    if (!list) return;

    const prevScroll = list.scrollTop;
    const query = searchEl ? searchEl.value.trim().toLowerCase() : "";
    const now = performance.now();
    const traffic = getTrafficState();

    const visible = getVisibleFleet().filter((b) => {
      if (!query) return true;
      const stopDisp = getBusNextStopDisplay(b).toLowerCase();
      return (
        b.routeId.toLowerCase().includes(query) ||
        b.reg.toLowerCase().includes(query) ||
        (b.livery || "").toLowerCase().includes(query) ||
        (b.nextStopName || "").toLowerCase().includes(query) ||
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
            <span>${showStops ? "Next: " : ""}${escHtml(getBusNextStopDisplay(b))}</span>
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
    if (tabBtnRoutes) tabBtnRoutes.textContent = `Routes (${ROUTES.length})`;

    const strip = document.getElementById("trafficStatusStrip");
    const traffic = getTrafficState();
    if (strip) {
      strip.innerHTML = `
        <span style="color:${traffic.color}">● ${traffic.level}</span>
        <span style="color:var(--muted);font-size:10.5px;">NH-48 & City ETA Factor: ${traffic.multiplier}×</span>
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
              <span>First–Last: <strong>${sched.windowLabel}</strong></span>
              <span>Every ${sched.freqMin}m</span>
            </div>
            <div class="timetable-deps">
              <span style="color:var(--muted);font-weight:600">Next:</span>
              ${sched.upcoming.map((t) => `<span class="dep-chip">${t}</span>`).join("")}
              <button class="share-mini-btn" data-share-route="${r.id}">Share</button>
            </div>
          </div>

          <div class="route-stops">
            ${r.stops.map((s) => `<div class="route-stop-row"><span>${escHtml(formatStopText(s))}</span><span>●</span></div>`).join("")}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-filter-route]").forEach((el) => {
      el.addEventListener("click", () => {
        selectedRouteFilter = el.dataset.filterRoute;
        if (selectedBusId) clearSelectedBus();
        renderRoutePills();
        applyRouteLayerFilter();
        switchTab("fleet");
        renderFleetList();
        if (map) {
          const target = selectedRouteFilter.startsWith("BLR-") ? LANDMARKS.corridor : LANDMARKS.tumkur;
          map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 900 });
        }
      });
    });

    container.querySelectorAll("[data-share-route]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        copyOrShareUrl({ route: btn.dataset.shareRoute }, `Route ${btn.dataset.shareRoute} Live Map`);
      });
    });
  }

  function initStopBoardAndFares() {
    const stopSel = document.getElementById("stopSelect");
    populateStopDropdown(stopSel, null, "ksrtc");
    if (stopSel) stopSel.addEventListener("change", renderArrivalBoard);

    const fareFrom = document.getElementById("fareFromSelect");
    const fareTo = document.getElementById("fareToSelect");
    const farePass = document.getElementById("farePassengerSelect");
    populateStopDropdown(fareFrom, null, "ksrtc");
    populateStopDropdown(fareTo, null, "majestic");

    if (fareFrom) fareFrom.addEventListener("change", renderTripAndFares);
    if (fareTo) fareTo.addEventListener("change", renderTripAndFares);
    if (farePass) farePass.addEventListener("change", renderTripAndFares);

    on("btnSwapFareStops", "click", () => {
      if (!fareFrom || !fareTo) return;
      const tmp = fareFrom.value;
      fareFrom.value = fareTo.value;
      fareTo.value = tmp;
      renderTripAndFares();
    });

    on("btnSaveCommute", "click", () => {
      const f = findStop(fareFrom.value);
      const t = findStop(fareTo.value);
      if (!f || !t || f.id === t.id) return showToast("Pick two different stops to save.");
      const id = `c-${f.id}-${t.id}`;
      if (savedCommutes.some((c) => c.id === id)) return showToast("Commute already saved.");
      const shortF = f.name.split(" ")[0];
      const shortT = t.name.split(" ")[0];
      savedCommutes.push({ id, label: `${shortF} → ${shortT}`, fromId: f.id, toId: t.id });
      saveCommutesList(savedCommutes);
      renderSavedCommutes();
      showToast(`Saved "${shortF} → ${shortT}" to Daily Commutes!`);
    });

    on("btnCheckFareFromStop", "click", () => {
      if (!stopSel || !fareFrom || !fareTo) return;
      const currentStopId = stopSel.value;
      fareFrom.value = currentStopId;
      if (fareTo.value === currentStopId) {
        fareTo.value = currentStopId === "majestic" ? "ksrtc" : "majestic";
      }
      renderTripAndFares();
      switchTab("fares");
    });

    const gpsSelect = document.getElementById("gpsRouteSelect");
    if (gpsSelect) {
      gpsSelect.innerHTML = ROUTES.map(
        (r) => `<option value="${r.id}">${r.id}${r.isAC ? " [AC]" : ""} — ${r.name}</option>`
      ).join("");
    }

    renderArrivalBoard();
    renderTripAndFares();
    renderSavedCommutes();
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
          <div class="board-eta">${mins <= 1 ? "DUE" : `${mins} min`}</div>
        </div>`
        )
        .join("")}
    `;
  }

  function switchTab(name) {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${name}`);
    });
  }

  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), 3500);
  }

  function updateFleetCounters(suffix = "Auto-updating live") {
    const tabBtn = document.getElementById("tabBtnFleet");
    if (tabBtn) tabBtn.textContent = `Fleet (${fleet.length})`;
    const status = document.getElementById("feedStatusText");
    if (status) status.textContent = `${fleet.length} Buses Active · ${suffix}`;
  }

  function updateFollowButton() {
    const btn = document.getElementById("btnFollowBus");
    if (!btn) return;
    btn.classList.toggle("active-follow", followBusActive);
    btn.textContent = followBusActive ? "Stop Following" : "Follow Bus";
  }

  // --- UI Control Bindings ---
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  on("drawerToggle", "click", () => {
    document.getElementById("drawer").classList.toggle("collapsed");
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

  on("btnToggleStops", "click", (e) => {
    if (editStopsMode) setStopEditorMode(false);
    showStops = !showStops;
    e.target.classList.toggle("active", showStops);
    e.target.textContent = showStops ? "Stops: ON" : "Stops: OFF";

    if (typeof setRouteStopMode === "function") setRouteStopMode(showStops);
    if (typeof repositionFleetOnRoutes === "function") repositionFleetOnRoutes(fleet);
    updateRouteSourceData();
    syncBusMarkers();

    const selectedBus = selectedBusId ? fleet.find((b) => b.id === selectedBusId) : null;
    syncStopMarkerHighlight(selectedBus ? selectedBus.routeId : null);
    if (selectedBus) updateInspectorMetrics(selectedBus);
    renderFleetList();
    showToast(
      showStops
        ? "Stops ON: Buses serving stops."
        : "Stops OFF: Buses following direct normal routes."
    );
  });

  on("btnToggleTraffic", "click", (e) => {
    showTraffic = !showTraffic;
    e.target.classList.toggle("active", showTraffic);
    e.target.textContent = showTraffic ? "Traffic: ON" : "Traffic: OFF";
    updateTrafficLayerVisibility();
  });

  on("btnLangToggle", "click", (e) => {
    const order = ["both", "kn", "en"];
    stopLangMode = order[(order.indexOf(stopLangMode) + 1) % order.length];
    const labels = { both: "EN + ಕನ್ನಡ", kn: "ಕನ್ನಡ Only", en: "English Only" };
    e.target.textContent = labels[stopLangMode];
    e.target.classList.toggle("active", stopLangMode !== "en");
    refreshStopLanguageUI();
    showToast(`Bus stop language: ${labels[stopLangMode]}`);
  });

  on("btnScaleToggle", "click", (e) => {
    boostScale = !boostScale;
    e.target.classList.toggle("active", boostScale);
    e.target.textContent = boostScale ? "Bus: Large" : "Bus: Compact";
  });

  // Locate Me + Closest Approaching Buses Bar
  on("btnLocateMe", "click", (e) => {
    if (!navigator.geolocation) return showToast("Geolocation is not supported by your browser.");
    if (!map) return;

    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Locating...";
    followBusActive = false;
    updateFollowButton();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude, accuracy } = pos.coords;
        myLocationCoord = [longitude, latitude];

        if (!myLocationMarker) {
          const el = document.createElement("div");
          el.className = "my-location-dot";
          el.title = "Your Current Location";
          myLocationMarker = new maplibregl.Marker({ element: el })
            .setLngLat(myLocationCoord)
            .addTo(map);
        } else {
          myLocationMarker.setLngLat(myLocationCoord);
        }

        map.flyTo({ center: myLocationCoord, zoom: 15.6, pitch: 0, bearing: 0, duration: 900 });
        nearbyBarOpen = true;
        document.getElementById("nearbyBusesBar").classList.remove("hidden");
        renderNearbyApproachingBuses();

        btn.disabled = false;
        btn.textContent = "◎ Locate Me";
        showToast(`Centered on your location (±${Math.round(accuracy)} m)`);
      },
      (err) => {
        btn.disabled = false;
        btn.textContent = "◎ Locate Me";
        showToast(
          err.code === 1
            ? "Location permission denied. Allow location access in browser settings."
            : "Could not get GPS fix. Make sure location is enabled."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  });

  on("btnCloseNearbyBar", "click", () => {
    nearbyBarOpen = false;
    document.getElementById("nearbyBusesBar").classList.add("hidden");
  });

  // Stop Editor Controls
  on("btnOpenEditStops", "click", () => setStopEditorMode(!editStopsMode));
  on("btnEditorDone", "click", () => setStopEditorMode(false));

  on("btnEditorAddMode", "click", (e) => {
    addStopSubMode = !addStopSubMode;
    e.target.classList.toggle("active", addStopSubMode);
    mapEl.classList.toggle("picking-location", addStopSubMode);
    if (addStopSubMode) showToast("Click anywhere on the map to drop a new bus stop.");
  });

  on("btnEditorExport", async () => {
    const json = exportStopsSnippet(STOPS);
    try {
      await navigator.clipboard.writeText(json);
      showToast("All stop coordinates copied to clipboard as JSON!");
    } catch {
      window.prompt("Copy Stop Coordinates JSON:", json);
    }
  });

  on("btnEditorReset", () => {
    clearStopOverrides();
    showToast("Cleared custom stop edits — reloading default stops...");
    setTimeout(() => window.location.reload(), 700);
  });

  // Landmarks & Nearest Stop
  document.querySelectorAll("[data-fly]").forEach((btn) => {
    btn.addEventListener("click", () => {
      followBusActive = false;
      updateFollowButton();
      const target = LANDMARKS[btn.dataset.fly];
      if (target && map) map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 900 });
    });
  });

  on("btnNearestStop", "click", () => {
    if (!navigator.geolocation) return showToast("Geolocation not supported.");
    showToast("Finding nearest bus stop...");
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
        renderArrivalBoard();
        switchTab("stops");
        if (map) map.flyTo({ center: nearest.coord, zoom: 15.6, pitch: 0, bearing: 0, duration: 900 });
        showToast(`Nearest stop: ${formatStopText(nearest)} (${(bestDist / 1000).toFixed(1)} km)`);
      },
      () => showToast("Location permission denied.")
    );
  });

  // Inspector & Share Controls
  on("btnCloseInspector", "click", clearSelectedBus);
  on("btnClearSelectedRoute", "click", clearSelectedBus);

  on("btnLights", "click", (e) => {
    const active = e.target.classList.toggle("active");
    e.target.textContent = active ? "Lights ON" : "Lights OFF";
    const insp = getInspector3D();
    if (insp) insp.setLights(active);
  });

  on("btnFollowBus", "click", () => {
    followBusActive = !followBusActive;
    updateFollowButton();
    if (followBusActive) showToast("Following bus in 2D top view.");
  });

  on("btnShareBus", "click", () => {
    const bus = fleet.find((b) => b.id === selectedBusId);
    if (!bus) return;
    copyOrShareUrl({ bus: bus.id, route: bus.routeId }, `Bus ${bus.routeId} (${bus.reg})`);
  });

  on("btnAlertThisRoute", "click", () => {
    const activeBus = fleet.find((b) => b.id === selectedBusId);
    if (activeBus) document.getElementById("alertFleetSelect").value = activeBus.routeId;
    document.getElementById("alertModal").classList.remove("hidden");
  });

  // Wake-Me Destination Drop-Off Alarm Controls
  on("btnOpenWakeModal", "click", () => document.getElementById("wakeModal").classList.remove("hidden"));
  on("btnCloseWakeModal", "click", () => document.getElementById("wakeModal").classList.add("hidden"));
  on("btnArmWake", "click", armWakeMeAlarm);
  on("btnDisableWake", "click", () => disableWakeMeAlarm(false));
  on("btnStopWakeQuick", "click", () => disableWakeMeAlarm(false));
  on("btnDismissWakeAlert", "click", () => disableWakeMeAlarm(false));

  // Pass-By Alert Controls
  on("btnOpenAlertModal", "click", () => {
    if (!alertConfig.active && selectedRouteFilter) {
      const sel = document.getElementById("alertFleetSelect");
      if (sel) sel.value = selectedRouteFilter;
    }
    document.getElementById("alertModal").classList.remove("hidden");
  });
  on("btnCloseAlertModal", "click", () => document.getElementById("alertModal").classList.add("hidden"));

  on("btnAlertUseGps", "click", () => {
    if (!navigator.geolocation) return showToast("Geolocation unavailable.");
    showToast("Reading your GPS location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserAlertLocation([pos.coords.longitude, pos.coords.latitude], "My Live GPS");
        showToast("Your live GPS location is set.");
      },
      () => showToast("GPS denied — select a Tumakuru stop or click on the map.")
    );
  });

  on("btnAlertPickMap", "click", () => {
    pickingAlertOnMap = true;
    mapEl.classList.add("picking-location");
    document.getElementById("alertModal").classList.add("hidden");
    showToast("Click anywhere on the map (or a bus stop) to set your alert location.");
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

  // Live Feed / GPS Modal
  on("btnOpenFeedModal", "click", () => document.getElementById("feedModal").classList.remove("hidden"));
  on("btnCloseFeedModal", "click", () => document.getElementById("feedModal").classList.add("hidden"));

  on("btnConnectApi", "click", async () => {
    const url = document.getElementById("apiUrlInput").value.trim();
    if (!url) return showToast("Enter a valid JSON endpoint URL.");
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
          const isNewBus = !prev;
          if (isNewBus) newlyLiveCount++;

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
            livery: item.livery || matchedRoute?.livery || "Live Telemetry",
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
            nextStopName: item.nextStop || "Live GPS Feed",
            etaMin: item.etaMin || 2,
            isExternal: true,
            isNewUntil: isNewBus ? now + 9000 : prev.isNewUntil || 0
          };
        });

        updateFleetCounters("Live API Auto-Updating (3s)");
        renderRoutePills();
        renderFleetList();
        renderRoutesTab();
        renderArrivalBoard();
        if (newlyLiveCount > 0 && existingMap.size > 0) {
          showToast(`${newlyLiveCount} new bus${newlyLiveCount > 1 ? "es" : ""} just went live!`);
        }
      } catch {
        showToast("Could not load JSON feed (check CORS / URL).");
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
      showToast("GPS broadcast stopped.");
      return;
    }

    if (!navigator.geolocation) return showToast("Geolocation unavailable.");
    const routeId = document.getElementById("gpsRouteSelect").value;
    const r = ROUTES.find((rt) => rt.id === routeId) || ROUTES[0];

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
        updateFleetCounters(`Broadcasting Live GPS on Route ${r.id}`);
        selectBus("my-gps-bus", true);
      },
      () => showToast("Unable to read device GPS."),
      { enableHighAccuracy: true }
    );

    e.target.textContent = "Stop GPS";
    document.getElementById("feedModal").classList.add("hidden");
    showToast("Broadcasting your device GPS as a 3D bus.");
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
    updateFleetCounters("Road-Aligned Live Fleet (Tumakuru & Bengaluru)");
    renderRoutePills();
    renderFleetList();
    renderRoutesTab();
    renderArrivalBoard();
    document.getElementById("feedModal").classList.add("hidden");
    showToast("Switched back to auto-updating fleet.");
  });

  // --- PWA Install Prompt & Service Worker Registration ---
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById("btnInstallPwa");
    if (btn) btn.classList.remove("hidden");
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
  // 1. BOOT FLEET UI IMMEDIATELY
  // =========================================================================
  updateFleetCounters("Aligning verified roads...");
  initAlertModalOptions();
  renderRoutePills();
  renderFleetList();
  renderRoutesTab();
  initStopBoardAndFares();

  // =========================================================================
  // 2. INITIALIZE MAP & 3D LAYER SAFELY
  // =========================================================================
  if (typeof maplibregl === "undefined") {
    showStatusError("MapLibre library failed to load. Check internet connection.");
  } else {
    try {
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
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("style.load", attachMapLayers);
      map.on("zoom", syncStopLabelZoomClass);
      syncStopLabelZoomClass();

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
          showToast(`Added custom stop "${newStop.name}"!`);
          return;
        }

        if (pickingAlertOnMap) {
          pickingAlertOnMap = false;
          mapEl.classList.remove("picking-location");
          setUserAlertLocation([e.lngLat.lng, e.lngLat.lat], "Pinned Map Location");
          document.getElementById("alertModal").classList.remove("hidden");
          showToast("Alert location pinned on map.");
          return;
        }

        const visible = getVisibleFleet();
        let closestBus = null;
        let bestPx = 30;
        visible.forEach((bus) => {
          const pt = map.project([bus.lng, bus.lat]);
          const d = Math.hypot(pt.x - e.point.x, pt.y - e.point.y);
          if (d < bestPx) {
            bestPx = d;
            closestBus = bus;
          }
        });

        if (closestBus) selectBus(closestBus.id, false);
      });

      initStopMarkers();
      syncBusMarkers();
      applyDeepLinkFromUrl();
    } catch (err) {
      console.error("Map init error:", err);
      showStatusError(`Map WebGL error: ${err.message}`);
    }
  }

  // =========================================================================
  // 3. AUTO-DISPATCH & MAIN ANIMATION LOOP
  // =========================================================================
  if (typeof spawnLiveBus === "function") {
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

      updateFleetCounters(`New bus ${newBus.routeId} (${newBus.reg}) just went live`);
      renderRoutePills();
      renderFleetList();
      renderRoutesTab();
      showToast(`Live Dispatch: ${newBus.routeId}${newBus.isAC ? " AC" : ""} (${newBus.reg}) departed terminal`);
    }, 14000);
  }

  let lastTime = performance.now();
  let uiTick = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    stepFleet(fleet, dt, showStops);
    syncBusMarkers();

    if (selectedBusId) {
      const activeBus = fleet.find((b) => b.id === selectedBusId);
      if (activeBus) {
        if (followBusActive && map) {
          map.easeTo({
            center: [activeBus.lng, activeBus.lat],
            pitch: 0,
            bearing: 0,
            duration: 280,
            easing: (t) => t
          });
        }
        if (now - uiTick > 500) {
          updateInspectorMetrics(activeBus);
        }
        if (wakeConfig.active && wakeConfig.mode === "selectedBus") {
          evaluateWakeMePosition([activeBus.lng, activeBus.lat]);
        }
      }
    }

    if (now - uiTick > 900) {
      uiTick = now;
      evaluatePassByAlerts(now);
      renderNearbyApproachingBuses();
      renderFleetList();
      renderArrivalBoard();
    }
  }

  requestAnimationFrame(loop);

  // =========================================================================
  // 4. SNAP ROUTES TO REAL OSM ROADS
  // =========================================================================
  if (typeof snapRoutesToRealRoads === "function") {
    snapRoutesToRealRoads((route, done, total) => {
      if (typeof repositionFleetOnRoutes === "function") {
        repositionFleetOnRoutes(fleet, route.id);
      }
      updateRouteSourceData();
      syncStopMarkerPositions();
      renderTripAndFares();
      updateFleetCounters(
        done < total
          ? `Snapping roads (${done}/${total})...`
          : showStops
            ? "Road-Aligned Live Fleet (Tumakuru & Bengaluru)"
            : "Direct Normal Routes (Stops Bypassed)"
      );
    }).then((snapped) => {
      if (snapped === 0) {
        updateFleetCounters("Offline Fallback (check internet for road snapping)");
      }
    });
  }
})();
