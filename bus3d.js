window.Bus3D = (() => {
  /**
   * Builds a procedural 3D KSRTC-style city bus mesh in Three.js.
   * Front points toward -Z, Roof points toward +Y, Right side toward +X.
   * Real-world scale in meters: ~11m long, 2.55m wide, 3.3m tall.
   */
  function buildBusModel({ color = "#e11d48", accent = "#fde047", routeLabel = "201" }) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.35,
      metalness: 0.25
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accent),
      roughness: 0.4,
      metalness: 0.2
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x161b26,
      roughness: 0.7,
      metalness: 0.2
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.12,
      metalness: 0.85
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.5,
      metalness: 0.1
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.3,
      metalness: 0.8
    });

    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfff7cc });
    const brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // Lower chassis skirt
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.7, 10.8), darkMat);
    chassis.position.set(0, 0.8, 0);
    group.add(chassis);

    // Main painted lower body
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 10.9), bodyMat);
    lowerBody.position.set(0, 1.45, 0);
    group.add(lowerBody);

    // Accent racing/livery stripe along both sides
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.22, 10.94), accentMat);
    stripe.position.set(0, 1.55, 0);
    group.add(stripe);

    // Upper window band
    const windowBand = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.95, 10.65), glassMat);
    windowBand.position.set(0, 2.42, 0.04);
    group.add(windowBand);

    // Window pillars for realistic bus look
    for (let z = -3.8; z <= 4.2; z += 1.6) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.96, 0.14), bodyMat);
      pillar.position.set(0, 2.42, z);
      group.add(pillar);
    }

    // Front panoramic windshield (facing -Z)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.34, 1.15, 0.12), glassMat);
    windshield.position.set(0, 2.25, -5.42);
    windshield.rotation.x = 0.1;
    group.add(windshield);

    // Front LED destination sign bar
    const ledSign = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.24, 0.1), ledMat);
    ledSign.position.set(0, 2.95, -5.46);
    group.add(ledSign);

    // Roof cap
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.34, 10.85), roofMat);
    roof.position.set(0, 3.06, 0);
    group.add(roof);

    // Roof AC pod
    const acPod = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.32, 3.2), bodyMat);
    acPod.position.set(0, 3.36, 0.3);
    group.add(acPod);

    // Front & rear bumpers
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.35, 0.25), darkMat);
    frontBumper.position.set(0, 0.72, -5.48);
    group.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.35, 0.25), darkMat);
    rearBumper.position.set(0, 0.72, 5.48);
    group.add(rearBumper);

    // Headlights (-Z)
    const headlights = [];
    [-0.92, 0.92].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.1), headLightMat);
      hl.position.set(x, 1.05, -5.48);
      group.add(hl);
      headlights.push(hl);
    });

    // Brake / Tail lights (+Z)
    const brakeLights = [];
    [-0.95, 0.95].forEach((x) => {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.1), brakeLightMat);
      bl.position.set(x, 1.12, 5.48);
      group.add(bl);
      brakeLights.push(bl);
    });

    // 4 Rotating 3D Wheels
    const wheels = [];
    const wheelCoords = [
      [-1.3, 0.52, -3.3],
      [1.3, 0.52, -3.3],
      [-1.3, 0.52, 3.1],
      [1.3, 0.52, 3.1]
    ];

    const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.34, 16);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.37, 10);
    rimGeo.rotateZ(Math.PI / 2);

    wheelCoords.forEach(([x, y, z]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, y, z);
      wheelGroup.add(new THREE.Mesh(tireGeo, tireMat));
      wheelGroup.add(new THREE.Mesh(rimGeo, rimMat));
      group.add(wheelGroup);
      wheels.push(wheelGroup);
    });

    // Ground glow halo beneath bus for crisp readability on dark/satellite maps
    const shadowGeo = new THREE.PlaneGeometry(3.4, 12.2);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0, 0.05, 0);
    group.add(shadow);

    // CRITICAL for MapLibre custom WebGL layer: disable frustum culling on every child!
    group.traverse((obj) => {
      obj.frustumCulled = false;
    });

    group.userData = {
      wheels,
      headlights,
      brakeLights,
      brakeLightMat,
      headLightMat,
      routeLabel
    };

    return group;
  }

  /**
   * Creates a MapLibre GL JS Custom WebGL Layer that renders all live 3D buses
   * directly on top of the Tumakuru map.
   */
  function createMapBusLayer({ originLng, originLat, getFleet, getBoostScale }) {
    const originMerc = maplibregl.MercatorCoordinate.fromLngLat([originLng, originLat], 0);
    const meterScale = originMerc.meterInMercatorCoordinateUnits();
    const rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);

    // Local meters -> MapLibre Mercator transform
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

        // Bright daylight + hemisphere lighting so 3D buses pop on any map theme
        const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 1.15);
        this.scene.add(hemi);

        const sun = new THREE.DirectionalLight(0xfffbeb, 1.1);
        sun.position.set(120, 260, 140);
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0x93c5fd, 0.55);
        fill.position.set(-140, 120, -100);
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

        // Adaptive 3D scale so buses stay unmistakably visible at city zoom
        const visualScale = boost
          ? Math.max(1.5, Math.min(18, Math.pow(2, 16.4 - zoom) * 1.1))
          : Math.max(1.0, Math.min(6, Math.pow(2, 14.8 - zoom)));

        const activeIds = new Set();

        fleet.forEach((bus) => {
          activeIds.add(bus.id);
          let mesh = meshMap.get(bus.id);
          if (!mesh) {
            mesh = buildBusModel({
              color: bus.color,
              accent: bus.accent,
              routeLabel: bus.routeId
            });
            this.scene.add(mesh);
            meshMap.set(bus.id, mesh);
          }

          const mc = maplibregl.MercatorCoordinate.fromLngLat([bus.lng, bus.lat], 0);
          const px = (mc.x - originMerc.x) / meterScale;
          const pz = (mc.y - originMerc.y) / meterScale;

          mesh.position.set(px, 0, pz);
          mesh.rotation.y = -(bus.heading * Math.PI) / 180;
          mesh.scale.setScalar(visualScale);

          // Spin wheels proportional to speed
          const spin = (bus.speedKmh || 0) * 0.008;
          mesh.userData.wheels.forEach((w) => {
            w.rotation.x -= spin;
          });

          // Brighten brake lights when slowing or stopped
          mesh.userData.brakeLightMat.color.setHex(bus.braking ? 0xff3b3b : 0x6b0f1a);
        });

        // Clean up removed buses (e.g. switching feeds)
        for (const [id, mesh] of meshMap.entries()) {
          if (!activeIds.has(id)) {
            this.scene.remove(mesh);
            meshMap.delete(id);
          }
        }

        // Handle both MapLibre v4 array and v5 object matrix signatures safely
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
   * Standalone interactive 3D Bus Turntable for the Inspector Card
   */
  class BusInspector3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(36, 286 / 170, 0.1, 100);
      this.camera.position.set(11, 5.2, 11);
      this.camera.lookAt(0, 1.5, 0);

      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.resize();

      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2));
      const key = new THREE.DirectionalLight(0xfffbeb, 1.2);
      key.position.set(8, 14, 10);
      this.scene.add(key);

      // Subtle turntable floor ring
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.4, 0.18, 40),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.3 })
      );
      disc.position.y = -0.1;
      this.scene.add(disc);

      this.busMesh = null;
      this.angle = 0.65;
      this.pitch = 0.34;
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
      if (this.busMesh) {
        this.scene.remove(this.busMesh);
      }
      this.busMesh = buildBusModel({
        color: bus.color,
        accent: bus.accent,
        routeLabel: bus.routeId
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
      this.busMesh.userData.headLightMat.color.setHex(this.lightsOn ? 0xfff7cc : 0x334155);
      this.busMesh.userData.brakeLightMat.color.setHex(this.lightsOn ? 0xff2a2a : 0x451a1a);
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
        this.pitch = Math.max(0.12, Math.min(1.1, this.pitch + (e.clientY - this.lastY) * 0.008));
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

      const r = 13.8;
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
