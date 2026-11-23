(() => {
  const {
    TUMKUR_CENTER,
    LANDMARKS,
    ROUTES,
    STOPS,
    haversineMeters,
    createInitialFleet,
    stepFleet
  } = window.TumkurData;

  // Guaranteed-uptime raster tile styles (zero API keys)
  const MAP_STYLES = {
    dark: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap © CARTO"
        }
      },
      layers: [{ id: "basemap", type: "raster", source: "basemap" }]
    },
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
        basemap: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256,
          attribution: "© Esri World Imagery"
        }
      },
      layers: [{ id: "basemap", type: "raster", source: "basemap" }]
    }
  };

  // App State
  let fleet = createInitialFleet();
  let selectedRouteFilter = "ALL";
  let selectedBusId = null;
  let chaseCamActive = false;
  let boostScale = true;
  let apiPollTimer = null;
  let gpsWatchId = null;

  const busMarkers = new Map();
  let stopMarkers = [];

  // Initialize MapLibre 3D Map centered on Tumakuru
  const map = new maplibregl.Map({
    container: "map",
    style: MAP_STYLES.dark,
    center: TUMKUR_CENTER,
    zoom: 13.6,
    pitch: 58,
    bearing: -15,
    antialias: true
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

  // 3D Turntable Inspector
  const inspector3D = new window.Bus3D.BusInspector3D(
    document.getElementById("inspectorCanvas")
  );

  // Attach route polylines + 3D bus layer whenever map style loads
  function attachMapLayers() {
    const routeFeatures = ROUTES.map((r) => ({
      type: "Feature",
      properties: { id: r.id, color: r.color, name: r.name },
      geometry: { type: "LineString", coordinates: r.path }
    }));

    map.addSource("tumkur-routes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: routeFeatures }
    });

    // Soft outer glow under each route
    map.addLayer({
      id: "routes-glow",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 8,
        "line-opacity": 0.25
      }
    });

    // Crisp corridor line
    map.addLayer({
      id: "routes-core",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3.5,
        "line-opacity": 0.92
      }
    });

    // Add Three.js 3D Bus Custom Layer
    const busLayer = window.Bus3D.createMapBusLayer({
      originLng: TUMKUR_CENTER[0],
      originLat: TUMKUR_CENTER[1],
      getFleet: () => getVisibleFleet(),
      getBoostScale: () => boostScale
    });
    map.addLayer(busLayer);

    applyRouteLayerFilter();
  }

  map.on("style.load", attachMapLayers);

  function applyRouteLayerFilter() {
    if (!map.getLayer("routes-core")) return;
    const filter =
      selectedRouteFilter === "ALL"
        ? null
        : ["==", ["get", "id"], selectedRouteFilter];
    map.setFilter("routes-core", filter);
    map.setFilter("routes-glow", filter);
  }

  function getVisibleFleet() {
    if (selectedRouteFilter === "ALL") return fleet;
    return fleet.filter((b) => b.routeId === selectedRouteFilter);
  }

  // Render Stop Pins
  function initStopMarkers() {
    stopMarkers.forEach((m) => m.remove());
    stopMarkers = STOPS.map((stop) => {
      const el = document.createElement("div");
      el.className = "stop-dot-marker";
      el.title = stop.name;

      const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div style="color:#0f172a;font-weight:700;font-size:12px;">${stop.name}</div>`
      );

      el.addEventListener("click", () => {
        document.getElementById("stopSelect").value = stop.id;
        renderLedBoard();
        switchTab("stops");
      });

      return new maplibregl.Marker({ element: el })
        .setLngLat(stop.coord)
        .setPopup(popup)
        .addTo(map);
    });
  }

  // Sync clickable floating route badges above each 3D bus
  function syncBusMarkers() {
    const visible = getVisibleFleet();
    const visibleIds = new Set(visible.map((b) => b.id));

    for (const [id, marker] of busMarkers.entries()) {
      if (!visibleIds.has(id)) {
        marker.remove();
        busMarkers.delete(id);
      }
    }

    visible.forEach((bus) => {
      let marker = busMarkers.get(bus.id);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "bus-map-badge";
        el.style.background = bus.color;
        el.textContent = bus.routeId;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          selectBus(bus.id, true);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([bus.lng, bus.lat])
          .addTo(map);
        busMarkers.set(bus.id, marker);
      } else {
        marker.setLngLat([bus.lng, bus.lat]);
        marker.getElement().classList.toggle("selected", bus.id === selectedBusId);
      }
    });
  }

  // Select a Bus & Open 3D Inspector
  function selectBus(busId, flyToBus = false) {
    const bus = fleet.find((b) => b.id === busId);
    if (!bus) return;

    selectedBusId = busId;
    const panel = document.getElementById("busInspector");
    panel.classList.remove("hidden");

    const tag = document.getElementById("inspRouteTag");
    tag.textContent = bus.routeId;
    tag.style.background = bus.color;
    document.getElementById("inspReg").textContent = bus.reg;

    inspector3D.resize();
    inspector3D.setBus(bus);
    updateInspectorMetrics(bus);
    renderFleetList();

    if (flyToBus) {
      map.flyTo({
        center: [bus.lng, bus.lat],
        zoom: Math.max(map.getZoom(), 15.6),
        pitch: 65,
        bearing: bus.heading,
        duration: 900
      });
    }
  }

  function updateInspectorMetrics(bus) {
    document.getElementById("inspSpeed").textContent =
      bus.speedKmh > 0 ? `${bus.speedKmh} km/h` : "At Stop";
    document.getElementById("inspNextStop").textContent = bus.nextStopName || "En Route";
    document.getElementById("inspEta").textContent = `${bus.etaMin || 2} min`;
    document.getElementById("inspCrowd").textContent = bus.crowd || "Moderate";
  }

  // Render Filter Pills
  function renderRoutePills() {
    const wrap = document.getElementById("routeFilterPills");
    const items = [{ id: "ALL", color: "#eab308" }, ...ROUTES];
    wrap.innerHTML = items
      .map((r) => {
        const active = selectedRouteFilter === r.id;
        const bg = active ? `style="background:${r.color};color:${r.id === "ALL" || r.id === "202" ? "#0b0e14" : "#fff"}"` : "";
        return `<button class="route-pill ${active ? "active" : ""}" data-route="${r.id}" ${bg}>${r.id}</button>`;
      })
      .join("");

    wrap.querySelectorAll(".route-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRouteFilter = btn.dataset.route;
        renderRoutePills();
        applyRouteLayerFilter();
        renderFleetList();
      });
    });
  }

  // Render Live Fleet List
  function renderFleetList() {
    const query = document.getElementById("fleetSearch").value.trim().toLowerCase();
    const list = document.getElementById("fleetList");
    const visible = getVisibleFleet().filter((b) => {
      if (!query) return true;
      return (
        b.routeId.toLowerCase().includes(query) ||
        b.reg.toLowerCase().includes(query) ||
        (b.nextStopName || "").toLowerCase().includes(query)
      );
    });

    list.innerHTML = visible
      .map(
        (b) => `
      <div class="bus-card ${b.id === selectedBusId ? "selected" : ""}" data-id="${b.id}">
        <div class="bus-card-top">
          <div>
            <span class="route-tag" style="background:${b.color}">${b.routeId}</span>
            <span class="bus-reg">${b.reg}</span>
          </div>
          <span class="speed-pill ${b.speedKmh === 0 ? "stopped" : ""}">
            ${b.speedKmh > 0 ? `${b.speedKmh} km/h` : "STOPPED"}
          </span>
        </div>
        <div class="bus-card-sub">
          <span>Next: ${b.nextStopName}</span>
          <span>ETA ${b.etaMin}m</span>
        </div>
      </div>`
      )
      .join("");

    list.querySelectorAll(".bus-card").forEach((card) => {
      card.addEventListener("click", () => selectBus(card.dataset.id, true));
    });
  }

  // Render Routes Tab
  function renderRoutesTab() {
    const container = document.getElementById("routesList");
    container.innerHTML = ROUTES.map((r) => {
      const activeCount = fleet.filter((b) => b.routeId === r.id).length;
      return `
        <div class="route-card">
          <div class="route-card-head" data-filter-route="${r.id}">
            <div>
              <span class="route-tag" style="background:${r.color}">${r.id}</span>
              <span style="font-size:11px;color:var(--muted)">${r.livery}</span>
              <div class="route-card-title">${r.name}</div>
            </div>
            <span style="font-size:11px;color:var(--emerald);font-weight:700">${activeCount} Live</span>
          </div>
          <div class="route-stops">
            ${r.stops.map((s) => `<div class="route-stop-row"><span>${s.name}</span><span>●</span></div>`).join("")}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-filter-route]").forEach((el) => {
      el.addEventListener("click", () => {
        selectedRouteFilter = el.dataset.filterRoute;
        renderRoutePills();
        applyRouteLayerFilter();
        switchTab("fleet");
        renderFleetList();
      });
    });
  }

  // Populate Stop Selector + LED Arrival Board
  function initStopBoard() {
    const select = document.getElementById("stopSelect");
    select.innerHTML = STOPS.map(
      (s) => `<option value="${s.id}">${s.name}</option>`
    ).join("");
    select.addEventListener("change", renderLedBoard);

    const gpsSelect = document.getElementById("gpsRouteSelect");
    gpsSelect.innerHTML = ROUTES.map(
      (r) => `<option value="${r.id}">${r.id} — ${r.name}</option>`
    ).join("");

    renderLedBoard();
  }

  function renderLedBoard() {
    const stopId = document.getElementById("stopSelect").value;
    const stop = STOPS.find((s) => s.id === stopId) || STOPS[0];
    const board = document.getElementById("ledBoard");

    const arrivals = fleet
      .map((bus) => {
        const distM = haversineMeters([bus.lng, bus.lat], stop.coord);
        const speedMps = Math.max(4.5, ((bus.speedKmh || 24) * 1000) / 3600);
        const mins = Math.max(1, Math.round(distM / speedMps / 60));
        return { bus, distKm: (distM / 1000).toFixed(1), mins };
      })
      .sort((a, b) => a.mins - b.mins)
      .slice(0, 7);

    board.innerHTML = `
      <div class="led-title">TUMAKURU LIVE ARRIVALS · ${stop.name.toUpperCase()}</div>
      ${arrivals
        .map(
          ({ bus, distKm, mins }) => `
        <div class="led-row">
          <span class="route-tag" style="background:${bus.color};text-align:center">${bus.routeId}</span>
          <div>
            <div>${bus.reg}</div>
            <div style="font-size:10px;color:#94a3b8">${distKm} km away · ${bus.crowd}</div>
          </div>
          <div class="led-eta">${mins <= 1 ? "DUE" : `${mins} min`}</div>
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
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), 3000);
  }

  // Bind UI Controls
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("drawerToggle").addEventListener("click", () => {
    document.getElementById("drawer").classList.toggle("collapsed");
  });

  document.getElementById("fleetSearch").addEventListener("input", renderFleetList);

  // Map Style Switcher
  document.querySelectorAll("[data-style]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-style]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      map.setStyle(MAP_STYLES[btn.dataset.style]);
    });
  });

  // Camera Presets
  document.getElementById("btn3DView").addEventListener("click", () => {
    chaseCamActive = false;
    updateChaseButton();
    map.flyTo({ center: TUMKUR_CENTER, zoom: 13.8, pitch: 60, bearing: -15, duration: 900 });
  });

  document.getElementById("btn2DView").addEventListener("click", () => {
    chaseCamActive = false;
    updateChaseButton();
    map.flyTo({ center: TUMKUR_CENTER, zoom: 13.2, pitch: 0, bearing: 0, duration: 800 });
  });

  document.getElementById("btnScaleToggle").addEventListener("click", (e) => {
    boostScale = !boostScale;
    e.target.textContent = boostScale ? "3D Scale: Boost" : "3D Scale: Real";
  });

  // Landmark Quick Jumps
  document.querySelectorAll("[data-fly]").forEach((btn) => {
    btn.addEventListener("click", () => {
      chaseCamActive = false;
      updateChaseButton();
      const target = LANDMARKS[btn.dataset.fly];
      if (target) map.flyTo({ ...target, duration: 1000 });
    });
  });

  // Nearest Stop Geolocation
  document.getElementById("btnNearestStop").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Geolocation not supported by your browser.");
      return;
    }
    showToast("Finding nearest Tumakuru bus stop...");
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
        renderLedBoard();
        switchTab("stops");
        map.flyTo({ center: nearest.coord, zoom: 15.6, pitch: 58, duration: 1000 });
        showToast(`Nearest stop: ${nearest.name} (${(bestDist / 1000).toFixed(1)} km)`);
      },
      () => showToast("Location permission denied.")
    );
  });

  // Inspector Buttons
  document.getElementById("btnCloseInspector").addEventListener("click", () => {
    document.getElementById("busInspector").classList.add("hidden");
    chaseCamActive = false;
    updateChaseButton();
    selectedBusId = null;
    renderFleetList();
  });

  document.getElementById("btnLights").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    e.target.textContent = active ? "Lights ON" : "Lights OFF";
    inspector3D.setLights(active);
  });

  document.getElementById("btnWireframe").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    inspector3D.setWireframe(active);
  });

  function updateChaseButton() {
    const btn = document.getElementById("btnChaseCam");
    btn.classList.toggle("active-chase", chaseCamActive);
    btn.textContent = chaseCamActive ? "Stop 3D Chase Cam" : "Start 3D Chase Cam";
  }

  document.getElementById("btnChaseCam").addEventListener("click", () => {
    chaseCamActive = !chaseCamActive;
    updateChaseButton();
    if (chaseCamActive) showToast("3D Chase Cam locked onto bus.");
  });

  // Live Feed / GPS Modal
  const feedModal = document.getElementById("feedModal");
  document.getElementById("btnOpenFeedModal").addEventListener("click", () => {
    feedModal.classList.remove("hidden");
  });
  document.getElementById("btnCloseFeedModal").addEventListener("click", () => {
    feedModal.classList.add("hidden");
  });

  document.getElementById("btnConnectApi").addEventListener("click", async () => {
    const url = document.getElementById("apiUrlInput").value.trim();
    if (!url) return showToast("Enter a valid JSON endpoint URL.");
    clearInterval(apiPollTimer);

    const poll = async () => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid format");
        fleet = data.map((item, idx) => {
          const r = ROUTES.find((rt) => rt.id === item.routeId) || ROUTES[0];
          return {
            id: item.id || `live-${idx}`,
            routeId: r.id,
            color: r.color,
            accent: r.accent,
            reg: item.reg || `LIVE-${idx + 1}`,
            lng: Number(item.lng),
            lat: Number(item.lat),
            heading: Number(item.heading) || 0,
            speedKmh: Math.round(Number(item.speed) || 0),
            braking: (Number(item.speed) || 0) < 5,
            crowd: item.crowd || "Live",
            nextStopName: item.nextStop || "Live Telemetry",
            etaMin: item.etaMin || 2,
            isExternal: true
          };
        });
        document.getElementById("feedStatusText").textContent =
          `${fleet.length} Live API Buses Connected`;
        renderFleetList();
        renderLedBoard();
      } catch {
        showToast("Could not load JSON feed (check CORS / URL).");
      }
    };

    await poll();
    apiPollTimer = setInterval(poll, 4000);
    feedModal.classList.add("hidden");
  });

  document.getElementById("btnToggleGps").addEventListener("click", (e) => {
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
            color: r.color,
            accent: r.accent,
            reg: "MY-GPS-LIVE",
            lng: longitude,
            lat: latitude,
            heading: heading || 0,
            speedKmh: Math.round((speed || 0) * 3.6),
            braking: false,
            crowd: "Live GPS",
            nextStopName: "Device GPS",
            etaMin: 1,
            isExternal: true
          };
          fleet.unshift(myBus);
        } else {
          myBus.lng = longitude;
          myBus.lat = latitude;
          if (heading != null && !Number.isNaN(heading)) myBus.heading = heading;
          myBus.speedKmh = Math.round((speed || 0) * 3.6);
        }
        document.getElementById("feedStatusText").textContent =
          `Broadcasting Live GPS on Route ${r.id}`;
        selectBus("my-gps-bus", true);
      },
      () => showToast("Unable to read device GPS."),
      { enableHighAccuracy: true }
    );

    e.target.textContent = "Stop GPS";
    feedModal.classList.add("hidden");
    showToast("Broadcasting your device GPS as a 3D bus.");
  });

  document.getElementById("btnResetSim").addEventListener("click", () => {
    clearInterval(apiPollTimer);
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
    fleet = createInitialFleet();
    document.getElementById("feedStatusText").textContent =
      `${fleet.length} Buses Active · Simulated Telemetry`;
    renderFleetList();
    renderLedBoard();
    feedModal.classList.add("hidden");
    showToast("Switched back to simulated Tumakuru fleet.");
  });

  // Main Animation Loop
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
        if (chaseCamActive) {
          map.easeTo({
            center: [activeBus.lng, activeBus.lat],
            bearing: activeBus.heading,
            pitch: 66,
            zoom: 16.2,
            duration: 280,
            easing: (t) => t
          });
        }
        if (now - uiTick > 500) {
          updateInspectorMetrics(activeBus);
        }
      }
    }

    if (now - uiTick > 1000) {
      uiTick = now;
      renderFleetList();
      renderLedBoard();
    }
  }

  // Boot
  initStopMarkers();
  renderRoutePills();
  renderFleetList();
  renderRoutesTab();
  initStopBoard();
  requestAnimationFrame(loop);
})();
