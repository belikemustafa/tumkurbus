window.TumkurData = (() => {
  const TUMKUR_CENTER = [77.1130, 13.3375];

  const LANDMARKS = {
    tumkur: { center: [77.1130, 13.3375], zoom: 13.5 },
    ksrtc: { center: [77.1074, 13.3378], zoom: 15.8 },
    sit: { center: [77.1262, 13.3268], zoom: 15.8 },
    mutt: { center: [77.1496, 13.3198], zoom: 15.4 },
    corridor: { center: [77.3500, 13.1550], zoom: 10.1 },
    nelamangala: { center: [77.3936, 13.0998], zoom: 13.6 },
    majestic: { center: [77.5724, 12.9781], zoom: 14.3 },
    airport: { center: [77.7066, 13.1986], zoom: 13.2 }
  };

  // Kannada translations for all Tumakuru & Bengaluru corridor bus stops
  const STOP_KANNADA = {
    heggere: "ಹೆಗ್ಗೆರೆ / ಎಸ್‌ಎಸ್‌ಎಂಸಿ",
    gubbi: "ಗುಬ್ಬಿ ಗೇಟ್",
    townhall: "ಟೌನ್ ಹಾಲ್ ವೃತ್ತ",
    ksrtc: "ತುಮಕೂರು ಕೆಎಸ್‌ಆರ್‌ಟಿಸಿ ನಿಲ್ದಾಣ",
    univ: "ತುಮಕೂರು ವಿಶ್ವವಿದ್ಯಾಲಯ",
    sit: "ಎಸ್‌ಐಟಿ ಮುಖ್ಯ ದ್ವಾರ",
    batawadi: "ಬಟವಾಡಿ ಬೈಪಾಸ್",
    kyathsandra: "ಕ್ಯಾತ್ಸಂದ್ರ ವೃತ್ತ",
    mutt: "ಸಿದ್ಧಗಂಗಾ ಮಠ",
    shettihalli: "ಶೆಟ್ಟಿಹಳ್ಳಿ ಗೇಟ್",
    sspuram: "ಎಸ್‌ಎಸ್ ಪುರಂ ಮುಖ್ಯ ರಸ್ತೆ",
    siragate: "ಶಿರಾ ಗೇಟ್",
    anthara: "ಅಂತರಸನಹಳ್ಳಿ",
    maralur: "ಮರಳೂರು ದಿಣ್ಣೆ",
    oorukere: "ಊರುಕೆರೆ (ಎನ್‌ಎಚ್-48)",
    upparahalli: "ಉಪ್ಪಾರಹಳ್ಳಿ",
    jayanagar: "ಜಯನಗರ ರಿಂಗ್ ರಸ್ತೆ",
    sitback: "ಎಸ್‌ಐಟಿ ಹಿಂಬದಿ ದ್ವಾರ",
    devaraya: "ದೇವರಾಯಪಟ್ಟಣ",
    gangasandra: "ಗಂಗಸಂದ್ರ",
    belagumba: "ಬೆಳಗುಂಬ",
    bellavi: "ಬೆಳ್ಳಾವಿ ಕ್ರಾಸ್",
    gulur: "ಗೂಳೂರು ವೃತ್ತ",
    gubbitown: "ಗುಬ್ಬಿ ಬಸ್ ನಿಲ್ದಾಣ",
    hebbur: "ಹೆಬ್ಬೂರು ಬಸ್ ನಿಲ್ದಾಣ",
    hirehalli: "ಹಿರೇಹಳ್ಳಿ ಕೈಗಾರಿಕಾ ಪ್ರದೇಶ",
    dobbaspet: "ದಾಬಸ್‌ಪೇಟೆ (ಎನ್‌ಎಚ್-48)",
    nelamangala: "ನೆಲಮಂಗಲ ಬಸ್ ನಿಲ್ದಾಣ",
    dasarahalli: "8ನೇ ಮೈಲಿ / ದಾಸರಹಳ್ಳಿ",
    jalahalli: "ಜಾಲಹಳ್ಳಿ ಕ್ರಾಸ್",
    goragunte: "ಗೊರಗುಂಟೆಪಾಳ್ಯ",
    yeshwantpur: "ಯಶವಂತಪುರ ವೃತ್ತ",
    majestic: "ಮೆಜೆಸ್ಟಿಕ್ ಕೆಬಿಎಸ್ (ಬೆಂಗಳೂರು)",
    hebbal: "ಹೆಬ್ಬಾಳ ಫ್ಲೈಓವರ್",
    krpuram: "ಕೆಆರ್ ಪುರಂ (ಬೆಂಗಳೂರು)",
    shantinagar: "ಶಾಂತಿನಗರ ಬಸ್ ನಿಲ್ದಾಣ",
    silkboard: "ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಜಂಕ್ಷನ್",
    ecity: "ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ ಹಂತ 1",
    airport: "ಕೆಂಪೇಗೌಡ ವಿಮಾನ ನಿಲ್ದಾಣ (KIA)",
    railway: "ತುಮಕೂರು ರೈಲ್ವೆ ನಿಲ್ದಾಣ",
    ashoka: "ಅಶೋಕ ರಸ್ತೆ ನಿಲ್ದಾಣ",
    dist_hosp: "ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ನಿಲ್ದಾಣ",
    mg_road: "ಎಂಜಿ ರಸ್ತೆ / ಚಿಕ್ಕಪೇಟೆ",
    bh_road: "ಬಿ.ಎಚ್. ರಸ್ತೆ / ಅಮಾನಿಕೆರೆ",
    siddaganga_ext: "ಸಿದ್ಧಗಂಗಾ ಬಡಾವಣೆ",
    rk_ashram: "ರಾಮಕೃಷ್ಣ ಆಶ್ರಮ",
    melekote: "ಮೇಳೆಕೋಟೆ ಕ್ರಾಸ್",
    dibbur: "ದಿಬ್ಬೂರು ವೃತ್ತ",
    yellapura: "ಯಲ್ಲಾಪುರ ಕ್ರಾಸ್",
    ring_cross: "ರಿಂಗ್ ರಸ್ತೆ / ಬಟವಾಡಿ ಸೇತುವೆ",
    honnenahalli: "ಹೊನ್ನೇನಹಳ್ಳಿ / ಬಡ್ಡಿಹಳ್ಳಿ"
  };

  // 16 Routes (10 Tumakuru City/Suburban + 6 Bengaluru Corridors incl. 4 AC fleets)
  const ROUTES = [
    {
      id: "201",
      category: "city",
      isAC: false,
      name: "Heggere – KSRTC Stand – SIT – Kyathsandra",
      livery: "KSRTC City Crimson",
      color: "#dc2626",
      accent: "#fde047",
      busCount: 6,
      baseSpeed: 32,
      stops: [
        { id: "heggere", name: "Heggere / SSMC", coord: [77.0655, 13.3312], major: true },
        { id: "gubbi", name: "Gubbi Gate", coord: [77.0902, 13.3376], major: true },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1018, 13.3408], major: true },
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "univ", name: "Tumkur University", coord: [77.1165, 13.3340], major: true },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268], major: true },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1319, 13.3282], major: true },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143], major: true }
      ]
    },
    {
      id: "201E",
      category: "city",
      isAC: false,
      name: "KSRTC Stand – Tumkur Univ – Siddaganga Mutt",
      livery: "EV City Emerald",
      color: "#059669",
      accent: "#a7f3d0",
      busCount: 4,
      baseSpeed: 30,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "univ", name: "Tumkur University", coord: [77.1165, 13.3340], major: true },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268], major: true },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143], major: true },
        { id: "mutt", name: "Siddaganga Mutt", coord: [77.1496, 13.3198], major: true }
      ]
    },
    {
      id: "202",
      category: "city",
      isAC: false,
      name: "Shettihalli – KSRTC – Sira Gate – Antharasanahalli",
      livery: "Royal Gold City",
      color: "#d97706",
      accent: "#1e293b",
      busCount: 5,
      baseSpeed: 34,
      stops: [
        { id: "shettihalli", name: "Shettihalli Gate", coord: [77.0958, 13.3260], major: false },
        { id: "sspuram", name: "SS Puram Main Rd", coord: [77.1045, 13.3315], major: true },
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1018, 13.3408], major: true },
        { id: "siragate", name: "Sira Gate", coord: [77.1021, 13.3543], major: true },
        { id: "anthara", name: "Antharasanahalli", coord: [77.0956, 13.3818], major: false }
      ]
    },
    {
      id: "203",
      category: "city",
      isAC: false,
      name: "Maralur Dinne – Gubbi Gate – KSRTC – Oorukere",
      livery: "Coastal Cyan",
      color: "#0891b2",
      accent: "#cffafe",
      busCount: 5,
      baseSpeed: 33,
      stops: [
        { id: "maralur", name: "Maralur Dinne", coord: [77.0785, 13.3348], major: false },
        { id: "gubbi", name: "Gubbi Gate", coord: [77.0902, 13.3376], major: true },
        { id: "townhall", name: "Town Hall Circle", coord: [77.1018, 13.3408], major: true },
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "siragate", name: "Sira Gate", coord: [77.1021, 13.3543], major: true },
        { id: "oorukere", name: "Oorukere (NH-48)", coord: [77.0875, 13.3950], major: false }
      ]
    },
    {
      id: "204",
      category: "city",
      isAC: false,
      name: "SS Puram – Ring Road – SIT – Batawadi",
      livery: "Deccan Violet",
      color: "#7c3aed",
      accent: "#ede9fe",
      busCount: 4,
      baseSpeed: 31,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "sspuram", name: "SS Puram Main Rd", coord: [77.1045, 13.3315], major: true },
        { id: "upparahalli", name: "Upparahalli", coord: [77.1140, 13.3230], major: false },
        { id: "jayanagar", name: "Jayanagar Ring Rd", coord: [77.1210, 13.3245], major: false },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268], major: true },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1319, 13.3282], major: true }
      ]
    },
    {
      id: "205",
      category: "city",
      isAC: false,
      name: "KSRTC – SIT Back Gate – Devarayapatna – Kyathsandra",
      livery: "Teal Metro Shuttle",
      color: "#0d9488",
      accent: "#ccfbf1",
      busCount: 4,
      baseSpeed: 30,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "upparahalli", name: "Upparahalli", coord: [77.1140, 13.3230], major: false },
        { id: "sitback", name: "SIT Back Gate", coord: [77.1278, 13.3218], major: false },
        { id: "devaraya", name: "Devarayapatna", coord: [77.1398, 13.3072], major: false },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143], major: true }
      ]
    },
    {
      id: "206",
      category: "city",
      isAC: false,
      name: "Gangasandra – Belagumba – KSRTC – SIT Gate",
      livery: "Ruby Local",
      color: "#be185d",
      accent: "#fbcfe8",
      busCount: 4,
      baseSpeed: 32,
      stops: [
        { id: "gangasandra", name: "Gangasandra", coord: [77.1225, 13.3685], major: false },
        { id: "belagumba", name: "Belagumba", coord: [77.1172, 13.3522], major: false },
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "univ", name: "Tumkur University", coord: [77.1165, 13.3340], major: true },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268], major: true }
      ]
    },
    {
      id: "207",
      category: "city",
      isAC: false,
      name: "Bellavi Cross – Gubbi Gate – KSRTC – Gulur",
      livery: "Forest Green City",
      color: "#15803d",
      accent: "#bbf7d0",
      busCount: 4,
      baseSpeed: 33,
      stops: [
        { id: "bellavi", name: "Bellavi Cross", coord: [77.0560, 13.3560], major: false },
        { id: "gubbi", name: "Gubbi Gate", coord: [77.0902, 13.3376], major: true },
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "shettihalli", name: "Shettihalli Gate", coord: [77.0958, 13.3260], major: false },
        { id: "gulur", name: "Gulur Circle", coord: [77.0888, 13.2852], major: false }
      ]
    },
    {
      id: "208",
      category: "city",
      isAC: false,
      name: "Tumakuru – Heggere – Gubbi Town Shuttle",
      livery: "Suburban Ochre",
      color: "#b45309",
      accent: "#fef3c7",
      busCount: 3,
      baseSpeed: 42,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "gubbi", name: "Gubbi Gate", coord: [77.0902, 13.3376], major: true },
        { id: "heggere", name: "Heggere / SSMC", coord: [77.0655, 13.3312], major: true },
        { id: "gubbitown", name: "Gubbi Bus Stand", coord: [76.9420, 13.3118], major: true }
      ]
    },
    {
      id: "209",
      category: "city",
      isAC: false,
      name: "Tumakuru – Kunigal Rd – Hebbur Shuttle",
      livery: "Suburban Slate",
      color: "#475569",
      accent: "#e2e8f0",
      busCount: 3,
      baseSpeed: 40,
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "sspuram", name: "SS Puram Main Rd", coord: [77.1045, 13.3315], major: true },
        { id: "gulur", name: "Gulur Circle", coord: [77.0888, 13.2852], major: false },
        { id: "hebbur", name: "Hebbur Bus Stand", coord: [77.0712, 13.1950], major: false }
      ]
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
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268], major: true },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143], major: true },
        { id: "hirehalli", name: "Hirehalli Ind. Area", coord: [77.1755, 13.2845], major: false },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276], major: true },
        { id: "nelamangala", name: "Nelamangala Bus Stand", coord: [77.3936, 13.0998], major: true },
        { id: "dasarahalli", name: "8th Mile / Dasarahalli", coord: [77.5085, 13.0448], major: false },
        { id: "jalahalli", name: "Jalahalli Cross", coord: [77.5154, 13.0384], major: false },
        { id: "goragunte", name: "Goraguntepalya", coord: [77.5404, 13.0285], major: true },
        { id: "yeshwantpur", name: "Yeshwantpur Circle", coord: [77.5540, 13.0235], major: true },
        { id: "majestic", name: "Majestic KBS (Bengaluru)", coord: [77.5724, 12.9781], major: true }
      ]
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
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143], major: true },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276], major: true },
        { id: "nelamangala", name: "Nelamangala Bus Stand", coord: [77.3936, 13.0998], major: true },
        { id: "goragunte", name: "Goraguntepalya", coord: [77.5404, 13.0285], major: true },
        { id: "hebbal", name: "Hebbal Flyover (ORR)", coord: [77.5913, 13.0358], major: true },
        { id: "krpuram", name: "KR Puram (Bengaluru)", coord: [77.6762, 13.0068], major: true }
      ]
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
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1319, 13.3282], major: true },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276], major: true },
        { id: "nelamangala", name: "Nelamangala Bypass", coord: [77.3936, 13.0998], major: true },
        { id: "goragunte", name: "Goraguntepalya", coord: [77.5404, 13.0285], major: true },
        { id: "yeshwantpur", name: "Yeshwantpur Circle", coord: [77.5540, 13.0235], major: true },
        { id: "majestic", name: "Majestic KBS (Bengaluru)", coord: [77.5724, 12.9781], major: true }
      ]
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
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "sit", name: "SIT Main Gate", coord: [77.1262, 13.3268], major: true },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143], major: true },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276], major: true },
        { id: "nelamangala", name: "Nelamangala Bus Stand", coord: [77.3936, 13.0998], major: true },
        { id: "jalahalli", name: "Jalahalli Cross", coord: [77.5154, 13.0384], major: false },
        { id: "yeshwantpur", name: "Yeshwantpur Circle", coord: [77.5540, 13.0235], major: true },
        { id: "majestic", name: "Majestic KBS (Bengaluru)", coord: [77.5724, 12.9781], major: true }
      ]
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
      stops: [
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1319, 13.3282], major: true },
        { id: "kyathsandra", name: "Kyathsandra Circle", coord: [77.1476, 13.3143], major: true },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276], major: true },
        { id: "nelamangala", name: "Nelamangala Bypass", coord: [77.3936, 13.0998], major: true },
        { id: "goragunte", name: "Goraguntepalya", coord: [77.5404, 13.0285], major: true },
        { id: "shantinagar", name: "Shantinagar Bus Station", coord: [77.5936, 12.9554], major: true },
        { id: "silkboard", name: "Silk Board Junction", coord: [77.6229, 12.9177], major: true },
        { id: "ecity", name: "Electronic City Phase 1", coord: [77.6602, 12.8452], major: true }
      ]
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
      stops: [
        { id: "ksrtc", name: "Tumakuru KSRTC Stand", coord: [77.1074, 13.3378], major: true },
        { id: "batawadi", name: "Batawadi Bypass", coord: [77.1319, 13.3282], major: true },
        { id: "dobbaspet", name: "Dobbaspet (NH-48)", coord: [77.2430, 13.2276], major: true },
        { id: "nelamangala", name: "Nelamangala Bypass", coord: [77.3936, 13.0998], major: true },
        { id: "goragunte", name: "Goraguntepalya", coord: [77.5404, 13.0285], major: true },
        { id: "hebbal", name: "Hebbal Flyover (ORR)", coord: [77.5913, 13.0358], major: true },
        { id: "airport", name: "Kempegowda Intl Airport (KIA)", coord: [77.7066, 13.1986], major: true }
      ]
    }
  ];

  // Additional local Tumakuru bus stops across the city
  const EXTRA_TUMKUR_STOPS = [
    { id: "railway", name: "Tumkur Railway Station", coord: [77.0984, 13.3444], major: true, routeIds: ["202", "203"] },
    { id: "ashoka", name: "Ashoka Road Bus Stop", coord: [77.1045, 13.3393], major: false, routeIds: ["201", "202", "203"] },
    { id: "dist_hosp", name: "District Hospital Stop", coord: [77.1105, 13.3360], major: true, routeIds: ["201", "201E", "206"] },
    { id: "mg_road", name: "MG Road / Chikpet", coord: [77.1014, 13.3370], major: false, routeIds: ["202", "204"] },
    { id: "bh_road", name: "B.H. Road / Amanikere", coord: [77.1135, 13.3352], major: false, routeIds: ["201", "201E", "BLR-SRG"] },
    { id: "siddaganga_ext", name: "Siddaganga Extension", coord: [77.1204, 13.3302], major: false, routeIds: ["201", "201E", "204"] },
    { id: "rk_ashram", name: "Ramakrishna Ashrama", coord: [77.0955, 13.3388], major: false, routeIds: ["201", "203"] },
    { id: "melekote", name: "Melekote Cross", coord: [77.1032, 13.3474], major: false, routeIds: ["202", "203"] },
    { id: "dibbur", name: "Dibbur Circle", coord: [77.1088, 13.3562], major: false, routeIds: ["202", "206"] },
    { id: "yellapura", name: "Yellapura Cross", coord: [77.0942, 13.3640], major: false, routeIds: ["202", "203"] },
    { id: "ring_cross", name: "Ring Road / Batawadi Bridge", coord: [77.1338, 13.3256], major: false, routeIds: ["201", "204", "BLR-AC1"] },
    { id: "honnenahalli", name: "Honnenahalli / Baddihalli", coord: [77.1180, 13.3148], major: false, routeIds: ["205", "209"] }
  ];

  // Collect all unique stops with Kannada labels + serving routes
  const stopMap = new Map();
  ROUTES.forEach((route) => {
    route.stops.forEach((s) => {
      s.kn = STOP_KANNADA[s.id] || s.name;
      if (!stopMap.has(s.id)) {
        stopMap.set(s.id, { ...s, kn: s.kn, routeIds: new Set([route.id]) });
      } else {
        const existing = stopMap.get(s.id);
        existing.routeIds.add(route.id);
        if (s.major) existing.major = true;
      }
    });
  });

  EXTRA_TUMKUR_STOPS.forEach((s) => {
    const kn = STOP_KANNADA[s.id] || s.name;
    if (!stopMap.has(s.id)) {
      stopMap.set(s.id, { ...s, kn, routeIds: new Set(s.routeIds || []) });
    }
  });

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

  ROUTES.forEach((route) => {
    route.path = route.stops.map((s) => s.coord);
    route.snapped = false;
    recomputeRouteMetrics(route);
  });

  const CACHE_KEY = "tumkur_blr_osrm_paths_v2";

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
            // Ignore quota errors
          }
          snappedCount++;
          if (onRouteSnapped) onRouteSnapped(route, snappedCount, ROUTES.length);
        }
      } catch {
        // Keep fallback path if offline
      }

      await new Promise((r) => setTimeout(r, 170));
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

  /**
   * KSRTC Ticket Fare Estimator between any two stops
   * Calibrated to Karnataka's Nov 5, 2026 KSRTC fare revision:
   * - City ordinary minimum ₹10, scaling by stage
   * - Tumakuru ↔ Bengaluru KSRTC Express / Sarige ₹100 (~70 km)
   * - Shakti Scheme (₹0 on Non-AC Ordinary/City/Sarige)
   * - Senior Citizen (25% off Non-AC & Rajahamsa), Child (50% Non-AC / 75% Premium AC)
   */
  function estimateFares(fromId, toId, passengerType = "adult") {
    const fromStop = getStopById(fromId);
    const toStop = getStopById(toId);
    if (!fromStop || !toStop || fromId === toId) {
      return null;
    }

    // Find direct routes connecting both stops
    const directRoutes = ROUTES.filter((r) => {
      const hasFrom = r.stops.some((s) => s.id === fromId) || fromStop.routeIds.includes(r.id);
      const hasTo = r.stops.some((s) => s.id === toId) || toStop.routeIds.includes(r.id);
      return hasFrom && hasTo;
    });

    // Compute road distance (preferring snapped OSRM route distance if direct)
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

    // 1. Tumakuru City Ordinary / EV Shuttle
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

    // 2. Intercity & Highway Tiers (shown for trips > 7 km or any Bengaluru corridor route)
    if (!isLocalCityTrip || directRoutes.some((r) => r.category === "bangalore")) {
      // KSRTC Karnataka Sarige Express (Calibrated: 70 km -> ₹100)
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

      // Rajahamsa Executive
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

      // EV Power Plus AC
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

      // Airavat Club Class AC
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

      // Ambaari Volvo AC Sleeper
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

      // FlyBus AC (when Airport KIA is selected or served)
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

    const lookStep = Math.min(route.path.length - 1, segIdx + 1);
    const backStep = Math.max(0, segIdx);
    const heading =
      direction >= 0
        ? bearingDegrees(route.path[backStep], route.path[lookStep])
        : bearingDegrees(route.path[lookStep], route.path[backStep]);

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

  function spawnLiveBus(preferredRouteId = null) {
    const route =
      ROUTES.find((r) => r.id === preferredRouteId) ||
      ROUTES[Math.floor(Math.random() * ROUTES.length)];
    const direction = Math.random() < 0.55 ? 1 : -1;
    const progress = direction === 1 ? 0.01 : 0.99;
    const pos = sampleRouteAt(route, progress, direction);
    const nextStopObj =
      route.stops[direction > 0 ? 1 : route.stops.length - 2] || route.stops[0];

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

      const jitter = Math.sin(performance.now() * 0.001 + bus.progress * 22) * 4;
      let targetSpeed = Math.max(18, bus.baseSpeedKmh + jitter);

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
      const paceMultiplier = route.category === "bangalore" ? 3.2 : 2.0;
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
      bus.nextStopId = bestStop.id;
      bus.nextStopName = bestStop.name;
      bus.etaMin = Math.max(1, Math.round(minDist / Math.max(4.5, speedMps) / 60));
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
    snapRoutesToRealRoads,
    createInitialFleet,
    spawnLiveBus,
    stepFleet
  };
})();
