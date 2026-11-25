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
    const mark = new Image();
    const wide = new Image();
    let ready = 0;
    function paintWhenReady() {
        ready += 1;
        if (ready < 2) return;
        const sw = 128;
        function fit(ctx, image, bottom, shrink) {
            const iw = image.naturalWidth || sw;
            const ih = image.naturalHeight || sw;
            const scale = Math.min(sw / iw, sw / ih) * (shrink || 1);
            const dw = iw * scale;
            const dh = ih * scale;
            const y = bottom ? (sw - dh) : (sw - dh) / 2;
            ctx.drawImage(image, (sw - dw) / 2, y, dw, dh);
        }
        function prep(canvas, ratio) {
            canvas.width = sw * ratio;
            canvas.height = sw * ratio;
            canvas.style.width = sw + 'px';
            canvas.style.height = sw + 'px';
            const ctx = canvas.getContext('2d');
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sw, sw);
            return ctx;
        }
        fit(prep(canvas4, 4), mark, false, 0.84);
        const ctx5 = prep(canvas5, 8);
        /* 512: 横ロゴ。下の辺が面の左辺、頭は右 */
        ctx5.setTransform(0, 8, -8, 0, sw * 8, 0);
        ctx5.imageSmoothingEnabled = true;
        ctx5.imageSmoothingQuality = 'high';
        fit(ctx5, wide, true);
    }
    mark.onload = paintWhenReady;
    wide.onload = paintWhenReady;
    mark.src = './assets/demo/DM-0018/logo_face4.jpg?v=1';
    wide.src = './assets/demo/DM-0018/logo_face5.png?v=1';
}
