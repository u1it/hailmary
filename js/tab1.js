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
    _sunUni: null,
    _bokeh: null,
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

            // 중심 → 핑크-화이트, 바깥 → 입자 색
            vec3 col = mix(vec3(1.0, 0.88, 0.86), vColor, clamp(d * 3.2, 0.0, 1.0));
            gl_FragColor = vec4(col * brightness, brightness);
        }
    `,

    SUN_VERT: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    SUN_FRAG: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vNormal;

        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
        float noise(vec2 p){
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), f.x),
                       mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
        }
        float fbm(vec2 p){
            float v = 0.0;
            float a = 0.55;
            for(int i=0;i<5;i++){
                v += noise(p) * a;
                p = p * 2.03 + vec2(3.1, 5.9);
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec3 n = normalize(vNormal);
            float lon = atan(n.z, n.x);
            float lat = asin(clamp(n.y, -1.0, 1.0));
            vec2 cyc = vec2(cos(lon + uTime * 0.7), sin(lon + uTime * 0.7));
            vec2 p = vec2(cyc.x * 2.2 + lat * 1.8, cyc.y * 2.2 - lat * 1.6);

            float n1 = fbm(p * 2.4 + uTime * 0.8);
            float n2 = fbm(p * 4.8 - uTime * 1.2);
            float f = clamp(n1 * 0.68 + n2 * 0.35, 0.0, 1.0);

            vec3 core = vec3(1.00, 0.70, 0.66);
            vec3 hot  = vec3(0.80, 0.18, 0.20);
            vec3 deep = vec3(0.45, 0.05, 0.07);
            vec3 col = mix(core, hot, smoothstep(0.15, 0.72, f));
            col = mix(col, deep, smoothstep(0.62, 1.0, f));

            float fres = pow(1.0 - abs(dot(normalize(cameraPosition - vWorldPos), n)), 2.1);
            col += vec3(0.95, 0.40, 0.42) * fres * 0.65;

            gl_FragColor = vec4(col, 0.9);
        }
    `,

    init(renderer, W, H) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d0102);
        this.scene.fog = new THREE.FogExp2(0x0d0102, 0.014);
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

            // 고채도 크림슨 팔레트 — G,B를 낮춰 붉은 색 순도를 높임
            const type = Math.random();
            if (type < 0.42) {
                // #cc535a 계열 — 순수 채도 높은 레드
                col[i*3] = 0.88+Math.random()*0.12; col[i*3+1] = 0.14+Math.random()*0.10; col[i*3+2] = 0.12+Math.random()*0.10;
            } else if (type < 0.70) {
                // #811d25 계열 — 딥 크림슨
                col[i*3] = 0.54+Math.random()*0.18; col[i*3+1] = 0.04+Math.random()*0.06; col[i*3+2] = 0.04+Math.random()*0.06;
            } else if (type < 0.88) {
                // #f18e8a 계열 — 화사한 핑크 하이라이트
                col[i*3] = 0.94+Math.random()*0.06; col[i*3+1] = 0.50+Math.random()*0.12; col[i*3+2] = 0.44+Math.random()*0.12;
            } else {
                // #a9343d 계열 — 비비드 레드 포인트
                col[i*3] = 0.72+Math.random()*0.14; col[i*3+1] = 0.10+Math.random()*0.08; col[i*3+2] = 0.10+Math.random()*0.08;
            }
        }

        this._home = home; this._pos = pos; this._vel = vel; this._col = col;
        this._scales = scales;

        this._geo = new THREE.BufferGeometry();
        this._geo.setAttribute('position', new THREE.BufferAttribute(pos,    3));
        this._geo.setAttribute('aColor',   new THREE.BufferAttribute(col,    3));
        this._geo.setAttribute('aScale',   new THREE.BufferAttribute(scales, 1));

        this._mat = new THREE.ShaderMaterial({
            uniforms:       { uSize: { value: 1.8 } },
            vertexShader:   this.VERT,
            fragmentShader: this.FRAG,
            transparent:    true,
            blending:       THREE.AdditiveBlending,
            depthWrite:     false,
            vertexColors:   false   // aColor 어트리뷰트 직접 사용
        });

        this.scene.add(new THREE.Points(this._geo, this._mat));

        // ── 태양 셰이더 + 글로우 레이어 (마우스) ─────
        this._sun = new THREE.Group();
        this._sunUni = { uTime: { value: 0 } };
        this._sun.add(new THREE.Mesh(
            new THREE.SphereGeometry(0.78, 48, 48),
            new THREE.ShaderMaterial({
                uniforms: this._sunUni,
                vertexShader: this.SUN_VERT,
                fragmentShader: this.SUN_FRAG,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        ));
        [
            { r: 1.35, color: 0xf18e8a,  op: 0.22 },
            { r: 2.70, color: 0xcc535a,  op: 0.10 },
            { r: 5.60, color: 0x811d25,  op: 0.045 },
        ].forEach(({ r, color, op }) => {
            this._sun.add(new THREE.Mesh(
                new THREE.SphereGeometry(r, 24, 24),
                new THREE.MeshBasicMaterial({
                    color, transparent: true, opacity: op,
                    blending: THREE.AdditiveBlending, depthWrite: false
                })
            ));
        });
        this._sun.position.set(this._mwx, this._mwy, 0);
        this.scene.add(this._sun);

        // ── 안개 스프라이트 (아스트로파지 군체) ──────────
        // 캔버스 방사형 그라디언트 텍스처 → 진짜 안개/보케 느낌
        const FOG_C = [
            {r:241,g:142,b:138}, // #f18e8a
            {r:204,g:83, b:90},  // #cc535a
            {r:169,g:52, b:61},  // #a9343d
            {r:129,g:29, b:37},  // #811d25
            {r:86, g:18, b:23},  // #561217
        ];
        this._bokeh = [];
        const _mkTex = (fc) => {
            const sz = 256, cv = document.createElement('canvas');
            cv.width = cv.height = sz;
            const ctx = cv.getContext('2d'), c = sz/2;
            const g = ctx.createRadialGradient(c,c,0,c,c,c);
            g.addColorStop(0.00, `rgba(${fc.r},${fc.g},${fc.b},1.0)`);
            g.addColorStop(0.30, `rgba(${fc.r},${fc.g},${fc.b},0.50)`);
            g.addColorStop(0.62, `rgba(${fc.r},${fc.g},${fc.b},0.12)`);
            g.addColorStop(1.00, `rgba(${fc.r},${fc.g},${fc.b},0.00)`);
            ctx.fillStyle = g; ctx.fillRect(0,0,sz,sz);
            return new THREE.CanvasTexture(cv);
        };

        // 레이어 1: 대형 대기 워시 — 화면 가득 채우는 붉은 안개 기저층
        for (let i = 0; i < 4; i++) {
            const fc  = FOG_C[3 + (i % 2)];
            const op  = 0.18 + Math.random() * 0.12;
            const mat = new THREE.SpriteMaterial({ map:_mkTex(fc), transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false });
            const s   = new THREE.Sprite(mat);
            const sc  = hw * (1.5 + Math.random() * 0.9);
            s.scale.set(sc, sc, 1);
            s.position.set((Math.random()-0.5)*hw*0.5, (Math.random()-0.5)*hh*0.5, -3 - Math.random()*3);
            this.scene.add(s);
            this._bokeh.push({ sprite:s, phase:Math.random()*Math.PI*2, baseOp:op, vx:0, vy:0, limX:0, limY:0 });
        }

        // 레이어 2: 중형 안개 덩어리 — 이미지의 핵심 보케
        for (let i = 0; i < 14; i++) {
            const fc  = FOG_C[Math.floor(Math.random()*4)];
            const op  = 0.28 + Math.random() * 0.24;
            const mat = new THREE.SpriteMaterial({ map:_mkTex(fc), transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false });
            const s   = new THREE.Sprite(mat);
            const sc  = 3.0 + Math.random() * 5.5;
            s.scale.setScalar(sc);
            s.position.set((Math.random()-0.5)*hw*2.2, (Math.random()-0.5)*hh*2.2, (Math.random()-0.5)*8 - 1);
            this.scene.add(s);
            this._bokeh.push({
                sprite:s, phase:Math.random()*Math.PI*2, baseOp:op,
                vx:(Math.random()-0.5)*0.006, vy:(Math.random()-0.5)*0.004,
                limX:hw*1.2, limY:hh*1.2
            });
        }

        // 레이어 3: 소형 밝은 핫스팟 — 전경 밝은 클러스터
        for (let i = 0; i < 8; i++) {
            const fc  = FOG_C[Math.floor(Math.random()*2)];
            const op  = 0.45 + Math.random() * 0.25;
            const mat = new THREE.SpriteMaterial({ map:_mkTex(fc), transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false });
            const s   = new THREE.Sprite(mat);
            const sc  = 0.9 + Math.random() * 2.0;
            s.scale.setScalar(sc);
            s.position.set((Math.random()-0.5)*hw*1.8, (Math.random()-0.5)*hh*1.8, Math.random()*3 + 0.5);
            this.scene.add(s);
            this._bokeh.push({
                sprite:s, phase:Math.random()*Math.PI*2, baseOp:op,
                vx:(Math.random()-0.5)*0.009, vy:(Math.random()-0.5)*0.007,
                limX:hw*1.0, limY:hh*1.0
            });
        }
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
                // 태양 열기 → 핑크-화이트로
                col[i3]   = lerp(col[i3],   1.00, power * 0.50);
                col[i3+1] = lerp(col[i3+1], 0.55 * power, 0.20);
                col[i3+2] = lerp(col[i3+2], 0.50 * power, 0.20);
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
            if (this._sunUni) this._sunUni.uTime.value = elapsed;
        }

        // 안개 드리프트 + 호흡 펄스
        if (this._bokeh) {
            this._bokeh.forEach(b => {
                if (b.limX > 0) {
                    b.sprite.position.x += b.vx;
                    b.sprite.position.y += b.vy;
                    if (Math.abs(b.sprite.position.x) > b.limX) b.vx *= -1;
                    if (Math.abs(b.sprite.position.y) > b.limY) b.vy *= -1;
                }
                b.sprite.material.opacity = b.baseOp + Math.sin(elapsed * 0.22 + b.phase) * 0.05;
            });
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
        if (this._bokeh) {
            this._bokeh.forEach(b => {
                if (b.sprite.material.map) b.sprite.material.map.dispose();
                b.sprite.material.dispose();
            });
            this._bokeh = null;
        }
        this._geo = this._mat = this._home = this._pos = this._vel = this._col = null;
        this._scales = this._sun = this._sunUni = null;
        this.scene = this.camera = null;
    }
};
