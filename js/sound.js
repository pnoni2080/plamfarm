// 효과음 — Kenney "Impact Sounds" (CC0, https://kenney.nl/assets/impact-sounds)
// assets/sfx/ 에는 팩에서 고른 파일만 mp3로 변환해 넣는다. 같은 효과에 여러 파일이 있으면 무작위로 골라 덜 단조롭게 한다.
'use strict';

const SFX_FILES = {
  roll:   ['impactWood_light_000', 'impactWood_light_001', 'impactWood_light_002', 'impactWood_light_003', 'impactWood_light_004'],
  land:   ['impactWood_heavy_000', 'impactWood_heavy_001'],
  step:   ['footstep_grass_000', 'footstep_grass_001', 'footstep_grass_002', 'footstep_grass_003', 'footstep_grass_004'],
  gain:   ['impactBell_heavy_001'],
  pay:    ['impactMetal_light_000', 'impactMetal_light_001', 'impactMetal_light_002'],
  buy:    ['impactPlank_medium_000', 'impactPlank_medium_001'],
  build:  ['impactMining_000', 'impactMining_001', 'impactMining_002'],
  card:   ['impactSoft_medium_000', 'impactSoft_medium_001'],
  bad:    ['impactPunch_heavy_000', 'impactPlate_heavy_000'],
  double: ['impactGlass_light_000'],
  win:    ['impactBell_heavy_000', 'impactBell_heavy_002', 'impactBell_heavy_003'],
  click:  ['impactGeneric_light_000', 'impactGeneric_light_001'],
};
const SFX_VOLUME = { roll: .55, land: .8, step: .8, gain: .55, pay: .6, buy: .75, build: .6, card: .45, bad: .55, double: .6, win: .6, click: .2 };
const SFX_MUTE_KEY = 'palmfarm-mute';

const Sound = (() => {
  let ctx = null, loading = null;
  const buffers = {};
  let muted = false;
  try { muted = localStorage.getItem(SFX_MUTE_KEY) === '1'; } catch (e) { /* 저장 불가 */ }

  function load() {
    if (loading) return loading;
    const names = [...new Set(Object.values(SFX_FILES).flat())];
    loading = Promise.all(names.map(n => fetch(`assets/sfx/${n}.mp3`)
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(b => ctx.decodeAudioData(b))
      .then(buf => { buffers[n] = buf; })
      .catch(() => { /* 파일이 없으면 그 소리만 생략 */ })));
    return loading;
  }

  // 태블릿 브라우저는 사용자가 화면을 처음 누른 뒤에만 소리를 낼 수 있다
  function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) { ctx = new AC(); load(); }
    if (ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));

  function play(kind, { delay = 0, rate = 1 } = {}) {
    if (muted || !ctx) return;
    const list = SFX_FILES[kind].filter(n => buffers[n]);
    if (!list.length) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[list[Math.floor(Math.random() * list.length)]];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = SFX_VOLUME[kind] ?? .6;
    src.connect(g).connect(ctx.destination);
    src.start(ctx.currentTime + delay);
  }

  return {
    play,
    win() { play('win'); play('win', { delay: .28, rate: 1.12 }); play('win', { delay: .56, rate: 1.26 }); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(SFX_MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* 저장 불가 */ }
      if (!muted) play('click');
      return muted;
    },
  };
})();
