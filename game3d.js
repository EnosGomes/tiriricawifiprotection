/* ============================================
   Modo Chute 3D — Three.js
   ============================================ */

class SoccerGame3D {
  constructor(container, options = {}) {
    this.container = container;
    this.onHit = options.onHit || (() => {});
    this.onKick = options.onKick || (() => {});
    this.onPowerChange = options.onPowerChange || (() => {});

    this.width = 800;
    this.height = 480;
    this.answered = false;
    this.canKick = true;
    this.hasKicked = false;
    this.dragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
    this.targets = [];
    this.ballVel = { x: 0, y: 0, z: 0 };
    this.ballStart = { x: 0, y: 0.65, z: 3.2 };
    this.animationId = null;
    this.ready = false;
    this.ballFlight = null;
    this.hitPending = null;
    this.charging = false;
    this.chargePower = 0;
    this.aimPoint = null;
    this.kickAnim = null;
    this.lastFrameTime = 0;
    this.kicker = null;
    this.shinGroup = null;

    this.goalWidth = 4.2;
    this.goalHeight = 2.7;
    this.goalDepth = 1.15;

    // Câmera mais perto dos gols
    this.cameraLookAt = new THREE.Vector3(0, 1.45, -1.4);
    this.cameraDistance = 7.2;
    this.cameraMinDist = 5;
    this.cameraMaxDist = 12;
    this.cameraPitch = 0.42;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);

    if (typeof THREE === 'undefined') {
      container.innerHTML = '<p class="game-error">Three.js não carregou. Recarregue a página.</p>';
      return;
    }

