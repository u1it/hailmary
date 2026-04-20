const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand  = (a, b) => a + Math.random() * (b - a);
const smoothstep = (t) => t * t * (3 - 2 * t);

function disposeScene(scene) {
    scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });
}
