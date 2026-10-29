// 팜팜 — 한 화면에서 함께 하는 태블릿용 보드게임
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STOP = Symbol('game-over');
const SAVE_KEY = 'palmfarm-save-v1';

let G = null;

// ───────────────────────── 유틸 ─────────────────────────
function won(n) {
  const neg = n < 0; n = Math.abs(Math.round(n));
  const man = Math.floor(n / MAN), rest = n % MAN;
  let s = '';
  if (man) s += man.toLocaleString('ko-KR') + '만';
  if (rest) s += (rest % 1000 === 0 ? rest / 1000 + '천' : rest.toLocaleString('ko-KR'));
  if (!s) s = '0';
  return (neg ? '-' : '') + s + '원';
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function d6() { return 1 + Math.floor(Math.random() * 6); }
const cur = () => G.players[G.turn];
const byId = id => G.players.find(p => p.id === id);
const alive = () => G.players.filter(p => !p.bankrupt);
const ownedFarms = p => Object.keys(FARMS).filter(id => G.farms[id].owner === p.id);
const farmValue = id => FARMS[id].price + FARMS[id].build.slice(0, G.farms[id].level).reduce((a, b) => a + b, 0);
const rentOf = id => FARMS[id].rent[G.farms[id].level] * (G.farms[id].drone ? 2 : 1);
const buildCap = p => Math.min(p.laps, 3);
const lapLabel = p => `${p.laps + 1}바퀴째`;
const avatar = (p, cls = '') => `<img class="ava ${cls}" src="assets/icons/${p.avatar}.png" alt="" style="--pc:${p.color}">`;
const pname = p => `<b class="pn" style="--pc:${p.color}">${esc(p.name)}</b>`;

function log(msg, p) {
  G.log.unshift({ msg, color: p ? p.color : null });
  if (G.log.length > 80) G.log.length = 80;
  renderLog();
}

function toast(msg, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// ───────────────────────── 모달 ─────────────────────────
function openModal(html, cls = '') {
  const back = document.createElement('div');
  back.className = 'backdrop';
  back.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  $('#modalRoot').appendChild(back);
  requestAnimationFrame(() => back.classList.add('in'));
  return back;
}
function closeModal(back) { back.classList.remove('in'); setTimeout(() => back.remove(), 160); }

// choices: [{label, value, kind, disabled, sub}]
function ask({ title, body = '', img = null, imgCls = '', who = null, choices = [{ label: '확인', value: true, kind: 'primary' }], cls = '' }) {
  return new Promise(resolve => {
    const head = who ? `<div class="modal-who">${avatar(who)}${pname(who)}<span>${lapLabel(who)} · ${won(who.cash)}</span></div>` : '';
    const html = `
      ${head}
      <div class="modal-body ${img ? 'has-img' : ''}">
        ${img ? `<img class="modal-img ${imgCls}" src="${img}" alt="">` : ''}
        <div class="modal-text">
          ${title ? `<h2>${title}</h2>` : ''}
          <div class="modal-copy">${body}</div>
        </div>
      </div>
      <div class="modal-actions">${choices.map((c, i) => `
        <button class="btn ${c.kind || 'ghost'}" data-i="${i}" ${c.disabled ? 'disabled' : ''}>
          <span>${c.label}</span>${c.sub ? `<small>${c.sub}</small>` : ''}
        </button>`).join('')}
      </div>`;
    const back = openModal(html, cls);
    const im = back.querySelector('.modal-img');
    if (im) im.addEventListener('click', () => im.classList.toggle('zoom'));
    back.querySelectorAll('.modal-actions .btn').forEach(b => b.addEventListener('click', () => {
      Sound.play('click');
      closeModal(back);
      resolve(choices[+b.dataset.i].value);
    }));
  });
}
const info = (title, body, extra = {}) => ask({ title, body, ...extra });

function chooseMany({ title, body, options, who }) {
  return new Promise(resolve => {
    const chosen = new Set();
    const head = who ? `<div class="modal-who">${avatar(who)}${pname(who)}</div>` : '';
    const back = openModal(`
      ${head}
      <div class="modal-body"><div class="modal-text"><h2>${title}</h2><div class="modal-copy">${body}</div></div></div>
      <div class="toggle-grid">${options.map((o, i) => `
        <button class="toggle" data-i="${i}" ${o.disabled ? 'disabled' : ''} style="--pc:${o.color || 'var(--ink)'}">
          ${o.icon || ''}<span>${o.label}</span>${o.sub ? `<small>${o.sub}</small>` : ''}
        </button>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn primary" data-done>결정하기</button></div>`);
    back.querySelectorAll('.toggle').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (chosen.has(i)) chosen.delete(i); else chosen.add(i);
      b.classList.toggle('on', chosen.has(i));
    }));
    back.querySelector('[data-done]').addEventListener('click', () => {
      closeModal(back);
      resolve([...chosen].map(i => options[i].value));
    });
  });
}

// 다른 친구들이 보면 안 되는 화면(레시피)
async function privateView(p, renderBody, title = '레시피 확인') {
  const go = await ask({
    who: p, title: `${esc(p.name)}만 보세요`,
    body: `<p>다른 친구들은 잠깐 눈을 감아 주세요. ${pname(p)} 준비가 되면 아래 버튼을 누르세요.</p>`,
    choices: [{ label: '내가 볼게요', value: true, kind: 'primary' }, { label: '나중에', value: false }],
    cls: 'secret',
  });
  if (!go) return;
  await ask({ who: p, title, body: renderBody(p), choices: [{ label: '다 봤어요 · 가리기', value: true, kind: 'primary' }], cls: 'secret wide' });
}

function recipeHtml(p) {
  const r = RECIPES[p.recipe];
  const items = r.foods.map(id => {
    const have = G.farms[id].owner === p.id;
    return `<li class="${have ? 'have' : ''}"><img src="assets/icons/${id}.png" alt="">${FARMS[id].name}<span>${have ? '확보' : won(FARMS[id].price)}</span></li>`;
  });
  const sp = p.specials.includes(r.special);
  items.push(`<li class="${sp ? 'have' : ''}"><img src="assets/icons/${r.special}.png" alt="">${SPECIALS[r.special].name}<span>${sp ? '확보' : '로컬푸드매장'}</span></li>`);
  if (r.salt) items.push(`<li class="${p.salt ? 'have' : ''}"><img src="assets/icons/salt.png" alt="">소금<span>${p.salt ? '확보' : '염전'}</span></li>`);
  return `<div class="recipe-view"><img class="recipe-card" src="assets/recipes/${p.recipe}.jpg" alt="${r.name} 레시피차트">
    <div><h3>${r.name}</h3><ul class="checklist">${items.join('')}</ul>
    <p class="hint">재료를 모두 모으면 바로 "푸드독점!"으로 승리합니다.</p></div></div>`;
}

// ───────────────────────── 말판 그리기 ─────────────────────────
const EDGE = 0.0175, CORNER = 0.157, CELL = (1 - 2 * CORNER) / 9;
function sqRect(i) {
  const D = CORNER - EDGE;
  if (i === 0) return { x: 1 - CORNER, y: 1 - CORNER, w: D, h: D, side: 'corner' };
  if (i === 10) return { x: EDGE, y: 1 - CORNER, w: D, h: D, side: 'corner' };
  if (i === 20) return { x: EDGE, y: EDGE, w: D, h: D, side: 'corner' };
  if (i === 30) return { x: 1 - CORNER, y: EDGE, w: D, h: D, side: 'corner' };
  if (i < 10) return { x: 1 - CORNER - i * CELL, y: 1 - CORNER, w: CELL, h: D, side: 'bottom' };
  if (i < 20) return { x: EDGE, y: 1 - CORNER - (i - 10) * CELL, w: D, h: CELL, side: 'left' };
  if (i < 30) return { x: CORNER + (i - 21) * CELL, y: EDGE, w: CELL, h: D, side: 'top' };
  return { x: 1 - CORNER, y: CORNER + (i - 31) * CELL, w: D, h: CELL, side: 'right' };
}
const pct = v => (v * 100).toFixed(3) + '%';

function buildBoard() {
  const sq = $('#squares');
  sq.innerHTML = BOARD.map((s, i) => {
    const r = sqRect(i);
    return `<button class="sq side-${r.side}" data-i="${i}" style="left:${pct(r.x)};top:${pct(r.y)};width:${pct(r.w)};height:${pct(r.h)}"
      aria-label="${s.t === 'farm' ? FARMS[s.id].name : s.name}"><span class="strip"></span><span class="badge"></span></button>`;
  }).join('');
  sq.addEventListener('click', e => {
    const b = e.target.closest('.sq'); if (!b) return;
    const i = +b.dataset.i;
    if (G.picking) { G.picking(i); return; }
    if (G.phase !== 'busy') showSquareInfo(i);
  });
}

