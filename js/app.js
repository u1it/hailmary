(() => {
    // ─── 로딩 화면 ─────────────────────────────
    const loadingScreen = document.getElementById('loading-screen');
    const loadingFill   = document.getElementById('loading-fill');
    let   loadTarget    = 0;

    function setLoad(pct) {
        loadTarget = Math.max(loadTarget, pct);
        loadingFill.style.width = loadTarget + '%';
    }

    setLoad(70); // 스크립트 로드 완료

    function hideLoader() {
        setLoad(100);
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => { loadingScreen.style.display = 'none'; }, 650);
        }, 280);
    }

    if (document.readyState === 'complete') {
        hideLoader();
    } else {
        window.addEventListener('load', hideLoader, { once: true });
    }

    // ─── 렌더러 ───────────────────────────────
    const canvas   = document.getElementById('main-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // const MODULES    = [Tab1, Tab2, Tab3, Tab4];
    const MODULES    = [Tab1, Tab2, Tab3];
    // const OVERLAY_IDS= ['view-tab0','view-tab1','view-tab2','view-tab3'];
    const OVERLAY_IDS= ['view-tab0','view-tab1','view-tab2'];

    let current  = null;
    const mouse  = { sx: 0, sy: 0, nx: 0, ny: 0 };
    let cursorRX = window.innerWidth / 2, cursorRY = window.innerHeight / 2;
    mouse.sx = cursorRX; mouse.sy = cursorRY;

    // ─── 힌트 자동 숨김 ──────────────────────
    const allHints = document.querySelectorAll('.hint');
    let hintTimer  = null;

    function showHints() {
        allHints.forEach(h => h.classList.remove('hint-hidden'));
    }
    function hideHints() {
        allHints.forEach(h => h.classList.add('hint-hidden'));
    }
    function onUserAction() {
        hideHints();
        clearTimeout(hintTimer);
        hintTimer = setTimeout(showHints, 3000);
    }

    document.addEventListener('mousemove',  onUserAction);
    document.addEventListener('wheel',      onUserAction, { passive: true });
    document.addEventListener('touchstart', onUserAction, { passive: true });
    document.addEventListener('touchmove',  onUserAction, { passive: true });

    // ─── 탭 전환 ──────────────────────────────
    function switchTo(module, overlayId) {
        if (current && current.dispose) current.dispose();

        document.querySelectorAll('.view-overlay').forEach(el => el.classList.remove('active'));
        document.getElementById(overlayId).classList.add('active');

        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        const idx = MODULES.indexOf(module);
        if (idx >= 0) document.querySelectorAll('.tab-btn')[idx].classList.add('active');

        // 탭 전환 시 힌트 초기화
        clearTimeout(hintTimer);
        showHints();

        current = module;
        current.init(renderer, window.innerWidth, window.innerHeight);
    }

    // ─── 네비게이션 이벤트 ─────────────────────
    document.getElementById('btn-home').addEventListener('click', () => {
        switchTo(Home, 'view-home');
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    });

    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        btn.addEventListener('click', () => switchTo(MODULES[i], OVERLAY_IDS[i]));
    });

    // ─── 마우스 ───────────────────────────────
    document.addEventListener('mousemove', e => {
        mouse.sx = e.clientX;
        mouse.sy = e.clientY;
        mouse.nx = (e.clientX / window.innerWidth)  *  2 - 1;
        mouse.ny = (e.clientY / window.innerHeight) * -2 + 1;
        if (current && current.onMouseMove) current.onMouseMove(mouse.nx, mouse.ny);
    });

    // ─── 터치 (모바일) ────────────────────────
    function applyTouch(clientX, clientY) {
        mouse.sx = clientX;
        mouse.sy = clientY;
        mouse.nx = (clientX / window.innerWidth)  *  2 - 1;
        mouse.ny = (clientY / window.innerHeight) * -2 + 1;
        if (current && current.onMouseMove) current.onMouseMove(mouse.nx, mouse.ny);
    }
    document.addEventListener('touchstart', e => {
        applyTouch(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchmove', e => {
        applyTouch(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    // ─── 리사이즈 ─────────────────────────────
    window.addEventListener('resize', () => {
        const W = window.innerWidth, H = window.innerHeight;
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        if (current && current.resize) current.resize(W, H);
    });

    // ─── 커서 ─────────────────────────────────
    const cursorDot  = document.getElementById('cursor-dot');
    const cursorRing = document.getElementById('cursor-ring');

    // ─── 애니메이션 루프 ──────────────────────
    let lastTime = 0;
    function animate(time) {
        requestAnimationFrame(animate);
        const elapsed = time * 0.001;
        const delta   = Math.min(elapsed - lastTime, 0.05);
        lastTime = elapsed;

        if (current && current.scene && current.camera) {
            current.tick(elapsed, delta);
            renderer.render(current.scene, current.camera);
        }

        // 커서 링 지연
        cursorRX = lerp(cursorRX, mouse.sx, 0.12);
        cursorRY = lerp(cursorRY, mouse.sy, 0.12);
        cursorDot.style.left  = `${mouse.sx}px`;
        cursorDot.style.top   = `${mouse.sy}px`;
        cursorRing.style.left = `${cursorRX}px`;
        cursorRing.style.top  = `${cursorRY}px`;
    }

    // ─── Contact 토글 ─────────────────────────
    const contactBtn   = document.getElementById('contact-btn');
    const contactPanel = document.getElementById('contact-panel');
    contactBtn.addEventListener('click', () => {
        const open = contactPanel.classList.toggle('open');
        contactBtn.classList.toggle('open', open);
    });
    document.addEventListener('click', e => {
        if (!contactBtn.contains(e.target) && !contactPanel.contains(e.target)) {
            contactPanel.classList.remove('open');
            contactBtn.classList.remove('open');
        }
    });

    // ─── 시작 ─────────────────────────────────
    switchTo(Home, 'view-home');
    requestAnimationFrame(animate);
})();
