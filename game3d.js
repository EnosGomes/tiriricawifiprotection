/* ============================================
   Modo Chute 3D — Three.js
   ============================================ */

class SoccerGame3D {
  constructor(container, options = {}) {
    this.container = container;
    this.onHit = options.onHit || (() => {});

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
    this.ballStart = { x: 0, y: 0.65, z: 3.5 };
    this.animationId = null;
    this.ready = false;

    // Câmera: distância ao ponto de foco (alvos)
    this.cameraLookAt = new THREE.Vector3(0, 2, -2.5);
    this.cameraDistance = 7.5;
    this.cameraMinDist = 4.5;
    this.cameraMaxDist = 14;
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
    this.scene.fog = new THREE.Fog(0x6eb5ff, 18, 40);

    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 80);
    this._updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(8, 20, 12);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-8, 10, 5);
    this.scene.add(fill);

    // Gramado (campo compacto — alvos perto da bola)
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 18),
      new THREE.MeshLambertMaterial({ color: 0x1a8a42 })
    );
    field.rotation.x = -Math.PI / 2;
    this.scene.add(field);

    // Listras
    for (let i = -1; i <= 1; i++) {
      if (i === 0) continue;
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 2.5),
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
    penaltySpot.position.set(0, 0.04, 3.5);
    this.scene.add(penaltySpot);

    // Traves (atrás dos alvos)
    const postMat = new THREE.MeshLambertMaterial({ color: 0xffdf00 });
    [-3.5, 3.5].forEach((x) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 10), postMat);
      post.position.set(x, 1.1, -5.5);
      this.scene.add(post);
    });
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.18, 0.18), postMat);
    crossbar.position.set(0, 2.2, -5.5);
    this.scene.add(crossbar);

    // Bola (maior para ver melhor)
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 24, 24),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    this.scene.add(this.ball);

    // Padrão na bola
    const ballLines = new THREE.Mesh(
      new THREE.SphereGeometry(0.56, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x222222, wireframe: true, transparent: true, opacity: 0.35 })
    );
    this.ball.add(ballLines);

    // Linha de puxão (estilingue)
    this.pullLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    this.pullLine.visible = false;
    this.scene.add(this.pullLine);

    // Trajetória prevista (pontos calculados pela física)
    this.trajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: 0xffdf00,
        dashSize: 0.4,
        gapSize: 0.25,
        transparent: true,
        opacity: 0.95
      })
    );
    this.trajectoryLine.visible = false;
    this.scene.add(this.trajectoryLine);

    // Constantes de física (usadas no jogo e na previsão)
    this.physics = {
      gravity: 0.015,
      friction: 0.96,
      groundY: 0.65,
      bounce: -0.35
    };

    this.resize();
    this._resetBall();
  }

  _startRenderLoop() {
    if (this.animationId) return;
    const loop = () => {
      this._updatePhysics();
      this._faceTargetsToCamera();
      if (this.renderer && this.scene && this.camera && this.width > 0) {
        this.renderer.render(this.scene, this.camera);
      }
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
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
    this.targets.forEach((t) => t.mesh.lookAt(this.camera.position));
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

  /** Calcula velocidade inicial a partir do arraste (estilingue) */
  _velocityFromDrag(dx, dy, dist) {
    const power = Math.min(dist, 130) / 130;
    const force = 0.4 + power * 0.7;
    return {
      x: (-dx / dist) * force * 0.7,
      y: 0.08 + power * 0.2,
      z: (-dy / dist) * force * 1.4
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

  _hideAimHelpers() {
    if (this.pullLine) this.pullLine.visible = false;
    if (this.trajectoryLine) this.trajectoryLine.visible = false;
  }

  resize() {
    if (!this.container || !this.renderer) return;

    const w = this.container.clientWidth || this.container.offsetWidth || 800;
    const h = this.container.clientHeight || this.container.offsetHeight || 480;

    if (w < 50) return;

    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _makeLabelTexture(text, letter, state = 'normal') {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    const colors = {
      normal: { bg: '#002776', border: '#FFDF00', text: '#fff' },
      correct: { bg: '#15803d', border: '#4ade80', text: '#fff' },
      wrong: { bg: '#991b1b', border: '#f87171', text: '#fff' },
      dim: { bg: '#334155', border: '#64748b', text: '#cbd5e1' }
    };
    const c = colors[state] || colors.normal;

    ctx.fillStyle = c.bg;
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 10;
    roundRect(ctx, 20, 20, 728, 344, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFDF00';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(letter, 44, 72);

    ctx.fillStyle = c.text;
    ctx.font = 'bold 34px Arial, sans-serif';
    wrapCanvasText(ctx, text, 384, 175, 640, 42);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  loadQuestion(shuffledOptions) {
    if (!this.ready || !this.scene) return;

    this.resize();
    this.answered = false;
    this.canKick = true;
    this.hasKicked = false;
    this.dragging = false;

    this.targets.forEach((t) => {
      this.scene.remove(t.mesh);
      t.mesh.material.map?.dispose();
      t.mesh.material.dispose();
      t.mesh.geometry.dispose();
    });
    this.targets = [];

    // 3 alvos em arco, bem perto da bola (z=3.5)
    const positions = [
      { x: -4.5, z: -2 },
      { x: 0, z: -3.2 },
      { x: 4.5, z: -2 }
    ];
    const letters = ['A', 'B', 'C'];

    shuffledOptions.slice(0, 3).forEach((opt, i) => {
      const tex = this._makeLabelTexture(opt.text, letters[i]);
      const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), mat);
      mesh.position.set(positions[i].x, 2, positions[i].z);
      this.scene.add(mesh);
      this.targets.push({ mesh, option: opt, state: 'normal', letter: letters[i] });
    });

    this._resetBall();
  }

  _resetBall() {
    if (!this.ball) return;
    this.ball.position.set(this.ballStart.x, this.ballStart.y, this.ballStart.z);
    this.ballVel = { x: 0, y: 0, z: 0 };
    this.hasKicked = false;
    this.dragging = false;
    this._hideAimHelpers();
  }

  _onPointerDown(e) {
    if (!this.canKick || this.answered || !this.ball || this.hasKicked) return;
    // Apenas botão esquerdo do mouse
    if (e.type === 'mousedown' && e.button !== 0) return;

    e.preventDefault();
    this.dragging = true;
    const p = e.touches ? e.touches[0] : e;
    this.dragStart = { x: p.clientX, y: p.clientY };
    this.dragCurrent = { x: p.clientX, y: p.clientY };
    this.pullLine.visible = true;
    this.trajectoryLine.visible = true;
    this._updateTrajectoryPreview();
  }

  _onPointerMove(e) {
    if (!this.dragging) return;
    e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    this.dragCurrent = { x: p.clientX, y: p.clientY };
    this._updateTrajectoryPreview();
  }

  _onPointerUp(e) {
    if (!this.dragging || !this.ball) return;
    // Só solta com botão esquerdo (mouse) ou toque
    if (e && e.type === 'mouseup' && e.button !== 0) return;

    const dx = this.dragCurrent.x - this.dragStart.x;
    const dy = this.dragCurrent.y - this.dragStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.dragging = false;
    this._hideAimHelpers();

    if (dist < 8) return;

    this.ballVel = this._velocityFromDrag(dx, dy, dist);
    this.hasKicked = true;
  }

  _updateTrajectoryPreview() {
    const dx = this.dragCurrent.x - this.dragStart.x;
    const dy = this.dragCurrent.y - this.dragStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const bx = this.ball.position.x;
    const by = this.ball.position.y;
    const bz = this.ball.position.z;

    // Linha de puxão (estilingue) — oposta à direção do chute
    if (dist > 4) {
      const vel = dist >= 8
        ? this._velocityFromDrag(dx, dy, dist)
        : { x: 0, y: 0, z: 0 };
      const pullScale = 3;
      this.pullLine.geometry.setFromPoints([
        new THREE.Vector3(bx, by, bz),
        new THREE.Vector3(bx - vel.x * pullScale, by, bz - vel.z * pullScale)
      ]);
    }

    // Trajetória calculada pela física
    if (dist >= 8) {
      const vel = this._velocityFromDrag(dx, dy, dist);
      const points = this._simulateTrajectory(
        { x: bx, y: by, z: bz },
        vel
      );
      this.trajectoryLine.geometry.dispose();
      this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.trajectoryLine.computeLineDistances();
    } else {
      this.trajectoryLine.geometry.setFromPoints([
        new THREE.Vector3(bx, by, bz),
        new THREE.Vector3(bx, by, bz)
      ]);
    }
  }

  _updatePhysics() {
    if (!this.ball) return;

    const { gravity, friction, groundY, bounce } = this.physics;

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

      if (this.ball.position.z < -8 || Math.abs(this.ball.position.x) > 10) {
        this._resetBall();
      }
    }

    this.ball.rotation.x += this.ballVel.z * 0.12;
    this.ball.rotation.z -= this.ballVel.x * 0.12;
  }

  _checkCollisions() {
    const bx = this.ball.position.x;
    const by = this.ball.position.y;
    const bz = this.ball.position.z;

    for (const t of this.targets) {
      const { x, z } = t.mesh.position;
      if (
        Math.abs(bx - x) < 3.2 &&
        Math.abs(bz - z) < 2.4 &&
        by < 3.6
      ) {
        this._registerHit(t);
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
    this._hideAimHelpers();
    target.state = target.option.correct ? 'correct' : 'wrong';
    this._updateTargetTexture(target);
    this.highlightResults(target.option);
    this.onHit(target.option);
  }

  _updateTargetTexture(target) {
    const tex = this._makeLabelTexture(target.option.text, target.letter, target.state);
    if (target.mesh.material.map) target.mesh.material.map.dispose();
    target.mesh.material.map = tex;
    target.mesh.material.needsUpdate = true;
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
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.targets = [];
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
