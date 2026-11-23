(() => {
  const {
    TUMKUR_CENTER,
    LANDMARKS,
    ROUTES,
    STOPS,
    haversineMeters,
    snapRoutesToRealRoads,
    createInitialFleet,
    stepFleet
  } = window.TumkurData;

  // Street & Satellite Only (Dark Mode Removed)
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
  let followBusActive = false;
  let boostScale = true;
  let apiPollTimer = null;
  let gpsWatchId = null;
  let currentStyleName = "street";

  const busMarkers = new Map();
  let stopMarkers = [];

  // Strict 2D Top-Down Map (pitch locked at 0, rotation disabled)
  const map = new maplibregl.Map({
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

  const inspector3D = new window.Bus3D.BusInspector3D(
    document.getElementById("inspectorCanvas")
  );

  function buildRouteGeoJSON() {
    return {
      type: "FeatureCollection",
      features: ROUTES.map((r) => ({
        type: "Feature",
        properties: { id: r.id, color: r.color, name: r.name, category: r.category },
        geometry: { type: "LineString", coordinates: r.path }
      }))
    };
  }

  function updateRouteSourceData() {
    const src = map.getSource("tumkur-routes");
    if (src) src.setData(buildRouteGeoJSON());
  }

  function attachMapLayers() {
    map.addSource("tumkur-routes", {
      type: "geojson",
      data: buildRouteGeoJSON()
    });

    // Crisp white casing so route lines read clearly on both Street and Satellite maps
    map.addLayer({
      id: "routes-casing",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": currentStyleName === "satellite" ? 6.5 : 5.5,
        "line-opacity": 0.85
      }
    });

    // Colored route centerline
    map.addLayer({
      id: "routes-core",
      type: "line",
      source: "tumkur-routes",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3.5,
        "line-opacity": 0.95
      }
    });

    // 3D Bus WebGL Layer directly on top of the 2D map
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
    let filter = null;
    if (selectedRouteFilter === "CITY") {
      filter = ["==", ["get", "category"], "city"];
    } else if (selectedRouteFilter === "BLR") {
      filter = ["==", ["get", "category"], "bangalore"];
    } else if (selectedRouteFilter !== "ALL") {
      filter = ["==", ["get", "id"], selectedRouteFilter];
    }
    map.setFilter("routes-core", filter);
    map.setFilter("routes-casing", filter);
  }

  function getVisibleFleet() {
    if (selectedRouteFilter === "ALL") return fleet;
    if (selectedRouteFilter === "CITY") return fleet.filter((b) => b.category === "city");
    if (selectedRouteFilter === "BLR") return fleet.filter((b) => b.category === "bangalore");
    return fleet.filter((b) => b.routeId === selectedRouteFilter);
  }

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
        renderArrivalBoard();
        switchTab("stops");
      });

      return new maplibregl.Marker({ element: el })
        .setLngLat(stop.coord)
        .setPopup(popup)
        .addTo(map);
    });
  }

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

  function selectBus(busId, flyToBus = false) {
    const bus = fleet.find((b) => b.id === busId);
    if (!bus) return;

    selectedBusId = busId;
    document.getElementById("busInspector").classList.remove("hidden");

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
        pitch: 0,
        bearing: 0,
        duration: 850
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

  function renderRoutePills() {
    const wrap = document.getElementById("routeFilterPills");
    const items = [
      { id: "ALL", label: "All (36)", color: "#0f172a" },
      { id: "CITY", label: "Tumakuru", color: "#dc2626" },
      { id: "BLR", label: "To BLR", color: "#1d4ed8" },
      ...ROUTES.map((r) => ({ id: r.id, label: r.id, color: r.color }))
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
        renderRoutePills();
        applyRouteLayerFilter();
        renderFleetList();
        if (selectedRouteFilter === "BLR" || selectedRouteFilter.startsWith("BLR-")) {
          map.flyTo({ ...LANDMARKS.corridor, pitch: 0, bearing: 0, duration: 900 });
        }
      });
    });
  }

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
            <span style="font-size:11px;color:var(--emerald);font-weight:800;white-space:nowrap">${activeCount} Live</span>
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
        if (selectedRouteFilter.startsWith("BLR-")) {
          map.flyTo({ ...LANDMARKS.corridor, pitch: 0, bearing: 0, duration: 900 });
        } else {
          map.flyTo({ ...LANDMARKS.tumkur, pitch: 0, bearing: 0, duration: 900 });
        }
      });
    });
  }

  function initStopBoard() {
    const select = document.getElementById("stopSelect");
    select.innerHTML = STOPS.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    select.addEventListener("change", renderArrivalBoard);

    const gpsSelect = document.getElementById("gpsRouteSelect");
    gpsSelect.innerHTML = ROUTES.map(
      (r) => `<option value="${r.id}">${r.id} — ${r.name}</option>`
    ).join("");

    renderArrivalBoard();
  }

  function renderArrivalBoard() {
    const stopId = document.getElementById("stopSelect").value;
    const stop = STOPS.find((s) => s.id === stopId) || STOPS[0];
    const board = document.getElementById("arrivalBoard");

    const arrivals = fleet
      .map((bus) => {
        const distM = haversineMeters([bus.lng, bus.lat], stop.coord);
        const speedMps = Math.max(5, ((bus.speedKmh || 28) * 1000) / 3600);
        const mins = Math.max(1, Math.round(distM / speedMps / 60));
        return { bus, distKm: (distM / 1000).toFixed(1), mins };
      })
      .sort((a, b) => a.mins - b.mins)
      .slice(0, 8);

    board.innerHTML = `
      <div class="board-title">LIVE ARRIVALS · ${stop.name.toUpperCase()}</div>
      ${arrivals
        .map(
          ({ bus, distKm, mins }) => `
        <div class="board-row">
          <span class="route-tag" style="background:${bus.color};text-align:center;margin:0">${bus.routeId}</span>
          <div>
            <div style="font-weight:700">${bus.reg}</div>
            <div style="font-size:10.5px;color:var(--muted)">${distKm} km away · ${bus.crowd}</div>
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
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), 3000);
  }

  // UI Bindings
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("drawerToggle").addEventListener("click", () => {
    document.getElementById("drawer").classList.toggle("collapsed");
  });

  document.getElementById("fleetSearch").addEventListener("input", renderFleetList);

  // Street / Satellite Switcher
  document.querySelectorAll("[data-style]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-style]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentStyleName = btn.dataset.style;
      map.setStyle(MAP_STYLES[currentStyleName]);
    });
  });

  // 3D Bus Visual Size Toggle
  document.getElementById("btnScaleToggle").addEventListener("click", (e) => {
    boostScale = !boostScale;
    e.target.classList.toggle("active", boostScale);
    e.target.textContent = boostScale ? "3D Bus Size: Boost" : "3D Bus Size: Real";
  });

  // Quick Jump Landmarks (strict 2D top view)
  document.querySelectorAll("[data-fly]").forEach((btn) => {
    btn.addEventListener("click", () => {
      followBusActive = false;
      updateFollowButton();
      const target = LANDMARKS[btn.dataset.fly];
      if (target) map.flyTo({ ...target, pitch: 0, bearing: 0, duration: 900 });
    });
  });

  // Nearest Stop Geolocation
  document.getElementById("btnNearestStop").addEventListener("click", () => {
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
        map.flyTo({ center: nearest.coord, zoom: 15.6, pitch: 0, bearing: 0, duration: 900 });
        showToast(`Nearest stop: ${nearest.name} (${(bestDist / 1000).toFixed(1)} km)`);
      },
      () => showToast("Location permission denied.")
    );
  });

  // Inspector Controls
  document.getElementById("btnCloseInspector").addEventListener("click", () => {
    document.getElementById("busInspector").classList.add("hidden");
    followBusActive = false;
    updateFollowButton();
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

  function updateFollowButton() {
    const btn = document.getElementById("btnFollowBus");
    btn.classList.toggle("active-follow", followBusActive);
    btn.textContent = followBusActive ? "Stop Following Bus" : "Follow Bus on Map";
  }

  document.getElementById("btnFollowBus").addEventListener("click", () => {
    followBusActive = !followBusActive;
    updateFollowButton();
    if (followBusActive) showToast("Following bus in 2D top view.");
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
            category: r.category,
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
        renderArrivalBoard();
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
            category: r.category,
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
      `${fleet.length} Buses Active · Road-Snapped Simulation`;
    renderFleetList();
    renderArrivalBoard();
    feedModal.classList.add("hidden");
    showToast("Switched back to simulated fleet.");
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
        if (followBusActive) {
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

    if (now - uiTick > 1000) {
      uiTick = now;
      renderFleetList();
      renderArrivalBoard();
    }
  }

  // Boot & Snap all 9 routes to real OSM roads via OSRM
  initStopMarkers();
  renderRoutePills();
  renderFleetList();
  renderRoutesTab();
  initStopBoard();
  requestAnimationFrame(loop);

  snapRoutesToRealRoads((route, done, total) => {
    updateRouteSourceData();
    document.getElementById("feedStatusText").textContent =
      done < total
        ? `36 Buses Active · Aligning roads (${done}/${total})...`
        : `36 Buses Active · Road-Aligned (Tumakuru & Bengaluru)`;
  }).then((snapped) => {
    if (snapped === 0) {
      document.getElementById("feedStatusText").textContent =
        "36 Buses Active · Simulated Telemetry (Offline Fallback)";
    }
  });
})();
