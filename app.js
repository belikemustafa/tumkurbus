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

  if (!window.TumkurData) {
    showStatusError("routes.js failed to load. Make sure routes.js is in the same folder as index.html.");
    return;
  }

  const {
    TUMKUR_CENTER,
    LANDMARKS,
    ROUTES,
    STOPS,
    haversineMeters,
    bearingDegrees,
    snapRoutesToRealRoads,
    createInitialFleet,
    spawnLiveBus,
    stepFleet
  } = window.TumkurData;

  // Safe fallbacks in case an older routes.js was cached
  const getStopById =
    window.TumkurData.getStopById ||
    ((id) => STOPS.find((s) => s.id === id) || null);

  const estimateFares =
    window.TumkurData.estimateFares ||
    (() => null);

  const MAP_STYLES = {
    street: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors"
        }
      },
      layers: [{ id: "basemap", type: "raster", source: "basemap" }]
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
        { id: "imagery", type: "raster", source: "imagery" },
        { id: "roads", type: "raster", source: "roads", paint: { "raster-opacity": 0.92 } },
        { id: "places", type: "raster", source: "places", paint: { "raster-opacity": 0.88 } }
      ]
    }
  };

  // Core App State
  let fleet = createInitialFleet();
  let selectedRouteFilter = "ALL";
  let selectedBusId = null;
  let followBusActive = false;
  let boostScale = true;
  let showStops = true;
  let stopLangMode = "both"; // "both" | "kn" | "en"
  let isExternalApiMode = false;
  let apiPollTimer = null;
  let gpsWatchId = null;
  let currentStyleName = "street";

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
  let audioCtx = null;

  const busMarkers = new Map();
  let stopMarkerEntries = [];
  let map = null;
  let inspector3D = null;

  const mapEl = document.getElementById("map");

  // Lazy-create the 3D Bus Inspector only when visible so hidden canvas never fails WebGL
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

  // Language formatting helpers for Kannada + English toggle
  function formatStopText(stop) {
    if (!stop) return "";
    const kn = stop.kn || stop.name;
    if (stopLangMode === "kn") return kn;
    if (stopLangMode === "en") return stop.name;
    return kn === stop.name ? stop.name : `${kn} · ${stop.name}`;
  }

  function formatStopPinHtml(stop) {
    const kn = stop.kn || stop.name;
    if (stopLangMode === "kn") {
      return `<span class="stop-kn">${kn}</span>`;
    }
    if (stopLangMode === "en") {
      return `<span class="stop-en">${stop.name}</span>`;
    }
    return `<span class="stop-kn">${kn}</span><span class="stop-en">${stop.name}</span>`;
  }

  function getBusNextStopDisplay(bus) {
    const stop = bus.nextStopId ? getStopById(bus.nextStopId) : null;
    if (!stop) return bus.nextStopName || "En Route";
    return formatStopText(stop);
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
    if (!src) return;
    if (alertConfig.active && alertConfig.coord) {
      src.setData(makeCircleGeoJSON(alertConfig.coord, alertConfig.radiusMeters));
    } else {
      src.setData({ type: "FeatureCollection", features: [] });
    }
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

    map.addSource("alert-zone", {
      type: "geojson",
      data:
        alertConfig.active && alertConfig.coord
          ? makeCircleGeoJSON(alertConfig.coord, alertConfig.radiusMeters)
          : { type: "FeatureCollection", features: [] }
    });

    map.addLayer({
      id: "alert-zone-fill",
      type: "fill",
      source: "alert-zone",
      paint: { "fill-color": "#2563eb", "fill-opacity": 0.14 }
    });

    map.addLayer({
      id: "alert-zone-border",
      type: "line",
      source: "alert-zone",
      paint: {
        "line-color": "#2563eb",
        "line-width": 2.2,
        "line-dasharray": [3, 2]
      }
    });

    map.addSource("tumkur-routes", {
      type: "geojson",
      data: buildRouteGeoJSON()
    });

    map.addLayer({
      id: "routes-casing",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": currentStyleName === "satellite" ? 6.5 : 5.5,
        "line-opacity": 0.9
      }
    });

    map.addLayer({
      id: "routes-core",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3.8,
        "line-opacity": 0.96
      }
    });

    // Add 3D buses layer safely (keeps working with 2D badges if Three.js ever fails)
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
    mapEl.classList.toggle("show-all-stops", z >= 13.7);
  }

  function applyRouteLayerFilter() {
    if (!map || !map.getLayer("routes-core")) return;

    const selectedBus = selectedBusId ? fleet.find((b) => b.id === selectedBusId) : null;
    let filter = null;

    if (selectedBus) {
      filter = ["==", ["get", "id"], selectedBus.routeId];
      map.setPaintProperty("routes-core", "line-width", 5.2);
      map.setPaintProperty("routes-casing", "line-width", 8.0);
    } else {
      map.setPaintProperty("routes-core", "line-width", 3.6);
      map.setPaintProperty("routes-casing", "line-width", currentStyleName === "satellite" ? 6.5 : 5.5);

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
    syncStopMarkerHighlight(selectedBus ? selectedBus.routeId : null);
  }

  function getVisibleFleet() {
    if (selectedRouteFilter === "ALL") return fleet;
    if (selectedRouteFilter === "CITY") return fleet.filter((b) => b.category === "city");
    if (selectedRouteFilter === "BLR") return fleet.filter((b) => b.category === "bangalore");
    if (selectedRouteFilter === "BLR_AC") return fleet.filter((b) => b.isAC);
    return fleet.filter((b) => b.routeId === selectedRouteFilter);
  }

  function initStopMarkers() {
    if (!map) return;
    stopMarkerEntries.forEach(({ marker }) => marker.remove());
    stopMarkerEntries = STOPS.map((stop) => {
      const el = document.createElement("div");
      el.className = `bus-stop-pin ${stop.major ? "major" : ""}`;
      el.innerHTML = `<span class="bus-stop-dot">B</span><span class="bus-stop-label">${formatStopPinHtml(stop)}</span>`;

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (pickingAlertOnMap) {
          pickingAlertOnMap = false;
          mapEl.classList.remove("picking-location");
          setUserAlertLocation(stop.coord, formatStopText(stop));
          document.getElementById("alertModal").classList.remove("hidden");
          showToast(`Alert location set to ${formatStopText(stop)}.`);
          return;
        }
        const stopSel = document.getElementById("stopSelect");
        if (stopSel) stopSel.value = stop.id;
        renderArrivalBoard();
        switchTab("stops");
        showToast(`${formatStopText(stop)} · Routes: ${(stop.routeIds || []).join(", ") || "Local"}`);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "left" })
        .setLngLat(stop.coord)
        .addTo(map);

      return { stop, el, marker };
    });

    syncStopMarkerHighlight(null);
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
      opts.push(`<option value="${s.id}">${formatStopText(s)}</option>`);
    });
    selectEl.innerHTML = opts.join("");
    if (prevVal && (prevVal === "" || getStopById(prevVal))) {
      selectEl.value = prevVal;
    } else if (defaultId && getStopById(defaultId)) {
      selectEl.value = defaultId;
    }
  }

  function refreshStopLanguageUI() {
    stopMarkerEntries.forEach(({ stop, el }) => {
      const labelEl = el.querySelector(".bus-stop-label");
      if (labelEl) labelEl.innerHTML = formatStopPinHtml(stop);
    });

    populateStopDropdown(document.getElementById("stopSelect"), null, "ksrtc");
    populateStopDropdown(
      document.getElementById("alertStopSelect"),
      "— Or pick a Tumakuru / BLR stop as your location —"
    );
    populateStopDropdown(document.getElementById("fareFromSelect"), null, "ksrtc");
    populateStopDropdown(document.getElementById("fareToSelect"), null, "majestic");

    renderFleetList();
    renderRoutesTab();
    renderArrivalBoard();
    renderFareEstimator();

    if (selectedBusId) {
      const activeBus = fleet.find((b) => b.id === selectedBusId);
      if (activeBus) updateInspectorMetrics(activeBus);
    }
  }

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
      document.getElementById("selectedRouteText").textContent = routeObj
        ? `Route ${routeObj.id}: ${routeObj.name}`
        : `Route ${bus.routeId}`;
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
    const svc = document.getElementById("inspService");
    if (svc) svc.textContent = bus.livery || (bus.isAC ? "AC Coach" : "City Bus");
    document.getElementById("inspSpeed").textContent =
      bus.speedKmh > 0 ? `${bus.speedKmh} km/h` : "At Stop";
    document.getElementById("inspNextStop").textContent = getBusNextStopDisplay(bus);
    const etaCrowd = document.getElementById("inspEtaCrowd");
    if (etaCrowd) {
      etaCrowd.textContent = `${bus.etaMin || 2} min · ${bus.crowd || "Moderate"}`;
    }
  }

  // --- KSRTC Ticket Fare Estimator ---
  function renderFareEstimator() {
    const fromEl = document.getElementById("fareFromSelect");
    const toEl = document.getElementById("fareToSelect");
    const passEl = document.getElementById("farePassengerSelect");
    const summaryEl = document.getElementById("fareSummary");
    const resultsEl = document.getElementById("fareResults");
    if (!fromEl || !toEl || !passEl || !summaryEl || !resultsEl) return;

    const est = estimateFares(fromEl.value, toEl.value, passEl.value);
    if (!est) {
      summaryEl.innerHTML = `<span>Select two different stops to estimate KSRTC fares.</span>`;
      resultsEl.innerHTML = "";
      return;
    }

    const directBadge =
      est.directRouteIds.length > 0
        ? `<strong>${est.directRouteIds.length} direct route${est.directRouteIds.length > 1 ? "s" : ""}</strong>`
        : `<span>Transfer via KSRTC Stand</span>`;

    summaryEl.innerHTML = `
      <span>Approx. Distance: <strong>${est.distanceKm} km</strong></span>
      ${directBadge}
    `;

    resultsEl.innerHTML =
      est.tiers
        .map((t) => {
          const isFree = t.fare === 0;
          const discounted = t.fare < t.baseFare && !isFree;
          const priceHtml = isFree
            ? `<div class="fare-amount is-free">FREE</div><span class="free-pill">Shakti ₹0</span>`
            : `<div class="fare-amount">${discounted ? `<span class="fare-strike">₹${t.baseFare}</span>` : ""}₹${t.fare}</div>`;

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
                  <div class="fare-service-sub">${t.subtitle} · ~${t.durationMin} min</div>
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
      `<p class="fare-note">Estimates follow Karnataka's Nov 2026 KSRTC fare structure (₹10 min city · ₹100 Tumakuru–Bengaluru Express). Online reservation or toll variations may apply.</p>`;

    resultsEl.querySelectorAll("[data-jump-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rid = btn.dataset.jumpRoute;
        selectedRouteFilter = rid;
        if (selectedBusId) clearSelectedBus();
        renderRoutePills();
        applyRouteLayerFilter();
        switchTab("fleet");
        renderFleetList();
        if (map) {
          if (rid.startsWith("BLR-")) {
            map.flyTo({ ...LANDMARKS.corridor, pitch: 0, bearing: 0, duration: 900 });
          } else {
            map.flyTo({ ...LANDMARKS.tumkur, pitch: 0, bearing: 0, duration: 900 });
          }
        }
      });
    });
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
        const stop = getStopById(stopSel.value);
        if (stop) setUserAlertLocation(stop.coord, formatStopText(stop));
      });
    }
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

  function playAlertChime() {
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      if (!audioCtx) audioCtx = new AudioClass();
      if (audioCtx.state === "suspended") audioCtx.resume();

      const now = audioCtx.currentTime;
      [660, 880].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.16);
        gain.gain.setValueAtTime(0.18, now + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.16);
        osc.stop(now + idx * 0.16 + 0.3);
      });
    } catch {
      // Ignore audio restrictions
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
          nearestDist < 1000
            ? `${Math.round(nearestDist)} m`
            : `${(nearestDist / 1000).toFixed(1)} km`;
        chipText.textContent =
          `Alert: ${formatFleetKeyLabel(alertConfig.fleetKey)} · Nearest ${nearestBus.routeId} (${distStr})`;
      } else {
        chipText.textContent = `Alert: ${formatFleetKeyLabel(alertConfig.fleetKey)} · Scanning...`;
      }
    }
  }

  function triggerPassByAlert(bus, distMeters) {
    lastAlertBusId = bus.id;
    const speedMps = Math.max(5, ((bus.speedKmh || 28) * 1000) / 3600);
    const etaMin = Math.max(1, Math.round(distMeters / speedMps / 60));
    const distLabel =
      distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`;

    const msg = `Route ${bus.routeId}${bus.isAC ? " (AC)" : ""} · ${bus.reg} is ${distLabel} away (~${etaMin} min) and about to pass ${alertConfig.locLabel}!`;
    document.getElementById("passAlertMsg").textContent = msg;
    document.getElementById("passAlertBanner").classList.remove("hidden");

    playAlertChime();

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Bus ${bus.routeId} Passing Soon`, { body: msg });
    }
  }

  function armPassByAlert() {
    if (!alertConfig.coord) {
      const ksrtc = getStopById("ksrtc") || STOPS[0];
      setUserAlertLocation(ksrtc.coord, formatStopText(ksrtc));
    }

    alertConfig.fleetKey = document.getElementById("alertFleetSelect").value;
    alertConfig.radiusMeters = Number(document.getElementById("alertRadiusSelect").value) || 1000;
    alertConfig.active = true;
    alertPrevDist.clear();
    alertCooldowns.clear();

    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass && !audioCtx) audioCtx = new AudioClass();
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    } catch {
      // Ignore
    }
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

  // --- UI List Rendering ---
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
            <span>Next: ${getBusNextStopDisplay(b)}</span>
            <span>ETA ${b.etaMin}m</span>
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
    const container = document.getElementById("routesList");
    if (!container) return;
    container.innerHTML = ROUTES.map((r) => {
      const activeCount = fleet.filter((b) => b.routeId === r.id).length;
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
          <div class="route-stops">
            ${r.stops.map((s) => `<div class="route-stop-row"><span>${formatStopText(s)}</span><span>●</span></div>`).join("")}
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
          if (selectedRouteFilter.startsWith("BLR-")) {
            map.flyTo({ ...LANDMARKS.corridor, pitch: 0, bearing: 0, duration: 900 });
          } else {
            map.flyTo({ ...LANDMARKS.tumkur, pitch: 0, bearing: 0, duration: 900 });
          }
        }
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

    if (fareFrom) fareFrom.addEventListener("change", renderFareEstimator);
    if (fareTo) fareTo.addEventListener("change", renderFareEstimator);
    if (farePass) farePass.addEventListener("change", renderFareEstimator);

    on("btnSwapFareStops", "click", () => {
      if (!fareFrom || !fareTo) return;
      const tmp = fareFrom.value;
      fareFrom.value = fareTo.value;
      fareTo.value = tmp;
      renderFareEstimator();
    });

    on("btnCheckFareFromStop", "click", () => {
      if (!stopSel || !fareFrom || !fareTo) return;
      const currentStopId = stopSel.value;
      fareFrom.value = currentStopId;
      if (fareTo.value === currentStopId) {
        fareTo.value = currentStopId === "majestic" ? "ksrtc" : "majestic";
      }
      renderFareEstimator();
      switchTab("fares");
    });

    const gpsSelect = document.getElementById("gpsRouteSelect");
    if (gpsSelect) {
      gpsSelect.innerHTML = ROUTES.map(
        (r) => `<option value="${r.id}">${r.id}${r.isAC ? " [AC]" : ""} — ${r.name}</option>`
      ).join("");
    }

    renderArrivalBoard();
    renderFareEstimator();
  }

  function renderArrivalBoard() {
    const stopSel = document.getElementById("stopSelect");
    const board = document.getElementById("arrivalBoard");
    if (!stopSel || !board) return;

    const stop = getStopById(stopSel.value) || STOPS[0];

    const arrivals = fleet
      .map((bus) => {
        const distM = haversineMeters([bus.lng, bus.lat], stop.coord);
        const speedMps = Math.max(5, ((bus.speedKmh || 28) * 1000) / 3600);
        const mins = Math.max(1, Math.round(distM / speedMps / 60));
        return { bus, distKm: (distM / 1000).toFixed(1), mins };
      })
      .sort((a, b) => a.mins - b.mins)
      .slice(0, 10);

    board.innerHTML = `
      <div class="board-title">LIVE ARRIVALS · ${formatStopText(stop)}</div>
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
    t._timer = setTimeout(() => t.classList.add("hidden"), 3400);
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
    btn.textContent = followBusActive ? "Stop Following Bus" : "Follow Bus on Map";
  }

  // --- Bind UI Controls ---
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
    showStops = !showStops;
    e.target.classList.toggle("active", showStops);
    e.target.textContent = showStops ? "Stops: ON" : "Stops: OFF";
    const selectedBus = selectedBusId ? fleet.find((b) => b.id === selectedBusId) : null;
    syncStopMarkerHighlight(selectedBus ? selectedBus.routeId : null);
  });

  on("btnLangToggle", "click", (e) => {
    const order = ["both", "kn", "en"];
    stopLangMode = order[(order.indexOf(stopLangMode) + 1) % order.length];
    const labels = {
      both: "EN + ಕನ್ನಡ",
      kn: "ಕನ್ನಡ Only",
      en: "English Only"
    };
    e.target.textContent = labels[stopLangMode];
    e.target.classList.toggle("active", stopLangMode !== "en");
    refreshStopLanguageUI();
    showToast(`Bus stop language: ${labels[stopLangMode]}`);
  });

  on("btnScaleToggle", "click", (e) => {
    boostScale = !boostScale;
    e.target.classList.toggle("active", boostScale);
    e.target.textContent = boostScale ? "Bus Size: Large" : "Bus Size: Compact";
  });

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

  on("btnAlertThisRoute", "click", () => {
    const activeBus = fleet.find((b) => b.id === selectedBusId);
    if (activeBus) {
      document.getElementById("alertFleetSelect").value = activeBus.routeId;
    }
    document.getElementById("alertModal").classList.remove("hidden");
  });

  // Pass-By Alert Modal Controls
  on("btnOpenAlertModal", "click", () => {
    if (!alertConfig.active && selectedRouteFilter) {
      const sel = document.getElementById("alertFleetSelect");
      if (sel) sel.value = selectedRouteFilter;
    }
    document.getElementById("alertModal").classList.remove("hidden");
  });
  on("btnCloseAlertModal", "click", () => {
    document.getElementById("alertModal").classList.add("hidden");
  });

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

  on("btnDismissPassAlert", "click", () => {
    document.getElementById("passAlertBanner").classList.add("hidden");
  });

  on("btnLocateAlertBus", "click", () => {
    if (lastAlertBusId) {
      selectBus(lastAlertBusId, true);
      document.getElementById("passAlertBanner").classList.add("hidden");
    }
  });

  // Live Feed / GPS Modal
  on("btnOpenFeedModal", "click", () => {
    document.getElementById("feedModal").classList.remove("hidden");
  });
  on("btnCloseFeedModal", "click", () => {
    document.getElementById("feedModal").classList.add("hidden");
  });

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
          const r = ROUTES.find((rt) => rt.id === item.routeId) || ROUTES[0];
          const isNewBus = !prev;
          if (isNewBus) newlyLiveCount++;

          return {
            id,
            routeId: r.id,
            category: r.category,
            isAC: item.isAC !== undefined ? Boolean(item.isAC) : Boolean(r.isAC),
            color: r.color,
            accent: r.accent,
            livery: item.livery || r.livery,
            reg: item.reg || `LIVE-${idx + 1}`,
            lng: Number(item.lng),
            lat: Number(item.lat),
            heading: Number(item.heading) || 0,
            speedKmh: Math.round(Number(item.speed) || 0),
            braking: (Number(item.speed) || 0) < 5,
            crowd: item.crowd || "Live",
            nextStopId: null,
            nextStopName: item.nextStop || "Live Telemetry",
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
          myBus.lng = longitude;
          myBus.lat = latitude;
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
    updateFleetCounters("Auto-updating live (Tumakuru & Bengaluru)");
    renderRoutePills();
    renderFleetList();
    renderRoutesTab();
    renderArrivalBoard();
    document.getElementById("feedModal").classList.add("hidden");
    showToast("Switched back to auto-updating fleet.");
  });

  // =========================================================================
  // 1. BOOT FLEET UI IMMEDIATELY (Independent of Map / WebGL!)
  // =========================================================================
  updateFleetCounters("Auto-updating live...");
  initAlertModalOptions();
  renderRoutePills();
  renderFleetList();
  renderRoutesTab();
  initStopBoardAndFares();

  // =========================================================================
  // 2. INITIALIZE MAP & 3D LAYER SAFELY
  // =========================================================================
  if (typeof maplibregl === "undefined") {
    showStatusError("MapLibre library failed to load (check internet connection or CDN block). Fleet list is still active.");
  } else {
    try {
      map = new maplibregl.Map({
        container: "map",
        style: MAP_STYLES.street,
        center: TUMKUR_CENTER,
        zoom: 13.5,
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

    stepFleet(fleet, dt);
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
      }
    }

    if (now - uiTick > 900) {
      uiTick = now;
      evaluatePassByAlerts(now);
      renderFleetList();
      renderArrivalBoard();
    }
  }

  requestAnimationFrame(loop);

  if (typeof snapRoutesToRealRoads === "function") {
    snapRoutesToRealRoads((route, done, total) => {
      updateRouteSourceData();
      renderFareEstimator();
      updateFleetCounters(
        done < total
          ? `Aligning roads (${done}/${total})...`
          : "Auto-updating live (Tumakuru & Bengaluru)"
      );
    }).then((snapped) => {
      if (snapped === 0) {
        updateFleetCounters("Auto-updating live (Offline Fallback)");
      }
    });
  }
})();
