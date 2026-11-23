window.TumkurData = (() => {
  const TUMKUR_CENTER = [77.1130, 13.3375];

  const LANDMARKS = {
    tumkur: { center: [77.1130, 13.3375], zoom: 13.3 },
    ksrtc: { center: [77.1074, 13.3378], zoom: 16.0 },
    sit: { center: [77.1262, 13.3268], zoom: 16.0 },
    mutt: { center: [77.1496, 13.3198], zoom: 15.6 },
    corridor: { center: [77.3400, 13.1550], zoom: 10.2 },
    nelamangala: { center: [77.3936, 13.0998], zoom: 13.8 },
    majestic: { center: [77.5724, 12.9781], zoom: 14.5 }
  };

  // Authentic Tumakuru City + Tumakuru–Bengaluru NH-48 Routes
  // Each route snaps to real roads via OSRM on load (cached in localStorage)
  const ROUTES = [
    {
      id: "201",
      category: "city",
      name: "Heggere – KSRTC Stand – SIT – Kyathsandra",
      livery: "KSRTC City Crimson",
      color: "#dc2626",
      accent: "#fde047",
      busCount: 5,
      baseSpeed: 32,
      stops: [
        { id: "heggere", name: "Heggere / SSMC", coord: [77.0655, 13.3312] },
        { id: "gubbi", name: "Gubbi Gate", coord: [77.0902, 13.3376] },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1018, 13.3408] },
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "univ", name: "Tumkur University", coord: [77.1165, 13.3340] },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268] },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1319, 13.3282] },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143] }
      ]
    },
    {
      id: "201E",
      category: "city",
      name: "KSRTC Stand – Tumkur Univ – Siddaganga Mutt",
      livery: "EV Smart Emerald",
      color: "#059669",
      accent: "#a7f3d0",
      busCount: 3,
      baseSpeed: 30,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "univ", name: "Tumkur University", coord: [77.1165, 13.3340] },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268] },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143] },
        { id: "mutt", name: "Siddaganga Mutt", coord: [77.1496, 13.3198] }
      ]
    },
    {
      id: "202",
      category: "city",
      name: "Shettihalli – KSRTC – Sira Gate – Antharasanahalli",
      livery: "Royal Gold City",
      color: "#d97706",
      accent: "#1e293b",
      busCount: 4,
      baseSpeed: 34,
      stops: [
        { id: "shettihalli", name: "Shettihalli Gate", coord: [77.0958, 13.3260] },
        { id: "sspuram", name: "SS Puram Main Rd", coord: [77.1045, 13.3315] },
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1018, 13.3408] },
        { id: "siragate", name: "Sira Gate", coord: [77.1021, 13.3543] },
        { id: "anthara", name: "Antharasanahalli", coord: [77.0956, 13.3818] }
      ]
    },
    {
      id: "203",
      category: "city",
      name: "Maralur Dinne – Gubbi Gate – KSRTC – Oorukere",
      livery: "Coastal Cyan",
      color: "#0891b2",
      accent: "#cffafe",
      busCount: 4,
      baseSpeed: 33,
      stops: [
        { id: "maralur", name: "Maralur Dinne", coord: [77.0785, 13.3348] },
        { id: "gubbi", name: "Gubbi Gate", coord: [77.0902, 13.3376] },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1018, 13.3408] },
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "siragate", name: "Sira Gate", coord: [77.1021, 13.3543] },
        { id: "oorukere", name: "Oorukere (NH-48)", coord: [77.0875, 13.3950] }
      ]
    },
    {
      id: "204",
      category: "city",
      name: "SS Puram – Ring Road – SIT – Batawadi",
      livery: "Deccan Violet",
      color: "#7c3aed",
      accent: "#ede9fe",
      busCount: 3,
      baseSpeed: 31,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "sspuram", name: "SS Puram Main Rd", coord: [77.1045, 13.3315] },
        { id: "upparahalli", name: "Upparahalli", coord: [77.1140, 13.3230] },
        { id: "jayanagar", name: "Jayanagar Ring Rd", coord: [77.1210, 13.3245] },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268] },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1319, 13.3282] }
      ]
    },
    {
      id: "205",
      category: "city",
      name: "KSRTC – Upparahalli – Jayanagar – Kyathsandra",
      livery: "Teal Metro Shuttle",
      color: "#0d9488",
      accent: "#ccfbf1",
      busCount: 3,
      baseSpeed: 30,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "upparahalli", name: "Upparahalli", coord: [77.1140, 13.3230] },
        { id: "jayanagar", name: "Jayanagar Ring Rd", coord: [77.1210, 13.3245] },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143] }
      ]
    },
    {
      id: "BLR-EXP",
      category: "bangalore",
      name: "Tumakuru ↔ Bengaluru Majestic (KSRTC Sarige)",
      livery: "KSRTC Sarige Red",
      color: "#b91c1c",
      accent: "#fef08a",
      busCount: 6,
      baseSpeed: 62,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268] },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143] },
        { id: "hirehalli", name: "Hirehalli Ind. Area", coord: [77.1755, 13.2845] },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276] },
        { id: "nelamangala", name: "Nelamangala Bus Stand", coord: [77.3936, 13.0998] },
        { id: "dasarahalli", name: "8th Mile / Dasarahalli", coord: [77.5085, 13.0448] },
        { id: "jalahalli", name: "Jalahalli Cross", coord: [77.5154, 13.0384] },
        { id: "goragunte", name: "Goraguntepalya", coord: [77.5404, 13.0285] },
        { id: "yeshwantpur", name: "Yeshwantpur Circle", coord: [77.5540, 13.0235] },
        { id: "majestic", name: "Majestic KBS (Bengaluru)", coord: [77.5724, 12.9781] }
      ]
    },
    {
      id: "BLR-VOL",
      category: "bangalore",
      name: "Tumakuru ↔ Bengaluru Majestic (Airavat Volvo AC)",
      livery: "Airavat Royal Blue",
      color: "#1d4ed8",
      accent: "#93c5fd",
      busCount: 4,
      baseSpeed: 70,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1319, 13.3282] },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276] },
        { id: "nelamangala", name: "Nelamangala Bypass", coord: [77.3936, 13.0998] },
        { id: "goragunte", name: "Goraguntepalya", coord: [77.5404, 13.0285] },
        { id: "yeshwantpur", name: "Yeshwantpur Circle", coord: [77.5540, 13.0235] },
        { id: "majestic", name: "Majestic KBS (Bengaluru)", coord: [77.5724, 12.9781] }
      ]
    },
    {
      id: "BLR-HEB",
      category: "bangalore",
      name: "Tumakuru ↔ Hebbal – KR Puram (Rajahamsa)",
      livery: "Rajahamsa Orange",
      color: "#ea580c",
      accent: "#ffedd5",
      busCount: 4,
      baseSpeed: 66,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378] },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143] },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276] },
        { id: "nelamangala", name: "Nelamangala Bus Stand", coord: [77.3936, 13.0998] },
        { id: "goragunte", name: "Goraguntepalya", coord: [77.5404, 13.0285] },
        { id: "hebbal", name: "Hebbal Flyover (ORR)", coord: [77.5913, 13.0358] },
        { id: "krpuram", name: "KR Puram (Bengaluru)", coord: [77.6762, 13.0068] }
      ]
    }
  ];

  // Collect unique stops
  const STOPS = [];
  const seenStops = new Set();
  ROUTES.forEach((route) => {
    route.stops.forEach((s) => {
      if (!seenStops.has(s.id)) {
        seenStops.add(s.id);
        STOPS.push(s);
      }
    });
  });

  function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function bearingDegrees(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const dLng = toRad(b[0] - a[0]);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function recomputeRouteMetrics(route) {
    route.cumDist = [0];
    for (let i = 1; i < route.path.length; i++) {
      route.cumDist.push(
        route.cumDist[i - 1] + haversineMeters(route.path[i - 1], route.path[i])
      );
    }
    route.totalDist = Math.max(1, route.cumDist[route.cumDist.length - 1]);
  }

  // Initialize every route with stop coordinates until OSRM real road path finishes loading
  ROUTES.forEach((route) => {
    route.path = route.stops.map((s) => s.coord);
    route.snapped = false;
    recomputeRouteMetrics(route);
  });

  /**
   * Fetches exact road-aligned GeoJSON LineStrings from public OSRM
   * and caches them in localStorage so buses stay aligned to real streets/highways.
   */
  const CACHE_KEY = "tumkur_blr_osrm_paths_v1";

  async function snapRoutesToRealRoads(onRouteSnapped) {
    let cache = {};
    try {
      cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    } catch {
      cache = {};
    }

    let snappedCount = 0;

    for (const route of ROUTES) {
      if (Array.isArray(cache[route.id]) && cache[route.id].length > route.stops.length) {
        route.path = cache[route.id];
        route.snapped = true;
        recomputeRouteMetrics(route);
        snappedCount++;
        if (onRouteSnapped) onRouteSnapped(route, snappedCount, ROUTES.length);
        continue;
      }

      const coordStr = route.stops.map((s) => `${s.coord[0]},${s.coord[1]}`).join(";");
      const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("OSRM HTTP " + res.status);
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length > 2) {
          route.path = coords;
          route.snapped = true;
          recomputeRouteMetrics(route);
          cache[route.id] = coords;
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
          } catch {
            // Ignore storage quota errors
          }
          snappedCount++;
          if (onRouteSnapped) onRouteSnapped(route, snappedCount, ROUTES.length);
        }
      } catch {
        // Keep stop-to-stop fallback if offline or rate-limited
      }

      // Small delay to stay polite with free OSRM server
      await new Promise((r) => setTimeout(r, 180));
    }

    return snappedCount;
  }

  function sampleRouteAt(route, progress01, direction) {
    const clampedDist = Math.max(0, Math.min(route.totalDist, progress01 * route.totalDist));

    // Binary search for fast lookup on dense OSRM road polylines
    let lo = 0;
    let hi = route.cumDist.length - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (route.cumDist[mid + 1] < clampedDist) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    const segIdx = lo;
    const segStart = route.cumDist[segIdx];
    const segLen = Math.max(0.01, route.cumDist[segIdx + 1] - segStart);
    const t = (clampedDist - segStart) / segLen;
    const p1 = route.path[segIdx];
    const p2 = route.path[segIdx + 1];

    const lng = p1[0] + (p2[0] - p1[0]) * t;
    const lat = p1[1] + (p2[1] - p1[1]) * t;

    // Look slightly ahead along the road for smooth, realistic steering heading
    const lookStep = Math.min(route.path.length - 1, segIdx + 1);
    const backStep = Math.max(0, segIdx);
    const heading =
      direction >= 0
        ? bearingDegrees(route.path[backStep], route.path[lookStep])
        : bearingDegrees(route.path[lookStep], route.path[backStep]);

    return { lng, lat, heading };
  }

  const CROWD_LEVELS = ["Low", "Moderate", "Busy"];

  function createInitialFleet() {
    const fleet = [];
    let tumkurReg = 1041;
    let blrReg = 4201;

    ROUTES.forEach((route, rIdx) => {
      const count = route.busCount || 3;
      for (let i = 0; i < count; i++) {
        const direction = i % 2 === 0 ? 1 : -1;
        const progress = (i + 0.35) / count;
        const pos = sampleRouteAt(route, progress, direction);
        const baseSpeed = route.baseSpeed + ((rIdx + i) % 3) * 4;
        const reg =
          route.category === "bangalore"
            ? `KA-01-F-${blrReg++}`
            : `KA-06-F-${tumkurReg++}`;

        fleet.push({
          id: `bus-${route.id}-${i + 1}`,
          routeId: route.id,
          category: route.category,
          color: route.color,
          accent: route.accent,
          livery: route.livery,
          reg,
          progress, // 0..1 along route (preserved cleanly when OSRM snaps!)
          direction,
          baseSpeedKmh: baseSpeed,
          speedKmh: baseSpeed,
          dwellTimer: 0,
          lng: pos.lng,
          lat: pos.lat,
          heading: pos.heading,
          braking: false,
          crowd: CROWD_LEVELS[(rIdx + i) % CROWD_LEVELS.length],
          nextStopName: route.stops[direction > 0 ? route.stops.length - 1 : 0].name,
          etaMin: 4,
          isExternal: false
        });
      }
    });

    return fleet;
  }

  function stepFleet(fleet, dtSeconds) {
    fleet.forEach((bus) => {
      if (bus.isExternal) return;
      const route = ROUTES.find((r) => r.id === bus.routeId);
      if (!route) return;

      if (bus.dwellTimer > 0) {
        bus.dwellTimer -= dtSeconds;
        bus.speedKmh = 0;
        bus.braking = true;
        return;
      }

      const jitter = Math.sin(performance.now() * 0.001 + bus.progress * 20) * 4;
      let targetSpeed = Math.max(18, bus.baseSpeedKmh + jitter);

      // Slow gently near stops
      let nearestStopDist = Infinity;
      route.stops.forEach((s) => {
        const d = haversineMeters([bus.lng, bus.lat], s.coord);
        if (d < nearestStopDist) nearestStopDist = d;
      });

      bus.braking = nearestStopDist < 130;
      if (nearestStopDist < 55 && Math.random() < 0.012) {
        bus.dwellTimer = 2.4;
        bus.speedKmh = 0;
        return;
      }
      if (bus.braking) targetSpeed *= 0.55;

      bus.speedKmh = Math.round(targetSpeed);
      const speedMps = (targetSpeed * 1000) / 3600;
      // Slightly faster visual pacing on long highway routes so movement stays lively
      const paceMultiplier = route.category === "bangalore" ? 3.0 : 2.0;
      const deltaProgress = (bus.direction * speedMps * dtSeconds * paceMultiplier) / route.totalDist;

      bus.progress += deltaProgress;

      if (bus.progress >= 1) {
        bus.progress = 1;
        bus.direction = -1;
        bus.dwellTimer = 2.5;
      } else if (bus.progress <= 0) {
        bus.progress = 0;
        bus.direction = 1;
        bus.dwellTimer = 2.5;
      }

      const pos = sampleRouteAt(route, bus.progress, bus.direction);
      bus.lng = pos.lng;
      bus.lat = pos.lat;
      bus.heading = pos.heading;

      // Determine next stop
      const stopsOrdered =
        bus.direction > 0 ? route.stops : [...route.stops].reverse();
      let bestStop = stopsOrdered[stopsOrdered.length - 1];
      let minDist = Infinity;
      for (const s of stopsOrdered) {
        const d = haversineMeters([bus.lng, bus.lat], s.coord);
        if (d > 90 && d < minDist) {
          minDist = d;
          bestStop = s;
        }
      }
      bus.nextStopName = bestStop.name;
      bus.etaMin = Math.max(1, Math.round(minDist / Math.max(4.5, speedMps) / 60));
    });
  }

  return {
    TUMKUR_CENTER,
    LANDMARKS,
    ROUTES,
    STOPS,
    haversineMeters,
    bearingDegrees,
    snapRoutesToRealRoads,
    createInitialFleet,
    stepFleet
  };
})();
