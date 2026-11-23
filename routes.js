window.TumkurData = (() => {
  const TUMKUR_CENTER = [77.1130, 13.3375];

  const LANDMARKS = {
    ksrtc: { center: [77.1072, 13.3379], zoom: 15.8, pitch: 62, bearing: 20 },
    sit: { center: [77.1261, 13.3269], zoom: 15.8, pitch: 62, bearing: -25 },
    mutt: { center: [77.1496, 13.3198], zoom: 15.6, pitch: 62, bearing: 35 },
    sira: { center: [77.1018, 13.3545], zoom: 15.4, pitch: 60, bearing: -10 },
    heggere: { center: [77.0655, 13.3312], zoom: 15.2, pitch: 60, bearing: 15 }
  };

  // Authentic Tumakuru corridors [lng, lat]
  const ROUTES = [
    {
      id: "201",
      name: "KSRTC Stand – SIT – Kyathsandra",
      livery: "KSRTC City Crimson",
      color: "#e11d48",
      accent: "#fde047",
      stops: [
        { id: "ksrtc", name: "KSRTC Central Bus Stand", coord: [77.1072, 13.3379] },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1010, 13.3409] },
        { id: "univ", name: "Tumkur University", coord: [77.1165, 13.3340] },
        { id: "sit", name: "SIT Main Gate", coord: [77.1261, 13.3269] },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1318, 13.3282] },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3142] }
      ],
      path: [
        [77.1072, 13.3379], [77.1038, 13.3396], [77.1010, 13.3409],
        [77.1068, 13.3378], [77.1122, 13.3358], [77.1165, 13.3340],
        [77.1215, 13.3304], [77.1261, 13.3269], [77.1318, 13.3282],
        [77.1398, 13.3212], [77.1476, 13.3142]
      ]
    },
    {
      id: "201E",
      name: "KSRTC Stand – Siddaganga Mutt Electric",
      livery: "EV Smart Emerald",
      color: "#10b981",
      accent: "#a7f3d0",
      stops: [
        { id: "ksrtc", name: "KSRTC Central Bus Stand", coord: [77.1072, 13.3379] },
        { id: "univ", name: "Tumkur University", coord: [77.1165, 13.3340] },
        { id: "sit", name: "SIT Main Gate", coord: [77.1261, 13.3269] },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3142] },
        { id: "mutt", name: "Siddaganga Mutt", coord: [77.1496, 13.3198] }
      ],
      path: [
        [77.1072, 13.3379], [77.1125, 13.3357], [77.1165, 13.3340],
        [77.1261, 13.3269], [77.1360, 13.3230], [77.1476, 13.3142],
        [77.1492, 13.3172], [77.1496, 13.3198]
      ]
    },
    {
      id: "202",
      name: "KSRTC Stand – Sira Gate – Antharasanahalli",
      livery: "Royal Gold City",
      color: "#eab308",
      accent: "#1e293b",
      stops: [
        { id: "ksrtc", name: "KSRTC Central Bus Stand", coord: [77.1072, 13.3379] },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1010, 13.3409] },
        { id: "siragate", name: "Sira Gate", coord: [77.1018, 13.3545] },
        { id: "vasanth", name: "Vasanthanarasapura Rd", coord: [77.0985, 13.3680] },
        { id: "anthara", name: "Antharasanahalli Ind. Area", coord: [77.0955, 13.3820] }
      ],
      path: [
        [77.1072, 13.3379], [77.1010, 13.3409], [77.1014, 13.3478],
        [77.1018, 13.3545], [77.1002, 13.3618], [77.0985, 13.3680],
        [77.0968, 13.3755], [77.0955, 13.3820]
      ]
    },
    {
      id: "203",
      name: "KSRTC – Gubbi Gate – Heggere Medical",
      livery: "Coastal Cyan",
      color: "#06b6d4",
      accent: "#ecfeff",
      stops: [
        { id: "ksrtc", name: "KSRTC Central Bus Stand", coord: [77.1072, 13.3379] },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1010, 13.3409] },
        { id: "gubbi", name: "Gubbi Gate", coord: [77.0902, 13.3376] },
        { id: "maralur", name: "Maralur Dinne", coord: [77.0785, 13.3348] },
        { id: "heggere", name: "Heggere / SSMC", coord: [77.0655, 13.3312] }
      ],
      path: [
        [77.1072, 13.3379], [77.1010, 13.3409], [77.0958, 13.3392],
        [77.0902, 13.3376], [77.0842, 13.3360], [77.0785, 13.3348],
        [77.0720, 13.3330], [77.0655, 13.3312]
      ]
    },
    {
      id: "204",
      name: "Ring Road Loop – SS Puram – Shettihalli",
      livery: "Deccan Violet",
      color: "#8b5cf6",
      accent: "#ddd6fe",
      stops: [
        { id: "ksrtc", name: "KSRTC Central Bus Stand", coord: [77.1072, 13.3379] },
        { id: "sspuram", name: "SS Puram Main Rd", coord: [77.1045, 13.3315] },
        { id: "shettihalli", name: "Shettihalli Gate", coord: [77.0958, 13.3260] },
        { id: "jayanagar", name: "Jayanagar Ring Rd", coord: [77.1155, 13.3250] },
        { id: "sit", name: "SIT Main Gate", coord: [77.1261, 13.3269] }
      ],
      path: [
        [77.1072, 13.3379], [77.1058, 13.3346], [77.1045, 13.3315],
        [77.0998, 13.3282], [77.0958, 13.3260], [77.1052, 13.3248],
        [77.1155, 13.3250], [77.1214, 13.3258], [77.1261, 13.3269]
      ]
    },
    {
      id: "NH48",
      name: "NH-48 Airavat Express (Bypass Corridor)",
      livery: "Airavat Obsidian",
      color: "#f97316",
      accent: "#fef08a",
      stops: [
        { id: "anthara", name: "Antharasanahalli Bypass", coord: [77.0955, 13.3820] },
        { id: "siragate", name: "Sira Gate Flyover", coord: [77.1018, 13.3545] },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1318, 13.3282] },
        { id: "kyathsandra", name: "Kyathsandra Toll", coord: [77.1476, 13.3142] }
      ],
      path: [
        [77.0955, 13.3820], [77.0995, 13.3690], [77.1018, 13.3545],
        [77.1145, 13.3440], [77.1268, 13.3340], [77.1318, 13.3282],
        [77.1408, 13.3204], [77.1476, 13.3142]
      ]
    }
  ];

  // Collect unique stops across all routes
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

  // Precompute cumulative distances along each route polyline
  ROUTES.forEach((route) => {
    route.cumDist = [0];
    for (let i = 1; i < route.path.length; i++) {
      route.cumDist.push(
        route.cumDist[i - 1] + haversineMeters(route.path[i - 1], route.path[i])
      );
    }
    route.totalDist = route.cumDist[route.cumDist.length - 1];
  });

  function sampleRouteAt(route, distMeters, direction) {
    const clamped = Math.max(0, Math.min(route.totalDist, distMeters));
    let segIdx = 0;
    for (let i = 0; i < route.cumDist.length - 1; i++) {
      if (clamped >= route.cumDist[i] && clamped <= route.cumDist[i + 1]) {
        segIdx = i;
        break;
      }
    }
    const segStart = route.cumDist[segIdx];
    const segLen = Math.max(1, route.cumDist[segIdx + 1] - segStart);
    const t = (clamped - segStart) / segLen;
    const p1 = route.path[segIdx];
    const p2 = route.path[segIdx + 1];

    const lng = p1[0] + (p2[0] - p1[0]) * t;
    const lat = p1[1] + (p2[1] - p1[1]) * t;
    const heading =
      direction >= 0 ? bearingDegrees(p1, p2) : bearingDegrees(p2, p1);

    return { lng, lat, heading };
  }

  const CROWD_LEVELS = ["Low", "Moderate", "Busy"];

  function createInitialFleet() {
    const fleet = [];
    let regNum = 1041;
    ROUTES.forEach((route, rIdx) => {
      const count = route.id === "201" || route.id === "202" ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const direction = i % 2 === 0 ? 1 : -1;
        const dist = ((i + 0.35) / count) * route.totalDist;
        const pos = sampleRouteAt(route, dist, direction);
        const baseSpeed = route.id === "NH48" ? 56 : 32 + ((rIdx + i) % 3) * 5;
        fleet.push({
          id: `bus-${route.id}-${i + 1}`,
          routeId: route.id,
          color: route.color,
          accent: route.accent,
          livery: route.livery,
          reg: `KA-06-F-${regNum++}`,
          dist,
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
          etaMin: 3,
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

      // Smooth speed variation + slow down near stops
      const jitter = Math.sin(performance.now() * 0.0012 + bus.dist * 0.01) * 4;
      let targetSpeed = Math.max(16, bus.baseSpeedKmh + jitter);

      // Check proximity to route stops for realistic brief stops
      let nearestStopDist = Infinity;
      route.stops.forEach((s) => {
        const d = haversineMeters([bus.lng, bus.lat], s.coord);
        if (d < nearestStopDist) nearestStopDist = d;
      });

      bus.braking = nearestStopDist < 120;
      if (nearestStopDist < 55 && Math.random() < 0.015) {
        bus.dwellTimer = 2.8;
        bus.speedKmh = 0;
        return;
      }
      if (bus.braking) targetSpeed *= 0.55;

      bus.speedKmh = Math.round(targetSpeed);
      const speedMps = (targetSpeed * 1000) / 3600;
      // 2.2x sim pace so movement is crisp and lively on city zoom
      bus.dist += bus.direction * speedMps * dtSeconds * 2.2;

      if (bus.dist >= route.totalDist) {
        bus.dist = route.totalDist;
        bus.direction = -1;
        bus.dwellTimer = 2.5;
      } else if (bus.dist <= 0) {
        bus.dist = 0;
        bus.direction = 1;
        bus.dwellTimer = 2.5;
      }

      const pos = sampleRouteAt(route, bus.dist, bus.direction);
      bus.lng = pos.lng;
      bus.lat = pos.lat;
      bus.heading = pos.heading;

      // Determine next stop ahead
      const stopsOrdered =
        bus.direction > 0 ? route.stops : [...route.stops].reverse();
      let bestStop = stopsOrdered[stopsOrdered.length - 1];
      let minDist = Infinity;
      for (const s of stopsOrdered) {
        const d = haversineMeters([bus.lng, bus.lat], s.coord);
        if (d > 80 && d < minDist) {
          minDist = d;
          bestStop = s;
        }
      }
      bus.nextStopName = bestStop.name;
      bus.etaMin = Math.max(1, Math.round((minDist / Math.max(4, speedMps)) / 60));
    });
  }

  return {
    TUMKUR_CENTER,
    LANDMARKS,
    ROUTES,
    STOPS,
    haversineMeters,
    bearingDegrees,
    createInitialFleet,
    stepFleet
  };
})();
