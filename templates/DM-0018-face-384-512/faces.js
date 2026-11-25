/* ノバック（DM-0018）。face-384-512 の写し。本番の startDm14Card_ は書き換えない。 */
/** 384は下から上。512は右から左。中身はどちらも 180。384の上を出た項目が右から入る。 */
function startDm18Card_() {
    const track = document.getElementById('dm14-card-track');
    const trackX = document.getElementById('dm14-card-track-x');
    const rotor = document.getElementById('dm14-card-rotor');
    if (!track || !trackX || !rotor || startDm18Card_.on) return;
    startDm18Card_.on = true;
    const cell = function (inner) {
        return '<div class="dm14-card-cell">' + inner + '</div>';
    };
    const wxOrder = ['weather', 'temp', 'rain', 'wdir', 'wind', 'gust', 'humi', 'pres', 'tmaxmin'];
    const wxOn = scene2TypesOn_();
    const types = wxOrder.filter(function (type) { return wxOn.indexOf(type) >= 0; });
    if (!types.length) types.push('weather');
    const cells = types.map(function (type) { return cell(scene2PanelHtml_(type)); });
    const logo4 = cell('<div class="dm18-logo-card"><img class="dm18-scroll-logo" src="./assets/demo/DM-0018/logo_face4.jpg?v=1" alt=""></div>');
    const logo5 = cell('<div class="dm18-logo-card"><img class="dm18-scroll-logo" src="./assets/demo/DM-0018/logo_face5.png?v=1" alt=""></div>');
    const seq4 = cells.concat(logo4);
    const seq5 = cells.concat(logo5);
    track.innerHTML = seq4.concat(seq4, seq4).join('');
    trackX.innerHTML = seq5.concat(seq5, seq5).join('');
    const cellH = 128;
    const setH = (track.children.length / 3) * cellH;
    const cards = [track, trackX];
    let seam = setH * 2;
    function sync() {
        types.forEach(function (type) {
            const src = document.querySelector('#scene2 [data-s2="' + type + '"] .s2-body');
            if (!src) return;
            const html = src.innerHTML;
            cards.forEach(function (root) {
                root.querySelectorAll('[data-s2="' + type + '"] .s2-body').forEach(function (dst) {
                    if (dst.innerHTML !== html) dst.innerHTML = html;
                });
            });
        });
    }
    function place() {
        const s = Math.round(seam * 100) / 100;
        track.style.transform = 'translate3d(0,' + (-(s + 128)) + 'px,0)';
        rotor.style.transform = 'translate3d(' + (-s) + 'px,128px,0) rotate(-90deg)';
    }
    function frame() {
        sync();
        seam += getScrollSpeedPx_();
        if (seam >= setH * 2) seam -= setH;
        place();
        requestAnimationFrame(frame);
    }
    place();
    requestAnimationFrame(frame);
}
/** 壁紙は縦。背景の下は512の128。下を左の辺に付け、頭は右。384の上側は正立。背景は動かさない。 */
function startDm18CornerScroll_() {
    if (startDm18CornerScroll_.on) return;
    const canvas4 = document.getElementById('dm14-face4-canvas');
    const canvas5 = document.getElementById('dm14-face5-canvas');
    if (!canvas4 || !canvas5) return;
    const site = typeof siteCfg_ === 'function' ? siteCfg_() : null;
    if (!site || site.projectId !== 'DM-0018') return;
    startDm18CornerScroll_.on = true;
    startDm18Card_();
    if (typeof markDisplayReady_ === 'function') markDisplayReady_();
    [canvas4, canvas5].forEach(function (canvas) {
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 128, 128);
    });
}
