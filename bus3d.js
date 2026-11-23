window.Bus3D = (() => {
  const sharedTireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.34, 14);
  sharedTireGeo.rotateZ(Math.PI / 2);
  const sharedRimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.37, 10);
  sharedRimGeo.rotateZ(Math.PI / 2);

  const sharedDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.2 });
  const sharedGlassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.14, metalness: 0.85 });
  const sharedTireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const sharedRimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });
  const sharedLedMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const sharedShadowMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.36,
    depthWrite: false
  });

  function buildBusModel({ color = "#dc2626", accent = "#fde047", isAC = false }) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: isAC ? 0.25 : 0.38,
      metalness: isAC ? 0.38 : 0.2
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accent),
      roughness: 0.35,
      metalness: 0.25
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: isAC ? 0xf8fafc : 0xe2e8f0,
      roughness: 0.42,
      metalness: 0.15
    });

    const acTrimMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.25,
      metalness: 0.35
    });

    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

    const length = isAC ? 12.6 : 10.8;

    // Ground drop shadow
    const shadowGeo = new THREE.PlaneGeometry(3.4, length + 1.2);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(shadowGeo, sharedShadowMat);
    shadow.position.set(0.6, 0.04, 0.6);
    group.add(shadow);

    // Live-spawn pulse ring (shown briefly when a new bus goes live)
    const ringGeo = new THREE.RingGeometry(4.5, 6.2, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const newRingMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const newRing = new THREE.Mesh(ringGeo, newRingMat);
    newRing.position.set(0, 0.08, 0);
    group.add(newRing);

    // Lower chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.65, length), sharedDarkMat);
    chassis.position.set(0, 0.78, 0);
    group.add(chassis);

    // Main lower body
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.66, 1.08, length + 0.14), bodyMat);
    lowerBody.position.set(0, 1.46, 0);
    group.add(lowerBody);

    // Side livery stripe
    const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.24, length + 0.18), accentMat);
    sideStripe.position.set(0, 1.56, 0);
    group.add(sideStripe);

    // Panoramic window band
    const windowBand = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.98, length - 0.18), sharedGlassMat);
    windowBand.position.set(0, 2.44, 0.05);
    group.add(windowBand);

    // Window pillars
    for (let z = -length * 0.35; z <= length * 0.38; z += 1.75) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.62, 1.0, 0.14), bodyMat);
      pillar.position.set(0, 2.44, z);
      group.add(pillar);
    }

    // Sloped front windshield (-Z)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.4), sharedGlassMat);
    windshield.position.set(0, 2.38, -length / 2 - 0.02);
    windshield.rotation.x = 0.24;
    group.add(windshield);

    // Front destination LED sign
    const ledSign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.24, 0.12), sharedLedMat);
    ledSign.position.set(0, 3.0, -length / 2 - 0.08);
    group.add(ledSign);

    // Front mirrors
    [-1.54, 1.54].forEach((x) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.12), sharedDarkMat);
      arm.position.set(x * 0.92, 2.35, -length / 2 + 0.25);
      group.add(arm);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.28), sharedDarkMat);
      mirror.position.set(x, 2.25, -length / 2 + 0.15);
      group.add(mirror);
    });

    // Roof deck
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, length), roofMat);
    roof.position.set(0, 3.08, 0);
    group.add(roof);

    // Roof livery accents
    const roofFrontBand = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.1, 1.9), bodyMat);
    roofFrontBand.position.set(0, 3.26, -length / 2 + 1.05);
    group.add(roofFrontBand);

    const roofCenterStripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, length - 0.6), bodyMat);
    roofCenterStripe.position.set(0, 3.26, 0.1);
    group.add(roofCenterStripe);

    if (isAC) {
      const hvacMain = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.42, 4.6), bodyMat);
      hvacMain.position.set(0, 3.46, 0.55);
      group.add(hvacMain);

      const hvacTrim = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.12, 3.8), acTrimMat);
      hvacTrim.position.set(0, 3.68, 0.55);
      group.add(hvacTrim);

      const hvacFront = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.26, 1.5), acTrimMat);
      hvacFront.position.set(0, 3.38, -length * 0.26);
      group.add(hvacFront);
    } else {
      const roofPod = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.32, 2.8), bodyMat);
      roofPod.position.set(0, 3.4, 0.4);
      group.add(roofPod);

      const frontHatch = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.0), sharedDarkMat);
      frontHatch.position.set(0, 3.3, -length * 0.26);
      group.add(frontHatch);
    }

    // Headlights (-Z)
    [-0.92, 0.92].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.14), headLightMat);
      hl.position.set(x, 1.06, -length / 2 - 0.08);
      group.add(hl);
    });

    // Brake lights (+Z)
    [-0.95, 0.95].forEach((x) => {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.14), brakeLightMat);
      bl.position.set(x, 1.12, length / 2 + 0.08);
      group.add(bl);
    });

    // Rotating 3D Wheels
    const wheels = [];
    const wheelZ = isAC ? [-3.9, 2.7, 4.15] : [-3.3, 3.1];
    wheelZ.forEach((z) => {
      [-1.34, 1.34].forEach((x) => {
        const wGroup = new THREE.Group();
        wGroup.position.set(x, 0.52, z);
        wGroup.add(new THREE.Mesh(sharedTireGeo, sharedTireMat));
        wGroup.add(new THREE.Mesh(sharedRimGeo, sharedRimMat));
        group.add(wGroup);
        wheels.push(wGroup);
      });
    });

    group.traverse((obj) => {
      obj.frustumCulled = false;
    });

    group.userData = {
      wheels,
      headLightMat,
      brakeLightMat,
      newRing,
      newRingMat
    };

    return group;
  }

  function createMapBusLayer({ originLng, originLat, getFleet, getBoostScale, getSelectedBusId }) {
    const originMerc = maplibregl.MercatorCoordinate.fromLngLat([originLng, originLat], 0);
    const meterScale = originMerc.meterInMercatorCoordinateUnits();
    const rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);

    const localToMercator = new THREE.Matrix4()
      .makeTranslation(originMerc.x, originMerc.y, originMerc.z)
      .scale(new THREE.Vector3(meterScale, -meterScale, meterScale))
      .multiply(rotX);

    const meshMap = new Map();

    return {
      id: "tumkur-3d-buses",
      type: "custom",
      renderingMode: "3d",

      onAdd(map, gl) {
        this.map = map;
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x475569, 1.12));

        const sun = new THREE.DirectionalLight(0xfffbeb, 1.25);
        sun.position.set(-180, 280, -140);
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0x93c5fd, 0.52);
        fill.position.set(160, 120, 160);
        this.scene.add(fill);

        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });
        this.renderer.autoClear = false;
      },

      render(gl, matrix) {
        const fleet = getFleet();
        const zoom = this.map.getZoom();
        const boost = getBoostScale();
        const selectedId = getSelectedBusId ? getSelectedBusId() : null;
        const now = performance.now();

        const baseScale = boost
          ? Math.max(2.2, Math.min(68, Math.pow(2, 16.95 - zoom) * 1.45))
          : Math.max(1.4, Math.min(28, Math.pow(2, 15.55 - zoom) * 1.15));

        const laneOffsetMeters = Math.min(5.0, 2.4 * Math.min(baseScale * 0.45, 2.2));
        const activeIds = new Set();

        fleet.forEach((bus) => {
          activeIds.add(bus.id);
          let mesh = meshMap.get(bus.id);
          if (!mesh) {
            mesh = buildBusModel({
              color: bus.color,
              accent: bus.accent,
              isAC: Boolean(bus.isAC)
            });
            this.scene.add(mesh);
            meshMap.set(bus.id, mesh);
          }

          const mc = maplibregl.MercatorCoordinate.fromLngLat([bus.lng, bus.lat], 0);
          const headingRad = (bus.heading * Math.PI) / 180;

          const leftX = -Math.cos(headingRad) * laneOffsetMeters;
          const leftZ = -Math.sin(headingRad) * laneOffsetMeters;

          const px = (mc.x - originMerc.x) / meterScale + leftX;
          const pz = (mc.y - originMerc.y) / meterScale + leftZ;

          mesh.position.set(px, 0, pz);
          mesh.rotation.y = -headingRad;
          const busScale = bus.id === selectedId ? baseScale * 1.18 : baseScale;
          mesh.scale.setScalar(busScale);

          const spin = (bus.speedKmh || 0) * 0.008;
          mesh.userData.wheels.forEach((w) => {
            w.rotation.x -= spin;
          });

          mesh.userData.brakeLightMat.color.setHex(bus.braking ? 0xff2a2a : 0x7f1d1d);

          // Animate emerald ring under newly live buses
          if (bus.isNewUntil && bus.isNewUntil > now) {
            const pulsePhase = (now * 0.004) % 1;
            mesh.userData.newRing.scale.setScalar(1 + pulsePhase * 1.4);
            mesh.userData.newRingMat.opacity = (1 - pulsePhase) * 0.85;
          } else {
            mesh.userData.newRingMat.opacity = 0;
          }
        });

        for (const [id, mesh] of meshMap.entries()) {
          if (!activeIds.has(id)) {
            this.scene.remove(mesh);
            meshMap.delete(id);
          }
        }

        const rawMatrix = Array.isArray(matrix)
          ? matrix
          : matrix.defaultProjectionData.mainMatrix;

        const m = new THREE.Matrix4().fromArray(rawMatrix);
        this.camera.projectionMatrix = m.multiply(localToMercator);

        if (this.renderer.resetState) {
          this.renderer.resetState();
        } else if (this.renderer.state && this.renderer.state.reset) {
          this.renderer.state.reset();
        }

        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
      }
    };
  }

  class BusInspector3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(36, 286 / 162, 0.1, 100);

      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.resize();

      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 1.25));
      const key = new THREE.DirectionalLight(0xfffbeb, 1.15);
      key.position.set(8, 15, 10);
      this.scene.add(key);

      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(7.8, 8.0, 0.18, 40),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7, metalness: 0.1 })
      );
      disc.position.y = -0.1;
      this.scene.add(disc);

      this.busMesh = null;
      this.angle = 0.65;
      this.pitch = 0.36;
      this.dragging = false;
      this.lastX = 0;
      this.lastY = 0;
      this.lightsOn = true;

      this._bindPointer();
      this._animate();
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const w = Math.max(200, rect.width);
      const h = Math.max(145, rect.height);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    setBus(bus) {
      if (this.busMesh) this.scene.remove(this.busMesh);
      this.busMesh = buildBusModel({
        color: bus.color,
        accent: bus.accent,
        isAC: Boolean(bus.isAC)
      });
      this.scene.add(this.busMesh);
      this.applyLights();
    }

    setLights(on) {
      this.lightsOn = on;
      this.applyLights();
    }

    applyLights() {
      if (!this.busMesh) return;
      this.busMesh.userData.headLightMat.color.setHex(this.lightsOn ? 0xfef08a : 0x64748b);
      this.busMesh.userData.brakeLightMat.color.setHex(this.lightsOn ? 0xff2a2a : 0x7f1d1d);
    }

    _bindPointer() {
      this.canvas.addEventListener("pointerdown", (e) => {
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.canvas.setPointerCapture(e.pointerId);
      });
      this.canvas.addEventListener("pointermove", (e) => {
        if (!this.dragging) return;
        this.angle -= (e.clientX - this.lastX) * 0.012;
        this.pitch = Math.max(0.12, Math.min(1.15, this.pitch + (e.clientY - this.lastY) * 0.008));
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      });
      this.canvas.addEventListener("pointerup", () => {
        this.dragging = false;
      });
    }

    _animate() {
      requestAnimationFrame(() => this._animate());
      if (!this.dragging) this.angle += 0.006;

      const r = 14.8;
      this.camera.position.set(
        Math.sin(this.angle) * Math.cos(this.pitch) * r,
        Math.sin(this.pitch) * r + 1.2,
        Math.cos(this.angle) * Math.cos(this.pitch) * r
      );
      this.camera.lookAt(0, 1.5, 0);

      if (this.busMesh) {
        this.busMesh.userData.wheels.forEach((w) => (w.rotation.x -= 0.06));
      }

      this.renderer.render(this.scene, this.camera);
    }
  }

  return {
    buildBusModel,
    createMapBusLayer,
    BusInspector3D
  };
})();