    try {
      this._initScene();
      this._bindEvents();
      this._startRenderLoop();
      this.ready = true;
    } catch (err) {
      console.error(err);
      container.innerHTML = '<p class="game-error">Erro ao iniciar o jogo 3D. Tente outro navegador.</p>';
    }
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6eb5ff);
    this.scene.fog = new THREE.Fog(0x6eb5ff, 22, 45);

    this.camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 80);
    this._updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x6eb5ff, 1);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(8, 20, 12);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-8, 10, 5);
    this.scene.add(fill);

    // Gramado
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 16),
      new THREE.MeshLambertMaterial({ color: 0x1a8a42 })
    );
    field.rotation.x = -Math.PI / 2;
    this.scene.add(field);

    // Listras
    for (let i = -1; i <= 1; i++) {
      if (i === 0) continue;
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 2.5),
        new THREE.MeshLambertMaterial({ color: 0x157a38 })
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.y = 0.02;
      stripe.position.z = i * 4 - 2;
      this.scene.add(stripe);
    }

    // Marca de pênalti (onde fica a bola)
    const penaltySpot = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true })
    );
    penaltySpot.rotation.x = -Math.PI / 2;
    penaltySpot.position.set(0, 0.04, 3.2);
    this.scene.add(penaltySpot);

    // Bola de futebol (padrão preto e branco)
    this.ball = this._createSoccerBall();
    this.scene.add(this.ball);

    // Jogador / perna que chuta
    this._createKicker();

    // Constantes de física
    this.physics = {
      gravity: 0.018,
      friction: 0.94,
      groundY: 0.65,
      bounce: -0.28,
      spin: 0.14
    };

    // Trajetória prevista (linha tracejada)
    this.trajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: 0xffdf00,
        dashSize: 0.35,
        gapSize: 0.22,
        transparent: true,
        opacity: 0.95,
        linewidth: 2
      })
    );
    this.trajectoryLine.visible = false;
    this.trajectoryLine.frustumCulled = false;
    this.scene.add(this.trajectoryLine);

    this.resize();
    this._resetBall();
  }

  _startRenderLoop() {
    if (this.animationId) return;
    const loop = (time) => {
      if (!this.lastFrameTime) this.lastFrameTime = time;
      const dt = Math.min(0.05, (time - this.lastFrameTime) / 1000);
      this.lastFrameTime = time;

      this._ensureRendererSize();
      this._updatePhysics(dt);
      this._updateKicker(dt);
      this._faceTargetsToCamera();

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  _ensureRendererSize() {
    if (!this.container || !this.renderer || !this.camera) return;

    let w = this.container.clientWidth;
    let h = this.container.clientHeight;

    if (!w || w < 50) w = this.width || 800;
    if (!h || h < 50) h = this.height || 480;

    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  _createSoccerBall() {
    const tex = this._makeSoccerBallTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    return new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 24), mat);
  }

  _makeSoccerBallTexture() {
    if (this._ballTexture) return this._ballTexture;

    const w = 512;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#1a1a1a';
    const pentagons = [
      [0.5, 0.5, 36],
      [0.5, 0.12, 22],
      [0.5, 0.88, 22],
      [0.18, 0.32, 20],
      [0.82, 0.32, 20],
      [0.18, 0.68, 20],
      [0.82, 0.68, 20],
      [0.08, 0.5, 18],
      [0.92, 0.5, 18],
      [0.32, 0.15, 16],
      [0.68, 0.15, 16],
      [0.32, 0.85, 16],
      [0.68, 0.85, 16]
    ];

    pentagons.forEach(([nx, ny, r]) => {
      ctx.beginPath();
      const sides = 5;
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = nx * w + Math.cos(angle) * r;
        const py = ny * h + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    });

    ctx.strokeStyle = 'rgba(30, 30, 30, 0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 8) * w, 0);
      ctx.lineTo((i / 8) * w, h);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    this._ballTexture = tex;
    return tex;
  }

  _createKicker() {
    this.kicker = new THREE.Group();

    const shortsMat = new THREE.MeshLambertMaterial({ color: 0x009739 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc68642 });
    const sockMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    const hip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.4), shortsMat);
    hip.position.set(0, 1.05, 0);
    this.kicker.add(hip);

    this.thigh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.95, 0.38), shortsMat);
    this.thigh.position.set(0.05, 0.55, 0);
    this.kicker.add(this.thigh);

    this.shinGroup = new THREE.Group();
    this.shinGroup.position.set(0.05, 0.08, 0);
    this.kicker.add(this.shinGroup);

    this.shin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.88, 0.34), sockMat);
    this.shin.position.set(0, -0.44, 0);
    this.shinGroup.add(this.shin);

    this.foot = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.42), bootMat);
    this.foot.position.set(0.18, -0.88, 0.12);
    this.shinGroup.add(this.foot);

    const calf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), skinMat);
    calf.position.set(0, -0.2, -0.05);
    this.shinGroup.add(calf);

    this.scene.add(this.kicker);
    this._positionKickerAtBall();
    this._setKickerPose(0, 0);
  }

  _positionKickerAtBall() {
    if (!this.kicker || !this.ball) return;
    this.kicker.position.set(
      this.ball.position.x + 0.55,
      0,
      this.ball.position.z + 0.75
    );
  }

  _setKickerPose(power, swing) {
    if (!this.shinGroup || !this.thigh) return;
    const pullBack = -0.25 - power * 0.85;
    const kickSwing = swing * 1.35;
    this.shinGroup.rotation.x = pullBack + kickSwing;
    this.thigh.rotation.x = pullBack * 0.35 + kickSwing * 0.2;
    if (this.foot) this.foot.rotation.x = -kickSwing * 0.25;
  }

  _updateKicker(dt) {
    if (!this.kicker) return;

    if (this.kickAnim) {
      this.kickAnim.t += dt;
      const p = Math.min(1, this.kickAnim.t / this.kickAnim.duration);
      const windUp = -0.9;
      const followThrough = 1.2;
      let legAngle;
      if (p < 0.35) {
        legAngle = windUp + (p / 0.35) * 0.2;
      } else {
        const kp = this._easeOutCubic((p - 0.35) / 0.65);
        legAngle = windUp + 0.2 + kp * (followThrough - windUp - 0.2);
      }
      this.shinGroup.rotation.x = legAngle;
      this.thigh.rotation.x = legAngle * 0.25;
      if (this.foot) this.foot.rotation.x = -legAngle * 0.15;

      if (this.kickAnim.t >= this.kickAnim.impactTime && !this.kickAnim.impacted) {
        this.kickAnim.impacted = true;
        this.ballVel = { ...this.kickAnim.velocity };
        this.hasKicked = true;
        this.onKick();
      }

      if (p >= 1) {
        this.kickAnim = null;
        this._setKickerPose(0, 0);
      }
      return;
    }

    if (this.charging) {
      this._setKickerPose(this.chargePower, 0);
    } else if (!this.hasKicked) {
      this._setKickerPose(0, 0);
    }
  }

  _getWorldPointFromScreen(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.physics.groundY);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) {
      point.set(0, this.physics.groundY, -2);
    }
    return point;
  }

  _aimKickerAt(point) {
    if (!this.kicker || !this.ball) return;
    const dir = new THREE.Vector3().subVectors(point, this.ball.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) return;
    dir.normalize();
    this.kicker.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI * 0.08;
    this._positionKickerAtBall();
  }

  _updateCameraPosition() {
    if (!this.camera) return;
    const dist = this.cameraDistance;
    const pitch = this.cameraPitch;
    const y = this.cameraLookAt.y + dist * Math.sin(pitch);
    const z = this.cameraLookAt.z + dist * Math.cos(pitch);
    this.camera.position.set(this.cameraLookAt.x, y, z);
    this.camera.lookAt(this.cameraLookAt);
  }

  zoomIn() {
    this.cameraDistance = Math.max(this.cameraMinDist, this.cameraDistance - 1);
    this._updateCameraPosition();
  }

  zoomOut() {
    this.cameraDistance = Math.min(this.cameraMaxDist, this.cameraDistance + 1);
    this._updateCameraPosition();
  }

  _faceTargetsToCamera() {
    if (!this.camera) return;
    this.targets.forEach((t) => {
      if (t.labelMesh) t.labelMesh.lookAt(this.camera.position);
    });
  }

  _bindEvents() {
    if (!this.renderer) return;
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onPointerDown);
    el.addEventListener('mousemove', this._onPointerMove);
    window.addEventListener('mouseup', this._onPointerUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('touchstart', this._onPointerDown, { passive: false });
    el.addEventListener('touchmove', this._onPointerMove, { passive: false });
    window.addEventListener('touchend', this._onPointerUp);
  }

  _unbindEvents() {
    if (!this.renderer) return;
    const el = this.renderer.domElement;
    el.removeEventListener('mousedown', this._onPointerDown);
    el.removeEventListener('mousemove', this._onPointerMove);
    window.removeEventListener('mouseup', this._onPointerUp);
    el.removeEventListener('touchstart', this._onPointerDown);
    el.removeEventListener('touchmove', this._onPointerMove);
    window.removeEventListener('touchend', this._onPointerUp);
  }

  /** Velocidade do chute a partir da mira e da força */
  _velocityFromAim(power) {
    if (!this.aimPoint || !this.ball) {
      return { x: 0, y: 0.15, z: -0.8 };
    }

    const dir = new THREE.Vector3().subVectors(this.aimPoint, this.ball.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.05) dir.set(0, 0, -1);
    dir.normalize();

    const force = 0.45 + power * 0.95;
    return {
      x: dir.x * force * 0.72,
      y: 0.1 + power * 0.32,
      z: dir.z * force * 1.15
    };
  }

  /** Simula a trajetória da bola com a mesma física do jogo */
  _simulateTrajectory(origin, velocity, maxSteps = 100) {
    const { gravity, friction, groundY, bounce } = this.physics;
    let x = origin.x;
    let y = origin.y;
    let z = origin.z;
    let vx = velocity.x;
    let vy = velocity.y;
    let vz = velocity.z;

    const points = [new THREE.Vector3(x, y, z)];

    for (let i = 0; i < maxSteps; i++) {
      vy -= gravity;
      x += vx;
      y += vy;
      z += vz;

      if (y < groundY) {
        y = groundY;
        if (vy < 0) vy *= bounce;
        vx *= friction;
        vz *= friction;
      }

      points.push(new THREE.Vector3(x, y, z));

      if (z < -8 || Math.abs(x) > 10) break;

      const speed = Math.hypot(vx, vz);
      if (speed < 0.04 && y <= groundY + 0.05) break;
    }

    return points;
  }

  _predictGoalFromPoints(points) {
    for (let i = 1; i < points.length; i++) {
      const pt = points[i];
      for (const t of this.targets) {
        const gx = t.group.position.x;
        const gz = t.group.position.z;
        const halfW = t.goalW / 2 + 0.35;
        const inWidth = Math.abs(pt.x - gx) < halfW;
        const inDepth = pt.z < gz + 0.5 && pt.z > gz - (t.goalDepth || 1) - 1.2;
        const inHeight = pt.y < t.goalH + 0.5 && pt.y > 0.2;
        if (inWidth && inDepth && inHeight) return t;
      }
    }
    return null;
  }

  _updateTrajectoryPreview() {
    if (!this.trajectoryLine || !this.ball || !this.charging || this.hasKicked || this.kickAnim) {
      return;
    }

    const previewPower = Math.max(this.chargePower, 0.2);
    const vel = this._velocityFromAim(previewPower);
    const points = this._simulateTrajectory(
      {
        x: this.ball.position.x,
        y: this.ball.position.y,
        z: this.ball.position.z
      },
      vel
    );

    this.trajectoryLine.geometry.dispose();
    this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.trajectoryLine.computeLineDistances();

    const hitGoal = this._predictGoalFromPoints(points);
    let color = 0xffdf00;
    if (hitGoal) {
      color = hitGoal.option.correct ? 0x4ade80 : 0xf87171;
    }

    this.trajectoryLine.material.color.setHex(color);
    this.trajectoryLine.visible = true;
  }

  _hideAimHelpers() {
    if (this.trajectoryLine) this.trajectoryLine.visible = false;
    this.onPowerChange(0, false);
  }

  _executeKick() {
    if (!this.ball || this.kickAnim || this.hasKicked || this.answered) {
      this.charging = false;
      this._hideAimHelpers();
      return;
    }
    if (this.chargePower < 0.08) {
      this.charging = false;
      this.chargePower = 0;
      this._hideAimHelpers();
      return;
    }

    const velocity = this._velocityFromAim(this.chargePower);
    this.charging = false;
    this._hideAimHelpers();
    this.onPowerChange(0, false);

    this.kickAnim = {
      t: 0,
      duration: 0.42,
      impactTime: 0.22,
      impacted: false,
      velocity
    };
  }

  resize() {
    this._ensureRendererSize();
  }

  _makeGoalLabelTexture(text, letter, state = 'normal') {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const colors = {
      normal: { bg: '#002776', border: '#FFDF00', text: '#fff', letter: '#FFDF00' },
      correct: { bg: 'rgba(21, 128, 61, 0.95)', border: '#4ade80', text: '#fff', letter: '#bbf7d0' },
      wrong: { bg: 'rgba(153, 27, 27, 0.95)', border: '#f87171', text: '#fff', letter: '#fecaca' },
      dim: { bg: 'rgba(51, 65, 85, 0.88)', border: '#64748b', text: '#cbd5e1', letter: '#94a3b8' }
    };
    const c = colors[state] || colors.normal;

    ctx.fillStyle = c.bg;
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 6;
    roundRect(ctx, 8, 8, 624, 384, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = c.letter;
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(letter, 320, 64);

    ctx.fillStyle = c.text;
    ctx.font = 'bold 32px Arial, sans-serif';
    wrapCanvasText(ctx, text, 320, 215, 580, 40);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  _makeNetTexture() {
    if (this._netTexture) return this._netTexture;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    const step = 12;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    this._netTexture = tex;
    return tex;
  }

  _createGoalGroup(option, letter, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const gw = this.goalWidth;
    const gh = this.goalHeight;
    const depth = this.goalDepth;
    const postR = 0.1;
    const postMat = new THREE.MeshLambertMaterial({ color: 0xf4f4f4 });

    const addPost = (px, pz) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, gh, 14), postMat);
      post.position.set(px, gh / 2, pz);
      group.add(post);
    };

    // Traves frontais e traseiras (gol real em profundidade)
    addPost(-gw / 2, 0);
    addPost(gw / 2, 0);
    addPost(-gw / 2, -depth);
    addPost(gw / 2, -depth);

    const barGeo = new THREE.CylinderGeometry(postR * 0.85, postR * 0.85, gw, 12);
    const frontBar = new THREE.Mesh(barGeo, postMat);
    frontBar.rotation.z = Math.PI / 2;
    frontBar.position.set(0, gh, 0);
    group.add(frontBar);

    const backBar = frontBar.clone();
    backBar.position.set(0, gh, -depth);
    group.add(backBar);

    const sideBarGeo = new THREE.CylinderGeometry(postR * 0.75, postR * 0.75, depth, 10);
    const topLeftBar = new THREE.Mesh(sideBarGeo, postMat);
    topLeftBar.rotation.x = Math.PI / 2;
    topLeftBar.position.set(-gw / 2, gh, -depth / 2);
    group.add(topLeftBar);

    const topRightBar = topLeftBar.clone();
    topRightBar.position.set(gw / 2, gh, -depth / 2);
    group.add(topRightBar);

    const groundBar = new THREE.Mesh(
      new THREE.CylinderGeometry(postR * 0.75, postR * 0.75, gw, 12),
      postMat
    );
    groundBar.rotation.z = Math.PI / 2;
    groundBar.position.set(0, postR * 0.8, -depth);
    group.add(groundBar);

    // Rede no fundo e laterais
    const netTex = this._makeNetTexture();
    const netMat = new THREE.MeshBasicMaterial({
      map: netTex,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const backNet = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), netMat);
    backNet.position.set(0, gh / 2, -depth + 0.03);
    group.add(backNet);

    const topNet = new THREE.Mesh(new THREE.PlaneGeometry(gw, depth), netMat);
    topNet.rotation.x = -Math.PI / 2;
    topNet.position.set(0, gh - 0.02, -depth / 2);
    group.add(topNet);

    const leftNet = new THREE.Mesh(new THREE.PlaneGeometry(depth, gh), netMat);
    leftNet.rotation.y = Math.PI / 2;
    leftNet.position.set(-gw / 2 + 0.02, gh / 2, -depth / 2);
    group.add(leftNet);

    const rightNet = leftNet.clone();
    rightNet.position.set(gw / 2 - 0.02, gh / 2, -depth / 2);
    group.add(rightNet);

    // Painel azul ocupa 90% da área interna do gol
    const panelW = gw * 0.9;
    const panelH = gh * 0.9;
    const tex = this._makeGoalLabelTexture(option.text, letter);
    const labelMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(panelW, panelH), labelMat);
    labelMesh.position.set(0, gh / 2, -depth * 0.42);
    group.add(labelMesh);

    this.scene.add(group);

    return { group, labelMesh, option, state: 'normal', letter, goalW: gw, goalH: gh, goalDepth: depth };
  }

  _disposeGoal(target) {
    target.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
    this.scene.remove(target.group);
  }

  _addTestGoalMarker(group) {
    const gw = this.goalWidth;
    const gh = this.goalHeight;
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(gw + 0.35, gh + 0.25),
      new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        wireframe: true,
        transparent: true,
        opacity: 0.95
      })
    );
    frame.position.set(0, gh / 2, 0.14);
    group.add(frame);

    const badge = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 20),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    badge.position.set(0, gh + 0.35, 0.12);
    group.add(badge);
  }

  loadQuestion(shuffledOptions, options = {}) {
    if (!this.ready || !this.scene) return;

    this.testMode = !!options.testMode;

    this.resize();
    this.answered = false;
    this.canKick = true;
    this.hasKicked = false;
    this.dragging = false;
    this.ballFlight = null;
    this.hitPending = null;

    this.targets.forEach((t) => this._disposeGoal(t));
    this.targets = [];

    // 3 gols próximos, em arco
    const positions = [
      { x: -5.4, z: -1 },
      { x: 0, z: -2 },
      { x: 5.4, z: -1 }
    ];
    const letters = ['A', 'B', 'C'];

    shuffledOptions.slice(0, 3).forEach((opt, i) => {
      const goal = this._createGoalGroup(opt, letters[i], positions[i].x, positions[i].z);
      if (this.testMode && opt.correct) this._addTestGoalMarker(goal.group);
      this.targets.push(goal);
    });

    this._resetBall();
  }

  _resetBall() {
    if (!this.ball) return;
    this.ball.position.set(this.ballStart.x, this.ballStart.y, this.ballStart.z);
    this.ballVel = { x: 0, y: 0, z: 0 };
    this.hasKicked = false;
    this.dragging = false;
    this.charging = false;
    this.chargePower = 0;
    this.aimPoint = null;
    this.kickAnim = null;
    this.ballFlight = null;
    this.hitPending = null;
    this._positionKickerAtBall();
    this._setKickerPose(0, 0);
    this._hideAimHelpers();
  }

  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  _startBallFlightToGoal(target) {
    if (this.ballFlight || this.hitPending || this.answered) return;

    this.hitPending = target;
    this.canKick = false;
    this.hasKicked = true;
    this.ballVel = { x: 0, y: 0, z: 0 };
    this._hideAimHelpers();

    const gx = target.group.position.x;
    const gz = target.group.position.z;
    const endY = this.physics.groundY;

    this.ballFlight = {
      from: this.ball.position.clone(),
      to: new THREE.Vector3(gx, endY, gz - (target.goalDepth || 0.5) * 0.35),
      t: 0,
      duration: 0.9,
      arcHeight: 0.55 + Math.min(0.4, this.ball.position.distanceTo(new THREE.Vector3(gx, endY, gz)) * 0.04)
    };
  }

  _updateBallFlight(dt = 1 / 60) {
    if (!this.ballFlight) return false;

    this.ballFlight.t += dt;
    const raw = Math.min(1, this.ballFlight.t / this.ballFlight.duration);
    const p = this._easeOutCubic(raw);
    const { from, to, arcHeight } = this.ballFlight;

    this.ball.position.x = from.x + (to.x - from.x) * p;
    this.ball.position.z = from.z + (to.z - from.z) * p;
    this.ball.position.y = from.y + (to.y - from.y) * p + Math.sin(p * Math.PI) * arcHeight;

    this.ball.rotation.x += 0.18;
    this.ball.rotation.z -= 0.12;

    if (raw >= 1) {
      this.ball.position.copy(to);
      const target = this.hitPending;
      this.ballFlight = null;
      this.hitPending = null;
      if (target) this._registerHit(target);
    }

    return true;
  }

  _onPointerDown(e) {
    if (!this.canKick || this.answered || !this.ball || this.hasKicked || this.kickAnim) return;
    if (e.type === 'mousedown' && e.button !== 0) return;

    e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    this.charging = true;
    this.chargePower = 0;
    this.aimPoint = this._getWorldPointFromScreen(p.clientX, p.clientY);
    this._aimKickerAt(this.aimPoint);
    this.onPowerChange(0, true);
    this._updateTrajectoryPreview();
  }

  _onPointerMove(e) {
    if (!this.charging || this.hasKicked || this.kickAnim) return;
    e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    this.aimPoint = this._getWorldPointFromScreen(p.clientX, p.clientY);
    this._aimKickerAt(this.aimPoint);
    this._updateTrajectoryPreview();
  }

  _onPointerUp(e) {
    if (!this.charging || !this.ball) return;
    if (e && e.type === 'mouseup' && e.button !== 0) return;

    e.preventDefault();
    this._executeKick();
  }

  _updatePhysics(dt = 1 / 60) {
    if (!this.ball) return;

    if (this.charging && !this.kickAnim && !this.hasKicked) {
      this.chargePower = Math.min(1, this.chargePower + dt * 1.35);
      this.onPowerChange(this.chargePower, true);
      this._updateTrajectoryPreview();
    }

    if (this.kickAnim && !this.kickAnim.impacted) return;

    if (this._updateBallFlight(dt)) return;

    const { gravity, friction, groundY, bounce, spin } = this.physics;

    if (this.hasKicked && !this.answered) {
      this.ballVel.y -= gravity;
      this.ball.position.x += this.ballVel.x;
      this.ball.position.y += this.ballVel.y;
      this.ball.position.z += this.ballVel.z;

      if (this.ball.position.y < groundY) {
        this.ball.position.y = groundY;
        if (this.ballVel.y < 0) this.ballVel.y *= bounce;
        this.ballVel.x *= friction;
        this.ballVel.z *= friction;
      }

      this._checkCollisions();

      const speed = Math.hypot(this.ballVel.x, this.ballVel.z);
      if (speed < 0.04 && this.hasKicked && this.ball.position.y <= groundY + 0.05) {
        this.ballVel = { x: 0, y: 0, z: 0 };
        this.hasKicked = false;
        if (!this.answered) {
          setTimeout(() => {
            if (!this.answered) this._resetBall();
          }, 500);
        }
      }

      if (this.ball.position.z < -6 || Math.abs(this.ball.position.x) > 10) {
        this._resetBall();
      }
    }

    this.ball.rotation.x += this.ballVel.z * spin;
    this.ball.rotation.z -= this.ballVel.x * spin;
  }

  _checkCollisions() {
    if (this.ballFlight || this.hitPending) return;

    const bx = this.ball.position.x;
    const by = this.ball.position.y;
    const bz = this.ball.position.z;

    for (const t of this.targets) {
      const gx = t.group.position.x;
      const gz = t.group.position.z;
      const halfW = t.goalW / 2 + 0.35;
      const inWidth = Math.abs(bx - gx) < halfW;
      const inDepth = bz < gz + 0.5 && bz > gz - (t.goalDepth || 1) - 1.2;
      const inHeight = by < t.goalH + 0.5 && by > 0.2;

      if (inWidth && inDepth && inHeight) {
        this._startBallFlightToGoal(t);
        break;
      }
    }
  }

  _registerHit(target) {
    if (this.answered) return;
    this.answered = true;
    this.canKick = false;
    this.dragging = false;
    this.ballVel = { x: 0, y: 0, z: 0 };
    this.ballFlight = null;
    this.hitPending = null;
    this._hideAimHelpers();
    target.state = target.option.correct ? 'correct' : 'wrong';
    this._updateTargetTexture(target);
    this.highlightResults(target.option);
    this.onHit(target.option);
  }

  _updateTargetTexture(target) {
    const tex = this._makeGoalLabelTexture(target.option.text, target.letter, target.state);
    if (target.labelMesh.material.map) target.labelMesh.material.map.dispose();
    target.labelMesh.material.map = tex;
    target.labelMesh.material.needsUpdate = true;
  }

  highlightResults(hitOption) {
    this.targets.forEach((t) => {
      if (t.option.correct) t.state = 'correct';
      else if (hitOption && t.option === hitOption) t.state = 'wrong';
      else t.state = 'dim';
      this._updateTargetTexture(t);
    });
  }

  setAnswered() {
    this.answered = true;
    this.canKick = false;
    this.dragging = false;
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this._unbindEvents();
    this.targets.forEach((t) => this._disposeGoal(t));
    this.targets = [];
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.ready = false;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineCount = 0;
  ctx.textAlign = 'center';
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + ' ';
    if (ctx.measureText(test).width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
      line = words[n] + ' ';
      lineCount++;
      if (lineCount > 3) return;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
}
