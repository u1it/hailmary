// Tab 04 — PRESENCE : 웹캠 모션 → 파티클
const Tab4 = {
    scene:   null,
    camera:  null,
    _geo:    null,
    _mat:    null,
    _pos:    null,
    _col:    null,
    _life:   null,
    _vel:    null,
    _prevData:   null,
    _webcamActive: false,
    _video:  null,
    _anCvs:  null,
    _anCtx:  null,
    _nextSlot: 0,
    _btn:    null,
    _onBtn:  null,
    _breathPhase: 0,

    COUNT: 5000,
    THRESHOLD: 22,

    init(renderer, W, H) {
        this.scene  = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000810);

        this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
        this.camera.position.set(0, 0, 16);

        const N   = this.COUNT;
        const pos = new Float32Array(N * 3);
        const col = new Float32Array(N * 3);
        const vel = new Float32Array(N * 3);
        const life= new Float32Array(N);

        // 초기: 화면 밖으로 숨김
        for (let i = 0; i < N; i++) {
            pos[i*3] = pos[i*3+1] = pos[i*3+2] = 9999;
            life[i] = 0;
        }

        this._pos  = pos;
        this._col  = col;
        this._vel  = vel;
        this._life = life;

        this._geo = new THREE.BufferGeometry();
        this._geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this._geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

        this._mat = new THREE.PointsMaterial({
            size: 0.14,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.scene.add(new THREE.Points(this._geo, this._mat));

        // 웹캠 엘리먼트
        this._video = document.getElementById('webcam-video');
        this._anCvs = document.getElementById('webcam-analysis');
        this._anCtx = this._anCvs.getContext('2d', { willReadFrequently: true });
        this._anCvs.width  = 320;
        this._anCvs.height = 240;

        // 웹캠 버튼
        this._btn   = document.getElementById('webcam-btn');
        this._onBtn = () => this._toggleWebcam();
        this._btn.addEventListener('click', this._onBtn);

        this._webcamActive = false;
        this._prevData     = null;
        this._nextSlot     = 0;
        this._breathPhase  = 0;

        this._W = W;
        this._H = H;
    },

    async _toggleWebcam() {
        if (this._webcamActive) {
            // 끄기
            if (this._video.srcObject) {
                this._video.srcObject.getTracks().forEach(t => t.stop());
                this._video.srcObject = null;
            }
            this._webcamActive = false;
            this._prevData = null;
            if (this._btn) {
                this._btn.querySelector('.btn-dot').style.background = '';
                this._btn.querySelector('span:last-child') && (this._btn.childNodes[this._btn.childNodes.length-1].textContent = ' 웹캠 열기');
                this._btn.lastChild.textContent = ' 웹캠 열기';
                this._btn.classList.remove('active');
            }
        } else {
            // 켜기
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240, facingMode: 'user' }
                });
                this._video.srcObject = stream;
                this._webcamActive = true;
                if (this._btn) {
                    this._btn.classList.add('active');
                    this._btn.lastChild.textContent = ' 웹캠 끄기';
                }
            } catch (e) {
                console.warn('웹캠 접근 거부:', e);
                if (this._btn) this._btn.lastChild.textContent = ' 접근 불가';
            }
        }
    },

    _spawnAt(sx, sy, intensity) {
        // 스크린 좌표 → Three.js world 좌표 (-1~1 NDC → 카메라 기준)
        const nx = (sx / this._W) * 2 - 1;
        const ny = -(sy / this._H) * 2 + 1;
        const vFov = (60 * Math.PI) / 180;
        const hh   = Math.tan(vFov / 2) * 16;
        const hw   = hh * (this.camera.aspect || 1.77);
        const wx   = nx * hw;
        const wy   = ny * hh;

        const N  = this.COUNT;
        const i  = this._nextSlot % N;
        const i3 = i * 3;
        this._pos[i3]   = wx + (Math.random() - 0.5) * 0.3;
        this._pos[i3+1] = wy + (Math.random() - 0.5) * 0.3;
        this._pos[i3+2] = (Math.random() - 0.5) * 0.5;

        this._vel[i3]   = (Math.random() - 0.5) * 0.08;
        this._vel[i3+1] = Math.random() * 0.12 + 0.02;
        this._vel[i3+2] = (Math.random() - 0.5) * 0.04;

        // 마젠타~보라 팔레트 (웹캠 전용)
        const h = 270 + Math.random() * 60;
        const s = 0.7 + Math.random() * 0.3;
        const l = 0.55 + Math.random() * 0.3;
        const rgb = this._hsl2rgb(h / 360, s, l);
        this._col[i3]   = rgb[0];
        this._col[i3+1] = rgb[1];
        this._col[i3+2] = rgb[2];

        this._life[i] = 1.0 + Math.random() * 0.5;
        this._nextSlot++;
    },

    _hsl2rgb(h, s, l) {
        let r, g, b;
        if (s === 0) { r = g = b = l; }
        else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1; if (t > 1) t -= 1;
                if (t < 1/6) return p + (q-p)*6*t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q-p)*(2/3-t)*6;
                return p;
            };
            const q = l < 0.5 ? l*(1+s) : l+s-l*s;
            const p = 2*l-q;
            r = hue2rgb(p,q,h+1/3);
            g = hue2rgb(p,q,h);
            b = hue2rgb(p,q,h-1/3);
        }
        return [r, g, b];
    },

    _detectMotion(W, H) {
        if (this._video.readyState < 2) return;
        const ctx = this._anCtx;
        ctx.drawImage(this._video, 0, 0, 320, 240);
        const curr = ctx.getImageData(0, 0, 320, 240);
        if (!this._prevData) { this._prevData = curr; return; }

        const step = 10;
        for (let y = 0; y < 240; y += step) {
            for (let x = 0; x < 320; x += step) {
                const idx = (y * 320 + x) * 4;
                const diff = (
                    Math.abs(curr.data[idx]   - this._prevData.data[idx]) +
                    Math.abs(curr.data[idx+1] - this._prevData.data[idx+1]) +
                    Math.abs(curr.data[idx+2] - this._prevData.data[idx+2])
                ) / 3;

                if (diff > this.THRESHOLD && Math.random() < 0.18) {
                    // 웹캠 미러: x 반전
                    const sx = (1 - x / 320) * W;
                    const sy = (y / 240) * H;
                    this._spawnAt(sx, sy, diff / 255);
                }
            }
        }
        this._prevData = curr;
    },

    tick(elapsed, delta) {
        if (!this._geo) return;
        const dt  = delta || 0.016;
        const N   = this.COUNT;
        const pos = this._pos;
        const vel = this._vel;
        const col = this._col;
        const life= this._life;

        // 웹캠 모션 감지
        if (this._webcamActive) {
            this._detectMotion(this._W, this._H);
        } else {
            // 대기 애니메이션: 숨쉬는 원
            this._breathPhase = elapsed;
            const breathe = (Math.sin(elapsed * 0.9) * 0.5 + 0.5);
            const r  = 3 + breathe * 4;
            const N2 = 300;
            for (let i = 0; i < N2; i++) {
                if (Math.random() > 0.02) continue;
                const angle = (i / N2) * Math.PI * 2;
                const si    = this._nextSlot % N;
                const i3    = si * 3;
                pos[i3]   = Math.cos(angle) * r + (Math.random()-0.5)*0.3;
                pos[i3+1] = Math.sin(angle) * r + (Math.random()-0.5)*0.3;
                pos[i3+2] = 0;
                vel[i3]   = Math.cos(angle) * 0.01;
                vel[i3+1] = Math.sin(angle) * 0.01;
                vel[i3+2] = 0;
                col[i3]   = 0.1 + breathe * 0.2;
                col[i3+1] = 0.5 + breathe * 0.3;
                col[i3+2] = 0.9;
                life[si]  = 0.8 + Math.random() * 0.4;
                this._nextSlot++;
            }
        }

        // 파티클 업데이트 (life decay)
        for (let i = 0; i < N; i++) {
            if (life[i] <= 0) continue;
            const i3 = i * 3;
            life[i] -= dt * 0.9;

            pos[i3]   += vel[i3];
            pos[i3+1] += vel[i3+1];
            pos[i3+2] += vel[i3+2];

            // 중력 미미하게
            vel[i3+1] += this._webcamActive ? 0.0008 : 0;

            // life 0이면 숨김
            if (life[i] <= 0) {
                pos[i3] = pos[i3+1] = pos[i3+2] = 9999;
            }
        }

        this._geo.attributes.position.needsUpdate = true;
    },

    resize(W, H) {
        this._W = W;
        this._H = H;
        if (!this.camera) return;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
    },

    dispose() {
        if (this._btn && this._onBtn) this._btn.removeEventListener('click', this._onBtn);
        if (this._webcamActive && this._video && this._video.srcObject) {
            this._video.srcObject.getTracks().forEach(t => t.stop());
            this._video.srcObject = null;
        }
        if (this._geo)  this._geo.dispose();
        if (this._mat)  this._mat.dispose();
        if (this._btn)  { this._btn.classList.remove('active'); this._btn.lastChild.textContent = ' 웹캠 열기'; }
        this._geo = this._mat = this._pos = this._col = this._vel = this._life = null;
        this._prevData = null;
        this._webcamActive = false;
        this.scene = this.camera = null;
    }
};
