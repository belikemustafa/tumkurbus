window.TumkurData = (() => {
  const TUMKUR_CENTER = [77.1105, 13.3385];

  const LANDMARKS = {
    tumkur: { center: [77.1105, 13.3385], zoom: 13.4 },
    ksrtc: { center: [77.10252, 13.34116], zoom: 15.8 },
    sit: { center: [77.12716234, 13.33204874], zoom: 16.0 },
    mutt: { center: [77.14963, 13.32065], zoom: 15.4 },
    corridor: { center: [77.3500, 13.1550], zoom: 10.1 },
    nelamangala: { center: [77.39426, 13.09821], zoom: 13.6 },
    majestic: { center: [77.57243, 12.97815], zoom: 14.3 },
    airport: { center: [77.70660, 13.19860], zoom: 13.2 }
  };

  const STOP_KANNADA = {
    ksrtc: "ತುಮಕೂರು ಕೆಎಸ್‌ಆರ್‌ಟಿಸಿ ನಿಲ್ದಾಣ",
    private_bs: "ತುಮಕೂರು ಖಾಸಗಿ ಬಸ್ ನಿಲ್ದಾಣ",
    dist_hosp: "ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ (ಬಿ.ಎಚ್. ರಸ್ತೆ)",
    townhall: "ಟೌನ್ ಹಾಲ್ ವೃತ್ತ",
    railway: "ತುಮಕೂರು ರೈಲ್ವೆ ನಿಲ್ದಾಣ",
    gubbi: "ಗುಬ್ಬಿ ಗೇಟ್ ವೃತ್ತ",
    heggere: "ಹೆಗ್ಗೆರೆ / ಎಸ್‌ಎಸ್‌ಎಂಸಿ",
    univ: "ತುಮಕೂರು ವಿಶ್ವವಿದ್ಯಾಲಯ ಬಸ್ ನಿಲ್ದಾಣ",
    sspuram: "ಎಸ್‌ಎಸ್ ಪುರಂ ಮುಖ್ಯ ರಸ್ತೆ",
    sit: "ಎಸ್‌ಐಟಿ ಮುಖ್ಯ ದ್ವಾರ ಬಸ್ ನಿಲ್ದಾಣ",
    sitback: "ಎಸ್‌ಐಟಿ ಹಿಂಬದಿ ದ್ವಾರ / ಪಾಲಿಟೆಕ್ನಿಕ್",
    batawadi: "ಬಟವಾಡಿ ಜಂಕ್ಷನ್",
    kyathsandra: "ಕ್ಯಾತ್ಸಂದ್ರ ವೃತ್ತ",
    mutt: "ಸಿದ್ಧಗಂಗಾ ಮಠ",
    siragate: "ಶಿರಾ ಗೇಟ್ ವೃತ್ತ",
    yellapura: "ಯಲ್ಲಾಪುರ",
    oorukere: "ಊರುಕೆರೆ (ಎನ್‌ಎಚ್-48)",
    shettihalli: "ಶೆಟ್ಟಿಹಳ್ಳಿ ಮುಖ್ಯ ರಸ್ತೆ",
    maralur: "ಮರಳೂರು ದಿಣ್ಣೆ",
    melekote: "ಮೇಳೆಕೋಟೆ",
    gangasandra: "ಗಂಗಸಂದ್ರ",
    belagumba: "ಬೆಳಗುಂಬ",
    upparahalli: "ಉಪ್ಪಾರಹಳ್ಳಿ",
    gulur: "ಗೂಳೂರು ವೃತ್ತ",
    gubbitown: "ಗುಬ್ಬಿ ಬಸ್ ನಿಲ್ದಾಣ",
    hirehalli: "ಹಿರೇಹಳ್ಳಿ ಕೈಗಾರಿಕಾ ಪ್ರದೇಶ",
    dobbaspet: "ದಾಬಸ್‌ಪೇಟೆ ಕೆಎಸ್‌ಆರ್‌ಟಿಸಿ ನಿಲ್ದಾಣ",
    nelamangala: "ನೆಲಮಂಗಲ ಬಸ್ ನಿಲ್ದಾಣ",
    goragunte: "ಗೊರಗುಂಟೆಪಾಳ್ಯ",
    yeshwantpur: "ಯಶವಂತಪುರ ವೃತ್ತ",
    majestic: "ಮೆಜೆಸ್ಟಿಕ್ ಕೆಬಿಎಸ್ (ಬೆಂಗಳೂರು)",
    hebbal: "ಹೆಬ್ಬಾಳ ಫ್ಲೈಓವರ್",
    krpuram: "ಕೆಆರ್ ಪುರಂ (ಬೆಂಗಳೂರು)",
    shantinagar: "ಶಾಂತಿನಗರ ಬಸ್ ನಿಲ್ದಾಣ",
    silkboard: "ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಜಂಕ್ಷನ್",
    ecity: "ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ ಹಂತ 1",
    airport: "ಕೆಂಪೇಗೌಡ ವಿಮಾನ ನಿಲ್ದಾಣ (KIA)"
  };

  // Verified stop coordinates [lng, lat] (pinned: true locks exact user-verified pins)
  const STOP_DEFS = {
    ksrtc: { id: "ksrtc", name: "Tumakuru KSRTC Bus Stand", coord: [77.10252, 13.34116], major: true },
    private_bs: { id: "private_bs", name: "Tumakuru Private Bus Stand", coord: [77.10118, 13.34250], major: false },
    dist_hosp: { id: "dist_hosp", name: "District Hospital (B.H. Rd)", coord: [77.09940, 13.34060], major: true },
    townhall: { id: "townhall", name: "Town Hall Circle", coord: [77.10201, 13.33764], major: true },
    railway: { id: "railway", name: "Tumakuru Railway Station", coord: [77.10196, 13.33390], major: true },
    gubbi: { id: "gubbi", name: "Gubbi Gate Circle", coord: [77.08780, 13.34480], major: true },
    heggere: { id: "heggere", name: "Heggere / SSMC (B.H. Rd)", coord: [77.05964, 13.35278], major: true },
    univ: {
      id: "univ",
      name: "Tumkur University Bus Stop",
      coord: [77.11982055469895, 13.33678950707134],
      major: true,
      pinned: true
    },
    sspuram: { id: "sspuram", name: "SS Puram Main Road", coord: [77.11282, 13.33228], major: true },
    sit: {
      id: "sit",
      name: "SIT Main Gate Bus Stop",
      coord: [77.12716234129778, 13.332048736778003],
      major: true,
      pinned: true
    },
    sitback: { id: "sitback", name: "SIT Back Gate / Polytechnic", coord: [77.13180, 13.32604], major: false },
    batawadi: { id: "batawadi", name: "Batawadi Junction", coord: [77.13198, 13.33372], major: true },
    kyathsandra: { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.14623, 13.31369], major: true },
    mutt: { id: "mutt", name: "Siddaganga Mutt", coord: [77.14963, 13.32065], major: true },
    siragate: { id: "siragate", name: "Sira Gate Circle", coord: [77.10331, 13.36252], major: true },
    yellapura: { id: "yellapura", name: "Yellapura", coord: [77.11720, 13.38383], major: false },
    oorukere: { id: "oorukere", name: "Oorukere (NH-48)", coord: [77.08936, 13.40336], major: false },
    shettihalli: { id: "shettihalli", name: "Shettihalli Main Road", coord: [77.12440, 13.31126], major: true },
    maralur: { id: "maralur", name: "Maralur Dinne", coord: [77.09295, 13.32426], major: false },
    melekote: { id: "melekote", name: "Melekote", coord: [77.07871, 13.32938], major: false },
    gangasandra: { id: "gangasandra", name: "Gangasandra", coord: [77.07843, 13.32412], major: false },
    belagumba: { id: "belagumba", name: "Belagumba", coord: [77.14278, 13.35241], major: false },
    upparahalli: { id: "upparahalli", name: "Upparahalli", coord: [77.11050, 13.32450], major: false },
    gulur: { id: "gulur", name: "Gulur Circle", coord: [77.09242, 13.29138], major: false },
    gubbitown: { id: "gubbitown", name: "Gubbi Bus Stand", coord: [76.94200, 13.31180], major: true },
    hirehalli: { id: "hirehalli", name: "Hirehalli (NH-48)", coord: [77.18456, 13.28316], major: false },
    dobbaspet: { id: "dobbaspet", name: "Dobbaspet KSRTC Stand", coord: [77.24223, 13.22736], major: true },
    nelamangala: { id: "nelamangala", name: "Nelamangala Bus Stand", coord: [77.39426, 13.09821], major: true },
    goragunte: { id: "goragunte", name: "Goraguntepalya", coord: [77.54014, 13.02971], major: true },
    yeshwantpur: { id: "yeshwantpur", name: "Yeshwantpur Circle", coord: [77.55400, 13.02350], major: true },
    majestic: { id: "majestic", name: "Majestic KBS (Bengaluru)", coord: [77.57243, 12.97815], major: true },
    hebbal: { id: "hebbal", name: "Hebbal Flyover (ORR)", coord: [77.59130, 13.03580], major: true },
    krpuram: { id: "krpuram", name: "KR Puram (Bengaluru)", coord: [77.67620, 13.00680], major: true },
    shantinagar: { id: "shantinagar", name: "Shantinagar Bus Station", coord: [77.59360, 12.95540], major: true },
    silkboard: { id: "silkboard", name: "Silk Board Junction", coord: [77.62290, 12.91770], major: true },
    ecity: { id: "ecity", name: "Electronic City Phase 1", coord: [77.66020, 12.84520], major: true },
    airport: { id: "airport", name: "Kempegowda Intl Airport (KIA)", coord: [77.70660, 13.19860], major: true }
  };

  function resolveStops(ids) {
    return ids.map((id) => {
      const def = STOP_DEFS[id];
      return {
        ...def,
        coord: [...def.coord],
        kn: STOP_KANNADA[id] || def.name
      };
    });
  }

  function resolveCoords(ids) {
    return ids.map((id) => [...STOP_DEFS[id].coord]);
  }

  // 15 Routes: each defines `stops` (Stops ON) and `directAnchors` (Stops OFF normal road path)
  const ROUTES = [
    {
      id: "201",
      category: "city",
      isAC: false,
      name: "Heggere – Gubbi Gate – KSRTC – SIT – Kyathsandra",
      livery: "KSRTC City Crimson",
      color: "#dc2626",
      accent: "#fde047",
      busCount: 7,
      baseSpeed: 32,
      stops: resolveStops(["heggere", "gubbi", "dist_hosp", "ksrtc", "univ", "sit", "kyathsandra"]),
      directAnchors: resolveCoords(["heggere", "kyathsandra"])
    },
    {
      id: "201E",
      category: "city",
      isAC: false,
      name: "KSRTC Stand – Tumkur Univ – SIT – Siddaganga Mutt",
      livery: "EV City Emerald",
      color: "#059669",
      accent: "#a7f3d0",
      busCount: 4,
      baseSpeed: 30,
      stops: resolveStops(["ksrtc", "univ", "sit", "kyathsandra", "mutt"]),
      directAnchors: resolveCoords(["ksrtc", "mutt"])
    },
    {
      id: "201B",
      category: "city",
      isAC: false,
      name: "KSRTC – Town Hall – SS Puram – SIT Back Gate – Kyathsandra",
      livery: "Teal City Shuttle",
      color: "#0d9488",
      accent: "#ccfbf1",
      busCount: 4,
      baseSpeed: 30,
      stops: resolveStops(["ksrtc", "townhall", "sspuram", "sitback", "kyathsandra"]),
      directAnchors: resolveCoords(["ksrtc", "kyathsandra"])
    },
    {
      id: "202",
      category: "city",
      isAC: false,
      name: "Shettihalli – SS Puram – KSRTC – Sira Gate – Yellapura",
      livery: "Royal Gold City",
      color: "#d97706",
      accent: "#1e293b",
      busCount: 6,
      baseSpeed: 33,
      stops: resolveStops(["shettihalli", "sspuram", "ksrtc", "siragate", "yellapura"]),
      directAnchors: resolveCoords(["shettihalli", "yellapura"])
    },
    {
      id: "203",
      category: "city",
      isAC: false,
      name: "Maralur Dinne – Railway Stn – KSRTC – Sira Gate – Oorukere",
      livery: "Coastal Cyan",
      color: "#0891b2",
      accent: "#cffafe",
      busCount: 5,
      baseSpeed: 34,
      stops: resolveStops(["maralur", "railway", "townhall", "ksrtc", "siragate", "oorukere"]),
      directAnchors: resolveCoords(["maralur", "oorukere"])
    },
    {
      id: "204",
      category: "city",
      isAC: false,
      name: "Gangasandra – Melekote – KSRTC – Batawadi – Belagumba",
      livery: "Deccan Violet",
      color: "#7c3aed",
      accent: "#ede9fe",
      busCount: 5,
      baseSpeed: 31,
      stops: resolveStops(["gangasandra", "melekote", "townhall", "ksrtc", "univ", "batawadi", "belagumba"]),
      directAnchors: resolveCoords(["gangasandra", "belagumba"])
    },
    {
      id: "205",
      category: "city",
      isAC: false,
      name: "KSRTC – Town Hall – Railway Stn – Upparahalli – Shettihalli",
      livery: "Ruby Local",
      color: "#be185d",
      accent: "#fbcfe8",
      busCount: 4,
      baseSpeed: 30,
      stops: resolveStops(["ksrtc", "townhall", "railway", "upparahalli", "shettihalli"]),
      directAnchors: resolveCoords(["ksrtc", "shettihalli"])
    },
    {
      id: "206",
      category: "city",
      isAC: false,
      name: "KSRTC – Town Hall – Maralur – Gulur (Kunigal Rd)",
      livery: "Forest Green City",
      color: "#15803d",
      accent: "#bbf7d0",
      busCount: 4,
      baseSpeed: 34,
      stops: resolveStops(["ksrtc", "townhall", "maralur", "gulur"]),
      directAnchors: resolveCoords(["ksrtc", "gulur"])
    },
    {
      id: "208",
      category: "city",
      isAC: false,
      name: "Tumakuru KSRTC – Gubbi Gate – Heggere – Gubbi Town",
      livery: "Suburban Ochre",
      color: "#b45309",
      accent: "#fef3c7",
      busCount: 3,
      baseSpeed: 42,
      stops: resolveStops(["ksrtc", "dist_hosp", "gubbi", "heggere", "gubbitown"]),
      directAnchors: resolveCoords(["ksrtc", "gubbitown"])
    },
    {
      id: "BLR-SRG",
      category: "bangalore",
      isAC: false,
      name: "Tumakuru ↔ Bengaluru Majestic (KSRTC Sarige)",
      livery: "KSRTC Sarige Red",
      color: "#b91c1c",
      accent: "#fef08a",
      busCount: 8,
      baseSpeed: 62,
      stops: resolveStops([
        "ksrtc", "univ", "sit", "kyathsandra", "hirehalli",
        "dobbaspet", "nelamangala", "goragunte", "yeshwantpur", "majestic"
      ]),
      directAnchors: resolveCoords(["ksrtc", "majestic"])
    },
    {
      id: "BLR-RJ",
      category: "bangalore",
      isAC: false,
      name: "Tumakuru ↔ Hebbal – KR Puram (Rajahamsa)",
      livery: "Rajahamsa Executive",
      color: "#ea580c",
      accent: "#ffedd5",
      busCount: 5,
      baseSpeed: 65,
      stops: resolveStops([
        "ksrtc", "kyathsandra", "dobbaspet", "nelamangala",
        "goragunte", "hebbal", "krpuram"
      ]),
      directAnchors: resolveCoords(["ksrtc", "hebbal", "krpuram"])
    },
    {
      id: "BLR-AC1",
      category: "bangalore",
      isAC: true,
      name: "Tumakuru ↔ Majestic (Airavat Club Class AC)",
      livery: "Airavat Volvo AC",
      color: "#1d4ed8",
      accent: "#93c5fd",
      busCount: 7,
      baseSpeed: 72,
      stops: resolveStops([
        "ksrtc", "batawadi", "kyathsandra", "dobbaspet",
        "nelamangala", "goragunte", "yeshwantpur", "majestic"
      ]),
      directAnchors: resolveCoords(["ksrtc", "majestic"])
    },
    {
      id: "BLR-EV",
      category: "bangalore",
      isAC: true,
      name: "Tumakuru ↔ Majestic (KSRTC EV Power Plus AC)",
      livery: "EV Power Plus AC",
      color: "#0284c7",
      accent: "#bae6fd",
      busCount: 6,
      baseSpeed: 68,
      stops: resolveStops([
        "ksrtc", "univ", "sit", "kyathsandra", "dobbaspet",
        "nelamangala", "goragunte", "yeshwantpur", "majestic"
      ]),
      directAnchors: resolveCoords(["ksrtc", "majestic"])
    },
    {
      id: "BLR-AMB",
      category: "bangalore",
      isAC: true,
      name: "Tumakuru ↔ Shantinagar – Electronic City (Ambaari AC)",
      livery: "Ambaari Volvo AC Sleeper",
      color: "#4338ca",
      accent: "#fde047",
      busCount: 6,
      baseSpeed: 74,
      stops: resolveStops([
        "batawadi", "kyathsandra", "dobbaspet", "nelamangala",
        "goragunte", "shantinagar", "silkboard", "ecity"
      ]),
      directAnchors: resolveCoords(["batawadi", "ecity"])
    },
    {
      id: "BLR-KIA",
      category: "bangalore",
      isAC: true,
      name: "Tumakuru ↔ Kempegowda Airport KIA (FlyBus AC)",
      livery: "FlyBus Multi-Axle AC",
      color: "#0f766e",
      accent: "#99f6e4",
      busCount: 4,
      baseSpeed: 75,
      stops: resolveStops([
        "ksrtc", "batawadi", "dobbaspet", "nelamangala",
        "goragunte", "hebbal", "airport"
      ]),
      directAnchors: resolveCoords(["ksrtc", "hebbal", "airport"])
    }
  ];

  // Collect all unique curated stops with serving route IDs
  const stopMap = new Map();
  ROUTES.forEach((route) => {
    route.stops.forEach((s) => {
      if (!stopMap.has(s.id)) {
        stopMap.set(s.id, { ...s, routeIds: new Set([route.id]) });
      } else {
        const existing = stopMap.get(s.id);
        existing.routeIds.add(route.id);
        if (s.major) existing.major = true;
      }
    });
  });

  if (!stopMap.has("private_bs")) {
    const pbs = STOP_DEFS.private_bs;
    stopMap.set("private_bs", {
      ...pbs,
      kn: STOP_KANNADA.private_bs,
      routeIds: new Set(["201", "202", "203"])
    });
  }

  const STOPS = Array.from(stopMap.values()).map((s) => ({
    ...s,
    routeIds: Array.from(s.routeIds)
  }));

  const STOPS_BY_ID = new Map(STOPS.map((s) => [s.id, s]));

  function getStopById(id) {
    return STOPS_BY_ID.get(id) || null;
  }

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

  let routeStopsEnabled = false;

  ROUTES.forEach((route) => {
    route.stopPath = route.stops.map((s) => s.coord);
    route.directPath = route.directAnchors.map((c) => [...c]);
    route.path = route.directPath;
    route.snapped = false;
    recomputeRouteMetrics(route);
  });

  /**
   * Switches every route between stop-by-stop paths (Stops ON)
   * and direct normal highway/road paths (Stops OFF).
   */
  function setRouteStopMode(enabled) {
    routeStopsEnabled = Boolean(enabled);
    ROUTES.forEach((route) => {
      route.path = routeStopsEnabled ? route.stopPath : route.directPath;
      recomputeRouteMetrics(route);
    });
  }

  // Clear older caches so new dual-path & exact pinned stops take effect cleanly
  const CACHE_KEY = "tumkur_blr_osrm_paths_v5_dual";
  try {
    localStorage.removeItem("tumkur_blr_osrm_paths_v1");
    localStorage.removeItem("tumkur_blr_osrm_paths_v2");
    localStorage.removeItem("tumkur_blr_osrm_paths_v4_verified");
    localStorage.removeItem("tumkur_osm_bus_stops_v1");
  } catch {
    // Ignore storage errors
  }

  const OSRM_BASES = [
    "https://router.project-osrm.org/route/v1/driving",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving"
  ];

  async function fetchRoadGeometry(coordArray) {
    const coordStr = coordArray.map((c) => `${c[0]},${c[1]}`).join(";");
    for (const base of OSRM_BASES) {
      try {
        const url = `${base}/${coordStr}?overview=full&geometries=geojson&continue_straight=true`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        const waypoints = data?.waypoints || [];
        if (Array.isArray(coords) && coords.length > 2) {
          return { coords, waypoints };
        }
      } catch {
        // Try backup server
      }
    }
    return null;
  }

  async function snapRoutesToRealRoads(onRouteSnapped) {
    let cache = {};
    try {
      cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    } catch {
      cache = {};
    }

    let snappedCount = 0;

    for (const route of ROUTES) {
      const cached = cache[route.id];
      if (
        cached &&
        Array.isArray(cached.stopCoords) &&
        cached.stopCoords.length > 2 &&
        Array.isArray(cached.directCoords) &&
        cached.directCoords.length > 2
      ) {
        route.stopPath = cached.stopCoords;
        route.directPath = cached.directCoords;
        route.path = routeStopsEnabled ? route.stopPath : route.directPath;
        route.snapped = true;
        recomputeRouteMetrics(route);
        snappedCount++;
        if (onRouteSnapped) onRouteSnapped(route, snappedCount, ROUTES.length);
        continue;
      }

      const stopResult = await fetchRoadGeometry(route.stops.map((s) => s.coord));
      await new Promise((r) => setTimeout(r, 140));
      const directResult = await fetchRoadGeometry(route.directAnchors);

      if (stopResult || directResult) {
        if (stopResult) {
          route.stopPath = stopResult.coords;
          // Snap non-pinned stops slightly onto carriageway; NEVER overwrite user-pinned stops
          stopResult.waypoints.forEach((wp, idx) => {
            const stop = route.stops[idx];
            if (stop && !stop.pinned && Array.isArray(wp.location)) {
              const shift = haversineMeters(stop.coord, wp.location);
              if (shift < 140) {
                stop.coord = wp.location;
                const master = STOPS_BY_ID.get(stop.id);
                if (master && !master.pinned) master.coord = wp.location;
              }
            }
          });
        }
        if (directResult) {
          route.directPath = directResult.coords;
        } else if (stopResult) {
          route.directPath = stopResult.coords;
        }

        route.path = routeStopsEnabled ? route.stopPath : route.directPath;
        route.snapped = true;
        recomputeRouteMetrics(route);

        cache[route.id] = {
          stopCoords: route.stopPath,
          directCoords: route.directPath
        };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch {
          // Ignore quota errors
        }
        snappedCount++;
        if (onRouteSnapped) onRouteSnapped(route, snappedCount, ROUTES.length);
      }

      await new Promise((r) => setTimeout(r, 160));
    }

    return snappedCount;
  }

  function findNearestCumDist(route, coord) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < route.path.length; i++) {
      const d = haversineMeters(route.path[i], coord);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    return route.cumDist[bestIdx] || 0;
  }

  function estimateFares(fromId, toId, passengerType = "adult") {
    const fromStop = getStopById(fromId);
    const toStop = getStopById(toId);
    if (!fromStop || !toStop || fromId === toId) return null;

    const directRoutes = ROUTES.filter((r) => {
      const hasFrom = r.stops.some((s) => s.id === fromId) || (fromStop.routeIds || []).includes(r.id);
      const hasTo = r.stops.some((s) => s.id === toId) || (toStop.routeIds || []).includes(r.id);
      return hasFrom && hasTo;
    });

    let distanceKm;
    if (directRoutes.length > 0 && directRoutes[0].snapped) {
      const r = directRoutes[0];
      const d1 = findNearestCumDist(r, fromStop.coord);
      const d2 = findNearestCumDist(r, toStop.coord);
      distanceKm = Math.max(1.2, Math.abs(d2 - d1) / 1000);
    } else {
      const straightKm = haversineMeters(fromStop.coord, toStop.coord) / 1000;
      const roadFactor = straightKm > 25 ? 1.12 : 1.24;
      distanceKm = Math.max(1.2, straightKm * roadFactor);
    }

    const fromInTumkur = haversineMeters(fromStop.coord, TUMKUR_CENTER) < 16000;
    const toInTumkur = haversineMeters(toStop.coord, TUMKUR_CENTER) < 16000;
    const isLocalCityTrip = fromInTumkur && toInTumkur && distanceKm <= 18;
    const involvesAirport = fromId === "airport" || toId === "airport";

    function applyConcession(baseFare, { shaktiEligible, seniorEligible, childRate }) {
      if (passengerType === "shakti") {
        return shaktiEligible
          ? { fare: 0, note: "FREE under Shakti Scheme (zero-value ticket)" }
          : { fare: baseFare, note: "Shakti not applicable on AC / luxury service" };
      }
      if (passengerType === "senior") {
        return seniorEligible
          ? { fare: Math.max(5, Math.round(baseFare * 0.75)), note: "25% Karnataka Senior Citizen concession" }
          : { fare: baseFare, note: "Senior concession applies to Rajahamsa & lower only" };
      }
      if (passengerType === "child") {
        return {
          fare: Math.max(5, Math.round(baseFare * childRate)),
          note: `${Math.round(childRate * 100)}% child fare (6–12 yrs; under 6 free)`
        };
      }
      return { fare: baseFare, note: "Standard adult fare" };
    }

    const tiers = [];

    if (isLocalCityTrip || directRoutes.some((r) => r.category === "city")) {
      const stageSteps = Math.max(0, Math.ceil((distanceKm - 2.0) / 2.6));
      const baseCity = Math.min(45, 10 + stageSteps * 5);
      const adj = applyConcession(baseCity, {
        shaktiEligible: true,
        seniorEligible: true,
        childRate: 0.5
      });
      tiers.push({
        id: "city",
        name: "Tumakuru City Ordinary / EV",
        subtitle: "Stage-based city service (Non-AC)",
        isAC: false,
        baseFare: baseCity,
        fare: adj.fare,
        note: adj.note,
        durationMin: Math.max(6, Math.round((distanceKm / 22) * 60)),
        routeIds: directRoutes.filter((r) => r.category === "city").map((r) => r.id)
      });
    }

    if (!isLocalCityTrip || directRoutes.some((r) => r.category === "bangalore")) {
      const baseSarige = Math.max(15, Math.round(12 + distanceKm * 1.26));
      const adjSarige = applyConcession(baseSarige, {
        shaktiEligible: true,
        seniorEligible: true,
        childRate: 0.5
      });
      tiers.push({
        id: "sarige",
        name: "KSRTC Sarige (Express)",
        subtitle: "3+2 Non-AC Seater · High Frequency",
        isAC: false,
        baseFare: baseSarige,
        fare: adjSarige.fare,
        note: adjSarige.note,
        durationMin: Math.max(12, Math.round((distanceKm / 42) * 60)),
        routeIds: directRoutes.filter((r) => r.id === "BLR-SRG").map((r) => r.id)
      });

      const baseRajahamsa = Math.max(45, Math.round(20 + distanceKm * 1.85));
      const adjRajahamsa = applyConcession(baseRajahamsa, {
        shaktiEligible: false,
        seniorEligible: true,
        childRate: 0.5
      });
      tiers.push({
        id: "rajahamsa",
        name: "Rajahamsa Executive",
        subtitle: "2+2 Pushback Non-AC Deluxe",
        isAC: false,
        baseFare: baseRajahamsa,
        fare: adjRajahamsa.fare,
        note: adjRajahamsa.note,
        durationMin: Math.max(12, Math.round((distanceKm / 46) * 60)),
        routeIds: directRoutes.filter((r) => r.id === "BLR-RJ").map((r) => r.id)
      });

      const baseEvAc = Math.max(60, Math.round(25 + distanceKm * 2.15));
      const adjEvAc = applyConcession(baseEvAc, {
        shaktiEligible: false,
        seniorEligible: false,
        childRate: 0.75
      });
      tiers.push({
        id: "evac",
        name: "KSRTC EV Power Plus AC",
        subtitle: "2+2 Electric AC Coach",
        isAC: true,
        baseFare: baseEvAc,
        fare: adjEvAc.fare,
        note: adjEvAc.note,
        durationMin: Math.max(12, Math.round((distanceKm / 48) * 60)),
        routeIds: directRoutes.filter((r) => r.id === "BLR-EV").map((r) => r.id)
      });

      const baseAiravat = Math.max(85, Math.round(35 + distanceKm * 2.65));
      const adjAiravat = applyConcession(baseAiravat, {
        shaktiEligible: false,
        seniorEligible: false,
        childRate: 0.75
      });
      tiers.push({
        id: "airavat",
        name: "Airavat Club Class AC",
        subtitle: "Volvo Multi-Axle AC Semi-Sleeper",
        isAC: true,
        baseFare: baseAiravat,
        fare: adjAiravat.fare,
        note: adjAiravat.note,
        durationMin: Math.max(12, Math.round((distanceKm / 52) * 60)),
        routeIds: directRoutes.filter((r) => r.id === "BLR-AC1").map((r) => r.id)
      });

      const baseAmbaari = Math.max(130, Math.round(55 + distanceKm * 3.35));
      const adjAmbaari = applyConcession(baseAmbaari, {
        shaktiEligible: false,
        seniorEligible: false,
        childRate: 0.75
      });
      tiers.push({
        id: "ambaari",
        name: "Ambaari Volvo AC Sleeper",
        subtitle: "2+1 AC Sleeper · Shantinagar / E-City",
        isAC: true,
        baseFare: baseAmbaari,
        fare: adjAmbaari.fare,
        note: adjAmbaari.note,
        durationMin: Math.max(14, Math.round((distanceKm / 54) * 60)),
        routeIds: directRoutes.filter((r) => r.id === "BLR-AMB").map((r) => r.id)
      });

      if (involvesAirport || directRoutes.some((r) => r.id === "BLR-KIA")) {
        const baseFlybus = Math.max(200, Math.round(70 + distanceKm * 4.05));
        const adjFlybus = applyConcession(baseFlybus, {
          shaktiEligible: false,
          seniorEligible: false,
          childRate: 0.75
        });
        tiers.push({
          id: "flybus",
          name: "FlyBus Multi-Axle AC (Airport)",
          subtitle: "Direct KIA Terminal AC Coach",
          isAC: true,
          baseFare: baseFlybus,
          fare: adjFlybus.fare,
          note: adjFlybus.note,
          durationMin: Math.max(25, Math.round((distanceKm / 55) * 60)),
          routeIds: ["BLR-KIA"]
        });
      }
    }

    return {
      fromStop,
      toStop,
      distanceKm: Number(distanceKm.toFixed(1)),
      directRouteIds: directRoutes.map((r) => r.id),
      tiers
    };
  }

  function sampleRouteAt(route, progress01, direction) {
    const clampedDist = Math.max(0, Math.min(route.totalDist, progress01 * route.totalDist));

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
    const heading = direction >= 0 ? bearingDegrees(p1, p2) : bearingDegrees(p2, p1);

    return { lng, lat, heading };
  }

  const CROWD_LEVELS = ["Low", "Moderate", "Busy"];
  let tumkurRegCounter = 1041;
  let blrRegCounter = 4201;
  let acRegCounter = 9601;
  let liveSpawnSeq = 1;

  function makeReg(route) {
    if (route.isAC) return `KA-57-F-${acRegCounter++}`;
    if (route.category === "bangalore") return `KA-01-F-${blrRegCounter++}`;
    return `KA-06-F-${tumkurRegCounter++}`;
  }

  function createInitialFleet() {
    tumkurRegCounter = 1041;
    blrRegCounter = 4201;
    acRegCounter = 9601;
    const fleet = [];

    ROUTES.forEach((route, rIdx) => {
      const count = route.busCount || 3;
      for (let i = 0; i < count; i++) {
        const direction = i % 2 === 0 ? 1 : -1;
        const progress = (i + 0.3) / count;
        const pos = sampleRouteAt(route, progress, direction);
        const baseSpeed = route.baseSpeed + ((rIdx + i) % 3) * 4;
        const nextStopObj = route.stops[direction > 0 ? route.stops.length - 1 : 0];

        fleet.push({
          id: `bus-${route.id}-${i + 1}`,
          routeId: route.id,
          category: route.category,
          isAC: Boolean(route.isAC),
          color: route.color,
          accent: route.accent,
          livery: route.livery,
          reg: makeReg(route),
          progress,
          direction,
          baseSpeedKmh: baseSpeed,
          speedKmh: baseSpeed,
          dwellTimer: 0,
          lng: pos.lng,
          lat: pos.lat,
          heading: pos.heading,
          braking: false,
          crowd: CROWD_LEVELS[(rIdx + i) % CROWD_LEVELS.length],
          nextStopId: nextStopObj.id,
          nextStopName: nextStopObj.name,
          etaMin: 4,
          isExternal: false,
          isNewUntil: 0
        });
      }
    });

    return fleet;
  }

  function repositionFleetOnRoutes(fleet, onlyRouteId = null) {
    fleet.forEach((bus) => {
      if (bus.isExternal) return;
      if (onlyRouteId && bus.routeId !== onlyRouteId) return;
      const route = ROUTES.find((r) => r.id === bus.routeId);
      if (!route) return;
      const pos = sampleRouteAt(route, bus.progress, bus.direction);
      bus.lng = pos.lng;
      bus.lat = pos.lat;
      bus.heading = pos.heading;
      if (!routeStopsEnabled) {
        bus.dwellTimer = 0;
        bus.braking = false;
      }
    });
  }

  function spawnLiveBus(preferredRouteId = null) {
    const route =
      ROUTES.find((r) => r.id === preferredRouteId) ||
      ROUTES[Math.floor(Math.random() * ROUTES.length)];
    const direction = Math.random() < 0.55 ? 1 : -1;
    const progress = direction === 1 ? 0.01 : 0.99;
    const pos = sampleRouteAt(route, progress, direction);
    const nextStopObj = routeStopsEnabled
      ? route.stops[direction > 0 ? 1 : route.stops.length - 2] || route.stops[0]
      : route.stops[direction > 0 ? route.stops.length - 1 : 0];

    return {
      id: `live-dispatch-${route.id}-${liveSpawnSeq++}`,
      routeId: route.id,
      category: route.category,
      isAC: Boolean(route.isAC),
      color: route.color,
      accent: route.accent,
      livery: route.livery,
      reg: makeReg(route),
      progress,
      direction,
      baseSpeedKmh: route.baseSpeed + 2,
      speedKmh: route.baseSpeed,
      dwellTimer: 0,
      lng: pos.lng,
      lat: pos.lat,
      heading: pos.heading,
      braking: false,
      crowd: "Low",
      nextStopId: nextStopObj.id,
      nextStopName: nextStopObj.name,
      etaMin: 3,
      isExternal: false,
      isNewUntil: performance.now() + 9000
    };
  }

  function stepFleet(fleet, dtSeconds, stopsEnabled = true) {
    fleet.forEach((bus) => {
      if (bus.isExternal) {
        if (bus.targetLng !== undefined && bus.targetLat !== undefined) {
          const lerp = Math.min(1, dtSeconds * 3.5);
          bus.lng += (bus.targetLng - bus.lng) * lerp;
          bus.lat += (bus.targetLat - bus.lat) * lerp;
        }
        return;
      }

      const route = ROUTES.find((r) => r.id === bus.routeId);
      if (!route) return;

      // When Stops are OFF, never hold a bus at an intermediate stop
      if (!stopsEnabled && bus.dwellTimer > 0 && bus.progress > 0.01 && bus.progress < 0.99) {
        bus.dwellTimer = 0;
        bus.braking = false;
      }

      if (bus.dwellTimer > 0) {
        bus.dwellTimer -= dtSeconds;
        bus.speedKmh = 0;
        bus.braking = true;
        return;
      }

      const jitter = Math.sin(performance.now() * 0.001 + bus.progress * 22) * 4;
      let targetSpeed = Math.max(18, bus.baseSpeedKmh + jitter);

      if (stopsEnabled) {
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
      } else {
        // Direct normal route: continuous cruising without intermediate stop braking
        bus.braking = false;
      }

      bus.speedKmh = Math.round(targetSpeed);
      const speedMps = (targetSpeed * 1000) / 3600;
      const paceMultiplier = route.category === "bangalore" ? 3.0 : 1.8;
      const deltaProgress = (bus.direction * speedMps * dtSeconds * paceMultiplier) / route.totalDist;

      bus.progress += deltaProgress;

      if (bus.progress >= 1) {
        bus.progress = 1;
        bus.direction = -1;
        bus.dwellTimer = stopsEnabled ? 2.5 : 0.8;
      } else if (bus.progress <= 0) {
        bus.progress = 0;
        bus.direction = 1;
        bus.dwellTimer = stopsEnabled ? 2.5 : 0.8;
      }

      const pos = sampleRouteAt(route, bus.progress, bus.direction);
      bus.lng = pos.lng;
      bus.lat = pos.lat;
      bus.heading = pos.heading;

      const terminalStop = route.stops[bus.direction > 0 ? route.stops.length - 1 : 0];

      if (!stopsEnabled) {
        // Show destination terminal directly instead of intermediate stops
        const remainingMeters =
          bus.direction > 0
            ? (1 - bus.progress) * route.totalDist
            : bus.progress * route.totalDist;
        bus.nextStopId = terminalStop.id;
        bus.nextStopName = terminalStop.name;
        bus.etaMin = Math.max(1, Math.round(remainingMeters / Math.max(4.5, speedMps) / 60));
      } else {
        const curDist = bus.progress * route.totalDist;
        let bestStop = terminalStop;
        let bestAheadMeters = Infinity;

        route.stops.forEach((s) => {
          const stopDist = findNearestCumDist(route, s.coord);
          const ahead = bus.direction > 0 ? stopDist - curDist : curDist - stopDist;
          if (ahead > 70 && ahead < bestAheadMeters) {
            bestAheadMeters = ahead;
            bestStop = s;
          }
        });

        bus.nextStopId = bestStop.id;
        bus.nextStopName = bestStop.name;
        const etaDist = Number.isFinite(bestAheadMeters)
          ? bestAheadMeters
          : haversineMeters([bus.lng, bus.lat], bestStop.coord);
        bus.etaMin = Math.max(1, Math.round(etaDist / Math.max(4.5, speedMps) / 60));
      }
    });
  }

  return {
    TUMKUR_CENTER,
    LANDMARKS,
    ROUTES,
    STOPS,
    getStopById,
    estimateFares,
    haversineMeters,
    bearingDegrees,
    setRouteStopMode,
    snapRoutesToRealRoads,
    createInitialFleet,
    repositionFleetOnRoutes,
    spawnLiveBus,
    stepFleet
  };
})();