function renderBoard() {
  document.querySelectorAll('#squares .sq').forEach(b => {
    const i = +b.dataset.i, s = BOARD[i];
    const strip = b.querySelector('.strip'), badge = b.querySelector('.badge');
    let owner = null, html = '', badgeTxt = '';
    if (s.t === 'farm') {
      const st = G.farms[s.id];
      owner = st.owner !== null ? byId(st.owner) : null;
      if (owner && st.level) html = `<img src="assets/icons/${FACILITY_ICON[st.level]}.png" alt="${FACILITY[st.level]}">`;
      if (st.drone) badgeTxt = '×2';
      if (st.inMarket) badgeTxt = '장터';
    } else if (s.t === 'expo' && G.expoOwner !== null) { owner = byId(G.expoOwner); html = '<i>개최</i>'; }
    else if (s.t === 'salt' && G.saltOwner !== null) { owner = byId(G.saltOwner); html = '<i>지분</i>'; }
    else if (s.t === 'center' && G.fund > 0) badgeTxt = won(G.fund);
    b.classList.toggle('owned', !!owner);
    b.style.setProperty('--oc', owner ? owner.color : 'transparent');
    strip.innerHTML = html;
    badge.textContent = badgeTxt;
    badge.hidden = !badgeTxt;
    b.classList.toggle('pickable', !!G.picking && i !== cur().pos);
  });
  // 말(청년농업인)
  const tk = $('#tokens');
  if (!tk.children.length) tk.innerHTML = G.players.map(p => `<img class="token" data-p="${p.id}" src="assets/icons/${p.avatar}.png" alt="${esc(p.name)}" style="--pc:${p.color}">`).join('');
  const at = {};
  G.players.forEach(p => { if (!p.bankrupt) (at[p.pos] = at[p.pos] || []).push(p); });
  const OFF = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  G.players.forEach(p => {
    const el = tk.querySelector(`[data-p="${p.id}"]`);
    el.hidden = p.bankrupt;
    if (p.bankrupt) return;
    const group = at[p.pos], k = group.indexOf(p), r = sqRect(p.pos);
    const off = group.length === 1 ? OFF[0] : OFF[k + 1];
    const s = Math.min(r.w, r.h) * 0.24;
    el.style.left = pct(r.x + r.w / 2 + off[0] * s);
    el.style.top = pct(r.y + r.h / 2 + off[1] * s);
    el.classList.toggle('active', p === cur() && G.phase !== 'over');
  });
}

