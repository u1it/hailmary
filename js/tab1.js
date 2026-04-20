// Tab 01 — ASTROPHAGE : 별빛 셰이더 파티클 + 마우스 태양 글로우
const Tab1 = {
    scene:  null,
    camera: null,
    _geo:   null,
    _mat:   null,
    _home:  null,
    _pos:   null,
    _vel:   null,
    _col:   null,
    _sun:   null,
    _mwx:   0,
    _mwy:   0,

    COUNT: 6000,

    // ── 별빛 버텍스 셰이더 ────────────────────────
    VERT: `
        uniform  float uSize;
        attribute vec3  aColor;
        attribute float aScale;
        varying   vec3  vColor;

        void main() {
            vColor = aColor;
            vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
            float pSize  = uSize * aScale * (280.0 / -mvPos.z);
            gl_PointSize = clamp(pSize, 1.0, 64.0);
            gl_Position  = projectionMatrix * mvPos;
        }
    `,

    // ── 별빛 프래그먼트 셰이더 ───────────────────
    FRAG: `
        varying vec3 vColor;

        void main() {
            vec2  uv = gl_PointCoord - vec2(0.5);
            float d  = length(uv);
            if (d > 0.5) discard;

            // 부드러운 코어 글로우
            float glow = exp(-d * 7.5);

            // 4방향 회절 스파이크 (수평·수직)
            float hSpike = exp(-abs(uv.y) * 40.0) * exp(-abs(uv.x) * 2.2);
            float vSpike = exp(-abs(uv.x) * 40.0) * exp(-abs(uv.y) * 2.2);

            // 45° 대각 스파이크
            float d1 = exp(-abs(uv.x - uv.y) * 40.0) * exp(-length(uv) * 4.5);
            float d2 = exp(-abs(uv.x + uv.y) * 40.0) * exp(-length(uv) * 4.5);

            float spikes     = (hSpike + vSpike) * 0.58 + (d1 + d2) * 0.30;
            float brightness = glow + spikes * max(0.0, 0.95 - d * 1.5);
            brightness       = clamp(brightness, 0.0, 1.0);

            if (brightness < 0.007) discard;

            // 중심 → 흰색, 바깥 → 입자 색
            vec3 col = mix(vec3(1.0, 0.96, 0.90), vColor, clamp(d * 3.2, 0.0, 1.0));
            gl_FragColor = vec4(col * brightness, brightness);
        }
    `,

    init(renderer, W, H) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020104);
        this.camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 200);
        this.camera.position.set(0, 0, 18);

        // 화면 world 크기
        const vFov = 65 * Math.PI / 180;
        const hh   = Math.tan(vFov / 2) * 18;
        const hw   = hh * (W / H);
        this._hw = hw; this._hh = hh;

        const N      = this.COUNT;
        const home   = new Float32Array(N * 3);
        const pos    = new Float32Array(N * 3);
        const vel    = new Float32Array(N * 3);
        const col    = new Float32Array(N * 3);
        const scales = new Float32Array(N);

        for (let i = 0; i < N; i++) {
            const x = (Math.random() - 0.5) * hw * 2.2;
            const y = (Math.random() - 0.5) * hh * 2.2;
            const z = (Math.random() - 0.5) * 3;

            home[i*3]   = pos[i*3]   = x;
            home[i*3+1] = pos[i*3+1] = y;
            home[i*3+2] = pos[i*3+2] = z;

            // 크기: 대부분 작고, 일부 크게 (밝은 별처럼)
            const r = Math.random();
            if      (r < 0.70) scales[i] = 0.25 + Math.random() * 0.45;  // 작은 배경
            else if (r < 0.90) scales[i] = 0.70 + Math.random() * 0.80;  // 중간
            else               scales[i] = 1.60 + Math.random() * 1.80;  // 큰 별

            // 핑크 + 빨강 팔레트
            const type = Math.random();
            if (type < 0.44) {
                col[i*3] = 0.95 + Math.random()*0.05; col[i*3+1] = 0.07+Math.random()*0.18; col[i*3+2] = 0.40+Math.random()*0.35;
            } else if (type < 0.76) {
                col[i*3] = 0.88 + Math.random()*0.12; col[i*3+1] = 0.02+Math.random()*0.08; col[i*3+2] = 0.04+Math.random()*0.08;
            } else {
                col[i*3] = 0.98; col[i*3+1] = 0.22+Math.random()*0.22; col[i*3+2] = 0.02+Math.random()*0.06;
            }
        }

        this._home = home; this._pos = pos; this._vel = vel; this._col = col;
        this._scales = scales;

        this._geo = new THREE.BufferGeometry();
        this._geo.setAttribute('position', new THREE.BufferAttribute(pos,    3));
        this._geo.setAttribute('aColor',   new THREE.BufferAttribute(col,    3));
        this._geo.setAttribute('aScale',   new THREE.BufferAttribute(scales, 1));

        this._mat = new THREE.ShaderMaterial({
            uniforms:       { uSize: { value: 1.4 } },
            vertexShader:   this.VERT,
            fragmentShader: this.FRAG,
            transparent:    true,
            blending:       THREE.AdditiveBlending,
            depthWrite:     false,
            vertexColors:   false   // aColor 어트리뷰트 직접 사용
        });

        this.scene.add(new THREE.Points(this._geo, this._mat));

        // ── 태양 글로우 (마우스) ──────────────────
        this._sun = new THREE.Group();
        [
            { r: 0.18, color: 0xffffff,  op: 0.96 },
            { r: 0.55, color: 0xffee88,  op: 0.32 },
            { r: 1.20, color: 0xff9922,  op: 0.13 },
            { r: 2.60, color: 0xff4400,  op: 0.048 },
            { r: 5.20, color: 0xff2200,  op: 0.016 },
        ].forEach(({ r, color, op }) => {
            const m = new THREE.Mesh(
                new THREE.SphereGeometry(r, 16, 16),
                new THREE.MeshBasicMaterial({
                    color, transparent: true, opacity: op,
                    blending: THREE.AdditiveBlending, depthWrite: false
                })
            );
            this._sun.add(m);
        });
        this._sun.position.set(9999, 9999, 0);
        this.scene.add(this._sun);
    },

    onMouseMove(nx, ny) {
        const vFov = 65 * Math.PI / 180;
        const hh   = Math.tan(vFov / 2) * 18;
        const hw   = hh * (this.camera ? this.camera.aspect : 1.77);
        this._mwx  = nx * hw;
        this._mwy  = ny * hh;
        if (this._sun) this._sun.position.set(this._mwx, this._mwy, 0);
    },

    tick(elapsed, delta) {
        if (!this._geo) return;
        const dt   = delta || 0.016;
        const pos  = this._pos, vel = this._vel;
        const home = this._home, col = this._col;
        const N    = this.COUNT;
        const mwx  = this._mwx, mwy = this._mwy;
        const REPEL_R  = 3.2;
        const SPRING_K = 0.045;
        const DAMP     = 0.87;

        for (let i = 0; i < N; i++) {
            const i3 = i * 3;
            const px = pos[i3], py = pos[i3+1];

            let ax = (home[i3]   - px) * SPRING_K;
            let ay = (home[i3+1] - py) * SPRING_K;

            const dx   = px - mwx, dy = py - mwy;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < REPEL_R && dist > 0.001) {
                const power = 1 - dist / REPEL_R;
                ax += (dx / dist) * power * 10;
                ay += (dy / dist) * power * 10;
                // 태양 열기 → 흰색+주황으로
                col[i3]   = lerp(col[i3],   1.0, power * 0.45);
                col[i3+1] = lerp(col[i3+1], 0.75 * power, 0.15);
                col[i3+2] = lerp(col[i3+2], 0.08, 0.1);
            }

            vel[i3]   = (vel[i3]   + ax) * DAMP;
            vel[i3+1] = (vel[i3+1] + ay) * DAMP;
            vel[i3+2] =  vel[i3+2]       * DAMP;

            pos[i3]   += vel[i3]   * dt * 60;
            pos[i3+1] += vel[i3+1] * dt * 60;
            pos[i3+2] += vel[i3+2] * dt * 60;
        }

        this._geo.attributes.position.needsUpdate = true;
        this._geo.attributes.aColor.needsUpdate   = true;

        // 태양 맥동
        if (this._sun) {
            const pulse = 1 + Math.sin(elapsed * 3.5) * 0.06;
            this._sun.scale.setScalar(pulse);
        }
    },

    resize(W, H) {
        if (!this.camera) return;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        const vFov = 65 * Math.PI / 180;
        const hh   = Math.tan(vFov / 2) * 18;
        const hw   = hh * (W / H);
        for (let i = 0; i < this.COUNT; i++) {
            this._home[i*3]   = (Math.random()-0.5) * hw * 2.2;
            this._home[i*3+1] = (Math.random()-0.5) * hh * 2.2;
        }
    },

    dispose() {
        if (this._geo) this._geo.dispose();
        if (this._mat) this._mat.dispose();
        if (this._sun) {
            this._sun.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
        }
        this._geo = this._mat = this._home = this._pos = this._vel = this._col = null;
        this._scales = this._sun = null;
        this.scene = this.camera = null;
    }
};
