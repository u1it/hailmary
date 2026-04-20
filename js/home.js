// Home — 우주 배경 파티클 (따뜻한 코스믹 톤)
const Home = {
    scene:  null,
    camera: null,
    _geo:   null,
    _mat:   null,
    _origins: null,
    _phases:  null,
    _scales:  null,
    _aurora:  null,
    _auroraUni: null,

    COUNT: 2600,

    VERT: `
        uniform  float uSize;
        attribute float aScale;
        attribute vec3  aColor;
        varying   vec3  vColor;

        void main() {
            vColor = aColor;
            vec4 mvPos  = modelViewMatrix * vec4(position, 1.0);
            float pSize = uSize * aScale * (260.0 / -mvPos.z);
            gl_PointSize = clamp(pSize, 0.8, 48.0);
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
            float hSpike = exp(-abs(uv.y) * 40.0) * exp(-abs(uv.x) * 2.2);
            float vSpike = exp(-abs(uv.x) * 40.0) * exp(-abs(uv.y) * 2.2);
            float d1     = exp(-abs(uv.x - uv.y) * 40.0) * exp(-length(uv) * 4.5);
            float d2     = exp(-abs(uv.x + uv.y) * 40.0) * exp(-length(uv) * 4.5);

            float spikes     = (hSpike + vSpike) * 0.55 + (d1 + d2) * 0.28;
            float brightness = glow + spikes * max(0.0, 0.92 - d * 1.4);
            brightness       = clamp(brightness, 0.0, 1.0);
            if (brightness < 0.007) discard;

            vec3 col = mix(vec3(1.0, 0.97, 0.92), vColor, clamp(d * 3.0, 0.0, 1.0));
            gl_FragColor = vec4(col * brightness, brightness);
        }
    `,

    AURORA_VERT: `
        varying vec3 vWorldPos;
        void main() {
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    AURORA_FRAG: `
        uniform float uTime;
        varying vec3 vWorldPos;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
        float noise(vec2 p){
            vec2 i = floor(p), f = fract(p);
            f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x),
                       mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
        }
        float fbm(vec2 p){
            float v = 0.0, a = 0.55;
            mat2 r = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
            for(int i=0;i<5;i++){ v += a*noise(p); p = r*p*2.03 + vec2(2.4,7.7); a *= 0.52; }
            return v;
        }

        void main() {
            vec2 p = vWorldPos.xy * 0.13;
            float t = uTime * 0.07;
            float bandA = fbm(vec2(p.x * 1.7 + t, p.y * 0.5 - t * 0.2));
            float bandB = fbm(vec2(p.x * 1.1 - t * 0.6, p.y * 0.7 + t * 0.4));
            float mixV = smoothstep(0.30, 0.92, bandA * 0.62 + bandB * 0.58);
            float topFade = smoothstep(-12.0, -2.0, vWorldPos.y) * (1.0 - smoothstep(9.0, 16.0, vWorldPos.y));
            float alpha = mixV * topFade * 0.34;

            vec3 c0 = vec3(0.06, 0.20, 0.35);
            vec3 c1 = vec3(0.24, 0.86, 0.74);
            vec3 c2 = vec3(0.57, 0.45, 0.95);
            vec3 col = mix(c0, c1, smoothstep(0.2, 0.7, bandA));
            col = mix(col, c2, smoothstep(0.6, 1.0, bandB) * 0.55);

            gl_FragColor = vec4(col, alpha);
        }
    `,

    init(renderer, W, H) {
        this.scene  = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
        this.camera.position.set(0, 0, 15);

        const N         = this.COUNT;
        const positions = new Float32Array(N * 3);
        const colors    = new Float32Array(N * 3);
        const scales    = new Float32Array(N);
        const phases    = new Float32Array(N * 3);
        const origins   = new Float32Array(N * 3);

        for (let i = 0; i < N; i++) {
            const r   = 3 + Math.random() * 9;
            const phi = Math.acos(2 * Math.random() - 1);
            const th  = Math.random() * Math.PI * 2;
            const x   = r * Math.sin(phi) * Math.cos(th);
            const y   = r * Math.sin(phi) * Math.sin(th);
            const z   = r * Math.cos(phi);

            positions[i*3]   = origins[i*3]   = x;
            positions[i*3+1] = origins[i*3+1] = y;
            positions[i*3+2] = origins[i*3+2] = z;

            // 크기 분포
            const rv = Math.random();
            if      (rv < 0.70) scales[i] = 0.18 + Math.random() * 0.32;
            else if (rv < 0.92) scales[i] = 0.55 + Math.random() * 0.70;
            else                scales[i] = 1.30 + Math.random() * 1.40;

            // 우주 톤: 흰색, 앰버, 차가운 블루 혼합
            const type = Math.random();
            if (type < 0.4) {
                const b = 0.7 + Math.random() * 0.3;
                colors[i*3] = b; colors[i*3+1] = b * 0.95; colors[i*3+2] = b * 0.85;
            } else if (type < 0.65) {
                colors[i*3] = 0.9 + Math.random() * 0.1;
                colors[i*3+1] = 0.4 + Math.random() * 0.3;
                colors[i*3+2] = 0.05 + Math.random() * 0.1;
            } else {
                const t = Math.random();
                colors[i*3] = t * 0.1; colors[i*3+1] = 0.3 + t * 0.4; colors[i*3+2] = 0.7 + t * 0.3;
            }

            phases[i*3]   = Math.random() * Math.PI * 2;
            phases[i*3+1] = Math.random() * Math.PI * 2;
            phases[i*3+2] = Math.random() * Math.PI * 2;
        }

        this._geo = new THREE.BufferGeometry();
        this._geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this._geo.setAttribute('aColor',   new THREE.BufferAttribute(colors,    3));
        this._geo.setAttribute('aScale',   new THREE.BufferAttribute(scales,    1));
        this._origins = origins;
        this._phases  = phases;

        this._mat = new THREE.ShaderMaterial({
            uniforms:       { uSize: { value: 1.2 } },
            vertexShader:   this.VERT,
            fragmentShader: this.FRAG,
            transparent:    true,
            blending:       THREE.AdditiveBlending,
            depthWrite:     false
        });

        this.scene.add(new THREE.Points(this._geo, this._mat));

        this._auroraUni = { uTime: { value: 0 } };
        this._aurora = new THREE.Mesh(
            new THREE.PlaneGeometry(60, 32, 1, 1),
            new THREE.ShaderMaterial({
                uniforms: this._auroraUni,
                vertexShader: this.AURORA_VERT,
                fragmentShader: this.AURORA_FRAG,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        this._aurora.position.set(0, 2.8, -6);
        this.scene.add(this._aurora);
    },

    tick(elapsed) {
        if (!this._geo) return;
        const pos = this._geo.attributes.position.array;
        const org = this._origins, ph = this._phases;
        const sp  = 0.25;
        for (let i = 0; i < this.COUNT; i++) {
            const i3 = i * 3;
            pos[i3]   = org[i3]   + Math.sin(elapsed * sp       + ph[i3])   * 0.3;
            pos[i3+1] = org[i3+1] + Math.cos(elapsed * sp * 0.7 + ph[i3+1]) * 0.3;
            pos[i3+2] = org[i3+2] + Math.sin(elapsed * sp * 0.5 + ph[i3+2]) * 0.25;
        }
        this._geo.attributes.position.needsUpdate = true;
        this.camera.position.x = Math.sin(elapsed * 0.07) * 0.5;
        this.camera.position.y = Math.cos(elapsed * 0.05) * 0.35;
        this.camera.lookAt(0, 0, 0);
        if (this._auroraUni) this._auroraUni.uTime.value = elapsed;
    },

    onMouseMove() {},

    resize(W, H) {
        if (!this.camera) return;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
    },

    dispose() {
        if (this._geo) this._geo.dispose();
        if (this._mat) this._mat.dispose();
        if (this._aurora) {
            this._aurora.geometry.dispose();
            this._aurora.material.dispose();
        }
        this._geo = this._mat = this._origins = this._phases = null;
        this._aurora = this._auroraUni = null;
        this.scene = this.camera = null;
    }
};
