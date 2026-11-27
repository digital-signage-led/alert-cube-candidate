/* ニッケン（DM-0004）。face-384-512 の写し。本番の startDm14Card_ は書き換えない。 */
/** 384は下から上。512は右から左。中身はどちらも 180。カードは気象の白い数値。 */
function startDm04Card_() {
    const track = document.getElementById('dm14-card-track');
    const trackX = document.getElementById('dm14-card-track-x');
    const rotor = document.getElementById('dm14-card-rotor');
    if (!track || !trackX || !rotor || startDm04Card_.on) return;
    startDm04Card_.on = true;
    const cell = function (inner) {
        return '<div class="dm14-card-cell">' + inner + '</div>';
    };
    const wxOrder = ['weather', 'temp', 'rain', 'wdir', 'wind', 'gust', 'humi', 'pres', 'tmaxmin'];
    const wxOn = scene2TypesOn_();
    const types = wxOrder.filter(function (type) { return wxOn.indexOf(type) >= 0; });
    if (!types.length) types.push('temp', 'rain');
    const cells = types.map(function (type) { return cell(scene2PanelHtml_(type)); });
    const seq = cells.concat(cells, cells);
    track.innerHTML = seq.join('');
    trackX.innerHTML = seq.join('');
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
/** 4面目と5面目は緑の地。512は下の辺が左、頭は右。 */
function startDm04CornerScroll_() {
    if (startDm04CornerScroll_.on) return;
    const canvas4 = document.getElementById('dm14-face4-canvas');
    const canvas5 = document.getElementById('dm14-face5-canvas');
    if (!canvas4 || !canvas5) return;
    const site = typeof siteCfg_ === 'function' ? siteCfg_() : null;
    if (!site || site.projectId !== 'DM-0004') return;
    startDm04CornerScroll_.on = true;
    if (typeof markDisplayReady_ === 'function') markDisplayReady_();
    startDm04Card_();
    const band = ((site.presentation || {}).brand || {}).body || '#8CB808';
    [canvas4, canvas5].forEach(function (canvas) {
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = band;
        ctx.fillRect(0, 0, 128, 128);
    });
}
