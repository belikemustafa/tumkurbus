window.Bus3D = (() => {
  /**
   * Builds a procedural 3D KSRTC / Airavat bus model in Three.js.
   * Front points toward -Z, Roof points toward +Y, Right side toward +X.
   * Designed with sharp top-down + 3D detail so it reads clearly in 2D top view
   * and spins smoothly inside the 3D inspector turntable.
   */
  function buildBusModel({ color = "#dc2626", accent = "#fde047", isVolvo = false }) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.35,
      metalness: 0.22
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accent),
      roughness: 0.35,
      metalness: 0.2
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.14,
      metalness: 0.85
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: isVolvo ? 0xf8fafc : 0xe2e8f0,
      roughness: 0.45,
      metalness: 0.12
    });

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });

    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    const length = isVolvo ? 12.2 : 10.8;

    // Offset ground drop shadow so the 3D bus casts crisp depth in 2D top-down view
    const shadowGeo = new THREE.PlaneGeometry(3.3, length + 1.1);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0.55, 0.04, 0.55);
    group.add(shadow);

    // Lower chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.65, length), darkMat);
    chassis.position.set(0, 0.78, 0);
    group.add(chassis);

    // Main lower painted body
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.64, 1.08, length + 0.12), bodyMat);
    lowerBody.position.set(0, 1.46, 0);
    group.add(lowerBody);

    // Side accent stripe
    const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.24, length + 0.16), accentMat);
    sideStripe.position.set(0, 1.56, 0);
    group.add(sideStripe);

    // Side window band
    const windowBand = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.96, length - 0.18), glassMat);
    windowBand.position.set(0, 2.44, 0.05);
    group.add(windowBand);

    // Window pillars
    for (let z = -length * 0.35; z <= length * 0.38; z += 1.65) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.98, 0.14), bodyMat);
      pillar.position.set(0, 2.44, z);
      group.add(pillar);
    }

    // Sloped front windshield (visible even from top-down!)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.38, 1.18, 0.38), glassMat);
    windshield.position.set(0, 2.38, -length / 2 - 0.02);
    windshield.rotation.x = 0.24;
    group.add(windshield);

    // Front destination LED sign
    const ledSign = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.24, 0.12), ledMat);
    ledSign.position.set(0, 2.98, -length / 2 - 0.08);
    group.add(ledSign);

    // Front side mirrors (clear top-down direction cue!)
    [-1.52, 1.52].forEach((x) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.12), darkMat);
      arm.position.set(x * 0.92, 2.35, -length / 2 + 0.25);
      group.add(arm);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.26), darkMat);
      mirror.position.set(x, 2.25, -length / 2 + 0.15);
      group.add(mirror);
    });

    // Main Roof Deck
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.34, length), roofMat);
    roof.position.set(0, 3.08, 0);
    group.add(roof);

    // Roof livery band (front + edges so color stands out clearly from directly above)
    const roofFrontBand = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.8), bodyMat);
    roofFrontBand.position.set(0, 3.26, -length / 2 + 1.0);
    group.add(roofFrontBand);

    const roofCenterStripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, length - 0.6), bodyMat);
    roofCenterStripe.position.set(0, 3.26, 0.1);
    group.add(roofCenterStripe);

    // Roof AC Pod(s) + Vent Hatch
    const acPod = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.36, isVolvo ? 4.2 : 3.0), bodyMat);
    acPod.position.set(0, 3.42, 0.45);
    group.add(acPod);

    const acVent = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, isVolvo ? 3.2 : 2.1), accentMat);
    acVent.position.set(0, 3.62, 0.45);
    group.add(acVent);

    const frontHatch = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.0), darkMat);
    frontHatch.position.set(0, 3.3, -length * 0.26);
    group.add(frontHatch);

    // Headlights (-Z) + subtle forward glow wedge
    [-0.92, 0.92].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.14), headLightMat);
      hl.position.set(x, 1.06, -length / 2 - 0.08);
      group.add(hl);
    });

    // Brake lights (+Z)
    [-0.95, 0.95].forEach((x) => {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.14), brakeLightMat);
      bl.position.set(x, 1.12, length / 2 + 0.08);
      group.add(bl);
    });

    // Rotating 3D Wheels
    const wheels = [];
    const wheelZ = isVolvo ? [-3.8, 2.8, 4.1] : [-3.3, 3.1];
    const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.34, 16);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.37, 10);
    rimGeo.rotateZ(Math.PI / 2);

    wheelZ.forEach((z) => {
      [-1.32, 1.32].forEach((x) => {
        const wGroup = new THREE.Group();
        wGroup.position.set(x, 0.52, z);
        wGroup.add(new THREE.Mesh(tireGeo, tireMat));
        wGroup.add(new THREE.Mesh(rimGeo, rimMat));
        group.add(wGroup);
        wheels.push(wGroup);
      });
    });

    // Prevent MapLibre custom projection frustum culling
    group.traverse((obj) => {
      obj.frustumCulled = false;
    });

    group.userData = {
      wheels,
      headLightMat,
      brakeLightMat
    };

    return group;
  }

  /**
   * MapLibre Custom WebGL Layer rendering all 3D buses on the 2D top-down map
   */
  function createMapBusLayer({ originLng, originLat, getFleet, getBoostScale }) {
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

        // Crisp angled sunlight so roofs, AC pods, and side bevels show 3D shading from top-down
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x475569, 1.1));

        const sun = new THREE.DirectionalLight(0xfffbeb, 1.2);
        sun.position.set(-180, 280, -140);
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0x93c5fd, 0.5);
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

        // Smooth zoom-adaptive scale from street level (z17) out to full BLR–TMK highway (z10)
        const visualScale = boost
          ? Math.max(1.4, Math.min(48, Math.pow(2, 16.5 - zoom) * 1.15))
          : Math.max(1.0, Math.min(20, Math.pow(2, 15.0 - zoom)));

        // Slight Indian left-hand lane offset so opposite-direction buses stay separated on roads
        const laneOffsetMeters = Math.min(4.2, 2.2 * Math.min(visualScale * 0.45, 2.2));

        const activeIds = new Set();

        fleet.forEach((bus) => {
          activeIds.add(bus.id);
          let mesh = meshMap.get(bus.id);
          if (!mesh) {
            mesh = buildBusModel({
              color: bus.color,
              accent: bus.accent,
              isVolvo: bus.routeId === "BLR-VOL" || bus.routeId === "BLR-HEB"
            });
            this.scene.add(mesh);
            meshMap.set(bus.id, mesh);
          }

          const mc = maplibregl.MercatorCoordinate.fromLngLat([bus.lng, bus.lat], 0);
          const headingRad = (bus.heading * Math.PI) / 180;

          // Left-hand traffic lateral offset vector in local (East=+X, South=+Z)
          const leftX = -Math.cos(headingRad) * laneOffsetMeters;
          const leftZ = -Math.sin(headingRad) * laneOffsetMeters;

          const px = (mc.x - originMerc.x) / meterScale + leftX;
          const pz = (mc.y - originMerc.y) / meterScale + leftZ;

          mesh.position.set(px, 0, pz);
          mesh.rotation.y = -headingRad;
          mesh.scale.setScalar(visualScale);

          const spin = (bus.speedKmh || 0) * 0.008;
          mesh.userData.wheels.forEach((w) => {
            w.rotation.x -= spin;
          });

          mesh.userData.brakeLightMat.color.setHex(bus.braking ? 0xff2a2a : 0x7f1d1d);
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

  /**
   * Standalone interactive 3D Bus Turntable inside the Inspector Card
   */
  class BusInspector3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(36, 284 / 165, 0.1, 100);

      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.resize();

      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 1.25));
      const key = new THREE.DirectionalLight(0xfffbeb, 1.15);
      key.position.set(8, 15, 10);
      this.scene.add(key);

      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(7.5, 7.7, 0.18, 40),
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
      this.wireframe = false;

      this._bindPointer();
      this._animate();
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const w = Math.max(200, rect.width);
      const h = Math.max(150, rect.height);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    setBus(bus) {
      if (this.busMesh) this.scene.remove(this.busMesh);
      this.busMesh = buildBusModel({
        color: bus.color,
        accent: bus.accent,
        isVolvo: bus.routeId === "BLR-VOL" || bus.routeId === "BLR-HEB"
      });
      this.scene.add(this.busMesh);
      this.applyModes();
    }

    setLights(on) {
      this.lightsOn = on;
      this.applyModes();
    }

    setWireframe(on) {
      this.wireframe = on;
      this.applyModes();
    }

    applyModes() {
      if (!this.busMesh) return;
      this.busMesh.userData.headLightMat.color.setHex(this.lightsOn ? 0xfef08a : 0x64748b);
      this.busMesh.userData.brakeLightMat.color.setHex(this.lightsOn ? 0xff2a2a : 0x7f1d1d);
      this.busMesh.traverse((obj) => {
        if (obj.isMesh && obj.material && "wireframe" in obj.material) {
          obj.material.wireframe = this.wireframe;
        }
      });
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

      const r = 14.5;
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
