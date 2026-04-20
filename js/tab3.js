// Tab 03 — TRANSIT : 별빛 셰이더 + 항성간 여행
const Tab3 = {
    scene:    null,
    camera:   null,
    _objects: [],
    _starGeo: null,
    _starMat: null,
    _asteroidGeo: null,
    _featuredGeo: null,
    _featuredMat: null,
    _planetUnis:  null,
    _scroll:  0,
    _scrollT: 0,
    _onWheel:      null,
    _onTouchStart: null,
    _onTouchMove:  null,
    _touchY:  0,
    _label:   null,

    // ── 큰 별 (Sol / Tau Ceti) 포인트 스프라이트 셰이더 ─
    FEAT_VERT: `
        uniform  float uSize;
        attribute float aScale;
        attribute vec3  aColor;
        varying   vec3  vColor;

        void main() {
            vColor = aColor;
            vec4 mvPos  = modelViewMatrix * vec4(position, 1.0);
            float dist  = max(-mvPos.z, 0.5);
            float pSize = uSize * aScale * 200.0 / dist;
            gl_PointSize = clamp(pSize, 12.0, 300.0);
            gl_Position  = projectionMatrix * mvPos;
        }
    `,

    // ── Tab1과 동일한 별빛 셰이더 ────────────────
    VERT: `
        uniform  float uSize;
        attribute float aScale;
        attribute vec3  aColor;
        varying   vec3  vColor;

        void main() {
            vColor = aColor;
            vec4 mvPos  = modelViewMatrix * vec4(position, 1.0);
            // 먼 별은 일정한 크기로 (무한 거리 별처럼)
            float dist  = max(-mvPos.z, 20.0);
            float pSize = uSize * aScale * 120.0 / dist;
            gl_PointSize = clamp(pSize, 0.8, 40.0);
            gl_Position  = projectionMatrix * mvPos;
        }
    `,

    FRAG: `
        varying vec3 vColor;

        void main() {
            vec2  uv = gl_PointCoord - vec2(0.5);
            float d  = length(uv);
            if (d > 0.5) discard;

            float glow   = exp(-d * 7.5);
            float hSpike = exp(-abs(uv.y) * 42.0) * exp(-abs(uv.x) * 2.5);
            float vSpike = exp(-abs(uv.x) * 42.0) * exp(-abs(uv.y) * 2.5);
            float d1     = exp(-abs(uv.x - uv.y) * 42.0) * exp(-length(uv) * 4.5);
            float d2     = exp(-abs(uv.x + uv.y) * 42.0) * exp(-length(uv) * 4.5);

            float spikes     = (hSpike + vSpike) * 0.55 + (d1 + d2) * 0.28;
            float brightness = glow + spikes * max(0.0, 0.92 - d * 1.4);
            brightness       = clamp(brightness, 0.0, 1.0);
            if (brightness < 0.007) discard;

            // 중심 흰색, 테두리 별 색
            vec3 col = mix(vec3(1.0, 0.97, 0.92), vColor, clamp(d * 3.0, 0.0, 1.0));
            gl_FragColor = vec4(col * brightness, brightness);
        }
    `,

    // ── 행성 표면 셰이더 ─────────────────────────
    PLANET_VERT: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
            vUv       = uv;
            vNormal   = normalize(normalMatrix * normal);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    EARTH_FRAG: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;

        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545); }
        float noise(vec2 p){
            vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0, a=0.52;
            mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
            for(int i=0;i<5;i++){ v+=a*noise(p); p=rot*p*2.05+vec2(1.7,9.2); a*=0.48; }
            return v;
        }
        vec3 earthPal(float t){
            vec3 c0=vec3(0.003,0.012,0.055);
            vec3 c1=vec3(0.010,0.075,0.220);
            vec3 c2=vec3(0.020,0.200,0.460);
            vec3 c3=vec3(0.040,0.380,0.280);
            vec3 c4=vec3(0.080,0.460,0.110);
            vec3 c5=vec3(0.320,0.600,0.080);
            vec3 c6=vec3(0.760,0.790,0.760);
            vec3 c7=vec3(0.950,0.960,0.970);
            if(t<0.14) return mix(c0,c1,t/0.14);
            if(t<0.30) return mix(c1,c2,(t-0.14)/0.16);
            if(t<0.46) return mix(c2,c3,(t-0.30)/0.16);
            if(t<0.58) return mix(c3,c4,(t-0.46)/0.12);
            if(t<0.70) return mix(c4,c5,(t-0.58)/0.12);
            if(t<0.85) return mix(c5,c6,(t-0.70)/0.15);
            return      mix(c6,c7,(t-0.85)/0.15);
        }
        void main(){
            vec2 rotUV = vec2(fract(vUv.x + uTime * 0.004), vUv.y);
            vec2 p = (rotUV - 0.5) * 3.5;
            float t = uTime * 0.04;
            vec2 q = vec2(fbm(p+vec2(t,t*0.7)), fbm(p+vec2(3.2+t*0.9,1.7)));
            vec2 r = vec2(fbm(p+4.0*q+vec2(1.7+t*0.2,9.2+t*0.15)),
                          fbm(p+4.0*q+vec2(8.3+t*0.1,2.8+t*0.2)));
            float f = clamp(fbm(p + 3.8*r), 0.0, 1.0);
            vec3 col = earthPal(f);
            float rim = clamp(dot(normalize(cameraPosition - vWorldPos), vNormal), 0.0, 1.0);
            col *= 0.25 + rim * 0.88;
            gl_FragColor = vec4(col, 1.0);
        }
    `,

    ERIDIAN_FRAG: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;

        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545); }
        float noise(vec2 p){
            vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0, a=0.52;
            mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
            for(int i=0;i<6;i++){ v+=a*noise(p); p=rot*p*2.05+vec2(1.7,9.2); a*=0.48; }
            return v;
        }
        vec3 eridianPal(float t){
            vec3 c0=vec3(0.003,0.022,0.008);
            vec3 c1=vec3(0.010,0.120,0.038);
            vec3 c2=vec3(0.028,0.380,0.095);
            vec3 c3=vec3(0.100,0.680,0.075);
            vec3 c4=vec3(0.500,0.840,0.038);
            vec3 c5=vec3(0.920,0.560,0.018);
            vec3 c6=vec3(1.000,0.310,0.008);
            vec3 c7=vec3(1.000,0.680,0.160);
            if(t<0.14) return mix(c0,c1,t/0.14);
            if(t<0.30) return mix(c1,c2,(t-0.14)/0.16);
            if(t<0.48) return mix(c2,c3,(t-0.30)/0.18);
            if(t<0.62) return mix(c3,c4,(t-0.48)/0.14);
            if(t<0.76) return mix(c4,c5,(t-0.62)/0.14);
            if(t<0.89) return mix(c5,c6,(t-0.76)/0.13);
            return      mix(c6,c7,(t-0.89)/0.11);
        }
        void main(){
            vec2 rotUV = vec2(fract(vUv.x + uTime * 0.005), vUv.y);
            vec2 p = (rotUV - 0.5) * 3.5;
            float t = uTime * 0.065;
            vec2 q = vec2(fbm(p+vec2(t,t*0.68)), fbm(p+vec2(3.18+t*0.88,1.74)));
            vec2 r = vec2(fbm(p+4.1*q+vec2(1.72+t*0.22,9.24+t*0.15)),
                          fbm(p+4.1*q+vec2(8.30+t*0.12,2.84+t*0.21)));
            float f = clamp(fbm(p + 3.8*r), 0.0, 1.0);
            vec3 col = eridianPal(f);
            float lum = dot(col, vec3(0.299,0.587,0.114));
            col = mix(col, vec3(lum*0.3+0.003), (1.0-f)*0.25);
            col = mix(col, col*1.22, smoothstep(0.60,1.0,f)*0.52);
            float rim = clamp(dot(normalize(cameraPosition - vWorldPos), vNormal), 0.0, 1.0);
            col *= 0.30 + rim * 0.82;
            gl_FragColor = vec4(col, 1.0);
        }
    `,

    BODIES: [
        { type:'star',   name:'Sol',      r:2.2,  color:0xffdd55, glow:0xff8800, pos:[ 0,    0,    0  ] },
        { type:'planet', name:'Earth',    r:0.38, color:0x2a70bb, glow:0x55aaee, pos:[ 4.0, -0.4, -9  ] },
        { type:'star',   name:'TauCeti',  r:1.75, color:0xff9944, glow:0xff5500, pos:[-4.2,  1.8, -52 ] },
        { type:'planet', name:'Eridian',  r:0.58, color:0x0b3020, glow:0x22ee66, pos:[-2.0,  0.5, -61 ] },
    ],

    LABELS: [
        { t:0.00, text:'Sol System' },
        { t:0.13, text:'Leaving the Inner System' },
        { t:0.28, text:'Interstellar Space' },
        { t:0.44, text:'Asteroid Field' },
        { t:0.60, text:'Approaching Tau Ceti' },
        { t:0.75, text:'Tau Ceti System' },
        { t:0.90, text:'Eridian' },
    ],

    _makeGlow(r, color, opacity) {
        return new THREE.Mesh(
            new THREE.SphereGeometry(r, 24, 24),
            new THREE.MeshBasicMaterial({
                color, transparent: true, opacity,
                blending: THREE.AdditiveBlending, depthWrite: false
            })
        );
    },

    init(renderer, W, H) {
        this.scene  = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000306);
        this.scene.fog = new THREE.FogExp2(0x000306, 0.006);

        this.camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 400);
        this.camera.position.set(0, 0, 14);

        // ── 별빛 셰이더 파티클 ────────────────────
        const starCount = 4000;
        const sp  = new Float32Array(starCount * 3);
        const sc  = new Float32Array(starCount * 3);
        const sSc = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            sp[i*3]   = (Math.random() - 0.5) * 400;
            sp[i*3+1] = (Math.random() - 0.5) * 280;
            sp[i*3+2] = Math.random() * -160 - 5;

            // 크기: 대부분 작고, 일부 중간, 소수 크게
            const rv = Math.random();
            if      (rv < 0.72) sSc[i] = 0.2 + Math.random() * 0.5;
            else if (rv < 0.93) sSc[i] = 0.6 + Math.random() * 1.0;
            else                sSc[i] = 1.6 + Math.random() * 2.2;

            // 색상: 흰색/파란별/노란별/주황별
            const ct = Math.random();
            if (ct < 0.55) {
                // 흰색~파란 백색왜성
                const b = 0.75 + Math.random() * 0.25;
                sc[i*3] = b * 0.88; sc[i*3+1] = b * 0.93; sc[i*3+2] = b;
            } else if (ct < 0.78) {
                // 따뜻한 노란 별
                sc[i*3] = 0.95 + Math.random()*0.05; sc[i*3+1] = 0.82+Math.random()*0.12; sc[i*3+2] = 0.35+Math.random()*0.2;
            } else if (ct < 0.92) {
                // 주황/K형
                sc[i*3] = 1.0; sc[i*3+1] = 0.55+Math.random()*0.2; sc[i*3+2] = 0.1+Math.random()*0.15;
            } else {
                // 청색 O/B형
                sc[i*3] = 0.6+Math.random()*0.3; sc[i*3+1] = 0.7+Math.random()*0.2; sc[i*3+2] = 1.0;
            }
        }

        const sGeo = new THREE.BufferGeometry();
        sGeo.setAttribute('position', new THREE.BufferAttribute(sp,  3));
        sGeo.setAttribute('aColor',   new THREE.BufferAttribute(sc,  3));
        sGeo.setAttribute('aScale',   new THREE.BufferAttribute(sSc, 1));

        this._starGeo = sGeo;
        this._starMat = new THREE.ShaderMaterial({
            uniforms:       { uSize: { value: 1.3 } },
            vertexShader:   this.VERT,
            fragmentShader: this.FRAG,
            transparent:    true,
            blending:       THREE.AdditiveBlending,
            depthWrite:     false
        });
        this.scene.add(new THREE.Points(sGeo, this._starMat));

        // ── 소행성대 ─────────────────────────────
        const acnt = 700;
        const ap   = new Float32Array(acnt * 3);
        const ac   = new Float32Array(acnt * 3);
        const as_  = new Float32Array(acnt);
        for (let i = 0; i < acnt; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 4 + Math.random() * 9;
            ap[i*3]   = Math.cos(a) * r;
            ap[i*3+1] = (Math.random() - 0.5) * 3;
            ap[i*3+2] = -18 + Math.sin(a) * r * 0.5 + (Math.random()-0.5)*10;
            as_[i] = 0.3 + Math.random() * 0.6;
            const g = 0.4 + Math.random() * 0.3;
            ac[i*3] = g*1.1; ac[i*3+1] = g; ac[i*3+2] = g*0.7;
        }
        const aGeo = new THREE.BufferGeometry();
        aGeo.setAttribute('position', new THREE.BufferAttribute(ap,  3));
        aGeo.setAttribute('aColor',   new THREE.BufferAttribute(ac,  3));
        aGeo.setAttribute('aScale',   new THREE.BufferAttribute(as_, 1));
        this._asteroidGeo = aGeo;
        this.scene.add(new THREE.Points(aGeo, new THREE.ShaderMaterial({
            uniforms:       { uSize: { value: 0.9 } },
            vertexShader:   this.VERT,
            fragmentShader: this.FRAG,
            transparent:    true,
            blending:       THREE.AdditiveBlending,
            depthWrite:     false
        })));

        // ── 항성 포인트 스프라이트 (Sol, Tau Ceti) ──
        const stars = this.BODIES.filter(b => b.type === 'star');
        const fp    = new Float32Array(stars.length * 3);
        const fc    = new Float32Array(stars.length * 3);
        const fs    = new Float32Array(stars.length);
        stars.forEach((b, i) => {
            fp[i*3] = b.pos[0]; fp[i*3+1] = b.pos[1]; fp[i*3+2] = b.pos[2];
            const hex = b.color;
            fc[i*3]   = ((hex >> 16) & 0xff) / 255;
            fc[i*3+1] = ((hex >>  8) & 0xff) / 255;
            fc[i*3+2] = ( hex        & 0xff) / 255;
            fs[i] = b.r * 5.5;   // Sol≈12.1, TauCeti≈9.6
        });
        this._featuredGeo = new THREE.BufferGeometry();
        this._featuredGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
        this._featuredGeo.setAttribute('aColor',   new THREE.BufferAttribute(fc, 3));
        this._featuredGeo.setAttribute('aScale',   new THREE.BufferAttribute(fs, 1));
        this._featuredMat = new THREE.ShaderMaterial({
            uniforms:       { uSize: { value: 1.8 } },
            vertexShader:   this.FEAT_VERT,
            fragmentShader: this.FRAG,
            transparent:    true,
            blending:       THREE.AdditiveBlending,
            depthWrite:     false
        });
        this.scene.add(new THREE.Points(this._featuredGeo, this._featuredMat));

        // ── 행성 구체 (Earth, Eridian) — 표면 셰이더 ─
        this._objects    = [];
        this._planetUnis = [];
        this.BODIES.filter(b => b.type === 'planet').forEach(b => {
            const uni  = { uTime: { value: 0 } };
            const frag = b.name === 'Earth' ? this.EARTH_FRAG : this.ERIDIAN_FRAG;
            this._planetUnis.push(uni);

            const g = new THREE.Group();
            g.position.set(...b.pos);
            g.add(new THREE.Mesh(
                new THREE.SphereGeometry(b.r, 64, 64),
                new THREE.ShaderMaterial({
                    uniforms:       uni,
                    vertexShader:   this.PLANET_VERT,
                    fragmentShader: frag
                })
            ));
            g.add(this._makeGlow(b.r * 1.6, b.glow, 0.18));
            g.add(this._makeGlow(b.r * 3.0, b.glow, 0.055));

            this.scene.add(g);
            this._objects.push({ group: g });
        });

        this._scroll  = 0;
        this._scrollT = 0;
        this._label   = document.getElementById('transit-label');

        this._onWheel = e => {
            this._scrollT = clamp(this._scrollT + e.deltaY * 0.0007, 0, 1);
        };
        window.addEventListener('wheel', this._onWheel, { passive: true });

        this._touchY      = 0;
        this._onTouchStart = e => { this._touchY = e.touches[0].clientY; };
        this._onTouchMove  = e => {
            const dy = this._touchY - e.touches[0].clientY;
            this._touchY  = e.touches[0].clientY;
            this._scrollT = clamp(this._scrollT + dy * 0.003, 0, 1);
        };
        window.addEventListener('touchstart', this._onTouchStart, { passive: true });
        window.addEventListener('touchmove',  this._onTouchMove,  { passive: true });
    },

    _getLabel(t) {
        let txt = this.LABELS[0].text;
        for (const l of this.LABELS) { if (t >= l.t) txt = l.text; }
        return txt;
    },

    tick(elapsed, delta) {
        if (!this.scene) return;
        this._scroll = lerp(this._scroll, this._scrollT, 0.04);
        const s  = this._scroll;

        const tz = 14 - s * 86;
        this.camera.position.z = lerp(this.camera.position.z, tz, 0.055);
        this.camera.position.x = Math.sin(s * Math.PI * 2.2) * 3.0;
        this.camera.position.y = Math.sin(s * Math.PI * 1.5) * 1.8;
        this.camera.lookAt(
            this.camera.position.x * 0.2,
            this.camera.position.y * 0.2,
            this.camera.position.z - 12
        );

        this._objects.forEach(({ group }) => {
            group.rotation.y += (delta || 0.016) * 0.12;
        });
        if (this._planetUnis) this._planetUnis.forEach(u => { u.uTime.value = elapsed; });

        if (this._label) this._label.textContent = this._getLabel(s);
    },

    onMouseMove() {},

    resize(W, H) {
        if (!this.camera) return;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
    },

    dispose() {
        if (this._onWheel)      window.removeEventListener('wheel',      this._onWheel);
        if (this._onTouchStart) window.removeEventListener('touchstart', this._onTouchStart);
        if (this._onTouchMove)  window.removeEventListener('touchmove',  this._onTouchMove);
        this._objects.forEach(({ group }) => {
            group.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
        });
        if (this._starGeo)     this._starGeo.dispose();
        if (this._starMat)     this._starMat.dispose();
        if (this._asteroidGeo) this._asteroidGeo.dispose();
        if (this._featuredGeo) this._featuredGeo.dispose();
        if (this._featuredMat) this._featuredMat.dispose();
        if (this._label) this._label.textContent = 'Sol System';
        this._objects = [];
        this._starGeo = this._starMat = this._asteroidGeo = null;
        this._featuredGeo = this._featuredMat = null;
        this._planetUnis = null;
        this.scene = this.camera = null;
    }
};
