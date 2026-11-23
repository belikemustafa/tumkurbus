window.TumkurFeatures = (() => {
  const CUSTOM_STOPS_KEY = "tumkur_custom_stops_v1";
  const COMMUTES_KEY = "tumkur_saved_commutes_v1";

  // -------------------------------------------------------------------------
  // 1. KSRTC TIMETABLES, FREQUENCY & FIRST/LAST BUS DATA
  // -------------------------------------------------------------------------
  const TIMETABLES = {
    "201": { first: "05:45", last: "22:15", freqMin: 10, note: "High-frequency B.H. Road backbone" },
    "201E": { first: "06:15", last: "21:30", freqMin: 15, note: "Electric city shuttle to Siddaganga Mutt" },
    "201B": { first: "06:30", last: "21:00", freqMin: 20, note: "SS Puram & SIT Back Gate loop" },
    "202": { first: "06:00", last: "21:45", freqMin: 15, note: "North-South Sira Gate corridor" },
    "203": { first: "06:00", last: "21:30", freqMin: 15, note: "Railway Station & NH-48 Oorukere link" },
    "204": { first: "06:30", last: "21:00", freqMin: 20, note: "West-East Gangasandra to Belagumba" },
    "205": { first: "06:30", last: "21:15", freqMin: 20, note: "Upparahalli & Shettihalli local" },
    "206": { first: "06:15", last: "21:30", freqMin: 20, note: "Kunigal Road & Gulur corridor" },
    "208": { first: "05:45", last: "22:00", freqMin: 25, note: "Suburban shuttle to Gubbi Town" },
    "BLR-SRG": { first: "00:00", last: "23:59", freqMin: 10, is24x7: true, note: "24×7 KSRTC Sarige Express via NH-48" },
    "BLR-RJ": { first: "05:30", last: "22:30", freqMin: 30, note: "Hebbal ORR & KR Puram Executive" },
    "BLR-AC1": { first: "05:45", last: "23:15", freqMin: 30, note: "Airavat Club Class Volvo AC" },
    "BLR-EV": { first: "06:00", last: "22:30", freqMin: 25, note: "KSRTC EV Power Plus AC Coach" },
    "BLR-AMB": { first: "06:30", last: "23:30", freqMin: 45, note: "Shantinagar & Electronic City AC Sleeper" },
    "BLR-KIA": { first: "04:00", last: "23:00", freqMin: 60, note: "Direct Kempegowda Airport FlyBus AC" }
  };

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function formatClock12(totalMin) {
    const wrapped = ((totalMin % 1440) + 1440) % 1440;
    const h24 = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function getScheduleInfo(routeId, nowDate = new Date()) {
    const meta = TIMETABLES[routeId] || {
      first: "06:00",
      last: "22:00",
      freqMin: 20,
      note: "Scheduled KSRTC service"
    };

    const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
    const firstMin = toMinutes(meta.first);
    const lastMin = toMinutes(meta.last);
    const upcoming = [];

    if (meta.is24x7) {
      let next = Math.ceil((nowMin + 1) / meta.freqMin) * meta.freqMin;
      for (let i = 0; i < 3; i++) {
        upcoming.push(formatClock12(next + i * meta.freqMin));
      }
      return {
        ...meta,
        windowLabel: "24×7 Service",
        inService: true,
        upcoming
      };
    }

    const inService = nowMin >= firstMin && nowMin <= lastMin;
    let next;
    if (nowMin < firstMin) {
      next = firstMin;
    } else if (nowMin > lastMin) {
      next = firstMin; // Tomorrow's first departures
    } else {
      const elapsed = nowMin - firstMin;
      next = firstMin + Math.ceil((elapsed + 1) / meta.freqMin) * meta.freqMin;
    }

    for (let i = 0; i < 3; i++) {
      const dep = next + i * meta.freqMin;
      if (dep <= lastMin || nowMin > lastMin || nowMin < firstMin) {
        upcoming.push(formatClock12(dep));
      }
    }

    return {
      ...meta,
      windowLabel: `${formatClock12(firstMin)} – ${formatClock12(lastMin)}`,
      inService,
      upcoming: upcoming.length ? upcoming : [formatClock12(firstMin)]
    };
  }

  // -------------------------------------------------------------------------
  // 2. NH-48 & TUMAKURU CITY TRAFFIC BOTTLENECK ENGINE
  // -------------------------------------------------------------------------
  const BOTTLENECKS = [
    {
      id: "bh-townhall",
      name: "B.H. Road / Town Hall – KSRTC",
      coord: [77.1022, 13.3395],
      radiusM: 650,
      peakDelayMin: 6,
      modDelayMin: 2
    },
    {
      id: "sit-batawadi",
      name: "SIT – Batawadi Junction",
      coord: [77.1295, 13.3328],
      radiusM: 750,
      peakDelayMin: 5,
      modDelayMin: 2
    },
    {
      id: "kyathsandra-merge",
      name: "Kyathsandra NH-48 Merge",
      coord: [77.1462, 13.3137],
      radiusM: 850,
      peakDelayMin: 6,
      modDelayMin: 2
    },
    {
      id: "nelamangala-toll",
      name: "Nelamangala Toll & Flyover",
      coord: [77.3942, 13.0982],
      radiusM: 1500,
      peakDelayMin: 12,
      modDelayMin: 5
    },
    {
      id: "goragunte-8thmile",
      name: "8th Mile – Goraguntepalya",
      coord: [77.5401, 13.0297],
      radiusM: 2200,
      peakDelayMin: 16,
      modDelayMin: 7
    },
    {
      id: "hebbal-flyover",
      name: "Hebbal Flyover (ORR)",
      coord: [77.5913, 13.0358],
      radiusM: 1400,
      peakDelayMin: 14,
      modDelayMin: 6
    }
  ];

  function getTrafficState(nowDate = new Date()) {
    const hr = nowDate.getHours();
    const isPeak = (hr >= 8 && hr < 11) || (hr >= 17 && hr < 21);
    const isNight = hr >= 22 || hr < 6;
    if (isPeak) {
      return { level: "Peak Traffic", severity: "heavy", multiplier: 1.38, color: "#dc2626" };
    }
    if (isNight) {
      return { level: "Free Flow", severity: "clear", multiplier: 1.0, color: "#059669" };
    }
    return { level: "Moderate Traffic", severity: "moderate", multiplier: 1.15, color: "#d97706" };
  }

  function evaluateCorridorBottlenecks(fromCoord, toCoord, haversineMeters, nowDate = new Date()) {
    const state = getTrafficState(nowDate);
    if (state.severity === "clear") {
      return { state, extraMin: 0, hotspots: [] };
    }

    const totalD = haversineMeters(fromCoord, toCoord);
    const hotspots = [];
    let extraMin = 0;

    BOTTLENECKS.forEach((zone) => {
      const d1 = haversineMeters(fromCoord, zone.coord);
      const d2 = haversineMeters(toCoord, zone.coord);
      // Check if bottleneck sits near the start, end, or along the corridor ellipse
      if (d1 < zone.radiusM * 1.4 || d2 < zone.radiusM * 1.4 || d1 + d2 < totalD * 1.18) {
        const delay = state.severity === "heavy" ? zone.peakDelayMin : zone.modDelayMin;
        extraMin += delay;
        hotspots.push({ ...zone, delayMin: delay });
      }
    });

    return { state, extraMin, hotspots };
  }

  function buildBottleneckGeoJSON(nowDate = new Date()) {
    const state = getTrafficState(nowDate);
    const earthR = 6371000;
    const features = BOTTLENECKS.map((zone) => {
      const pts = [];
      const latRad = (zone.coord[1] * Math.PI) / 180;
      const dLat = (zone.radiusM / earthR) * (180 / Math.PI);
      const dLng = dLat / Math.cos(latRad);
      for (let i = 0; i <= 36; i++) {
        const th = (i / 36) * Math.PI * 2;
        pts.push([zone.coord[0] + Math.cos(th) * dLng, zone.coord[1] + Math.sin(th) * dLat]);
      }
      return {
        type: "Feature",
        properties: {
          id: zone.id,
          name: zone.name,
          color: state.color,
          delayMin: state.severity === "heavy" ? zone.peakDelayMin : state.severity === "moderate" ? zone.modDelayMin : 0
        },
        geometry: { type: "Polygon", coordinates: [pts] }
      };
    });
    return { type: "FeatureCollection", features };
  }

  // -------------------------------------------------------------------------
  // 3. POINT-TO-POINT TRIP PLANNER (DIRECT + 1-TRANSFER)
  // -------------------------------------------------------------------------
  function planPointToPointTrip({
    fromId,
    toId,
    routes,
    stops,
    fleet,
    findStop,
    estimateFares,
    haversineMeters,
    passengerType = "adult"
  }) {
    const fromStop = findStop(fromId);
    const toStop = findStop(toId);
    if (!fromStop || !toStop || fromId === toId) return null;

    const traffic = evaluateCorridorBottlenecks(fromStop.coord, toStop.coord, haversineMeters);

    function routeServes(route, stopId) {
      return route.stops.some((s) => s.id === stopId);
    }

    function nextLiveBusForRoute(routeId, stopCoord) {
      const buses = fleet.filter((b) => b.routeId === routeId);
      if (!buses.length) return null;
      let best = null;
      let bestMin = Infinity;
      buses.forEach((b) => {
        const d = haversineMeters([b.lng, b.lat], stopCoord);
        const speedMps = Math.max(5, ((b.speedKmh || 28) * 1000) / 3600);
        const mins = Math.max(1, Math.round((d / speedMps / 60) * traffic.state.multiplier));
        if (mins < bestMin) {
          bestMin = mins;
          best = { bus: b, etaMin: mins, distKm: (d / 1000).toFixed(1) };
        }
      });
      return best;
    }

    const fareEst = estimateFares(fromId, toId, passengerType);

    // 1. Direct Route Options
    const directOptions = routes
      .filter((r) => routeServes(r, fromId) && routeServes(r, toId))
      .map((r) => {
        const nextBus = nextLiveBusForRoute(r.id, fromStop.coord);
        const sched = getScheduleInfo(r.id);
        const distKm = fareEst ? fareEst.distanceKm : Math.max(1.2, (haversineMeters(fromStop.coord, toStop.coord) / 1000) * 1.18);
        const baseRideMin = Math.max(6, Math.round((distKm / (r.category === "bangalore" ? 45 : 24)) * 60));
        const totalRideMin = baseRideMin + traffic.extraMin;

        // Match closest fare tier
        let estFare = 15;
        if (fareEst && fareEst.tiers.length) {
          const matchedTier =
            fareEst.tiers.find((t) => (t.routeIds || []).includes(r.id)) ||
            fareEst.tiers.find((t) => t.isAC === Boolean(r.isAC)) ||
            fareEst.tiers[0];
          estFare = matchedTier.fare;
        }

        return {
          type: "direct",
          route: r,
          nextBus,
          schedule: sched,
          rideMin: totalRideMin,
          fare: estFare
        };
      })
      .sort((a, b) => (a.nextBus ? a.nextBus.etaMin : 99) - (b.nextBus ? b.nextBus.etaMin : 99));

    // 2. 1-Transfer Options (when direct routes are sparse or unavailable)
    const transferOptions = [];
    if (directOptions.length < 2) {
      const majorHubs = ["ksrtc", "kyathsandra", "batawadi", "sit", "nelamangala", "goragunte", "townhall"];
      const fromRoutes = routes.filter((r) => routeServes(r, fromId));
      const toRoutes = routes.filter((r) => routeServes(r, toId));
      const seenPairs = new Set();

      for (const hubId of majorHubs) {
        if (hubId === fromId || hubId === toId) continue;
        const hubStop = findStop(hubId);
        if (!hubStop) continue;

        const leg1Candidates = fromRoutes.filter((r) => routeServes(r, hubId));
        const leg2Candidates = toRoutes.filter((r) => routeServes(r, hubId));

        if (leg1Candidates.length && leg2Candidates.length) {
          const r1 = leg1Candidates[0];
          const r2 = leg2Candidates.find((r) => r.id !== r1.id) || leg2Candidates[0];
          if (r1.id === r2.id) continue;
          const pairKey = `${r1.id}->${hubId}->${r2.id}`;
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          const f1 = estimateFares(fromId, hubId, passengerType);
          const f2 = estimateFares(hubId, toId, passengerType);
          const fare1 = f1?.tiers?.[0]?.fare ?? 15;
          const fare2 = f2?.tiers?.[0]?.fare ?? 20;
          const d1 = (haversineMeters(fromStop.coord, hubStop.coord) / 1000) * 1.18;
          const d2 = (haversineMeters(hubStop.coord, toStop.coord) / 1000) * 1.18;
          const rideMin =
            Math.max(5, Math.round((d1 / (r1.category === "bangalore" ? 45 : 24)) * 60)) +
            Math.max(5, Math.round((d2 / (r2.category === "bangalore" ? 45 : 24)) * 60)) +
            6 + // transfer buffer
            traffic.extraMin;

          transferOptions.push({
            type: "transfer",
            hubStop,
            leg1: r1,
            leg2: r2,
            nextBus: nextLiveBusForRoute(r1.id, fromStop.coord),
            rideMin,
            fare: fare1 + fare2
          });
        }
        if (transferOptions.length >= 2) break;
      }
    }

    return {
      fromStop,
      toStop,
      traffic,
      fareEst,
      directOptions: directOptions.slice(0, 4),
      transferOptions
    };
  }

  // -------------------------------------------------------------------------
  // 4. SAVED DAILY COMMUTES (localStorage)
  // -------------------------------------------------------------------------
  const DEFAULT_COMMUTES = [
    { id: "c-sit-ksrtc", label: "SIT Gate → KSRTC", fromId: "sit", toId: "ksrtc" },
    { id: "c-tmk-blr", label: "Tumakuru → Majestic", fromId: "ksrtc", toId: "majestic" }
  ];

  function loadSavedCommutes() {
    try {
      const raw = localStorage.getItem(COMMUTES_KEY);
      if (!raw) return [...DEFAULT_COMMUTES];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [...DEFAULT_COMMUTES];
    } catch {
      return [...DEFAULT_COMMUTES];
    }
  }

  function saveCommutesList(list) {
    try {
      localStorage.setItem(COMMUTES_KEY, JSON.stringify(list));
    } catch {
      // Ignore storage quota
    }
  }

  // -------------------------------------------------------------------------
  // 5. DRAG-AND-DROP STOP EDITOR PERSISTENCE
  // -------------------------------------------------------------------------
  function loadStopOverrides() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_STOPS_KEY) || '{"moved":{},"added":[]}');
    } catch {
      return { moved: {}, added: [] };
    }
  }

  function saveStopOverrides(data) {
    try {
      localStorage.setItem(CUSTOM_STOPS_KEY, JSON.stringify(data));
    } catch {
      // Ignore
    }
  }

  function applySavedStopOverrides(stops, routes) {
    const saved = loadStopOverrides();

    // Apply dragged coordinates to existing stops & route stops
    Object.entries(saved.moved || {}).forEach(([stopId, coord]) => {
      if (!Array.isArray(coord) || coord.length !== 2) return;
      const master = stops.find((s) => s.id === stopId);
      if (master) {
        master.coord = [...coord];
        master.pinned = true;
      }
      routes.forEach((r) => {
        r.stops.forEach((s) => {
          if (s.id === stopId) {
            s.coord = [...coord];
            s.pinned = true;
          }
        });
      });
    });

    // Append user-added stops
    (saved.added || []).forEach((customStop) => {
      if (!stops.some((s) => s.id === customStop.id)) {
        stops.push({ ...customStop, pinned: true });
      }
    });
  }

  function recordMovedStop(stopId, coord, stops, routes) {
    const saved = loadStopOverrides();
    const isAdded = (saved.added || []).find((s) => s.id === stopId);
    if (isAdded) {
      isAdded.coord = [...coord];
    } else {
      saved.moved[stopId] = [...coord];
    }
    saveStopOverrides(saved);

    const master = stops.find((s) => s.id === stopId);
    if (master) {
      master.coord = [...coord];
      master.pinned = true;
    }
    routes.forEach((r) => {
      r.stops.forEach((s) => {
        if (s.id === stopId) {
          s.coord = [...coord];
          s.pinned = true;
        }
      });
    });
  }

  function recordAddedStop(stopObj, stops) {
    const saved = loadStopOverrides();
    saved.added = saved.added || [];
    saved.added.push(stopObj);
    saveStopOverrides(saved);
    stops.push(stopObj);
  }

  function clearStopOverrides() {
    try {
      localStorage.removeItem(CUSTOM_STOPS_KEY);
    } catch {
      // Ignore
    }
  }

  function exportStopsSnippet(stops) {
    const out = {};
    stops.forEach((s) => {
      out[s.id] = {
        name: s.name,
        kn: s.kn || s.name,
        lat: Number(s.coord[1].toFixed(6)),
        lng: Number(s.coord[0].toFixed(6))
      };
    });
    return JSON.stringify(out, null, 2);
  }

  // -------------------------------------------------------------------------
  // 6. ESCAPE HELPER
  // -------------------------------------------------------------------------
  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    TIMETABLES,
    BOTTLENECKS,
    getScheduleInfo,
    getTrafficState,
    evaluateCorridorBottlenecks,
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
  };
})();