// ───────────────────────── 패널 ─────────────────────────
function renderPanel() {
  const p = cur();
  $('#fundAmt').textContent = won(G.fund);
  const mk = Object.keys(FARMS).filter(id => G.farms[id].inMarket);
  $('#marketList').innerHTML = mk.length ? mk.map(id => `<span class="chip"><img src="assets/icons/${id}.png" alt="">${FARMS[id].name} ${won(farmValue(id))}</span>`).join('') : '<span class="muted">없음</span>';

  $('#players').innerHTML = G.players.map(q => {
    const farms = ownedFarms(q);
    const tags = [];
    if (q.jail) tags.push(`<span class="tag warn">자연재해 ${q.jail}회</span>`);
    if (q.freeMove) tags.push('<span class="tag">자유 이동</span>');
    if (q.loan) tags.push(`<span class="tag warn">대출 ${won(q.loan.amount)} · ${q.loan.dueLap + 1}바퀴째 전 상환</span>`);
    const n13 = q.keep.filter(c => c === 13 || c === 25).length;
    if (n13) tags.push(`<span class="tag good">우대권${n13 > 1 ? ' ×' + n13 : ''}</span>`);
    if (q.keep.includes(3)) tags.push('<span class="tag good">기청제</span>');
    if (G.expoOwner === q.id) tags.push('<span class="tag">박람회 개최자</span>');
    if (G.saltOwner === q.id) tags.push('<span class="tag">염전 지분</span>');
    const goods = [...q.specials.map(k => `<img src="assets/icons/${k}.png" alt="${SPECIALS[k].name}" title="${SPECIALS[k].name}">`),
      q.salt ? '<img src="assets/icons/salt.png" alt="소금" title="소금">' : ''].join('');
    return `<li class="pl ${q === p && G.phase !== 'over' ? 'turn' : ''} ${q.bankrupt ? 'out' : ''}" style="--pc:${q.color}">
      <div class="pl-head">${avatar(q)}<div class="pl-name"><b>${esc(q.name)}</b><small>${q.bankrupt ? '파산' : lapLabel(q)}</small></div>
        <div class="pl-cash">${won(q.cash)}</div>
        <button class="mini" data-recipe="${q.id}" ${q.bankrupt ? 'disabled' : ''}>레시피</button></div>
      ${farms.length || goods ? `<div class="pl-farms">${farms.map(id => `<img src="assets/icons/${id}.png" alt="${FARMS[id].name}" title="${FARMS[id].name} ${FACILITY[G.farms[id].level]}" class="lv${G.farms[id].level}">`).join('')}${goods ? `<span class="goods">${goods}</span>` : ''}</div>` : ''}
      ${tags.length ? `<div class="pl-tags">${tags.join('')}</div>` : ''}
    </li>`;
  }).join('');

  if (G.endsAt) {
    const left = Math.max(0, G.endsAt - Date.now());
    $('#timer').hidden = false;
    $('#timer').textContent = `남은 시간 ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  } else $('#timer').hidden = true;
}

function renderLog() {
  const el = $('#log'); if (!el) return;
  el.innerHTML = G.log.slice(0, 40).map(l => `<li style="--pc:${l.color || 'var(--muted)'}">${l.msg}</li>`).join('');
}

function renderStage() {
  const st = $('#stage');
  if (G.phase === 'over') { st.querySelector('.stage-who').innerHTML = '게임 끝'; $('#stageBtns').innerHTML = '<button class="btn primary" data-act="new">새 게임</button>'; return; }
  const p = cur();
  st.style.setProperty('--pc', p.color);
  st.querySelector('.stage-who').innerHTML = `${avatar(p)}<span>${esc(p.name)} 차례</span><small>${lapLabel(p)}</small>`;
  $('#stageMsg').innerHTML = G.msg || '';
  let btns = '';
  if (G.phase === 'idle') {
    if (p.freeMove) btns = '<button class="btn primary big" data-act="free">원하는 칸 고르기</button>';
    else if (p.jail > 0) {
      btns = `<button class="btn primary big" data-act="jail">탈출 주사위 (${p.jail}번 남음)</button>`;
      if (p.keep.includes(3)) btns += '<button class="btn ghost" data-act="prayer">기청제 카드 쓰기</button>';
    } else btns = `<button class="btn primary big" data-act="roll">${G.extraPending ? '한 번 더 굴리기' : '주사위 굴리기'}</button>`;
    btns += '<button class="btn ghost" data-act="manage">농장 관리 · 대출</button>';
  }
  $('#stageBtns').innerHTML = btns;
}

function render() { renderBoard(); renderPanel(); renderStage(); }

// ───────────────────────── 주사위 ─────────────────────────
function setDie(el, v) { el.dataset.v = v; }
async function rollDice() {
  const [d1, d2] = [$('#die1'), $('#die2')];
  const a = d6(), b = d6();
  d1.classList.add('rolling'); d2.classList.add('rolling');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let k = 0; k < (reduce ? 1 : 9); k++) { setDie(d1, d6()); setDie(d2, d6()); if (k % 2 === 0) Sound.play('roll'); await sleep(65); }
  d1.classList.remove('rolling'); d2.classList.remove('rolling');
  setDie(d1, a); setDie(d2, b);
  Sound.play('land');
  if (a === b) Sound.play('double', { delay: .15 });
  await sleep(250);
  return [a, b];
}

// ───────────────────────── 이동 ─────────────────────────
async function moveSteps(p, n, opt = {}) {
  const dir = n < 0 ? -1 : 1;
  for (let k = 0; k < Math.abs(n); k++) {
    p.pos = (p.pos + dir + 40) % 40;
    renderBoard();
    Sound.play('step');
    await sleep(Math.abs(n) > 12 ? 70 : 150);
    if (dir > 0 && p.pos === 0) {
      if (opt.salary === false) log(`${pname(p)} 태풍 때문에 농촌지원금을 받지 못했어요.`, p);
      else await passStart(p);
      if (p.bankrupt) return;
    }
    if (opt.collectFund && p.pos === 20 && k < Math.abs(n) - 1) collectFund(p);
  }
}
async function moveTo(p, target, opt = {}) {
  const n = (target - p.pos + 40) % 40;
  await moveSteps(p, n, opt);
}
async function passStart(p) {
  p.laps++;
  p.cash += SALARY;
  Sound.play('gain');
  log(`${pname(p)} 출발지를 지나 농촌지원금 ${won(SALARY)}을 받았어요. (${lapLabel(p)})`, p);
  toast(`${esc(p.name)} 농촌지원금 +${won(SALARY)}`);
  renderPanel();
  if (p.loan && p.laps >= p.loan.dueLap) {
    await info('대출 상환 기한', `<p>대출받은 지 3바퀴가 지났어요. 대출금 <b>${won(p.loan.amount)}</b>을 지금 갚아야 합니다.</p>`, { who: p });
    const amt = p.loan.amount;
    if (await pay(p, amt, 'bank', '대출 상환')) p.loan = null;
  }
}
function collectFund(p) {
  if (G.fund > 0) {
    log(`${pname(p)} 농업기술센터에서 기금 ${won(G.fund)}을 받았어요.`, p);
    toast(`${esc(p.name)} 기금 +${won(G.fund)}`);
    p.cash += G.fund; G.fund = 0;
    Sound.play('gain');
  } else log(`${pname(p)} 농업기술센터에 도착했지만 모인 기금이 없어요.`, p);
  render();
}

// ───────────────────────── 돈 ─────────────────────────
function credit(to, amount) {
  if (to === 'fund') G.fund += amount;
  else if (to && to !== 'bank') to.cash += amount;
}
async function pay(p, amount, to, reason) {
  if (amount <= 0) return true;
  if (p.cash < amount) {
    const ok = await manage(p, { need: amount, reason });
    if (!ok) { await goBankrupt(p, to, reason); return false; }
  }
  p.cash -= amount;
  credit(to, amount);
  Sound.play('pay');
  const dest = to === 'fund' ? '농촌발전기금' : to === 'bank' ? '은행' : pname(to);
  log(`${pname(p)} ${reason} ${won(amount)} → ${dest}`, p);
  render();
  return true;
}

async function goBankrupt(p, to, reason) {
  if (to && to !== 'bank' && to !== 'fund') { to.cash += p.cash; }
  p.cash = 0;
  p.bankrupt = true;
  Sound.play('bad');
  ownedFarms(p).forEach(id => Object.assign(G.farms[id], { owner: null, level: 0, drone: false }));
  if (G.expoOwner === p.id) G.expoOwner = null;
  if (G.saltOwner === p.id) G.saltOwner = null;
  p.keep.forEach(c => G.deck.push(c)); p.keep = [];
  p.jail = 0; p.freeMove = false; p.loan = null;
  log(`${pname(p)} ${reason}을(를) 낼 수 없어 파산했어요.`, p);
  render();
  await info('파산', `<p>${pname(p)} 더 이상 낼 돈이 없어 <b>파산</b>했습니다. 가지고 있던 농장은 은행으로 돌아갑니다.</p>`, { who: p });
  await checkWin();
}

// 농장 관리: 시설·농장 팔기, 대출, 상환. need가 있으면 부족한 돈을 마련하는 화면
function manage(p, { need = 0, reason = '' } = {}) {
  return new Promise(resolve => {
    const back = openModal('<div class="mg"></div>', 'wide');
    const box = back.querySelector('.mg');
    const draw = () => {
      const farms = ownedFarms(p).sort((a, b) => farmValue(b) - farmValue(a));
      const canLoan = !p.loanUsed;
      const sellable = farms.length > 0 || canLoan;
      const short = Math.max(0, need - p.cash);
      const buyers = alive().filter(q => q !== p && q.cash >= 20 * MAN);
      box.innerHTML = `
        <div class="modal-who">${avatar(p)}${pname(p)}<span>${lapLabel(p)} · 가진 돈 <b>${won(p.cash)}</b></span></div>
        <h2>${need ? '돈이 부족해요' : '농장 관리 · 대출'}</h2>
        ${need ? `<p class="alert">${reason} <b>${won(need)}</b>을(를) 내야 해요. <b>${won(short)}</b>이 더 필요합니다. 농장이나 시설을 은행에 팔거나 대출을 받으세요.</p>` : '<p class="muted">은행에 팔면 산 값(증서 + 지은 시설 비용)을 그대로 돌려받아요.</p>'}
        <ul class="mg-list">${farms.map(id => {
          const st = G.farms[id], f = FARMS[id];
          return `<li><img src="assets/icons/${id}.png" alt=""><div><b>${f.name}</b><small>${FACILITY[st.level]}${st.drone ? ' · 드론 ×2' : ''} · 가치 ${won(farmValue(id))}</small></div>
            ${st.level ? `<button class="mini" data-sellfac="${id}">${FACILITY[st.level]} 팔기 +${won(f.build[st.level - 1])}</button>` : ''}
            <button class="mini" data-sellfarm="${id}">농장 팔기 +${won(farmValue(id))}</button></li>`;
        }).join('') || '<li class="muted">가진 농장이 없어요.</li>'}</ul>
        <div class="mg-row">
          ${canLoan ? `<span>대출(게임 중 1번, 3바퀴 안에 상환)</span>${[20, 50, 100].map(v => `<button class="mini" data-loan="${v}">${v}만원 빌리기</button>`).join('')}`
            : p.loan ? `<span>대출 ${won(p.loan.amount)} · ${p.loan.dueLap + 1}바퀴째 전 상환</span>${!need ? `<button class="mini" data-repay ${p.cash < p.loan.amount ? 'disabled' : ''}>지금 갚기</button>` : ''}`
            : '<span class="muted">대출은 이미 사용했어요.</span>'}
        </div>
        ${!need && p.keep.includes(3) && buyers.length ? `<div class="mg-row"><span>기청제 카드를 20만원에 팔기</span>${buyers.map(q => `<button class="mini" data-prayer="${q.id}">${esc(q.name)}에게</button>`).join('')}</div>` : ''}
        <div class="modal-actions">
          ${need ? `<button class="btn primary" data-pay ${p.cash < need ? 'disabled' : ''}>${won(need)} 내기</button>
                    ${!sellable && p.cash < need ? '<button class="btn danger" data-bankrupt>파산 선언</button>' : ''}`
                 : '<button class="btn primary" data-close>닫기</button>'}
        </div>`;
    };
    draw();
    box.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      const d = t.dataset;
      if (d.sellfac) {
        const st = G.farms[d.sellfac], cost = FARMS[d.sellfac].build[st.level - 1];
        log(`${pname(p)} ${FARMS[d.sellfac].name} 농장의 ${FACILITY[st.level]}을(를) 은행에 팔았어요. +${won(cost)}`, p);
        p.cash += cost; st.level--;
      } else if (d.sellfarm) {
        const v = farmValue(d.sellfarm);
        p.cash += v; Object.assign(G.farms[d.sellfarm], { owner: null, level: 0, drone: false });
        log(`${pname(p)} ${FARMS[d.sellfarm].name} 농장을 은행에 팔았어요. +${won(v)}`, p);
      } else if (d.loan) {
        const amt = +d.loan * MAN;
        p.cash += amt; p.loanUsed = true; p.loan = { amount: amt, dueLap: p.laps + 3 };
        log(`${pname(p)} 은행에서 ${won(amt)}을 대출받았어요.`, p);
      } else if ('repay' in d) {
        p.cash -= p.loan.amount; log(`${pname(p)} 대출 ${won(p.loan.amount)}을 갚았어요.`, p); p.loan = null;
      } else if (d.prayer) {
        const q = byId(+d.prayer);
        q.cash -= 20 * MAN; p.cash += 20 * MAN;
        p.keep.splice(p.keep.indexOf(3), 1); q.keep.push(3);
        log(`${pname(p)} 기청제 카드를 ${pname(q)}에게 20만원에 팔았어요.`, p);
      } else if ('pay' in d) { closeModal(back); resolve(true); return; }
      else if ('bankrupt' in d) { closeModal(back); resolve(false); return; }
      else if ('close' in d) { closeModal(back); resolve(true); return; }
      render(); draw();
    });
  });
}

// ───────────────────────── 승리 ─────────────────────────
function recipeDone(p) {
  const r = RECIPES[p.recipe];
  return r.foods.every(id => G.farms[id].owner === p.id) && p.specials.includes(r.special) && (!r.salt || p.salt);
}
function recipeCount(p) { return RECIPES[p.recipe].foods.filter(id => G.farms[id].owner === p.id).length; }
function totalAssets(p) {
  return p.cash + ownedFarms(p).reduce((s, id) => s + farmValue(id), 0)
    + (G.expoOwner === p.id ? EXPO_PRICE : 0) + (G.saltOwner === p.id ? SALT_FARM_PRICE : 0) - (p.loan ? p.loan.amount : 0);
}

async function checkWin() {
  if (G.over) throw STOP;
  const live = alive();
  if (live.length === 1) return victory(live[0], '파산 승리', '다른 친구들이 모두 파산했어요.');
  for (const p of live) {
    if (recipeDone(p)) return victory(p, '푸드독점!', `레시피 <b>${RECIPES[p.recipe].name}</b>의 재료를 모두 모아 요리를 완성했어요.`);
    const line = LINES.find(l => l.farms.every(id => G.farms[id].owner === p.id));
    if (line) return victory(p, '라인독점!', `말판 ${line.name}의 농장 6곳을 모두 가졌어요.`);
    const edu = ownedFarms(p).filter(id => G.farms[id].level === 3);
    if (edu.length >= 3) return victory(p, '교육농장독점!', `교육농장을 3곳(${edu.map(id => FARMS[id].name).join(', ')})에 세웠어요.`);
  }
}

async function victory(p, kind, why, ranking = '') {
  G.over = true; G.phase = 'over';
  clearSave();
  Sound.win();
  log(`🏆 ${pname(p)} ${kind}`, p);
  render();
  const reveal = G.players.map(q => `<li style="--pc:${q.color}">${avatar(q)}<b>${esc(q.name)}</b><span>${RECIPES[q.recipe].name} · 재료 ${recipeCount(q)}/5 · 재산 ${won(totalAssets(q))}</span></li>`).join('');
  ask({
    cls: 'victory', title: '', choices: [{ label: '새 게임', value: 'new', kind: 'primary' }, { label: '말판 보기', value: 'board' }],
    body: `<div class="win-burst" style="--pc:${p.color}">${avatar(p, 'big')}<div class="win-kind">${kind}</div><div class="win-name">${esc(p.name)} 승리</div><p>${why}</p></div>
      ${ranking}<h3>모두의 레시피 공개</h3><ul class="reveal">${reveal}</ul>`,
  }).then(v => { if (v === 'new') location.reload(); });
  throw STOP;
}

async function timeUp() {
  const ranked = alive().sort((a, b) => recipeCount(b) - recipeCount(a) || totalAssets(b) - totalAssets(a));
  const w = ranked[0];
  const tie = ranked[1] && recipeCount(ranked[1]) === recipeCount(w);
  await victory(w, '시간 종료', `레시피 재료 푸드카드를 가장 많이(${recipeCount(w)}장) 모았어요.${tie ? ' 같은 수라서 재산과 시설이 더 많은 쪽이 이겼어요.' : ''}`,
    `<ol class="rank">${ranked.map(q => `<li>${esc(q.name)} — 재료 ${recipeCount(q)}장 · 재산 ${won(totalAssets(q))}</li>`).join('')}</ol>`);
}

// ───────────────────────── 칸 정보 ─────────────────────────
function farmTable(id) {
  const f = FARMS[id], st = G.farms[id];
  return `<table class="ftable"><thead><tr><th></th><th>시설 설립</th><th>견학요금</th></tr></thead><tbody>
    ${FACILITY.map((n, lv) => `<tr class="${st.level === lv && st.owner !== null ? 'now' : ''}"><th>${n}</th><td>${lv ? won(f.build[lv - 1]) : '–'}</td><td>${won(f.rent[lv] * (st.drone ? 2 : 1))}</td></tr>`).join('')}
  </tbody></table>`;
}
const SPECIAL_IMG = { expo: 'expo', salt: 'saltfarm', local: 'localfood', heritage: 'heritage' };
const SQUARE_HELP = {
  start: `출발지를 지날 때마다 농촌지원금 ${won(SALARY)}을 받아요.`,
  chance: '찬스카드를 한 장 뽑아 지시대로 해요.',
  expo: `처음 도착한 사람이 임대료 ${won(EXPO_PRICE)}을 내고 박람회를 개최할 수 있어요. 그 뒤로 도착하는 사람은 참가비 ${won(EXPO_FEE)}을 개최자에게 내요. 팔거나 인수할 수 없어요.`,
  disaster: '도착하면 3번 동안 움직일 수 없어요. 차례마다 주사위를 굴려 더블이 나오면 탈출해서 나온 수만큼 이동해요.',
  market: '가진 푸드카드 한 장을 반드시 경매에 내놓아야 해요. 사고 싶은 사람이 여럿이면 주사위로 우선권을 정하고, 아무도 없으면 은행이 사서 장터에 내놓아요.',
  center: `농촌발전기금 칸에서 모인 기금을 모두 받아요. 지금 모인 기금: ${'{fund}'}`,
  heritage: `카드를 10초 동안 보고 국가중요농업유산 3곳을 말해요. 성공하면 장려금 ${won(HERITAGE_PRIZE)}, 실패하면 견학비 ${won(HERITAGE_PRIZE)}을 내요.`,
  local: `특수재료 한 가지를 ${won(SPECIAL_PRICE)}에 살 수 있어요. 사면 다음 차례에 주사위 없이 원하는 칸으로 이동해요.`,
  salt: `처음 산 사람만 ${won(SALT_FARM_PRICE)}에 염전 지분을 가질 수 있어요(소금 포함). 다른 사람은 소금을 ${won(SALT_PRICE)}에 살 수 있어요.`,
  fund: `${won(FUND_DONATION)}을 농업기술센터에 기부해요. 기부금은 누가 농업기술센터에 갈 때까지 쌓여요.`,
};
function showSquareInfo(i) {
  const s = BOARD[i];
  if (s.t === 'farm') {
    const f = FARMS[s.id], st = G.farms[s.id], o = st.owner !== null ? byId(st.owner) : null;
    const state = st.inMarket ? '직거래장터에 나와 있어요.' : o ? `${pname(o)}의 농장 · ${FACILITY[st.level]}${st.drone ? ' · 드론 견학료 2배' : ''}` : '아직 주인이 없어요.';
    return info(`${f.name} <small>${f.en}</small>`, `<p class="season">제철 ${f.season} · 증서 ${won(f.price)}</p><p>${state}</p>${farmTable(s.id)}`, { img: `assets/cards/${s.id}.jpg`, imgCls: 'card' });
  }
  const body = `<p>${SQUARE_HELP[s.t].replace('{fund}', won(G.fund))}</p>`;
  return info(s.name, body, SPECIAL_IMG[s.t] ? { img: `assets/specials/${SPECIAL_IMG[s.t]}.jpg`, imgCls: 'card' } : {});
}

// ───────────────────────── 칸 도착 ─────────────────────────
async function land(p) {
  if (p.bankrupt) return;
  const s = BOARD[p.pos];
  G.msg = `${esc(p.name)} → ${s.t === 'farm' ? FARMS[s.id].name : s.name}`;
  renderStage();
  switch (s.t) {
    case 'farm': await landFarm(p, s.id); break;
    case 'chance': await drawChance(p); break;
    case 'expo': await landExpo(p); break;
    case 'salt': await landSalt(p); break;
    case 'disaster':
      p.jail = 3; G.extra = false;
      Sound.play('bad');
      log(`${pname(p)} 자연재해 칸에 도착해 3번 동안 움직일 수 없어요.`, p);
      await info('자연재해', '<p>3번 동안 움직일 수 없어요. 내 차례마다 주사위를 굴려 <b>더블</b>이 나오면 탈출하고, 나온 수만큼 이동합니다.</p>', { who: p });
      break;
    case 'market': await landMarket(p); break;
    case 'center': collectFund(p); break;
    case 'fund': await pay(p, FUND_DONATION, 'fund', '농촌발전기금 기부'); break;
    case 'heritage': await landHeritage(p); break;
    case 'local': await landLocal(p); break;
    case 'start': break;
  }
  render();
  await checkWin();
}

async function usePass(p, where) {
  const i = p.keep.findIndex(c => c === 13 || c === 25);
  if (i < 0) return false;
  const use = await ask({ who: p, title: '우대권을 쓸까요?', body: `<p>${where}에 견학비용 없이 머무를 수 있어요. 쓰고 나면 찬스카드함으로 돌아갑니다.</p>`,
    choices: [{ label: '우대권 쓰기', value: true, kind: 'primary' }, { label: '그냥 낼게요', value: false }] });
  if (!use) return false;
  G.deck.push(p.keep.splice(i, 1)[0]);
  log(`${pname(p)} 우대권을 써서 ${where} 견학비를 내지 않았어요.`, p);
  render();
  return true;
}

async function landFarm(p, id, opt = {}) {
  const f = FARMS[id], st = G.farms[id], img = `assets/cards/${id}.jpg`;
  if (st.inMarket) {
    await info(`${f.name} 농장`, '<p>이 농장의 푸드카드는 지금 <b>직거래장터</b>에 나와 있어요. 직거래장터 칸에 도착해야 살 수 있어요.</p>', { who: p, img, imgCls: 'card' });
    return;
  }
  if (st.owner === null) {
    const buy = await ask({
      who: p, img, imgCls: 'card', title: `${f.name} 농장`,
      body: `<p class="season">제철 ${f.season}</p><p>주인이 없는 농장이에요. 푸드카드(증서)를 <b>${won(f.price)}</b>에 살 수 있어요.</p>${p.laps === 0 ? '<p class="hint">첫 바퀴에는 증서만 살 수 있고, 시설은 두 번째 바퀴부터 지을 수 있어요.</p>' : ''}${farmTable(id)}`,
      choices: [{ label: `${won(f.price)}에 사기`, value: true, kind: 'primary', disabled: p.cash < f.price, sub: p.cash < f.price ? '돈이 부족해요' : '' }, { label: '사지 않기', value: false }],
    });
    if (!buy) return;
    p.cash -= f.price; st.owner = p.id;
    Sound.play('buy');
    log(`${pname(p)} ${f.name} 푸드카드를 ${won(f.price)}에 샀어요.`, p);
    render();
    await checkWin();
    await offerBuild(p, id);
  } else if (st.owner === p.id) {
    await offerBuild(p, id, true);
  } else {
    const o = byId(st.owner);
    if (opt.festival) {
      if (await usePass(p, '딸기축제')) return;
      await pay(p, 25 * MAN, o, '딸기축제 참가비');
      return;
    }
    const rent = rentOf(id);
    await info(`${f.name} 농장 견학`, `<p>${pname(o)}의 ${f.name} 농장(${FACILITY[st.level]})이에요. 견학요금 <b>${won(rent)}</b>을 내야 해요.${st.drone ? ' (드론 신기술로 2배)' : ''}</p>`, { who: p, img, imgCls: 'card' });
    if (!(await usePass(p, `${f.name} 농장`))) {
      if (!(await pay(p, rent, o, `${f.name} 농장 견학료`))) return;
    }
    const v = farmValue(id);
    const take = await ask({
      who: p, title: `${f.name} 농장을 인수할까요?`,
      body: `<p>${pname(o)}에게 <b>${won(v)}</b>(증서${st.level ? ' + 시설' : ''} 값)을 주고 이 농장을 가져올 수 있어요.</p>`,
      choices: [{ label: `${won(v)}에 인수하기`, value: true, kind: 'primary', disabled: p.cash < v, sub: p.cash < v ? '돈이 부족해요' : '' }, { label: '인수하지 않기', value: false }],
    });
    if (!take) return;
    p.cash -= v; o.cash += v; st.owner = p.id; st.drone = false;
    Sound.play('buy');
    log(`${pname(p)} ${pname(o)}의 ${f.name} 농장을 ${won(v)}에 인수했어요.`, p);
    render();
    await checkWin();
    await offerBuild(p, id);
  }
}

async function offerBuild(p, id, ownVisit = false) {
  const f = FARMS[id], st = G.farms[id];
  while (st.level < 3) {
    const next = st.level + 1;
    if (next > buildCap(p)) {
      if (ownVisit || p.laps > 0) toast(`${FACILITY[next]}은(는) ${next + 1}바퀴째부터 지을 수 있어요.`);
      return;
    }
    const cost = f.build[next - 1];
    const yes = await ask({
      who: p, title: `${f.name} 농장에 ${FACILITY[next]} 짓기`,
      body: `<div class="build-row"><img src="assets/icons/${FACILITY_ICON[next]}.png" alt=""><p>설립 비용 <b>${won(cost)}</b><br>지으면 견학요금이 <b>${won(f.rent[next] * (st.drone ? 2 : 1))}</b>이 돼요.</p></div>
        <p class="hint">밭 → 가공시설 → 교육농장 순서로 지어요. 2바퀴째 밭, 3바퀴째 가공시설, 4바퀴째부터 교육농장.</p>`,
      choices: [{ label: `${FACILITY[next]} 짓기`, value: true, kind: 'primary', disabled: p.cash < cost, sub: p.cash < cost ? '돈이 부족해요' : won(cost) }, { label: '안 짓기', value: false }],
    });
    if (!yes) return;
    p.cash -= cost; st.level = next;
    Sound.play('build');
    log(`${pname(p)} ${f.name} 농장에 ${FACILITY[next]}을(를) 지었어요. (${won(cost)})`, p);
    render();
    await checkWin();
  }
}

async function landExpo(p) {
  const img = 'assets/specials/expo.jpg';
  if (G.expoOwner === null) {
    const yes = await ask({ who: p, img, imgCls: 'card', title: '농업기술박람회',
      body: `<p>아직 개최자가 없어요. 임대료 <b>${won(EXPO_PRICE)}</b>을 은행에 내고 박람회를 개최할 수 있어요. 이후 이 칸에 오는 친구들은 참가비 ${won(EXPO_FEE)}을 나에게 냅니다.</p><p class="hint">시설은 지을 필요가 없고, 팔거나 다른 사람에게 넘길 수 없어요.</p>`,
      choices: [{ label: '박람회 개최하기', value: true, kind: 'primary', disabled: p.cash < EXPO_PRICE, sub: won(EXPO_PRICE) }, { label: '지나가기', value: false }] });
    if (!yes) return;
    p.cash -= EXPO_PRICE; G.expoOwner = p.id;
    Sound.play('buy');
    log(`${pname(p)} 농업기술박람회를 개최했어요. (${won(EXPO_PRICE)})`, p);
  } else if (G.expoOwner !== p.id) {
    const o = byId(G.expoOwner);
    await info('농업기술박람회 참가', `<p>${pname(o)}가 개최한 박람회에 참가해요. 참가비 <b>${won(EXPO_FEE)}</b>을 냅니다.</p>`, { who: p, img, imgCls: 'card' });
    if (await usePass(p, '농업기술박람회')) return;
    await pay(p, EXPO_FEE, o, '박람회 참가비');
  } else toast('내가 개최한 박람회예요.');
}

function giveSalt(p) {
  if (p.salt || G.stock.salt <= 0) return false;
  p.salt = true; G.stock.salt--; return true;
}
async function landSalt(p) {
  const img = 'assets/specials/saltfarm.jpg';
  const saltLeft = G.stock.salt > 0;
  if (G.saltOwner === null) {
    const v = await ask({ who: p, img, imgCls: 'card', title: '염전(소금)',
      body: `<p>염전의 주인이 없어요.</p><ul class="opts"><li>염전 지분 <b>${won(SALT_FARM_PRICE)}</b> — 소금도 함께 얻고, 이후 다른 친구가 소금을 살 때 판매비 ${won(SALT_PRICE)}을 받아요.</li><li>소금만 사기 <b>${won(SALT_PRICE)}</b> — 은행에 냅니다.</li></ul>${p.salt ? '<p class="hint">이미 소금을 가지고 있어요.</p>' : ''}`,
      choices: [
        { label: '염전 지분 사기', value: 'farm', kind: 'primary', disabled: p.cash < SALT_FARM_PRICE, sub: won(SALT_FARM_PRICE) },
        { label: '소금만 사기', value: 'salt', disabled: p.salt || !saltLeft || p.cash < SALT_PRICE, sub: saltLeft ? won(SALT_PRICE) : '소금이 다 떨어졌어요' },
        { label: '지나가기', value: null }] });
    if (v) Sound.play('buy');
    if (v === 'farm') {
      p.cash -= SALT_FARM_PRICE; G.saltOwner = p.id; giveSalt(p);
      log(`${pname(p)} 염전 지분을 ${won(SALT_FARM_PRICE)}에 샀어요.`, p);
    } else if (v === 'salt') {
      p.cash -= SALT_PRICE; giveSalt(p);
      log(`${pname(p)} 소금을 ${won(SALT_PRICE)}에 샀어요.`, p);
    }
  } else if (G.saltOwner !== p.id) {
    const o = byId(G.saltOwner);
    if (p.salt) { toast('이미 소금을 가지고 있어요.'); return; }
    if (!saltLeft) { toast('소금이 다 떨어졌어요.'); return; }
    const yes = await ask({ who: p, img, imgCls: 'card', title: '염전(소금)',
      body: `<p>${pname(o)}의 염전이에요. 소금을 <b>${won(SALT_PRICE)}</b>에 살 수 있어요. 레시피에 소금이 필요한지 생각해 보세요.</p>`,
      choices: [{ label: '소금 사기', value: true, kind: 'primary', disabled: p.cash < SALT_PRICE, sub: won(SALT_PRICE) }, { label: '사지 않기', value: false }] });
    if (!yes) return;
    p.cash -= SALT_PRICE; o.cash += SALT_PRICE; giveSalt(p);
    Sound.play('buy');
    log(`${pname(p)} ${pname(o)}의 염전에서 소금을 ${won(SALT_PRICE)}에 샀어요.`, p);
  } else if (giveSalt(p)) log(`${pname(p)} 내 염전에서 소금을 얻었어요.`, p);
}

async function landLocal(p) {
  const opts = Object.keys(SPECIALS).map(k => ({
    label: `<img src="assets/icons/${k}.png" alt="">${SPECIALS[k].name}`, value: k,
    disabled: G.stock[k] <= 0 || p.cash < SPECIAL_PRICE || p.specials.includes(k),
    sub: p.specials.includes(k) ? '가지고 있어요' : G.stock[k] <= 0 ? '품절' : `남은 ${G.stock[k]}개`,
  }));
  const k = await ask({ who: p, title: '로컬푸드매장', cls: 'wide shop',
    body: `<p>로컬푸드는 장거리 운송을 거치지 않은 지역 농산물이에요. 이동거리를 줄여 신선도를 높입니다.</p><p>특수재료 <b>한 가지</b>를 <b>${won(SPECIAL_PRICE)}</b>에 살 수 있어요. 사면 <b>다음 차례에 주사위 없이 원하는 칸으로 이동</b>할 수 있어요.</p>`,
    choices: [...opts, { label: '사지 않기', value: null }] });
  if (!k) return;
  p.cash -= SPECIAL_PRICE; G.stock[k]--; p.specials.push(k); p.freeMove = true;
  Sound.play('buy');
  log(`${pname(p)} 로컬푸드매장에서 ${SPECIALS[k].name}을(를) 샀어요. 다음 차례에 원하는 칸으로 갈 수 있어요.`, p);
}

async function landHeritage(p) {
  const ok = await new Promise(resolve => {
    const back = openModal(`
      <div class="modal-who">${avatar(p)}${pname(p)}<span>국가중요농업유산 퀴즈</span></div>
      <div class="hq"><div class="hq-ready"><h2>국가중요농업유산</h2><p>카드를 <b>10초</b> 동안 보고 외운 뒤, 유산 <b>3곳</b>을 친구들에게 말해요.<br>성공하면 장려금 ${won(HERITAGE_PRIZE)}, 실패하면 견학비 ${won(HERITAGE_PRIZE)}을 은행에 내요.</p>
        <div class="modal-actions"><button class="btn primary" data-go>카드 보기 시작</button></div></div></div>`, 'wide');
    const box = back.querySelector('.hq');
    box.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if ('go' in t.dataset) {
        box.innerHTML = `<div class="hq-timer"><span id="hqSec">10</span>초</div><img class="hq-img" src="assets/specials/heritage.jpg" alt="국가중요농업유산 지도">`;
        for (let s = 10; s > 0; s--) { $('#hqSec').textContent = s; await sleep(1000); }
        box.innerHTML = `<div class="hq-ready"><h2>카드를 가렸어요!</h2><p>기억나는 국가중요농업유산 <b>3곳</b>을 친구들에게 말해 보세요. 다 말했으면 정답을 확인해요.</p>
          <div class="modal-actions"><button class="btn primary" data-ans>정답 확인하기</button></div></div>`;
      } else if ('ans' in t.dataset) {
        box.innerHTML = `<div class="hq-ready"><h2>정답 목록</h2><ol class="heritage">${HERITAGE.map(h => `<li>${h}</li>`).join('')}</ol>
          <p>친구들이 판정해 주세요. 3곳 모두 맞았나요?</p>
          <div class="modal-actions"><button class="btn primary" data-ok>성공 +${won(HERITAGE_PRIZE)}</button><button class="btn danger" data-no>실패 −${won(HERITAGE_PRIZE)}</button></div></div>`;
      } else if ('ok' in t.dataset) { closeModal(back); resolve(true); }
      else if ('no' in t.dataset) { closeModal(back); resolve(false); }
    });
  });
  if (ok) { p.cash += HERITAGE_PRIZE; Sound.play('gain'); log(`${pname(p)} 국가중요농업유산 3곳을 맞혀 장려금 ${won(HERITAGE_PRIZE)}을 받았어요.`, p); }
  else await pay(p, HERITAGE_PRIZE, 'bank', '국가중요농업유산 견학비');
}

async function landMarket(p) {
  // 1) 장터에 나온 카드 사기
  const onSale = Object.keys(FARMS).filter(id => G.farms[id].inMarket);
  if (onSale.length) {
    const id = await ask({ who: p, title: '직거래장터 매물', cls: 'wide shop',
      body: '<p>장터에 나와 있는 푸드카드를 살 수 있어요. (시설이 있으면 시설 값도 함께)</p>',
      choices: [...onSale.map(id => ({ label: `<img src="assets/icons/${id}.png" alt="">${FARMS[id].name}`, value: id, disabled: p.cash < farmValue(id), sub: `${FACILITY[G.farms[id].level]} · ${won(farmValue(id))}` })), { label: '사지 않기', value: null }] });
    if (id) {
      const v = farmValue(id);
      p.cash -= v; Object.assign(G.farms[id], { owner: p.id, inMarket: false });
      Sound.play('buy');
      log(`${pname(p)} 직거래장터에서 ${FARMS[id].name} 카드를 ${won(v)}에 샀어요.`, p);
      render();
      await checkWin();
    }
  }
  // 2) 내 카드 한 장 경매
  const mine = ownedFarms(p);
  if (!mine.length) { await info('직거래장터', '<p>경매에 내놓을 푸드카드가 없어요.</p>', { who: p }); return; }
  const id = await ask({ who: p, title: '직거래장터 경매', cls: 'wide shop',
    body: '<p>가진 푸드카드 중 <b>한 장을 반드시</b> 경매에 내놓아야 해요. 시설이 있으면 시설도 함께 경매합니다. 어떤 카드를 낼까요?</p>',
    choices: mine.map(id => ({ label: `<img src="assets/icons/${id}.png" alt="">${FARMS[id].name}`, value: id, sub: `${FACILITY[G.farms[id].level]} · ${won(farmValue(id))}` })) });
  const f = FARMS[id], v = farmValue(id);
  const others = alive().filter(q => q !== p);
  const wants = await chooseMany({
    who: p, title: `${f.name} 카드 경매 · ${won(v)}`,
    body: `<p>${pname(p)}의 ${f.name}(${FACILITY[G.farms[id].level]}) 카드를 <b>${won(v)}</b>에 사고 싶은 친구는 이름을 눌러 주세요. 여럿이면 주사위로 우선권을 정해요. 아무도 없으면 은행이 사서 장터에 내놓아요.</p>`,
    options: others.map(q => ({ label: esc(q.name), value: q.id, color: q.color, icon: avatar(q), disabled: q.cash < v, sub: q.cash < v ? '돈이 부족해요' : won(q.cash) })),
  });
  let winner = null;
  if (wants.length === 1) winner = byId(wants[0]);
  else if (wants.length > 1) winner = await diceOff(wants.map(byId), `${f.name} 카드 우선권`);
  if (winner) {
    winner.cash -= v; p.cash += v;
    Sound.play('buy');
    Object.assign(G.farms[id], { owner: winner.id, drone: false });
    log(`${pname(winner)} 경매에서 ${pname(p)}의 ${f.name} 카드를 ${won(v)}에 샀어요.`, winner);
  } else {
    p.cash += v;
    Object.assign(G.farms[id], { owner: null, inMarket: true, drone: false });
    log(`${f.name} 카드를 사려는 사람이 없어 은행이 ${won(v)}에 사서 장터에 내놓았어요.`, p);
  }
  render();
  await checkWin();
}

async function diceOff(players, title) {
  let pool = players;
  for (;;) {
    const rolls = pool.map(q => ({ q, a: d6(), b: d6() }));
    const best = Math.max(...rolls.map(r => r.a + r.b));
    const top = rolls.filter(r => r.a + r.b === best);
    await ask({ title, body: `<ul class="dice-off">${rolls.map(r => `<li class="${r.a + r.b === best ? 'best' : ''}" style="--pc:${r.q.color}">${avatar(r.q)}<b>${esc(r.q.name)}</b><span>${r.a} + ${r.b} = ${r.a + r.b}</span></li>`).join('')}</ul>${top.length > 1 ? '<p>같은 수가 나왔어요. 다시 굴립니다.</p>' : ''}`,
      choices: [{ label: top.length > 1 ? '다시 굴리기' : `${esc(top[0].q.name)} 우선권`, value: true, kind: 'primary' }] });
    if (top.length === 1) return top[0].q;
    pool = top.map(r => r.q);
  }
}

// ───────────────────────── 찬스카드 ─────────────────────────
function chanceHtml(id) {
  const c = CHANCE[id];
  return `<div class="chance-card"><div class="cc-inner"><div class="cc-no">${String(id).padStart(2, '0')}</div><div class="cc-title">${c.title}</div>
    <p class="cc-text">${c.text}</p><p class="cc-act">▶ ${c.act}</p></div></div>`;
}
const facilityFee = p => ownedFarms(p).reduce((s, id) => s + [0, 3, 5, 8][G.farms[id].level] * MAN, 0);

async function drawChance(p) {
  const id = G.deck.shift();
  const c = CHANCE[id];
  Sound.play('card');
  await ask({ who: p, title: '', body: chanceHtml(id), cls: 'chance', choices: [{ label: '카드대로 하기', value: true, kind: 'primary' }] });
  log(`${pname(p)} 찬스카드 「${c.title}」`, p);
  if (c.keep) { p.keep.push(id); toast(`${c.title} 카드를 보관했어요.`); render(); return; }
  G.deck.push(id);
  if (c.lap2 && p.laps < 1) { toast('첫 바퀴라서 이 카드는 효력이 없어요.'); log('첫 바퀴라서 효력이 없어요.', p); return; }
  switch (id) {
    case 1: await pay(p, 5 * MAN, 'bank', '병해충 방제비'); break;
    case 7: await pay(p, 5 * MAN, 'bank', 'PLS 범칙금'); break;
    case 8: await pay(p, 10 * MAN, 'bank', '해외연수 등록금'); break;
    case 2: gain(p, 20 * MAN, '진로체험처 사업비'); break;
    case 5: gain(p, 30 * MAN, '신지식 농업인 상금'); break;
    case 9: gain(p, 10 * MAN, '농지 연금'); break;
    case 12: gain(p, 10 * MAN, '농식품 경진대회 상금'); break;
    case 20: gain(p, 10 * MAN, '친환경 장려금'); break;
    case 22: gain(p, 30 * MAN, '세계중요농업유산 수상금'); break;
    case 4:
      await moveTo(p, 10, { salary: false });
      p.jail = 3; G.extra = false;
      Sound.play('bad');
      log(`${pname(p)} 태풍으로 자연재해 칸에 갇혔어요.`, p);
      break;
    case 6: await moveTo(p, 32); await land(p); break;
    case 14: await moveTo(p, 5); await land(p); break;
    case 23: await moveTo(p, 30); await land(p); break;
    case 28: await moveTo(p, 20); await land(p); break;
    case 26: await moveTo(p, p.pos < 15 || p.pos >= 25 ? 15 : 25); await land(p); break;
    case 11: case 18: await moveTo(p, 0); break;
    case 10: await moveSteps(p, -3); await land(p); break;
    case 17: await moveTo(p, 36); await landFarm(p, 'strawberry', { festival: true }); break;
    case 27: await moveSteps(p, 40, { collectFund: true }); break;
    case 15: case 16: case 21: {
      const fee = facilityFee(p);
      if (!fee) { toast('지은 시설이 없어서 낼 돈이 없어요.'); break; }
      await pay(p, fee, 'bank', c.title);
      break;
    }
    case 19:
      for (const q of alive().filter(q => q !== p)) await pay(q, 1 * MAN, p, '단오제 축하금');
      break;
    case 24: case 29: {
      const farms = ownedFarms(p).sort((a, b) => farmValue(b) - farmValue(a));
      if (!farms.length) { toast('팔 농장이 없어요.'); break; }
      const fid = farms[0], half = farmValue(fid) / 2;
      p.cash += half; Object.assign(G.farms[fid], { owner: null, level: 0, drone: false });
      log(`${pname(p)} 가장 비싼 ${FARMS[fid].name} 농장을 반값 ${won(half)}에 은행에 팔았어요.`, p);
      await info('농장매각', `<p>${FARMS[fid].name} 농장을 반값 <b>${won(half)}</b>에 은행에 팔았어요.</p>`, { who: p });
      break;
    }
    case 30: {
      const farms = ownedFarms(p).filter(fid => !G.farms[fid].drone);
      if (!farms.length) { toast('드론을 띄울 농장이 없어요.'); break; }
      const fid = await ask({ who: p, title: '드론으로 방역할 농장 고르기', cls: 'wide shop',
        body: '<p>고른 농장의 견학요금이 2배가 됩니다. (농장 주인이 바뀌면 사라져요)</p>',
        choices: farms.map(fid => ({ label: `<img src="assets/icons/${fid}.png" alt="">${FARMS[fid].name}`, value: fid, kind: 'ghost', sub: `${won(rentOf(fid))} → ${won(rentOf(fid) * 2)}` })) });
      G.farms[fid].drone = true;
      log(`${pname(p)} ${FARMS[fid].name} 농장에 드론을 띄워 견학요금이 2배가 되었어요.`, p);
      break;
    }
  }
  render();
}
function gain(p, amount, why) {
  p.cash += amount;
  Sound.play('gain');
  log(`${pname(p)} ${why} +${won(amount)}`, p);
  toast(`${esc(p.name)} +${won(amount)}`);
  render();
}

// ───────────────────────── 차례 진행 ─────────────────────────
function pickSquare(p) {
  return new Promise(resolve => {
    G.msg = '말판에서 가고 싶은 칸을 누르세요.';
    G.picking = i => { if (i === p.pos) return; G.picking = null; resolve(i); };
    render();
  });
}

async function act(kind) {
  if (G.phase !== 'idle') return;
  const p = cur();
  if (kind === 'manage') { await manage(p); render(); runSafe(checkWin); save(); return; }
  if (kind === 'prayer') {
    p.keep.splice(p.keep.indexOf(3), 1); G.deck.push(3); p.jail = 0;
    log(`${pname(p)} 기청제 카드를 써서 자연재해에서 빠져나왔어요.`, p);
    G.msg = '자연재해에서 빠져나왔어요. 주사위를 굴리세요.';
    render(); save(); return;
  }
  G.phase = 'busy'; G.msg = ''; G.extraPending = false; render();
  try {
    if (kind === 'free') {
      const target = await pickSquare(p);
      p.freeMove = false; G.extra = false;
      G.phase = 'busy'; render();
      await moveTo(p, target);
      await land(p);
    } else if (kind === 'jail') {
      const [a, b] = await rollDice();
      G.extra = false;
      if (a === b) {
        p.jail = 0;
        log(`${pname(p)} 더블(${a}:${b})! 자연재해에서 탈출해 ${a + b}칸 이동해요.`, p);
        await moveSteps(p, a + b);
        await land(p);
      } else {
        p.jail--;
        log(`${pname(p)} 더블이 나오지 않았어요(${a}:${b}). ${p.jail ? `${p.jail}번 남았어요.` : '다음 차례부터 움직일 수 있어요.'}`, p);
      }
    } else if (kind === 'roll') {
      const [a, b] = await rollDice();
      G.extra = a === b;
      log(`${pname(p)} 주사위 ${a} + ${b} = ${a + b}${a === b ? ' (더블!)' : ''}`, p);
      await moveSteps(p, a + b);
      await land(p);
    }
    await checkWin();
  } catch (e) {
    if (e === STOP) return;
    console.error(e);
  }
  if (G.over) return;
  if (!p.bankrupt && G.extra && p.jail === 0 && !p.freeMove) {
    G.extra = false;
    G.extraPending = true;
    G.phase = 'idle';
    G.msg = '더블! 한 번 더 굴릴 수 있어요.';
    render(); save();
    return;
  }
  G.extraPending = false;
  await endTurn();
}

async function runSafe(fn) { try { await fn(); } catch (e) { if (e !== STOP) console.error(e); } }

async function endTurn() {
  G.extra = false;
  if (G.endsAt && Date.now() >= G.endsAt) { await runSafe(timeUp); return; }
  let n = G.turn;
  do { n = (n + 1) % G.players.length; } while (G.players[n].bankrupt);
  G.turn = n;
  G.phase = 'idle';
  const p = cur();
  G.msg = p.freeMove ? '로컬푸드매장에서 재료를 샀으니 원하는 칸으로 갈 수 있어요.' : p.jail ? '자연재해에 갇혀 있어요. 더블이 나오면 탈출!' : '';
  render(); save();
}

// ───────────────────────── 저장 ─────────────────────────
function save() { try { if (!G.over) localStorage.setItem(SAVE_KEY, JSON.stringify({ ...G, picking: null, phase: G.phase === 'busy' ? 'idle' : G.phase })); } catch (e) { /* 저장 불가 */ } }
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } }

// ───────────────────────── 시작 ─────────────────────────
function newGame({ names, minutes }) {
  const recipes = shuffle(Object.keys(RECIPES));
  const start = names.length === 2 ? START_CASH * 2 : START_CASH;
  G = {
    players: names.map((name, i) => ({
      id: i, name, ...PLAYER_STYLES[i], cash: start, pos: 0, laps: 0, jail: 0, recipe: recipes[i],
      specials: [], salt: false, keep: [], loan: null, loanUsed: false, freeMove: false, bankrupt: false,
    })),
    turn: 0, phase: 'idle', fund: 0, extra: false, msg: '',
    deck: shuffle(Object.keys(CHANCE).map(Number)),
    farms: Object.fromEntries(Object.keys(FARMS).map(id => [id, { owner: null, level: 0, inMarket: false, drone: false }])),
    expoOwner: null, saltOwner: null,
    stock: { ...Object.fromEntries(Object.keys(SPECIALS).map(k => [k, SPECIAL_STOCK])), salt: SALT_STOCK },
    endsAt: minutes ? Date.now() + minutes * 60000 : 0, log: [], over: false, picking: null,
  };
}

async function startPlay(fresh) {
  $('#setup').hidden = true;
  $('#game').hidden = false;
  $('#tokens').innerHTML = '';
  render(); renderLog();
  if (fresh) {
    log('게임을 시작했어요. 모두 출발지(서울)에서 출발합니다.');
    for (const p of G.players) await privateView(p, recipeHtml, '나의 레시피차트');
    G.msg = '주사위를 굴려 출발하세요!';
    render(); save();
  }
  setInterval(() => { if (G && G.endsAt && !G.over) renderPanel(); }, 1000);
}

function rulesHtml() {
  return `<div class="rules">
  <p><b>목표</b> 지역 특산물 농장을 사고, 밭 → 가공시설 → 교육농장으로 키워 농장을 융복합산업(6차 산업)으로 만들어요. 아래 넷 중 하나를 먼저 이루면 승리!</p>
  <ul>
    <li><b>푸드독점</b> 내 레시피의 푸드카드 5장 + 특수재료(로컬푸드매장) + 소금(레시피에 있으면, 염전)을 모두 모으기</li>
    <li><b>라인독점</b> 말판 한 줄의 농장 6곳을 모두 가지기</li>
    <li><b>교육농장독점</b> 교육농장 3곳 세우기</li>
    <li><b>파산 승리</b> 나를 빼고 모두 파산</li>
  </ul>
  <p><b>차례</b> 주사위 2개를 굴려 합만큼 이동해요. 더블이면 한 번 더! 출발지를 지날 때마다 농촌지원금 20만원.</p>
  <p><b>농장</b> 주인이 없으면 증서(푸드카드)를 살 수 있어요. 첫 바퀴는 증서만, 2바퀴째 밭, 3바퀴째 가공시설, 4바퀴째부터 교육농장을 지을 수 있어요(내 농장에 도착했을 때). 남의 농장에선 견학요금을 내고, 원하면 증서+시설 값을 주인에게 주고 인수할 수 있어요.</p>
  <p><b>돈이 부족하면</b> 시설이나 농장을 은행에 산 값 그대로 팔 수 있어요. 대출은 게임 중 1번, 100만원까지, 3바퀴 안에 갚아야 해요. 낼 돈을 마련할 수 없으면 파산.</p>
  <p><b>특수 칸</b> 자연재해(3번 쉬기, 더블이면 탈출) · 직거래장터(카드 한 장 경매) · 농업기술센터(기금 받기) · 농촌발전기금(15만원 기부) · 로컬푸드매장(특수재료 25만원, 다음 차례 자유 이동) · 염전(지분 40만원, 소금 20만원) · 농업기술박람회(개최 50만원, 참가비 30만원) · 국가중요농업유산(10초 보고 3곳 말하기, ±20만원)</p>
  <p><b>레시피</b> 레시피는 자기만 알아야 해요. 이름 옆 '레시피' 버튼으로 몰래 확인하세요.</p>
  <p><b>말판의 칸을 누르면</b> 푸드카드 앞면(작물 설명·대표음식·영농기술 정보)과 견학요금표를 볼 수 있어요.</p></div>`;
}

function initSetup() {
  const saved = loadSave();
  let count = 4, minutes = 0;
  const names = ['1모둠', '2모둠', '3모둠', '4모둠'];
  const draw = () => {
    $('#countSel').innerHTML = [2, 3, 4].map(n => `<button class="seg ${n === count ? 'on' : ''}" data-n="${n}">${n}명(팀)</button>`).join('');
    $('#timeSel').innerHTML = [[0, '제한 없음'], [30, '30분'], [45, '45분'], [60, '60분']].map(([m, l]) => `<button class="seg ${m === minutes ? 'on' : ''}" data-m="${m}">${l}</button>`).join('');
    $('#nameList').innerHTML = PLAYER_STYLES.slice(0, count).map((s, i) => `
      <label class="name-row" style="--pc:${s.color}"><img class="ava" src="assets/icons/${s.avatar}.png" alt="">
        <input id="pname${i}" value="${esc(names[i])}" maxlength="10" aria-label="${i + 1}번째 플레이어 이름"></label>`).join('');
    $('#nameList').querySelectorAll('input').forEach((inp, i) => inp.addEventListener('input', () => { names[i] = inp.value; }));
    $('#cashNote').textContent = `시작 자금 ${won(count === 2 ? START_CASH * 2 : START_CASH)} · 레시피는 무작위로 한 장씩`;
  };
  draw();
  $('#countSel').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { count = +b.dataset.n; draw(); } });
  $('#timeSel').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { minutes = +b.dataset.m; draw(); } });
  $('#startBtn').addEventListener('click', () => {
    const list = names.slice(0, count).map((n, i) => n.trim() || `${i + 1}모둠`);
    clearSave();
    newGame({ names: list, minutes });
    startPlay(true);
  });
  if (saved && !saved.over) {
    $('#resumeBtn').hidden = false;
    $('#resumeBtn').textContent = `이어하기 (${saved.players.map(p => p.name).join(', ')})`;
    $('#resumeBtn').addEventListener('click', () => { G = saved; G.phase = 'idle'; G.picking = null; startPlay(false); });
  }
  $('#rulesBtn').addEventListener('click', () => info('게임 방법', rulesHtml(), { cls: 'wide' }));
}

document.addEventListener('DOMContentLoaded', () => {
  buildBoard();
  initSetup();
  $('#stageBtns').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'new') { location.reload(); return; }
    act(b.dataset.act);
  });
  $('#players').addEventListener('click', e => {
    const b = e.target.closest('[data-recipe]'); if (!b || G.phase === 'busy') return;
    privateView(byId(+b.dataset.recipe), recipeHtml, '나의 레시피차트');
  });
  const syncMute = () => document.querySelectorAll('[data-mute]').forEach(b => { b.textContent = Sound.muted ? '소리 꺼짐' : '소리 켜짐'; b.setAttribute('aria-pressed', String(!Sound.muted)); });
  document.querySelectorAll('[data-mute]').forEach(b => b.addEventListener('click', () => { Sound.toggle(); syncMute(); }));
  syncMute();
  $('#rulesBtn2').addEventListener('click', () => info('게임 방법', rulesHtml(), { cls: 'wide' }));
  $('#endBtn').addEventListener('click', async () => {
    if (G.phase !== 'idle') return;
    const v = await ask({ title: '게임을 끝낼까요?', body: '<p>지금까지의 결과로 순위를 정해요. 레시피 재료 푸드카드를 가장 많이 모은 사람이 이기고, 같으면 재산과 시설이 더 많은 사람이 이깁니다.</p>',
      choices: [{ label: '지금 끝내고 결과 보기', value: true, kind: 'danger' }, { label: '계속하기', value: false }] });
    if (v) runSafe(timeUp);
  });
});
