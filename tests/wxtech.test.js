var assert = require('assert');
var fs = require('fs');
var path = require('path');
var wx = require('../services/wxtech/index.js');
var foundation = require('../core/foundation.js');

var NOW = Date.parse('2026-11-04T11:31:00+09:00');

function row(minute, code, prec) {
  var hh = String(Math.floor(minute / 60)).padStart(2, '0');
  var mm = String(minute % 60).padStart(2, '0');
  return { date: '2026-11-04T' + hh + ':' + mm + ':00+09:00', wx: code, prec: prec };
}

function payload(rows) {
  return {
    ok: true,
    fetchedAt: '2026-11-04T11:24:00+09:00',
    freshUntil: '2026-11-04T11:40:00+09:00',
    wxdata: [{ lat: 34.6, lon: 135.47, data: rows }]
  };
}

assert.strictEqual(wx.jstLabels(Date.parse('2026-11-04T10:30:00+09:00')).dateLabel, '11/4（水）');
assert.strictEqual(wx.jstLabels(Date.parse('2026-11-04T10:30:00+09:00')).timeLabel, '10:30');

var model = wx.normalize(payload([
  row(11 * 60 + 30, 100, 0),
  row(11 * 60 + 35, -9999, 1.2),
  row(11 * 60 + 20, 200, 0)
]), NOW);
assert.strictEqual(model.ok, true);
assert.strictEqual(model.slots.length, 2);
assert.strictEqual(model.slots[0].timeLabel, '11:30');
assert.strictEqual(model.slots[0].wxName, '晴れ');
assert.strictEqual(model.slots[0].precLabel, '0mm');
assert.strictEqual(model.slots[1].wxOk, false);
assert.strictEqual(model.slots[1].precOk, true);
assert.strictEqual(model.slots[1].precLabel, '1.2mm');
assert.strictEqual(model.fetchedTimeLabel, '11:24');
assert.notStrictEqual(model.fetchedTimeLabel, model.slots[0].timeLabel);

var failed = wx.normalize({ ok: false, fetchedAt: '2026-11-04T11:24:00+09:00', wxdata: [{ data: [row(11 * 60 + 30, 100, 0)] }] }, NOW);
assert.strictEqual(failed.ok, false);
assert.strictEqual(failed.slots.length, 0);

var stale = wx.normalize(Object.assign(payload([row(11 * 60 + 30, 100, 0)]), {
  freshUntil: '2026-11-04T11:20:00+09:00'
}), NOW);
assert.strictEqual(stale.ok, true);
assert.strictEqual(stale.slots.length, 1);
assert.strictEqual(stale.slots[0].timeLabel, '11:30');

var held = wx.normalize(payload([row(10 * 60, 100, 0)]), NOW);
assert.strictEqual(held.ok, true);
assert.strictEqual(held.reason, 'held');
assert.strictEqual(held.slots.length, 1);
assert.strictEqual(held.slots[0].timeLabel, '10:00');

var heldLast = wx.normalize(payload([
  row(10 * 60, 100, 0),
  row(10 * 60 + 5, 200, 0),
  row(10 * 60 + 10, 200, 0),
  row(10 * 60 + 15, 600, 0),
  row(10 * 60 + 20, 100, 0),
  row(10 * 60 + 30, -9999, 0)
]), NOW);
assert.strictEqual(heldLast.reason, 'held');
assert.strictEqual(heldLast.slots.length, 4);
assert.strictEqual(heldLast.slots[0].timeLabel, '10:05');
assert.strictEqual(heldLast.slots[3].timeLabel, '10:20');
assert.strictEqual(heldLast.slots[3].wxOk, true);

var expired = wx.normalize(payload([row(4 * 60, 100, 0)]), NOW);
assert.strictEqual(expired.ok, false);
assert.strictEqual(expired.reason, 'expired');
assert.strictEqual(expired.slots.length, 0);

var unknown = wx.normalize(payload([row(11 * 60 + 30, 999, -9999)]), NOW);
assert.strictEqual(unknown.slots[0].wxOk, false);
assert.strictEqual(unknown.slots[0].precOk, false);

var demo = require('../demo/DM-0008.json');
assert.strictEqual(demo.projectId, 'DM-0008');
assert.strictEqual(demo.status, 'demo');
assert.strictEqual(demo.contents['short-forecast'].on, true);
assert.deepStrictEqual(demo.contentOrder, ['short-forecast']);
assert.strictEqual(demo.contents.forecast.on, false);
assert.strictEqual(demo.contents.temperature.on, false);
assert.strictEqual(demo.contents.clock.on, false);
assert.strictEqual(demo.contents.warning.on, false);
assert.strictEqual(demo.presentation.shortForecastLaps, 1);
assert.strictEqual(demo.wxtech.snapshot, './assets/demo/DM-0008/wxtech-latest.json');
assert.strictEqual(foundation.isContentOn(require('../demo/DM-0001.json'), 'short-forecast'), false);

var page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var relay = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'wxtech-preview.js'), 'utf8');
var client = fs.readFileSync(path.join(__dirname, '..', 'contents', 'short-forecast', 'index.js'), 'utf8');
var workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'wxtech-dm0008.yml'), 'utf8');
assert.strictEqual(page.indexOf('X-API-Key'), -1);
assert.strictEqual(page.indexOf('WXTECH_API_KEY'), -1);
assert.strictEqual(client.indexOf('X-API-Key'), -1);
assert.strictEqual(client.indexOf('WXTECH_API_KEY'), -1);
assert.ok(client.indexOf('wxtech.snapshot') >= 0);
assert.ok(client.indexOf('取得できません') >= 0);
assert.ok(page.indexOf('ac-dm0008') >= 0);
assert.ok(page.indexOf('20261112-wxtech-face2') >= 0);
assert.strictEqual(client.indexOf('">取得不可<'), -1);

var short = require('../contents/short-forecast/index.js');
assert.deepStrictEqual(short.pageStarts(0), []);
assert.deepStrictEqual(short.pageStarts(3), [0, 1, 2]);
assert.deepStrictEqual(short.pageStarts(8), [0, 1, 2, 3, 4, 5, 6, 7]);
assert.ok(relay.indexOf('process.env.WXTECH_API_KEY') >= 0);
assert.strictEqual(relay.indexOf('tpf.weathernews.jp'), -1);
assert.ok(workflow.indexOf('secrets.WXTECH_API_KEY') >= 0);
assert.strictEqual(workflow.indexOf('wxtech.weathernews.com'), -1);

console.log('wxtech tests ok');
