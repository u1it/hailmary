// Tab 03 — TRANSIT : Solar System → Tau Ceti → 40 Eridani
const Tab3 = {
    scene:    null,
    camera:   null,
    _objects: [],
    _starObjs:[],
    _starUnis:[],
    _starGeo: null,
    _starMat: null,
    _asteroidGeo: null,
    _asteroidMat: null,
    _petroGeo: null,
    _petroMat: null,
    _planetUnis: null,
    _scroll:  0,
    _scrollT: 0,
    _onWheel:      null,
    _onTouchStart: null,
    _onTouchMove:  null,
    _onTouchEnd:   null,
    _touchY:  0,
    _label:   null,
    // 마우스 시선 제어
    _lookH: 0, _lookV: 0,
    _lookHT: 0, _lookVT: 0,
    _isDragging: false,
    _prevMX: 0, _prevMY: 0,
    _onMouseDown: null,
    _onMouseUp: null,
    _onMouseMoveDrag: null,

    // ── 배경별 파티클 셰이더 ──────────────────────
    STAR_VERT: `
        uniform  float uSize;
        attribute float aScale;
        attribute vec3  aColor;
        varying   vec3  vColor;
        void main(){
            vColor = aColor;
            vec4 mvPos = modelViewMatrix * vec4(position,1.0);
            float dist = max(-mvPos.z, 20.0);
            gl_PointSize = clamp(uSize*aScale*120.0/dist, 0.8, 40.0);
            gl_Position  = projectionMatrix * mvPos;
        }
    `,
    STAR_FRAG: `
        varying vec3 vColor;
        void main(){
            vec2  uv = gl_PointCoord-vec2(0.5);
            float d  = length(uv);
            if(d>0.5) discard;
            float glow  = exp(-d*7.5);
            float hSpike= exp(-abs(uv.y)*42.0)*exp(-abs(uv.x)*2.5);
            float vSpike= exp(-abs(uv.x)*42.0)*exp(-abs(uv.y)*2.5);
            float d1=exp(-abs(uv.x-uv.y)*42.0)*exp(-length(uv)*4.5);
            float d2=exp(-abs(uv.x+uv.y)*42.0)*exp(-length(uv)*4.5);
            float spikes=(hSpike+vSpike)*0.55+(d1+d2)*0.28;
            float b=clamp(glow+spikes*max(0.0,0.92-d*1.4),0.0,1.0);
            if(b<0.007) discard;
            gl_FragColor=vec4(mix(vec3(1.0,0.97,0.92),vColor,clamp(d*3.0,0.0,1.0))*b,b);
        }
    `,

    // ── 항성 표면 셰이더 (Sol / TauCeti / 40EridaniA/B/C 공용) ─
    STAR_SURF_VERT: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main(){
            vNormal   = normalize(normalMatrix*normal);
            vWorldPos = (modelMatrix*vec4(position,1.0)).xyz;
            gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
        }
    `,
    STAR_SURF_FRAG: `
        uniform float uTime;
        uniform vec3  uCore;
        uniform vec3  uMid;
        uniform vec3  uRim;
        varying vec3  vWorldPos;
        varying vec3  vNormal;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.55;
            for(int i=0;i<5;i++){v+=noise(p)*a;p=p*2.03+vec2(3.1,5.9);a*=0.5;}
            return v;
        }
        void main(){
            vec3 n=normalize(vNormal);
            float lon=atan(n.z,n.x), lat=asin(clamp(n.y,-1.0,1.0));
            vec2 cyc=vec2(cos(lon+uTime*0.07),sin(lon+uTime*0.07));
            vec2 p=vec2(cyc.x*2.2+lat*1.8,cyc.y*2.2-lat*1.6);
            float n1=fbm(p*2.4+uTime*0.09), n2=fbm(p*4.8-uTime*0.13);
            float f=clamp(n1*0.68+n2*0.35,0.0,1.0);
            vec3 col=mix(uCore,uMid,smoothstep(0.15,0.72,f));
            col=mix(col,uRim,smoothstep(0.62,1.0,f));
            float fres=pow(1.0-abs(dot(normalize(cameraPosition-vWorldPos),n)),2.1);
            col+=uMid*fres*0.55;
            gl_FragColor=vec4(col,1.0);
        }
    `,

    // ── 행성 표면 공용 정점 셰이더 ──────────────────
    // ★ vNormal 사용 — 원점에서 멀리 있는 행성도 올바른 UV 맵핑
    PLANET_VERT: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main(){
            vUv       = uv;
            vNormal   = normalize(normalMatrix*normal);
            vWorldPos = (modelMatrix*vec4(position,1.0)).xyz;
            gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
        }
    `,
    PLANET_GENERIC_FRAG: `
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform float uBanding;
        uniform float uRough;
        varying vec3 vWorldPos; varying vec3 vNormal;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.5;
            for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.07+vec2(1.2,3.7);a*=0.5;}
            return v;
        }
        void main(){
            vec3 n=normalize(vNormal);
            float lon=atan(n.z,n.x), lat=asin(clamp(n.y,-1.,1.));
            vec2 p=vec2(cos(lon+uTime*0.02), sin(lon+uTime*0.02))*2.2+vec2(lat*1.7,-lat*1.4);
            float n1=fbm(p*2.5+uTime*0.03);
            float n2=fbm(p*5.4-uTime*0.04);
            float bands=0.5+0.5*sin(lat*uBanding + n1*3.2);
            float h=clamp(n1*0.65+n2*0.25+bands*0.35,0.0,1.0);
            vec3 col=mix(uColorA,uColorB,smoothstep(0.18,0.62,h));
            col=mix(col,uColorC,smoothstep(0.62,0.96,h));
            vec3 lightDir=normalize(vec3(-3.2,1.2,6.0));
            float diff=clamp(dot(n,lightDir),0.0,1.0);
            vec3 viewDir=normalize(cameraPosition-vWorldPos);
            vec3 halfVec=normalize(lightDir+viewDir);
            float spec=pow(max(dot(n,halfVec),0.0),mix(12.0,48.0,uRough))*mix(0.12,0.42,1.0-uRough);
            col*=0.12+0.88*diff;
            col+=vec3(0.8,0.9,1.0)*spec*diff;
            float rim=pow(1.0-clamp(dot(viewDir,n),0.0,1.0),2.7);
            col+=uColorC*rim*0.14;
            gl_FragColor=vec4(col,1.0);
        }
    `,

    // ── 지구 ─────────────────────────────────────────
    EARTH_FRAG: `
        uniform float uTime;
        varying vec2 vUv; varying vec3 vWorldPos; varying vec3 vNormal;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.52;
            mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
            for(int i=0;i<6;i++){v+=a*noise(p);p=rot*p*2.05+vec2(1.7,9.2);a*=0.48;}
            return v;
        }
        void main(){
            vec3 nSurf=vNormal;
            float lon=atan(nSurf.z,nSurf.x),lat=asin(clamp(nSurf.y,-1.0,1.0));
            float latN=lat/(3.14159*0.5);
            vec2 cyc=vec2(cos(lon+uTime*0.018),sin(lon+uTime*0.018));
            vec2 p=vec2(cyc.x*2.2+lat*1.8,cyc.y*2.2-lat*1.6);
            float t=uTime*0.020;
            vec2 q=vec2(fbm(p+vec2(t,t*0.7)),fbm(p+vec2(3.2+t*0.9,1.7)));
            vec2 r=vec2(fbm(p+3.6*q+vec2(1.7+t*0.15,9.2+t*0.10)),
                        fbm(p+3.6*q+vec2(8.3+t*0.08,2.8+t*0.15)));
            float landF=clamp(fbm(p+3.4*r),0.0,1.0);
            float isLand=smoothstep(0.44,0.50,landF);
            vec3 oceanCol=mix(vec3(0.004,0.016,0.140),vec3(0.010,0.085,0.360),clamp(landF/0.44,0.0,1.0));
            float tf=clamp((landF-0.50)/0.50,0.0,1.0);
            vec3 lc;
            if(tf<0.30)      lc=mix(vec3(0.048,0.175,0.032),vec3(0.130,0.250,0.058),tf/0.30);
            else if(tf<0.60) lc=mix(vec3(0.130,0.250,0.058),vec3(0.270,0.210,0.075),(tf-0.30)/0.30);
            else             lc=mix(vec3(0.270,0.210,0.075),vec3(0.410,0.390,0.350),(tf-0.60)/0.40);
            vec3 col=mix(oceanCol,lc,isLand);
            vec3 lightDir=normalize(vec3(-3.5,0.3,5.0));
            float diffuse=clamp(dot(vNormal,lightDir),0.0,1.0);
            vec3 viewDir=normalize(cameraPosition-vWorldPos);
            vec3 halfVec=normalize(lightDir+viewDir);
            float spec=pow(max(dot(vNormal,halfVec),0.0),52.0)*(1.0-isLand)*0.65;
            col*=0.06+diffuse*0.94;
            col+=vec3(0.50,0.65,0.92)*spec*diffuse;
            float poleT=smoothstep(0.68,0.90,abs(latN));
            float iceVar=noise(vec2(lon*4.0,lat*12.0));
            float iceMask=smoothstep(0.0,0.5,poleT+iceVar*0.18-0.12);
            col=mix(col,vec3(0.82,0.90,0.96)*(0.06+diffuse*0.94),iceMask);
            vec2 cCyc=vec2(cos(lon+uTime*0.050),sin(lon+uTime*0.050));
            vec2 cp=vec2(cCyc.x*3.2+lat*2.4,cCyc.y*3.2-lat*2.0);
            float ct=uTime*0.040;
            float cloud=smoothstep(0.42,0.60,fbm(cp+2.6*vec2(fbm(cp+vec2(ct,ct*0.8)),fbm(cp+vec2(2.1+ct,1.3)))));
            col=mix(col,vec3(0.88,0.91,0.95)*(0.05+diffuse*0.95),cloud*0.86);
            float rim=1.0-clamp(dot(viewDir,vNormal),0.0,1.0);
            col+=vec3(0.10,0.25,0.62)*pow(rim,3.0)*0.30*diffuse;
            gl_FragColor=vec4(col,1.0);
        }
    `,

    // ── Adrian (타우세티 e) — Tab02 에이드리언과 동일한 수채화 오로라 ─
    ADRIAN_FRAG: `
        uniform float uTime;
        varying vec2 vUv; varying vec3 vWorldPos; varying vec3 vNormal;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.52;
            mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
            for(int i=0;i<6;i++){v+=a*noise(p);p=rot*p*2.05+vec2(1.7,9.2);a*=0.48;}
            return v;
        }
        vec3 pal(float t){
            vec3 c0=vec3(0.003,0.022,0.008),c1=vec3(0.010,0.120,0.038),
                 c2=vec3(0.028,0.380,0.095),c3=vec3(0.100,0.680,0.075),
                 c4=vec3(0.500,0.840,0.038),c5=vec3(0.920,0.560,0.018),
                 c6=vec3(1.000,0.380,0.010),c7=vec3(1.000,0.720,0.170),
                 c8=vec3(1.000,0.540,0.095);
            if(t<0.14)return mix(c0,c1,t/0.14);
            if(t<0.30)return mix(c1,c2,(t-0.14)/0.16);
            if(t<0.48)return mix(c2,c3,(t-0.30)/0.18);
            if(t<0.62)return mix(c3,c4,(t-0.48)/0.14);
            if(t<0.76)return mix(c4,c5,(t-0.62)/0.14);
            if(t<0.88)return mix(c5,c6,(t-0.76)/0.12);
            if(t<0.95)return mix(c6,c7,(t-0.88)/0.07);
            return mix(c7,c8,(t-0.95)/0.05);
        }
        void main(){
            vec3 nSurf=vNormal;
            float lon=atan(nSurf.z,nSurf.x),lat=asin(clamp(nSurf.y,-1.0,1.0));
            vec2 cyc=vec2(cos(lon+uTime*0.05),sin(lon+uTime*0.05));
            vec2 p=vec2(cyc.x*2.1+lat*1.7,cyc.y*2.1-lat*1.5);
            float t=uTime*0.065;
            vec2 q=vec2(fbm(p+vec2(t,t*0.68)),fbm(p+vec2(3.18+t*0.88,1.74)));
            vec2 r=vec2(fbm(p+4.1*q+vec2(1.72+t*0.22,9.24+t*0.15)),
                        fbm(p+4.1*q+vec2(8.30+t*0.12,2.84+t*0.21)));
            float f=clamp(fbm(p+3.8*r),0.0,1.0);
            vec3 col=pal(f);
            float lum=dot(col,vec3(0.299,0.587,0.114));
            col=mix(col,vec3(lum*0.3+0.003),(1.0-f)*0.25);
            col=mix(col,col*1.22,smoothstep(0.60,1.0,f)*0.52);
            float ob=smoothstep(0.58,0.95,f)*(0.6+0.4*fbm(p*2.0-t));
            col=mix(col,col+vec3(0.26,0.10,0.01),ob*0.45);
            float rim=clamp(dot(normalize(cameraPosition-vWorldPos),vNormal),0.0,1.0);
            col*=0.30+rim*0.82;
            gl_FragColor=vec4(col,1.0);
        }
    `,

    // ── Erid (로키 고향, 40 Eridani) — 암석·폭풍·암모니아 ──
    ERID_FRAG: `
        uniform float uTime;
        varying vec2 vUv; varying vec3 vWorldPos; varying vec3 vNormal;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.52;
            mat2 rot=mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
            for(int i=0;i<6;i++){v+=a*noise(p);p=rot*p*2.05+vec2(1.7,9.2);a*=0.48;}
            return v;
        }
        vec3 eridPal(float t){
            vec3 c0=vec3(0.03,0.02,0.06), c1=vec3(0.08,0.05,0.13),
                 c2=vec3(0.14,0.09,0.18), c3=vec3(0.20,0.14,0.14),
                 c4=vec3(0.30,0.22,0.15), c5=vec3(0.16,0.20,0.26),
                 c6=vec3(0.07,0.12,0.20);
            if(t<0.16)return mix(c0,c1,t/0.16);
            if(t<0.33)return mix(c1,c2,(t-0.16)/0.17);
            if(t<0.49)return mix(c2,c3,(t-0.33)/0.16);
            if(t<0.63)return mix(c3,c4,(t-0.49)/0.14);
            if(t<0.77)return mix(c4,c5,(t-0.63)/0.14);
            if(t<0.90)return mix(c5,c6,(t-0.77)/0.13);
            return mix(c6,c0,(t-0.90)/0.10);
        }
        void main(){
            vec3 nSurf=vNormal;
            float lon=atan(nSurf.z,nSurf.x),lat=asin(clamp(nSurf.y,-1.0,1.0));
            vec2 cyc=vec2(cos(lon+uTime*0.022),sin(lon+uTime*0.022));
            vec2 p=vec2(cyc.x*2.0+lat*1.5,cyc.y*2.0-lat*1.3);
            float t=uTime*0.025;
            vec2 q=vec2(fbm(p+vec2(t,t*0.8)),fbm(p+vec2(2.8+t*0.7,1.5)));
            vec2 r=vec2(fbm(p+3.8*q+vec2(1.5+t*0.18,8.8+t*0.12)),
                        fbm(p+3.8*q+vec2(7.8+t*0.10,2.5+t*0.18)));
            float f=clamp(fbm(p+3.5*r),0.0,1.0);
            // 대기 밴드 (폭풍 줄무늬)
            float band=sin(lat*10.0+fbm(p*0.5+t*0.8)*2.0)*0.12+0.5;
            f=clamp(f*0.72+band*0.28,0.0,1.0);
            vec3 col=eridPal(f);
            // 40 Eridani A 방향 조명
            vec3 lightDir=normalize(vec3(-4.5,1.2,8.0));
            float diffuse=clamp(dot(vNormal,lightDir),0.0,1.0);
            vec3 viewDir=normalize(cameraPosition-vWorldPos);
            col*=0.07+diffuse*0.93;
            col+=vec3(0.10,0.05,0.01)*diffuse*0.22;
            // 암모니아 대기 림 (짙은 청록)
            float rim=1.0-clamp(dot(viewDir,vNormal),0.0,1.0);
            col+=vec3(0.08,0.18,0.28)*pow(rim,2.5)*0.50*diffuse;
            gl_FragColor=vec4(col,1.0);
        }
    `,

    // ── 대기권 셰이더 ────────────────────────────────
    ATM_VERT: `
        varying vec3 vNormal; varying vec3 vWorldPos;
        void main(){
            vNormal   = normalize(normalMatrix*normal);
            vWorldPos = (modelMatrix*vec4(position,1.0)).xyz;
            gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
        }
    `,
    // 지구 — 레일리 산란 파란 대기
    EARTH_ATM_FRAG: `
        float hash(vec2 p){return fract(sin(dot(p,vec2(91.7,129.3)))*43758.5453123);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
        }
        varying vec3 vNormal; varying vec3 vWorldPos;
        void main(){
            vec3 n=normalize(vNormal);
            vec3 vd=normalize(cameraPosition-vWorldPos);
            float fr=1.0-max(dot(vd,n),0.0);
            float lon=atan(n.z,n.x),lat=asin(clamp(n.y,-1.,1.));
            float haze=noise(vec2(lon*2.5,lat*6.0))*0.16;
            float layer1=pow(fr,2.4)*(1.2+haze);
            float layer2=pow(fr,4.8)*0.92;
            vec3 col=mix(vec3(0.08,0.34,0.88),vec3(0.33,0.70,1.00),smoothstep(0.35,1.0,fr));
            col*=(layer1+layer2);
            gl_FragColor=vec4(col, clamp(layer1*0.34+layer2*0.48,0.0,0.78));
        }
    `,
    // Adrian — 고온·고압·타우메바 서식 금성형 두꺼운 대기
    ADRIAN_ATM_FRAG: `
        float hash(vec2 p){return fract(sin(dot(p,vec2(71.9,201.1)))*43758.5453123);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
        }
        varying vec3 vNormal; varying vec3 vWorldPos;
        void main(){
            vec3 n=normalize(vNormal);
            vec3 vd=normalize(cameraPosition-vWorldPos);
            float fr=1.0-max(dot(vd,n),0.0);
            float lon=atan(n.z,n.x),lat=asin(clamp(n.y,-1.,1.));
            float swirl=noise(vec2(lon*3.2,lat*8.2))*0.32;
            float layer1=pow(fr,1.9)*(0.8+swirl);
            float layer2=pow(fr,3.7)*(0.9+swirl*0.6);
            vec3 col=mix(vec3(0.62,0.34,0.08),vec3(0.98,0.71,0.23),smoothstep(0.25,1.0,fr+swirl*0.2));
            col*=(layer1+layer2);
            gl_FragColor=vec4(col, clamp(layer1*0.28+layer2*0.46,0.0,0.80));
        }
    `,
    // Erid — 암모니아 기반 극고압 청록 대기
    ERID_ATM_FRAG: `
        float hash(vec2 p){return fract(sin(dot(p,vec2(119.9,77.3)))*43758.5453123);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
        }
        varying vec3 vNormal; varying vec3 vWorldPos;
        void main(){
            vec3 n=normalize(vNormal);
            vec3 vd=normalize(cameraPosition-vWorldPos);
            float fr=1.0-max(dot(vd,n),0.0);
            float lon=atan(n.z,n.x),lat=asin(clamp(n.y,-1.,1.));
            float turb=noise(vec2(lon*4.0,lat*6.8))*0.24;
            float layer1=pow(fr,2.2)*(0.95+turb);
            float layer2=pow(fr,4.1)*(0.70+turb*0.7);
            vec3 col=mix(vec3(0.07,0.22,0.32),vec3(0.19,0.47,0.56),smoothstep(0.32,1.0,fr+turb*0.2));
            col*=(layer1+layer2);
            gl_FragColor=vec4(col, clamp(layer1*0.26+layer2*0.42,0.0,0.74));
        }
    `,

    // Solar → Tau Ceti → 40 Eridani (삼중성계)
    BODIES: [
        { type:'star',   name:'Sol',      r:2.20, glow:0xff8800,
          core:[1.00,0.95,0.78], mid:[1.00,0.62,0.18], rim:[1.00,0.28,0.05],
          g1:0xffcc33, g2:0xff4400, pos:[ 0.0,  0.0,   0.0] },
        { type:'planet', name:'Mercury',  kind:'rock', r:0.22, color:0x9a8873, glow:0x664c35, rot:0.08, pos:[ 2.6, -0.1,  -3.2] },
        { type:'planet', name:'Venus',    kind:'rock', r:0.34, color:0xd4b16a, glow:0xaa8850, rot:0.05, pos:[ 4.5,  0.2,  -7.5] },
        { type:'planet', name:'Earth',    kind:'earth',r:0.48, color:0x2a70bb, glow:0x55aaee, rot:0.12, pos:[ 6.3, -0.3, -12.5] },
        { type:'planet', name:'Mars',     kind:'rock', r:0.30, color:0xb45c3b, glow:0x883322, rot:0.09, pos:[ 8.1,  0.4, -17.5] },
        { type:'planet', name:'Jupiter',  kind:'gas',  r:0.95, color:0xd8b78a, glow:0xb18a56, rot:0.16, pos:[11.2, -0.5, -24.0] },
        { type:'planet', name:'Saturn',   kind:'gas',  r:0.86, color:0xd7c487, glow:0xa78f58, rot:0.14, pos:[13.8,  0.5, -30.0] },
        { type:'planet', name:'Uranus',   kind:'ice',  r:0.63, color:0x8dc3d2, glow:0x5f8f9e, rot:0.12, pos:[16.4, -0.3, -36.5] },
        { type:'planet', name:'Neptune',  kind:'ice',  r:0.61, color:0x3d63c8, glow:0x2945a0, rot:0.13, pos:[18.9,  0.4, -43.0] },
        { type:'star',   name:'TauCeti',  r:1.68, glow:0xffaa22,
          core:[1.00,0.92,0.72], mid:[1.00,0.72,0.28], rim:[0.95,0.45,0.08],
          g1:0xffbb22, g2:0xff7700, pos:[-1.8,  1.2, -62.0] },
        { type:'planet', name:'Adrian',   kind:'adrian', r:0.52, color:0x0b3020, glow:0x22ee66, rot:0.11, pos:[-2.6,  0.9, -69.5] },
        { type:'planet', name:'Tau Ceti f', kind:'rock', r:0.46, color:0x9f9074, glow:0x6f5b45, rot:0.08, pos:[ 0.9,  0.1, -74.5] },
        { type:'planet', name:'Tau Ceti g', kind:'ice',  r:0.54, color:0x6c92b5, glow:0x4e7595, rot:0.10, pos:[-4.7, -0.3, -80.5] },
        // 40 Eridani 삼중성계
        { type:'star',   name:'40EridA',  r:1.85, glow:0xff5a20,
          core:[1.00,0.82,0.56], mid:[1.00,0.55,0.15], rim:[0.90,0.30,0.05],
          g1:0xff9944, g2:0xff3300, pos:[-2.1,  1.4, -108.0] },
        { type:'star',   name:'40EridB',  r:0.24, glow:0xaaccff,   // 백색왜성
          core:[0.94,0.96,1.00], mid:[0.82,0.90,1.00], rim:[0.70,0.82,0.98],
          g1:0xaabbff, g2:0x7799ff, pos:[-0.9,  2.3, -106.8] },
        { type:'star',   name:'40EridC',  r:0.48, glow:0xff3300,   // 적색왜성
          core:[1.00,0.42,0.12], mid:[0.90,0.25,0.04], rim:[0.70,0.10,0.02],
          g1:0xff4400, g2:0xcc1100, pos:[-3.6,  0.4, -109.5] },
        { type:'planet', name:'Erid',     kind:'erid', r:0.62, color:0x0b0814, glow:0x2244aa, rot:0.12, pos:[ 2.4,  0.2, -116.0] },
    ],

    LABELS: [
        { t:0.00, text:'Sol System' },
        { t:0.08, text:'Inner Rocky Planets' },
        { t:0.20, text:'Gas / Ice Giants' },
        { t:0.34, text:'Solar Escape' },
        { t:0.50, text:'Tau Ceti System' },
        { t:0.60, text:'Tau Ceti e (Adrian)' },
        { t:0.68, text:'Tau Ceti f / g' },
        { t:0.82, text:'40 Eridani Triple Star' },
        { t:0.92, text:'Erid Orbit (40 Eridani A)' },
        { t:0.97, text:'First Contact Zone' },
    ],

    // ── 헬퍼 ─────────────────────────────────────────
    _makeGlow(r, color, opacity) {
        return new THREE.Mesh(
            new THREE.SphereGeometry(r, 24, 24),
            new THREE.MeshBasicMaterial({
                color, transparent:true, opacity,
                blending:THREE.AdditiveBlending, depthWrite:false
            })
        );
    },
    _makeAtmosphere(r, fragShader) {
        return new THREE.Mesh(
            new THREE.SphereGeometry(r, 32, 32),
            new THREE.ShaderMaterial({
                vertexShader:this.ATM_VERT, fragmentShader:fragShader,
                transparent:true, blending:THREE.AdditiveBlending,
                depthWrite:false, side:THREE.BackSide
            })
        );
    },
    _makeGenericPlanetUniforms(kind, colorHex) {
        const c = new THREE.Color(colorHex || 0x888888);
        const a = c.clone().multiplyScalar(0.55);
        const b = c.clone().multiplyScalar(0.95);
        const d = c.clone().lerp(new THREE.Color(0xffffff), 0.35);
        let banding = 4.5;
        let rough = 0.72;
        if (kind === 'gas') { banding = 16.0; rough = 0.45; }
        else if (kind === 'ice') { banding = 9.0; rough = 0.28; }
        return {
            uTime:{value:0},
            uColorA:{value:new THREE.Vector3(a.r,a.g,a.b)},
            uColorB:{value:new THREE.Vector3(b.r,b.g,b.b)},
            uColorC:{value:new THREE.Vector3(d.r,d.g,d.b)},
            uBanding:{value:banding},
            uRough:{value:rough}
        };
    },
    _makeStar(r, core, mid, rim, g1, g2) {
        const uni = {
            uTime: {value:0},
            uCore: {value: new THREE.Vector3(core[0],core[1],core[2])},
            uMid:  {value: new THREE.Vector3(mid[0], mid[1], mid[2])},
            uRim:  {value: new THREE.Vector3(rim[0], rim[1], rim[2])},
        };
        const g = new THREE.Group();
        g.add(new THREE.Mesh(
            new THREE.SphereGeometry(r, 48, 48),
            new THREE.ShaderMaterial({
                uniforms:uni,
                vertexShader:this.STAR_SURF_VERT,
                fragmentShader:this.STAR_SURF_FRAG,
            })
        ));
        g.add(this._makeGlow(r*1.5,  g1, 0.28));
        g.add(this._makeGlow(r*2.5,  g1, 0.12));
        g.add(this._makeGlow(r*5.0,  g2, 0.05));
        return { group:g, uni };
    },

    init(renderer, W, H) {
        this.scene  = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000306);
        this.scene.fog = new THREE.FogExp2(0x000306, 0.004);

        this.camera = new THREE.PerspectiveCamera(68, W/H, 0.1, 600);
        this.camera.position.set(0, 0, 14);

        // 시선 상태 초기화
        this._lookH = this._lookV = this._lookHT = this._lookVT = 0;

        // ── 배경별 파티클 ────────────────────────────
        const SC=6000;
        const sp=new Float32Array(SC*3),sc=new Float32Array(SC*3),sSc=new Float32Array(SC);
        for(let i=0;i<SC;i++){
            sp[i*3]=(Math.random()-0.5)*440; sp[i*3+1]=(Math.random()-0.5)*320;
            sp[i*3+2]=Math.random()*-230-5;
            const rv=Math.random();
            if(rv<0.66) sSc[i]=0.22+Math.random()*0.60;
            else if(rv<0.90) sSc[i]=0.80+Math.random()*1.30;
            else sSc[i]=2.0+Math.random()*2.8;
            const ct=Math.random();
            if(ct<0.55){const b=0.75+Math.random()*0.25;sc[i*3]=b*0.88;sc[i*3+1]=b*0.93;sc[i*3+2]=b;}
            else if(ct<0.78){sc[i*3]=0.95+Math.random()*0.05;sc[i*3+1]=0.82+Math.random()*0.12;sc[i*3+2]=0.35+Math.random()*0.2;}
            else if(ct<0.92){sc[i*3]=1.0;sc[i*3+1]=0.55+Math.random()*0.2;sc[i*3+2]=0.1+Math.random()*0.15;}
            else{sc[i*3]=0.6+Math.random()*0.3;sc[i*3+1]=0.7+Math.random()*0.2;sc[i*3+2]=1.0;}
        }
        this._starGeo=new THREE.BufferGeometry();
        this._starGeo.setAttribute('position',new THREE.BufferAttribute(sp,3));
        this._starGeo.setAttribute('aColor',  new THREE.BufferAttribute(sc,3));
        this._starGeo.setAttribute('aScale',  new THREE.BufferAttribute(sSc,1));
        this._starMat=new THREE.ShaderMaterial({
            uniforms:{uSize:{value:1.9}},
            vertexShader:this.STAR_VERT,fragmentShader:this.STAR_FRAG,
            transparent:true,blending:THREE.AdditiveBlending,depthWrite:false
        });
        this.scene.add(new THREE.Points(this._starGeo,this._starMat));

        // ── 소행성대 ─────────────────────────────────
        const AC=900;
        const ap=new Float32Array(AC*3),ac=new Float32Array(AC*3),as_=new Float32Array(AC);
        for(let i=0;i<600;i++){
            const a=Math.random()*Math.PI*2,r=4+Math.random()*9;
            ap[i*3]=Math.cos(a)*r;ap[i*3+1]=(Math.random()-0.5)*3;
            ap[i*3+2]=-18+Math.sin(a)*r*0.5+(Math.random()-0.5)*10;
            as_[i]=0.3+Math.random()*0.6;
            const g=0.4+Math.random()*0.3;ac[i*3]=g*1.1;ac[i*3+1]=g;ac[i*3+2]=g*0.7;
        }
        for(let i=600;i<900;i++){
            const a=Math.random()*Math.PI*2,r=3+Math.random()*7;
            ap[i*3]=-1.8+Math.cos(a)*r;ap[i*3+1]=1.2+(Math.random()-0.5)*2.5;
            ap[i*3+2]=-50.0+Math.sin(a)*r*0.4+(Math.random()-0.5)*9;
            as_[i]=0.22+Math.random()*0.48;
            const g=0.32+Math.random()*0.22;ac[i*3]=g*1.12;ac[i*3+1]=g*0.92;ac[i*3+2]=g*0.68;
        }
        this._asteroidGeo=new THREE.BufferGeometry();
        this._asteroidGeo.setAttribute('position',new THREE.BufferAttribute(ap,3));
        this._asteroidGeo.setAttribute('aColor',  new THREE.BufferAttribute(ac,3));
        this._asteroidGeo.setAttribute('aScale',  new THREE.BufferAttribute(as_,1));
        this._asteroidMat=new THREE.ShaderMaterial({
            uniforms:{uSize:{value:0.9}},
            vertexShader:this.STAR_VERT,fragmentShader:this.STAR_FRAG,
            transparent:true,blending:THREE.AdditiveBlending,depthWrite:false
        });
        this.scene.add(new THREE.Points(this._asteroidGeo,this._asteroidMat));

        // ── 항성 구체 (모든 star 타입) ───────────────
        this._starObjs=[]; this._starUnis=[];
        this.BODIES.filter(b=>b.type==='star').forEach(b=>{
            const {group,uni}=this._makeStar(b.r,b.core,b.mid,b.rim,b.g1,b.g2);
            group.position.set(...b.pos);
            this.scene.add(group);
            this._starObjs.push(group);
            this._starUnis.push(uni);
        });

        // ── Petrova Flow: 성간 물질 흐름 (항성-항성 직결 아님) ─
        // 항성 자체를 연결하지 않고 성간 공간을 따라 퍼지는 흐름으로 표현
        const PC=3200;
        const pp=new Float32Array(PC*3),pc=new Float32Array(PC*3),ps=new Float32Array(PC);
        const p0 ={x: 1.4, y:-0.8, z:-12.0};
        const p1 ={x:-4.0, y: 1.9, z:-44.0};
        const p2 ={x: 2.8, y:-1.4, z:-83.0};
        const p3 ={x:-5.2, y: 1.0, z:-121.0};
        const FADE_Z=-69.5, FADE_R=10.0;
        const ssFade=x=>{const t=Math.max(0,Math.min(1,Math.abs(x-FADE_Z)/FADE_R));return t*t*(3-2*t);};
        for(let i=0;i<PC;i++){
            const u=i/(PC-1);
            const omt=1.0-u;
            const cx = omt*omt*omt*p0.x + 3.0*omt*omt*u*p1.x + 3.0*omt*u*u*p2.x + u*u*u*p3.x;
            const cy = omt*omt*omt*p0.y + 3.0*omt*omt*u*p1.y + 3.0*omt*u*u*p2.y + u*u*u*p3.y;
            const cz = omt*omt*omt*p0.z + 3.0*omt*omt*u*p1.z + 3.0*omt*u*u*p2.z + u*u*u*p3.z;
            pp[i*3]=cx+(Math.random()-0.5)*0.14;
            pp[i*3+1]=cy+(Math.random()-0.5)*0.14;
            pp[i*3+2]=cz+(Math.random()-0.5)*0.10;
            const dim=0.03+0.97*ssFade(cz);
            const type=Math.random();
            if(type<0.50){pc[i*3]=(0.97+Math.random()*0.03)*dim;pc[i*3+1]=(0.04+Math.random()*0.08)*dim;pc[i*3+2]=(0.48+Math.random()*0.38)*dim;}
            else if(type<0.85){pc[i*3]=(0.94+Math.random()*0.06)*dim;pc[i*3+1]=(0.01+Math.random()*0.05)*dim;pc[i*3+2]=(0.18+Math.random()*0.16)*dim;}
            else{pc[i*3]=1.00*dim;pc[i*3+1]=(0.08+Math.random()*0.10)*dim;pc[i*3+2]=(0.38+Math.random()*0.20)*dim;}
            ps[i]=0.72+Math.random()*1.40;
        }
        this._petroGeo=new THREE.BufferGeometry();
        this._petroGeo.setAttribute('position',new THREE.BufferAttribute(pp,3));
        this._petroGeo.setAttribute('aColor',  new THREE.BufferAttribute(pc,3));
        this._petroGeo.setAttribute('aScale',  new THREE.BufferAttribute(ps,1));
        this._petroMat=new THREE.ShaderMaterial({
            uniforms:{uSize:{value:2.4}},
            vertexShader:this.STAR_VERT,fragmentShader:this.STAR_FRAG,
            transparent:true,blending:THREE.AdditiveBlending,depthWrite:false
        });
        this.scene.add(new THREE.Points(this._petroGeo,this._petroMat));

        // ── 행성 구체 ────────────────────────────────
        this._objects=[]; this._planetUnis=[];
        this.BODIES.filter(b=>b.type==='planet').forEach(b=>{
            let uni={uTime:{value:0}};
            let frag=null, atmFrag=null;
            if(b.kind==='earth'){
                frag=this.EARTH_FRAG; atmFrag=this.EARTH_ATM_FRAG;
            } else if(b.kind==='adrian'){
                frag=this.ADRIAN_FRAG; atmFrag=this.ADRIAN_ATM_FRAG;
            } else if(b.kind==='erid') {
                frag=this.ERID_FRAG;   atmFrag=this.ERID_ATM_FRAG;
            } else {
                frag=this.PLANET_GENERIC_FRAG;
                uni=this._makeGenericPlanetUniforms(b.kind, b.color);
            }
            const g=new THREE.Group();
            g.position.set(...b.pos);
            this._planetUnis.push(uni);
            g.add(new THREE.Mesh(
                new THREE.SphereGeometry(b.r,64,64),
                new THREE.ShaderMaterial({uniforms:uni,vertexShader:this.PLANET_VERT,fragmentShader:frag})
            ));
            if (atmFrag) g.add(this._makeAtmosphere(b.r*1.20, atmFrag));
            g.add(this._makeGlow(b.r*2.8, b.glow, 0.045));
            this.scene.add(g);
            this._objects.push({group:g, rot:b.rot || 0.1, kind:b.kind});
        });

        this.scene.add(new THREE.AmbientLight(0x8888aa, 0.7));
        const dir = new THREE.DirectionalLight(0xfff2de, 0.8);
        dir.position.set(-2, 2, 3);
        this.scene.add(dir);

        // ── 스크롤 ────────────────────────────────────
        this._scroll=0; this._scrollT=0;
        this._label=document.getElementById('transit-label');
        this._onWheel=e=>{this._scrollT=clamp(this._scrollT+e.deltaY*0.0005,0,1);};
        window.addEventListener('wheel',this._onWheel,{passive:true});
        this._touchY=0;
        this._isDragging=false;
        this._onTouchStart=e=>{
            const t=e.touches[0];
            this._touchY=t.clientY;
            this._prevMX=t.clientX;
            this._prevMY=t.clientY;
            this._isDragging=true;
        };
        this._onTouchMove=e=>{
            if (!e.touches.length) return;
            if (e.touches.length > 1) {
                const dy=this._touchY-e.touches[0].clientY;
                this._touchY=e.touches[0].clientY;
                this._scrollT=clamp(this._scrollT+dy*0.003,0,1);
                return;
            }
            const t=e.touches[0];
            const dx=t.clientX-this._prevMX, dy=t.clientY-this._prevMY;
            this._prevMX=t.clientX; this._prevMY=t.clientY;
            this._lookHT=clamp(this._lookHT-dx*0.006,-1.6,1.6);
            this._lookVT=clamp(this._lookVT+dy*0.0045,-0.9,0.9);
        };
        this._onTouchEnd=()=>{this._isDragging=false;};
        window.addEventListener('touchstart',this._onTouchStart,{passive:true});
        window.addEventListener('touchmove', this._onTouchMove, {passive:true});
        window.addEventListener('touchend', this._onTouchEnd, {passive:true});

        // ── 마우스 시선 제어 (클릭 드래그) ─────────────
        this._onMouseDown=e=>{
            if (e.button !== 0) return;
            this._isDragging=true;
            this._prevMX=e.clientX;
            this._prevMY=e.clientY;
        };
        this._onMouseMoveDrag=e=>{
            if(!this._isDragging) return;
            const dx=e.clientX-this._prevMX, dy=e.clientY-this._prevMY;
            this._prevMX=e.clientX; this._prevMY=e.clientY;
            this._lookHT=clamp(this._lookHT-dx*0.006,-1.6,1.6);
            this._lookVT=clamp(this._lookVT+dy*0.0045,-0.9,0.9);
        };
        this._onMouseUp=()=>{this._isDragging=false;};
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mousemove', this._onMouseMoveDrag);
        window.addEventListener('mouseup', this._onMouseUp);
    },

    _getLabel(t){
        let txt=this.LABELS[0].text;
        for(const l of this.LABELS){if(t>=l.t)txt=l.text;}
        return txt;
    },

    tick(elapsed,delta){
        if(!this.scene) return;
        this._scroll=lerp(this._scroll,this._scrollT,0.04);
        const s=this._scroll;

        // 카메라 위치 (스크롤 경로 고정)
        const tz=14-s*136;
        this.camera.position.z=lerp(this.camera.position.z,tz,0.075);
        this.camera.position.x=Math.sin(s*Math.PI*2.8)*2.5 + Math.sin(s*Math.PI*8.0)*0.4;
        this.camera.position.y=Math.sin(s*Math.PI*1.7)*1.6;

        // 시선 보간 (드래그)
        this._lookH=lerp(this._lookH,this._lookHT,0.08);
        this._lookV=lerp(this._lookV,this._lookVT,0.08);

        // lookAt: 기본 전방 + 마우스 오프셋
        const baseX=this.camera.position.x*0.2;
        const baseY=this.camera.position.y*0.2;
        const baseZ=this.camera.position.z-12;
        const LOOK_D=18;
        this.camera.lookAt(
            baseX+Math.sin(this._lookH)*LOOK_D,
            baseY+this._lookV*LOOK_D,
            baseZ
        );

        // 행성 자전
        this._objects.forEach(({group, rot, kind})=>{
            const mult = kind === 'gas' ? 1.25 : 1.0;
            group.rotation.y += (delta||0.016) * rot * mult;
        });

        // 셰이더 시간 업데이트
        if(this._planetUnis) this._planetUnis.forEach(u=>{u.uTime.value=elapsed;});
        if(this._starUnis)   this._starUnis.forEach(u=>{u.uTime.value=elapsed;});

        if(this._label) this._label.textContent=this._getLabel(s);
    },

    onMouseMove(){},

    resize(W,H){
        if(!this.camera) return;
        this.camera.aspect=W/H;
        this.camera.updateProjectionMatrix();
    },

    dispose(){
        if(this._onWheel)      window.removeEventListener('wheel',      this._onWheel);
        if(this._onTouchStart) window.removeEventListener('touchstart', this._onTouchStart);
        if(this._onTouchMove)  window.removeEventListener('touchmove',  this._onTouchMove);
        if(this._onTouchEnd)   window.removeEventListener('touchend',   this._onTouchEnd);
        if(this._onMouseDown)  window.removeEventListener('mousedown',  this._onMouseDown);
        if(this._onMouseMoveDrag) window.removeEventListener('mousemove', this._onMouseMoveDrag);
        if(this._onMouseUp)    window.removeEventListener('mouseup',    this._onMouseUp);

        this._objects.forEach(({group})=>{
            group.children.forEach(c=>{c.geometry.dispose();c.material.dispose();});
        });
        this._starObjs.forEach(g=>{
            g.children.forEach(c=>{c.geometry.dispose();c.material.dispose();});
        });
        if(this._starGeo)     this._starGeo.dispose();
        if(this._starMat)     this._starMat.dispose();
        if(this._asteroidGeo) this._asteroidGeo.dispose();
        if(this._asteroidMat) this._asteroidMat.dispose();
        if(this._petroGeo)    this._petroGeo.dispose();
        if(this._petroMat)    this._petroMat.dispose();
        if(this._label){this._label.textContent='Sol System';}

        this._objects=[]; this._starObjs=[]; this._starUnis=[]; this._planetUnis=null;
        this._starGeo=this._starMat=null;
        this._asteroidGeo=this._asteroidMat=null;
        this._petroGeo=this._petroMat=null;
        this.scene=this.camera=null;
    }
};
