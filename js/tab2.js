// Tab 02 — ERIDIAN : 수채화 오로라를 행성 표면에 직접 적용
const Tab2 = {
    scene:     null,
    camera:    null,
    _planet:   null,
    _atmMesh:  null,
    _starGeo:  null,
    _uni:      null,
    _raycaster: null,
    _hitStrTarget: 0,

    // ── 행성 표면 버텍스 셰이더 ─────────────────
    VERT: `
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

    // ── 수채화 FBM 도메인 워핑 표면 셰이더 ──────
    FRAG: `
        uniform float uTime;
        uniform vec3  uHit;
        uniform float uHitStr;

        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;

        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545); }
        float noise(vec2 p){
            vec2 i=floor(p), f=fract(p);
            f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0, a=0.52;
            mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
            for(int i=0;i<6;i++){ v+=a*noise(p); p=rot*p*2.05+vec2(1.7,9.2); a*=0.48; }
            return v;
        }

        // dark green → green → lime → orange → deep orange 팔레트
        vec3 palette(float t){
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
            // UV 기반 좌표 — uTime으로 자전처럼 천천히 이동
            vec2 rotUV = vec2(fract(vUv.x + uTime * 0.005), vUv.y);
            vec2 p = (rotUV - 0.5) * 3.5;
            float t = uTime * 0.065;

            // 마우스 파문 (구면 대원 거리 기반)
            vec3 nSurf = normalize(vWorldPos);
            vec3 nHit  = normalize(uHit);
            float hitAng = acos(clamp(dot(nSurf, nHit), -1.0, 1.0));
            float ripple = sin(hitAng * 9.0 - uTime * 4.5)
                           * exp(-hitAng * 1.8) * uHitStr * 0.28;

            // 2단계 도메인 워핑
            vec2 q = vec2(fbm(p+vec2(t, t*0.68)),
                          fbm(p+vec2(3.18+t*0.88, 1.74)));
            vec2 r = vec2(fbm(p+4.1*q+vec2(1.72+t*0.22, 9.24+t*0.15)),
                          fbm(p+4.1*q+vec2(8.30+t*0.12, 2.84+t*0.21)));
            r.x += ripple * 0.35;
            r.y += ripple * 0.25;

            float f = fbm(p + 3.8*r);
            f = clamp(f + ripple * 0.15, 0.0, 1.0);

            vec3 col = palette(f);

            // 수채화 — 어두운 영역 살짝 탁하게
            float lum = dot(col, vec3(0.299,0.587,0.114));
            col = mix(col, vec3(lum*0.3+0.003), (1.0-f)*0.25);

            // 밝은 영역 채도 강화
            col = mix(col, col*1.22, smoothstep(0.60,1.0,f)*0.52);

            // 림 다크닝 (구 형태감)
            float rimDark = dot(normalize(cameraPosition - vWorldPos), vNormal);
            rimDark = clamp(rimDark, 0.0, 1.0);
            col *= 0.30 + rimDark * 0.82;

            gl_FragColor = vec4(col, 1.0);
        }
    `,

    // ── 대기권 림 글로우 셰이더 ─────────────────
    ATM_VERT: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main(){
            vNormal   = normalize(normalMatrix * normal);
            vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
    `,
    ATM_FRAG: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main(){
            vec3  viewDir = normalize(cameraPosition - vWorldPos);
            float fr      = 1.0 - abs(dot(viewDir, vNormal));
            fr = pow(fr, 2.2);
            vec3  col  = mix(vec3(0.05,0.9,0.25), vec3(0.55,0.95,0.05), fr*0.5);
            float alpha = fr * 0.55;
            gl_FragColor = vec4(col, alpha);
        }
    `,

    init(renderer, W, H) {
        this.scene  = new THREE.Scene();
        this.scene.background = new THREE.Color(0x010408);

        this.camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
        this.camera.position.set(0, 2, 12);
        this.camera.lookAt(0, 0, 0);

        // ── 별 배경 ──────────────────────────────
        const sc = 1800;
        const sp = new Float32Array(sc*3), sv = new Float32Array(sc*3);
        for(let i=0;i<sc;i++){
            sp[i*3]   = (Math.random()-0.5)*200;
            sp[i*3+1] = (Math.random()-0.5)*150;
            sp[i*3+2] = (Math.random()-0.5)*200 - 30;
            const b = 0.4+Math.random()*0.6;
            sv[i*3]=b*0.85; sv[i*3+1]=b*0.90; sv[i*3+2]=b;
        }
        this._starGeo = new THREE.BufferGeometry();
        this._starGeo.setAttribute('position', new THREE.BufferAttribute(sp,3));
        this._starGeo.setAttribute('color',    new THREE.BufferAttribute(sv,3));
        this.scene.add(new THREE.Points(this._starGeo, new THREE.PointsMaterial({
            size:0.06, vertexColors:true, transparent:true, opacity:0.6,
            blending:THREE.AdditiveBlending, depthWrite:false
        })));

        // ── 행성 본체 (수채화 표면 셰이더) ───────
        this._uni = {
            uTime:   { value: 0 },
            uHit:    { value: new THREE.Vector3(0, 4.2, 0) },
            uHitStr: { value: 0 }
        };

        this._planet = new THREE.Mesh(
            new THREE.SphereGeometry(4.2, 96, 96),
            new THREE.ShaderMaterial({
                uniforms:       this._uni,
                vertexShader:   this.VERT,
                fragmentShader: this.FRAG
            })
        );
        this.scene.add(this._planet);

        // ── 대기권 글로우 (림 빛) ─────────────────
        this._atmMesh = new THREE.Mesh(
            new THREE.SphereGeometry(4.48, 48, 48),
            new THREE.ShaderMaterial({
                vertexShader:   this.ATM_VERT,
                fragmentShader: this.ATM_FRAG,
                transparent:    true,
                blending:       THREE.AdditiveBlending,
                depthWrite:     false,
                side:           THREE.FrontSide
            })
        );
        this.scene.add(this._atmMesh);

        this._raycaster    = new THREE.Raycaster();
        this._hitStrTarget = 0;
    },

    onMouseMove(nx, ny) {
        if (!this.camera || !this._raycaster) return;
        this._raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
        const hits = this._raycaster.intersectObject(this._planet);
        if (hits.length > 0) {
            this._uni.uHit.value.copy(hits[0].point);
            this._hitStrTarget = 1.0;
        }
    },

    tick(elapsed) {
        if (!this._uni) return;
        this._uni.uTime.value = elapsed;

        this._hitStrTarget *= 0.965;
        this._uni.uHitStr.value = lerp(this._uni.uHitStr.value, this._hitStrTarget, 0.08);

        // 카메라 느린 공전
        this.camera.position.x = Math.sin(elapsed * 0.065) * 1.8;
        this.camera.position.y = 1.8 + Math.cos(elapsed * 0.048) * 0.9;
        this.camera.lookAt(0, 0, 0);
    },

    resize(W, H) {
        if (!this.camera) return;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
    },

    dispose() {
        if (this._planet)  { this._planet.geometry.dispose();  this._planet.material.dispose(); }
        if (this._atmMesh) { this._atmMesh.geometry.dispose(); this._atmMesh.material.dispose(); }
        if (this._starGeo) this._starGeo.dispose();
        this._planet = this._atmMesh = this._starGeo = this._uni = null;
        this.scene = this.camera = null;
    }
};
