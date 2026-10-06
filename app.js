'use strict';
/* Meu Caminho — tudo funciona localmente no aparelho, sem servidor. */
const KEY = 'meucaminho:v1', WKEY = 'meucaminho:caminhada';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dkey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fmt = (n, d = 1) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
const clock = s => { s = Math.max(0, Math.floor(s)); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };
const dur = s => { const m = Math.round(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min' : m + ' min'; };
const fdate = k => { const p = k.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
const sumBy = (a, k) => a.reduce((t, x) => t + (+x[k] || 0), 0);
const pace = (s, km) => { if (!(km > 0.02)) return '--'; const t = Math.round(s / km); return Math.floor(t / 60) + ':' + pad(t % 60) + ' min/km'; };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);

const NOTA_KCAL = 'As calorias são uma estimativa e podem variar conforme peso, ritmo, terreno, condicionamento e outros fatores.';
const NOTA_EMAG = 'Emagrecimento envolve vários fatores, incluindo alimentação, atividade física, sono, descanso e outros aspectos individuais. Este aplicativo serve para acompanhamento e organização da rotina e não substitui orientação médica ou nutricional. Este aplicativo é uma ferramenta de acompanhamento e não substitui orientação médica ou profissional.';
const FRASES = ['Hoje não precisa ser perfeito. Só precisa começar.', 'Cada caminhada conta.', 'Consistência vale mais que intensidade exagerada.', 'Você está construindo um hábito.', 'Mais um dia. Mais um passo.', 'O difícil é sair de casa. O resto é caminho.', 'Seu corpo agradece cada passo de hoje.', 'Devagar também é avançar.', 'Não compare seu começo com o meio de ninguém.', 'Um dia curto ainda é um dia vencido.'];
const PLANO = [20, 20, 25, 0, 25, 30, 15, 25, 25, 30, 0, 30, 35, 20, 30, 30, 35, 0, 35, 40, 25, 30, 35, 40, 0, 40, 45, 30, 35, 30];

/* ---------- Estado ---------- */
const DEF = () => ({ v: 3, perfil: { nome: '', idade: '', altura: '', pesoInicial: null, pesoAtual: null, pesoMeta: null, hora: '17:00', metaDia: 30, metaSemana: 150, metaTipo: 'tempo', metaKm: 3, lembrete: false }, pesos: [], walks: [], metas: [], plano: { feitos: [], inicio: null }, conq: {}, habitos: {}, checkins: {}, tema: 'auto', fest: {}, nivel: 0, onboarded: false, notif: '' });
const merge = (d, r) => {
  const o = Object.assign({}, d, r); o.v = 3;
  o.perfil = Object.assign({}, d.perfil, r.perfil || {});
  o.plano = Object.assign({}, d.plano, r.plano || {});
  ['pesos', 'walks', 'metas'].forEach(k => { if (!Array.isArray(o[k])) o[k] = []; });
  if (!Array.isArray(o.plano.feitos)) o.plano.feitos = [];
  ['conq', 'habitos', 'checkins', 'fest'].forEach(k => { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; });
  if (!['auto', 'claro', 'escuro'].includes(o.tema)) o.tema = 'auto';
  return o;
};
let S = (() => { try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.v) return merge(DEF(), r); } catch (e) { } return DEF(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Não foi possível salvar neste navegador. Faça um backup.'); } };
let W = null; try { W = JSON.parse(localStorage.getItem(WKEY)); } catch (e) { }
const saveW = () => { try { W ? localStorage.setItem(WKEY, JSON.stringify(W)) : localStorage.removeItem(WKEY); } catch (e) { } };
const R = { tab: 'home', sub: { prog: 'peso', metas: 'metas' }, hist: 'semana', cal: new Date(), sel: null, ob: 0, obd: {}, fr: 0 };
let toastT = null, dip = null;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3500); }

/* ---------- Cálculos ---------- */
function inP(w, p) {
  const d = new Date(w.at), n = new Date();
  if (p === 'hoje') return dkey(d) === dkey(n);
  if (p === 'semana') { const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return d >= s; }
  if (p === 'mes') return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  return true;
}
function stats() {
  const w = S.walks, days = [...new Set(w.map(x => dkey(new Date(x.at))))].sort();
  let best = 0, run = 0, prev = null;
  days.forEach(d => { run = prev && dayDiff(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  let cur = 0; const c = new Date(); if (!days.includes(dkey(c))) c.setDate(c.getDate() - 1);
  while (days.includes(dkey(c))) { cur++; c.setDate(c.getDate() - 1); }
  return { n: w.length, sec: sumBy(w, 'dur'), km: sumBy(w, 'km'), kcal: sumBy(w, 'kcal'), best, cur, days, maxMin: Math.max(0, ...w.map(x => x.dur / 60)), maxKm: Math.max(0, ...w.map(x => +x.km || 0)) };
}
const kcalP = p => sumBy(S.walks.filter(w => inP(w, p)), 'kcal');
const syncPeso = () => { const l = [...S.pesos].sort((a, b) => a.d.localeCompare(b.d)).pop(); if (l) S.perfil.pesoAtual = l.kg; };
const planState = () => { const f = S.plano.feitos; return { f, cur: PLANO.findIndex((_, i) => !f.includes(i + 1)) }; };

const ACH = [
  ['primeira', '🏁', 'Primeira caminhada', s => s.n, 1], ['km5', '🚶', 'Primeiros 5 km', s => s.km, 5], ['h1', '⏱️', 'Primeira hora caminhando', s => s.sec / 3600, 1], ['kc1000', '🔥', '1.000 kcal estimadas', s => s.kcal, 1000], ['s3', '🔥', '3 dias seguidos', s => s.best, 3], ['s7', '🔥', '7 dias seguidos', s => s.best, 7],
  ['s14', '🔥', '14 dias seguidos', s => s.best, 14], ['s30', '🏆', '30 dias seguidos', s => s.best, 30], ['km10', '🚶', '10 km acumulados', s => s.km, 10],
  ['km25', '🚶', '25 km acumulados', s => s.km, 25], ['km50', '🏆', '50 km acumulados', s => s.km, 50], ['km100', '🏆', '100 km acumulados', s => s.km, 100], ['h5', '⏱️', '5 horas caminhadas', s => s.sec / 3600, 5], ['h10', '⏱️', '10 horas caminhadas', s => s.sec / 3600, 10],
  ['n10', '📅', '10 caminhadas realizadas', s => s.n, 10], ['n30', '📅', '30 caminhadas realizadas', s => s.n, 30], ['n50', '📅', '50 caminhadas realizadas', s => s.n, 50]
];
function checkAch() {
  const st = stats(), nov = [];
  ACH.forEach(a => { if (!S.conq[a[0]] && a[3](st) >= a[4]) { S.conq[a[0]] = dkey(); nov.push(a); } });
  return nov;
}
const TIPOS = {
  min: { n: '🚶 Caminhar X minutos em uma caminhada', u: 'min', p: () => Math.max(0, ...S.walks.map(w => w.dur / 60)) },
  km: { n: '🚶 Caminhar X km em uma caminhada', u: 'km', p: () => Math.max(0, ...S.walks.map(w => +w.km || 0)) },
  kcal: { n: '🔥 Acumular X kcal estimadas', u: 'kcal', p: () => sumBy(S.walks, 'kcal') },
  dias: { n: '📅 Caminhar X dias seguidos', u: 'dias', p: () => stats().best },
  plano: { n: '📅 Completar o Desafio de 30 dias', u: 'dias', fixo: 30, p: () => S.plano.feitos.length },
  peso: { n: '⚖️ Atingir X kg', u: 'kg', p: () => +S.perfil.pesoAtual || 0 }
};
function metaInfo(m) {
  const t = TIPOS[m.tipo]; if (!t) return { pct: 0, txt: '' };
  if (m.tipo === 'peso') {
    const ini = +S.perfil.pesoInicial || 0, at = +S.perfil.pesoAtual || 0;
    const pct = ini > m.alvo ? clamp(Math.round((ini - at) / (ini - m.alvo) * 100), 0, 100) : (at <= m.alvo ? 100 : 0);
    return { pct, txt: 'Atual ' + fmt(at) + ' kg · meta ' + fmt(m.alvo) + ' kg' };
  }
  const cur = t.p();
  return { pct: clamp(Math.round(cur / m.alvo * 100), 0, 100), txt: fmt(Math.min(cur, m.alvo), t.u === 'km' ? 1 : 0) + ' / ' + fmt(m.alvo, t.u === 'km' ? 1 : 0) + ' ' + t.u };
}

/* ---------- Componentes ---------- */
const bar = p => '<div class="bar" role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + p + '%"></i></div>';
const chips = (g, items, cur) => '<div class="chips" role="tablist">' + items.map(i => '<button class="chip ' + (i[0] === cur ? 'on' : '') + '" role="tab" aria-selected="' + (i[0] === cur) + '" data-act="sub" data-g="' + g + '" data-k="' + i[0] + '">' + i[1] + '</button>').join('') + '</div>';
const st_ = (v, l, id) => '<div class="st"><b' + (id ? ' id="' + id + '"' : '') + '>' + v + '</b><span>' + l + '</span></div>';

function lineChart(pts, goal, un, nome) {
  if (!pts.length) return '<p class="mut">Registre seu peso para ver o gráfico.</p>';
  pts = pts.slice(-30);
  const VW = 320, VH = 170, pl = 38, pr = 12, pt = 12, pb = 26;
  let ys = pts.map(p => p.y); if (goal != null) ys = ys.concat(goal);
  let mn = Math.min(...ys), mx = Math.max(...ys); if (mx - mn < 1) { mn -= .5; mx += .5; }
  const ex = (mx - mn) * .1; mn -= ex; mx += ex;
  const X = i => pts.length === 1 ? pl + (VW - pl - pr) / 2 : pl + i * (VW - pl - pr) / (pts.length - 1);
  const Y = v => pt + (mx - v) * (VH - pt - pb) / (mx - mn);
  let g = '';
  [mn + ex, (mn + mx) / 2, mx - ex].forEach(v => { g += '<line x1="' + pl + '" x2="' + (VW - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="currentColor" opacity=".12"/><text x="' + (pl - 4) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + fmt(v) + '</text>'; });
  if (goal != null) g += '<line x1="' + pl + '" x2="' + (VW - pr) + '" y1="' + Y(goal) + '" y2="' + Y(goal) + '" stroke="#ff7a3d" stroke-dasharray="5 4" stroke-width="2"/><text x="' + (VW - pr) + '" y="' + (Y(goal) - 4) + '" text-anchor="end" style="fill:#ff7a3d">meta</text>';
  const path = pts.map((p, i) => X(i) + ',' + Y(p.y)).join(' ');
  const sh = k => k.slice(8) + '/' + k.slice(5, 7);
  return '<svg class="chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" aria-label="Gráfico de evolução ' + (nome || 'do peso') + ', de ' + fmt(pts[0].y) + ' ' + (un || 'kg') + ' para ' + fmt(pts[pts.length - 1].y) + ' ' + (un || 'kg') + '" style="color:var(--tx)">' + g +
    (pts.length > 1 ? '<polyline points="' + path + '" fill="none" stroke="#1f8a4c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' : '') +
    pts.map((p, i) => '<circle cx="' + X(i) + '" cy="' + Y(p.y) + '" r="4" fill="#1f8a4c"/>').join('') +
    '<text x="' + X(0) + '" y="' + (VH - 6) + '" text-anchor="' + (pts.length > 1 ? 'start' : 'middle') + '">' + sh(pts[0].x) + '</text>' +
    (pts.length > 1 ? '<text x="' + X(pts.length - 1) + '" y="' + (VH - 6) + '" text-anchor="end">' + sh(pts[pts.length - 1].x) + '</text>' : '') + '</svg>';
}
function barChart(items, unit) {
  const mx = Math.max(1, ...items.map(i => i.v));
  return '<div class="bars" role="img" aria-label="Gráfico de barras em ' + unit + '">' + items.map(i => '<div><small>' + (i.v ? fmt(i.v, 0) : '') + '</small><b style="height:' + Math.round(i.v / mx * 85) + '%"></b><span>' + i.l + '</span></div>').join('') + '</div>';
}

/* ---------- Telas ---------- */
const fraseDia = () => FRASES[(Math.floor(Date.now() / 864e5) + R.fr) % FRASES.length];

const vProg = () => chips('prog', [['peso', '⚖️ Peso'], ['hist', '📜 Histórico'], ['stats', '📊 Estatísticas'], ['cal', '📅 Calendário'], ['conq', '🏆 Conquistas'], ['hab', '🌱 Hábitos']], R.sub.prog) + ({ peso: vPeso, hist: vHist, stats: vStats, cal: vCal, conq: vConq, hab: vHab }[R.sub.prog])();
const vMetas = () => chips('metas', [['metas', '🎯 Metas'], ['plano', '📅 Desafio 30 dias'], ['rotina', '⏰ Minha Rotina'], ['mot', '🧠 Motivação']], R.sub.metas) + ({ metas: vMetasLista, plano: vPlano, rotina: vRotina, mot: vMot }[R.sub.metas])();

function vHist() {
  const f = R.hist, L = S.walks.filter(w => inP(w, f)).sort((a, b) => b.at.localeCompare(a.at));
  return '<h2>Histórico</h2><div class="chips">' + [['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['tudo', 'Tudo']].map(i => '<button class="chip ' + (i[0] === f ? 'on' : '') + '" data-act="hist" data-k="' + i[0] + '">' + i[1] + '</button>').join('') + '</div><button class="btn sec" data-act="manual">＋ Registrar caminhada manualmente</button>' +
    (L.length ? L.map(walkItem).join('') : '<p class="card mut">Nenhuma caminhada neste período.</p>');
}
function vConq() {
  const st = stats();
  return '<h2>Conquistas</h2>' + nivelCard() + '<p class="mut">' + Object.keys(S.conq).length + ' de ' + ACH.length + ' desbloqueadas</p>' + ACH.map(a => {
    const ok = S.conq[a[0]], cur = Math.min(a[3](st), a[4]);
    return '<article class="card ach ' + (ok ? '' : 'lock') + '"><div class="ic" aria-hidden="true">' + a[1] + '</div><div><b>' + a[2] + '</b><div class="mut small">' + (ok ? '✅ Desbloqueada em ' + fdate(ok) : 'Progresso: ' + fmt(cur, a[4] >= 50 || /^(km|h)/.test(a[0]) ? 1 : 0) + ' / ' + a[4]) + '</div></div></article>';
  }).join('');
}
function vMetasLista() {
  return '<h2>Minhas Metas</h2>' + metasBase() + (S.metas.length ? S.metas.map(m => { const i = metaInfo(m), t = TIPOS[m.tipo]; return '<article class="card"><div class="item"><b>' + (i.pct >= 100 ? '✅ ' : '') + t.n.replace('X', t.fixo ? '' : fmt(m.alvo, t.u === 'km' || t.u === 'kg' ? 1 : 0)).replace('  ', ' ') + '</b><button class="x" aria-label="Excluir meta" data-act="delmeta" data-id="' + esc(m.id) + '">🗑️</button></div>' + bar(i.pct) + '<p class="small mut">' + i.txt + ' · ' + i.pct + '%</p></article>'; }).join('') : '<p class="card mut">Você ainda não criou metas. Crie a primeira abaixo.</p>') +
    '<form class="card" data-form="meta"><h3>Nova meta</h3><label for="mt">Tipo de meta</label><select id="mt" name="tipo">' + Object.keys(TIPOS).map(k => '<option value="' + k + '">' + TIPOS[k].n.replace('X ', '') + '</option>').join('') + '</select><label for="ma">Valor da meta (minutos, km, kcal, dias ou kg)</label><input id="ma" name="alvo" inputmode="decimal" autocomplete="off" placeholder="Ex.: 30 (não precisa no desafio de 30 dias)"><button class="btn" type="submit">Criar meta</button></form>';
}
function vMot() {
  return '<h2>Motivação</h2><section class="card hero"><p class="quote">“' + fraseDia() + '”</p></section><button class="btn sec" data-act="fr">Outra mensagem</button><section class="card"><h3>Lembretes que valem ouro</h3>' + FRASES.map(f => '<p>• ' + f + '</p>').join('') + '</section><p class="note">' + NOTA_EMAG + '</p>';
}
function vPerfil() {
  const p = S.perfil, f = (id, l, v, extra) => '<label for="' + id + '">' + l + '</label><input id="' + id + '" name="' + id + '" value="' + esc(v == null ? '' : v) + '" ' + (extra || '') + '>';
  return '<h2>⚙️ Configurações</h2><form class="card" data-form="perfil">' + f('nome', 'Nome', p.nome, 'autocomplete="given-name"') + '<div class="row"><div>' + f('idade', 'Idade', p.idade, 'inputmode="numeric"') + '</div><div>' + f('altura', 'Altura (cm)', p.altura, 'inputmode="numeric"') + '</div></div>' +
    '<div class="row"><div>' + f('pesoInicial', 'Peso inicial (kg)', p.pesoInicial == null ? '' : fmt(p.pesoInicial), 'inputmode="decimal"') + '</div><div>' + f('pesoAtual', 'Peso atual (kg)', p.pesoAtual == null ? '' : fmt(p.pesoAtual), 'inputmode="decimal"') + '</div></div>' +
    f('pesoMeta', 'Peso desejado (kg)', p.pesoMeta == null ? '' : fmt(p.pesoMeta), 'inputmode="decimal"') + f('hora', 'Horário da caminhada', p.hora, 'type="time"') + '<div class="row"><div>' + f('metaDia', 'Meta diária (min)', p.metaDia, 'inputmode="numeric"') + '</div><div>' + f('metaSemana', 'Meta semanal (min)', p.metaSemana, 'inputmode="numeric"') + '</div></div>' + metaFields() + '<button class="btn" type="submit">Salvar configurações</button></form>' +
    cfg() + '<section class="card"><h3>💾 Dados</h3><p class="small mut">Tudo fica salvo só neste aparelho. Faça backups de vez em quando.</p><button class="btn sec" data-act="export">Exportar meus dados</button><button class="btn sec" data-act="import">Importar meus dados</button>' + (dip ? '<button class="btn lima" data-act="install">📲 Instalar na tela inicial</button>' : '') + '<button class="btn dan" data-act="reset">Apagar todos os dados</button></section>' +
    '<p class="note">' + NOTA_KCAL + '</p><p class="note">' + NOTA_EMAG + '</p><p class="small mut c">Meu Caminho · seus dados nunca saem do seu aparelho.</p>';
}

/* ---------- Onboarding ---------- */
function vOb() {
  const s = R.ob, d = R.obd, dots = '<div class="dots" aria-hidden="true">' + [0, 1, 2, 3, 4].map(i => '<i class="' + (i <= s ? 'on' : '') + '"></i>').join('') + '</div>';
  const back = s > 0 && s < 4 ? '<button class="btn sec" type="button" data-act="obback">Voltar</button>' : '';
  const body = [
    '<div class="emoji">🚶‍♂️</div><h2 class="c">Vamos começar sua jornada.</h2><p class="mut c">Um companheiro simples para criar o hábito de caminhar e acompanhar sua evolução, no seu ritmo. Seus dados ficam só no seu aparelho.</p><button class="btn" data-act="obnext">Começar</button>',
    '<h2>Seu peso e sua meta</h2><form data-form="ob"><label for="nome">Como podemos te chamar? (opcional)</label><input id="nome" name="nome" autocomplete="given-name" value="' + esc(d.nome || '') + '"><label for="peso">Peso atual (kg)</label><input id="peso" name="peso" inputmode="decimal" required autocomplete="off" value="' + esc(d.peso || '') + '" placeholder="Ex.: 92,4"><label for="meta">Peso desejado (kg)</label><input id="meta" name="meta" inputmode="decimal" required autocomplete="off" value="' + esc(d.meta || '') + '" placeholder="Ex.: 78"><button class="btn" type="submit">Continuar</button>' + back + '</form>',
    '<h2>Horário da caminhada</h2><p class="mut">Ter um horário fixo ajuda a criar o hábito. Sugestão: 17:00.</p><form data-form="ob"><label for="hora">Horário</label><input id="hora" name="hora" type="time" required value="' + esc(d.hora || '17:00') + '"><button class="btn" type="submit">Continuar</button>' + back + '</form>',
    '<h2>Meta diária</h2><p class="mut">Comece com um valor que você consegue cumprir. Sugestão: 30 minutos.</p><form data-form="ob"><label for="min">Minutos por dia</label><input id="min" name="min" inputmode="numeric" required value="' + esc(d.min || 30) + '"><button class="btn" type="submit">Continuar</button>' + back + '</form>',
    '<div class="emoji">🎉</div><h2 class="c">Tudo pronto! Vamos começar. 🚶‍♂️</h2><p class="mut c">Seu primeiro objetivo é simples: começar.</p><button class="btn big" data-act="obfim">COMEÇAR MINHA JORNADA</button>'
  ][s];
  return '<section class="card" style="margin-top:12px">' + dots + body + '</section><p class="note">' + NOTA_EMAG + '</p>';
}

/* ---------- Render e relógio ---------- */
function render() {
  applyTema();
  const nav = $('#nav'), v = $('#view');
  if (!S.onboarded) { nav.hidden = true; v.innerHTML = vOb(); return; }
  nav.hidden = false;
  v.innerHTML = ({ home: vHome, walk: vWalk, prog: vProg, metas: vMetas, perfil: vPerfil }[R.tab])();
  document.querySelectorAll('#nav button').forEach(b => { const on = b.dataset.t === R.tab; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  updateLive();
}
function go(t) { R.tab = t; render(); window.scrollTo(0, 0); }
const elapsed = () => W ? W.acc + (W.last ? Date.now() - W.last : 0) : 0;
function updateLive() {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  if (W && !W.fin) { const s = elapsed() / 1000, km = W.m / 1000; set('t-time', clock(s)); set('t-dist', fmt(km, 2) + ' km'); set('t-kcal', '~' + calcKcal(s, km) + ' kcal'); set('t-pace', pace(s, km)); set('t-gps', gpsTxt()); }
  const e = document.getElementById('cd');
  if (e) {
    const now = new Date(), hm = S.perfil.hora.split(':').map(Number), t = new Date(); t.setHours(hm[0], hm[1], 0, 0);
    const done = S.walks.some(w => inP(w, 'hoje')), l = document.getElementById('cdl'), g = document.getElementById('cdgo'), mm = document.getElementById('cdmsg');
    if (now >= t && now - t < 30 * 60000 && !done) { l.textContent = '🔔 Está na hora!'; e.textContent = 'Sua caminhada está esperando por você.'; e.style.fontSize = '1.2rem'; if (g) g.hidden = false; if (mm) mm.textContent = ''; }
    else { if (now >= t) t.setDate(t.getDate() + 1); l.textContent = 'Faltam'; e.textContent = clock((t - now) / 1000); e.style.fontSize = ''; if (g) g.hidden = true; if (mm) mm.textContent = (t - now) < 3600000 ? 'Está chegando a hora da sua caminhada.' : 'Sem pressa: o horário é só uma sugestão.'; }
  }
}
async function notify() {
  const o = { body: 'Está na hora da sua caminhada! Cada passo conta.', icon: './icon-192.png', tag: 'meucaminho' };
  try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) return reg.showNotification('Meu Caminho 🚶', o); new Notification('Meu Caminho 🚶', o); } catch (e) { }
}
function checkReminder() {
  if (!S.onboarded || !S.perfil.lembrete || !('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Date();
  if (pad(n.getHours()) + ':' + pad(n.getMinutes()) === S.perfil.hora && S.notif !== dkey()) { S.notif = dkey(); save(); notify(); }
}
setInterval(() => { updateLive(); checkReminder(); }, 1000);

/* ---------- Caminhada (cronômetro + GPS) ---------- */
let watchId = null, prev = null, wake = null;
const hav = (a, b) => { const r = x => x * Math.PI / 180, R_ = 6371000, dl = r(b.la - a.la), dn = r(b.lo - a.lo), h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.la)) * Math.cos(r(b.la)) * Math.sin(dn / 2) ** 2; return 2 * R_ * Math.asin(Math.sqrt(h)); };
function startWatch() {
  if (watchId != null) return;
  if (!('geolocation' in navigator)) { W.gps = 'indisponível'; return; }
  try {
    watchId = navigator.geolocation.watchPosition(pos => {
      if (!W || W.fin || !W.last) return;
      const c = pos.coords; if (W.gps !== 'ativo') W.gps = 'ativo';
      if (c.accuracy > 35) return;
      const cur = { la: c.latitude, lo: c.longitude, t: pos.timestamp };
      if (prev) { const d = hav(prev, cur), dt = (cur.t - prev.t) / 1000; if (d >= 5 && dt > 0 && d / dt < 5) { W.m += d; prev = cur; saveW(); } } else prev = cur;
    }, err => { if (W) W.gps = err.code === 1 ? 'negado' : 'sem sinal'; }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
  } catch (e) { W.gps = 'indisponível'; }
}
function stopWatch() { if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); watchId = null; prev = null; if (wake) { try { wake.release(); } catch (e) { } wake = null; } }
async function keepAwake() { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && W && W.last && !W.fin) keepAwake(); });
if (W && !W.fin && W.last) { startWatch(); keepAwake(); }

/* ---------- Ações e formulários ---------- */
function openModal(t, h) { $('#modal').innerHTML = '<div class="ov" data-act="closeModal"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + t + '">' + h + '</div></div>'; const i = $('#modal input'); if (i) i.focus(); }
const closeModal = () => { $('#modal').innerHTML = ''; };
const ACTS = {
  tab: a => go(a.dataset.t),
  sub: a => { R.sub[a.dataset.g] = a.dataset.k; render(); },
  hist: a => { R.hist = a.dataset.k; render(); },
  start: () => { W = { start: new Date().toISOString(), acc: 0, last: Date.now(), m: 0, gps: 'pedindo', fin: false }; saveW(); startWatch(); keepAwake(); render(); },
  pause: () => { if (W.last) { W.acc += Date.now() - W.last; W.last = null; prev = null; } else { W.last = Date.now(); } saveW(); render(); },
  finish: () => { if (W.last) { W.acc += Date.now() - W.last; W.last = null; } W.fin = true; stopWatch(); saveW(); render(); },
  discard: () => { if (confirm('Descartar esta caminhada sem salvar?')) { W = null; saveW(); render(); } },
  manual: () => openModal('Registrar caminhada manualmente', '<h2>Registrar caminhada</h2><form data-form="manual"><div class="row"><div><label for="md">Data</label><input id="md" name="data" type="date" max="' + dkey() + '" value="' + dkey() + '" required></div><div><label for="mh">Horário</label><input id="mh" name="hora" type="time" value="' + S.perfil.hora + '" required></div></div><label for="mm">Duração (minutos)</label><input id="mm" name="min" inputmode="numeric" required><label for="mk">Distância em km (opcional)</label><input id="mk" name="km" inputmode="decimal" placeholder="Ex.: 3,2"><button class="btn" type="submit">Salvar caminhada</button><button class="btn sec" type="button" data-act="closeModal">Cancelar</button></form>'),
  closeModal,
  delwalk: a => { if (confirm('Excluir esta caminhada?')) { S.walks = S.walks.filter(w => w.id !== a.dataset.id); save(); render(); } },
  delpeso: a => { if (confirm('Excluir este registro de peso?')) { S.pesos = S.pesos.filter(p => p.d !== a.dataset.d); syncPeso(); save(); render(); } },
  dia: a => { const n = +a.dataset.d, f = S.plano.feitos, i = f.indexOf(n); i >= 0 ? f.splice(i, 1) : f.push(n); save(); render(); },
  planoreset: () => { if (confirm('Recomeçar o desafio do dia 1?')) { S.plano.feitos = []; S.fest = {}; S.plano.inicio = dkey(); save(); render(); } },
  calprev: () => { R.cal = new Date(R.cal.getFullYear(), R.cal.getMonth() - 1, 1); R.sel = null; render(); },
  calnext: () => { R.cal = new Date(R.cal.getFullYear(), R.cal.getMonth() + 1, 1); R.sel = null; render(); },
  calsel: a => { R.sel = a.dataset.k; render(); },
  delmeta: a => { S.metas = S.metas.filter(m => m.id !== a.dataset.id); save(); render(); },
  fr: () => { R.fr++; render(); },
  lembrete: async () => {
    const on = !S.perfil.lembrete;
    if (on) {
      if (!('Notification' in window)) toast('Este navegador não suporta notificações. A contagem regressiva continua funcionando.');
      else { let p = Notification.permission; if (p === 'default') p = await Notification.requestPermission(); if (p !== 'granted') toast('Permissão de notificação não concedida. Você ainda vê o aviso dentro do app.'); }
    }
    S.perfil.lembrete = on; save(); render();
  },
  export: () => {
    const b = new Blob([JSON.stringify({ app: 'meu-caminho', versao: 1, exportadoEm: new Date().toISOString(), dados: S }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'meu-caminho-backup-' + dkey() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('Backup gerado. Guarde o arquivo em um lugar seguro.');
  },
  import: () => $('#imp').click(),
  reset: () => { if (confirm('Tem certeza? Essa ação apagará todo o seu histórico.') && String(prompt('Para confirmar, digite APAGAR (em maiúsculas):') || '').trim().toUpperCase() === 'APAGAR') { localStorage.removeItem(KEY); localStorage.removeItem(WKEY); S = DEF(); W = null; R.ob = 0; R.obd = {}; R.tab = 'home'; render(); } },
  install: async () => { if (dip) { dip.prompt(); await dip.userChoice; dip = null; render(); } },
  obnext: () => { R.ob++; render(); },
  obback: () => { R.ob = Math.max(0, R.ob - 1); render(); },
  obfim: () => {
    const d = R.obd, md = +d.min || 30;
    Object.assign(S.perfil, { nome: d.nome || '', pesoInicial: d.peso, pesoAtual: d.peso, pesoMeta: d.meta, hora: d.hora || '17:00', metaDia: md, metaSemana: md * 5 });
    S.pesos = [{ d: dkey(), kg: d.peso }]; S.plano.inicio = dkey(); S.onboarded = true; save(); R.tab = 'home'; render(); window.scrollTo(0, 0);
  }
};
const validKg = v => v != null && v >= 20 && v <= 400;
const FORMS = {
  ob: fd => {
    const d = R.obd;
    if (R.ob === 1) { const p = num(fd.get('peso')), m = num(fd.get('meta')); if (!validKg(p) || !validKg(m)) return toast('Informe pesos entre 20 e 400 kg.'); Object.assign(d, { nome: String(fd.get('nome') || '').trim().slice(0, 40), peso: p, meta: m }); }
    if (R.ob === 2) d.hora = fd.get('hora') || '17:00';
    if (R.ob === 3) d.min = clamp(parseInt(fd.get('min')) || 30, 5, 300);
    R.ob++; render();
  },
  savewalk: fd => {
    const sec = Math.round(W.acc / 1000), raw = String(fd.get('km') || '').trim(), km = raw ? clamp(num(raw) || 0, 0, 300) : 0;
    addWalk({ at: W.start, dur: sec, km: +km.toFixed(2), kcal: calcKcal(sec, km) });
    W = null; saveW(); toast('Caminhada salva! 🎉'); R.tab = 'home'; render(); window.scrollTo(0, 0);
  },
  manual: fd => {
    const at = new Date(fd.get('data') + 'T' + fd.get('hora')), min = num(fd.get('min')), km = num(fd.get('km')) || 0;
    if (isNaN(at) || !min || min < 1 || min > 600) return toast('Informe uma duração válida em minutos.');
    addWalk({ at: at.toISOString(), dur: Math.round(min * 60), km: +clamp(km, 0, 300).toFixed(2), kcal: calcKcal(min * 60, km), manual: true });
    closeModal(); toast('Caminhada registrada!'); render();
  },
  peso: fd => {
    const kg = num(fd.get('kg')), d = fd.get('data') || dkey();
    if (!validKg(kg)) return toast('Informe um peso entre 20 e 400 kg.');
    const o = String(fd.get('obs') || '').trim().slice(0, 120), e = S.pesos.find(p => p.d === d); if (e) { e.kg = kg; e.o = o; } else S.pesos.push({ d, kg, o }); syncPeso(); save(); toast('Peso registrado.'); render();
  },
  meta: fd => {
    const tipo = fd.get('tipo'), t = TIPOS[tipo], alvo = t.fixo || num(fd.get('alvo'));
    if (!alvo || alvo <= 0) return toast('Informe o valor da meta.');
    S.metas.push({ id: Date.now().toString(36), tipo, alvo, criada: dkey() }); save(); render();
  },
  hora: fd => { S.perfil.hora = fd.get('hora') || '17:00'; save(); toast('Horário salvo.'); render(); },
  perfil: fd => {
    const p = S.perfil, pa = num(fd.get('pesoAtual')), pi = num(fd.get('pesoInicial')), pm = num(fd.get('pesoMeta'));
    if (![pa, pi, pm].every(validKg)) return toast('Informe pesos entre 20 e 400 kg.');
    const trocou = pa !== p.pesoAtual;
    Object.assign(p, { nome: String(fd.get('nome') || '').trim().slice(0, 40), idade: fd.get('idade'), altura: fd.get('altura'), pesoInicial: pi, pesoAtual: pa, pesoMeta: pm, hora: fd.get('hora') || '17:00', metaDia: clamp(parseInt(fd.get('metaDia')) || 30, 5, 300), metaSemana: clamp(parseInt(fd.get('metaSemana')) || 150, 10, 2000), metaTipo: fd.get('metaTipo') === 'dist' ? 'dist' : 'tempo', metaKm: clamp(num(fd.get('metaKm')) || 3, 0.5, 100) });
    if (trocou) { const k = dkey(), e = S.pesos.find(x => x.d === k); e ? e.kg = pa : S.pesos.push({ d: k, kg: pa }); }
    save(); toast('Perfil salvo.'); render();
  }
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.classList.contains('ov') && e.target !== a) return;
  const f = ACTS[a.dataset.act]; if (f) f(a, e);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault(); FORMS[f.dataset.form](new FormData(f));
});
document.addEventListener('input', e => {
  if (e.target.id !== 'sum-km' || !W) return;
  const sec = Math.round(W.acc / 1000), km = num(e.target.value) || 0;
  $('#s-kcal').textContent = calcKcal(sec, km); $('#s-pace').textContent = pace(sec, km);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('change', e => {
  if (e.target.id !== 'imp') return;
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result), d = j && j.dados ? j.dados : j;
      if (!d || typeof d !== 'object' || !d.perfil || !Array.isArray(d.walks)) throw new Error('formato');
      if (!confirm('Importar este backup? Os dados atuais deste aparelho serão substituídos.')) return;
      S = merge(DEF(), d); if (S.perfil.pesoAtual != null) S.onboarded = true; save(); render(); toast('Dados restaurados com sucesso.');
    } catch (err) { toast('Arquivo inválido. Escolha um backup do Meu Caminho (.json).'); }
  };
  r.readAsText(file);
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); dip = e; if (R.tab === 'perfil' && S.onboarded) render(); });
if ('serviceWorker' in navigator) {
  const tinha = !!navigator.serviceWorker.controller; let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!tinha || recarregou) return; recarregou = true; if (W && !W.fin) toast('Nova versão instalada. Ela será aplicada quando você reabrir o app.'); else location.reload(); });
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).then(r => { r.update(); document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update(); }); }).catch(() => { }));
}
/* ===== Versão 2.0 ===== */
FRASES.push('Você não precisa correr. Precisa continuar.', 'Hoje você fez algo por você.', 'Um dia de cada vez.', 'Constância vence a pressa.', 'Olhe o quanto você já avançou.');
const MSG_DIA = ['Hoje é mais um passo na sua jornada.', 'Não precisa ser perfeito. Só precisa começar.', 'Vamos cumprir sua caminhada de hoje?', 'Cada passo conta.', 'Um dia de cada vez.'];
function applyTema() { document.documentElement.dataset.tema = S.tema || 'auto'; }
const hojeSec = () => sumBy(S.walks.filter(w => inP(w, 'hoje')), 'dur');
function pctPeso() { const i = +S.perfil.pesoInicial || 0, a = +S.perfil.pesoAtual || 0, m = +S.perfil.pesoMeta || 0; return i > m ? clamp(Math.round((i - a) / (i - m) * 100), 0, 100) : 0; }

/* Níveis */
const NIVEIS = ['Começando', 'Primeiros passos', 'Criando ritmo', 'Constante', 'Caminhante', 'Determinado', 'Imparável'], LIM = [0, 40, 120, 260, 500, 900, 1500];
function nivelCard() {
  const n = nivel();
  return `<section class="card"><h3>⭐ Nível ${n.i + 1} — ${n.nome}</h3>${bar(n.pct)}<p class="small mut">${n.prox ? n.pt + ' / ' + n.prox + ' pontos para o próximo nível' : 'Nível máximo alcançado!'} · pontos: 10 por caminhada, 1 por minuto e 5 por km (o nível nunca diminui).</p></section>`;
}

/* Celebrações */
function celebraFila(q) { R.q = (R.q || []).concat(q); if (!$('#modal').innerHTML) setTimeout(proxCel, 350); }
function proxCel() {
  const c = (R.q || []).shift(); if (!c) return;
  openModal(esc(c[1]), `<div class="c"><div class="emoji pop">${c[0]}</div><h2>${esc(c[1])}</h2><p class="quote">${esc(c[2])}</p><p class="mut">Muito bem!</p><button class="btn" data-act="celOk">Continuar</button></div>`);
}
ACTS.celOk = () => { closeModal(); proxCel(); };
ACTS.closeModal = () => { closeModal(); proxCel(); };

/* Metas */
TIPOS.hoje = { n: '🎯 Caminhar X minutos em um dia', u: 'min', p: () => Math.floor(hojeSec() / 60) };
TIPOS.sem = { n: '📅 Caminhar X vezes por semana', u: 'caminhadas', p: () => S.walks.filter(w => inP(w, 'semana')).length };
TIPOS.distsem = { n: '🚶 Caminhar X km na semana', u: 'km', p: () => sumBy(S.walks.filter(w => inP(w, 'semana')), 'km') };
/* Hábitos e check-in */
const HABS = [['agua', '💧', 'Bebi água'], ['alim', '🥗', 'Mantive alimentação organizada'], ['sono', '😴', 'Dormi bem'], ['cam', '🚶', 'Caminhei'], ['desc', '🧘', 'Descansei']];
const HUM = [['😊', 'Muito bom'], ['🙂', 'Bom'], ['😐', 'Normal'], ['😔', 'Difícil']];
function habOk(k, id) { const h = S.habitos[k] || {}; return id === 'cam' ? (!!h.cam || S.walks.some(w => dkey(new Date(w.at)) === k)) : !!h[id]; }
function vHab() {
  const k = dkey(), c = S.checkins[k] || {}, dias = [], hist = Object.keys(S.checkins).sort().reverse().slice(0, 10);
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); dias.push(dkey(d)); }
  return `<h2>✅ Check-in de hoje</h2><section class="card"><h3>Como foi seu dia?</h3><div class="g2">${HUM.map(m => `<button class="btn ${c.humor === m[1] ? '' : 'sec'}" data-act="humor" data-v="${m[1]}" aria-pressed="${c.humor === m[1]}">${m[0]} ${m[1]}</button>`).join('')}</div><h3 style="margin-top:12px">Você fez sua caminhada?</h3><div class="row"><button class="btn ${c.caminhou === true ? '' : 'sec'}" data-act="fez" data-v="1">Sim</button><button class="btn ${c.caminhou === false ? '' : 'sec'}" data-act="fez" data-v="0">Não</button></div>${c.humor && c.caminhou != null ? '<p class="small mut">Check-in de hoje salvo ✔</p>' : ''}${c.caminhou === false ? '<p class="mut">Tudo bem. Amanhã é uma nova chance, sem culpa.</p>' : ''}</section>` +
    `<h2>🌱 Meus hábitos</h2><section class="card">${HABS.map(h => { const on = habOk(k, h[0]), n = dias.filter(d => habOk(d, h[0])).length; return `<button class="btn ${on ? '' : 'sec'}" data-act="hab" data-id="${h[0]}" aria-pressed="${on}">${h[1]} ${h[2]} ${on ? '✔' : ''} <small>(${n}/7 dias)</small></button>`; }).join('')}<p class="small mut">Apenas acompanhamento de hábitos. Não é dieta nem orientação médica.</p></section>` +
    `<section class="card"><h3>Histórico de check-ins</h3>${hist.length ? hist.map(d => { const x = S.checkins[d]; return `<p><b>${fdate(d)}</b> — ${esc(x.humor || '—')} · caminhou: ${x.caminhou === true ? 'sim' : x.caminhou === false ? 'não' : '—'}</p>`; }).join('') : '<p class="mut">Nenhum check-in ainda.</p>'}</section>`;
}
const ckHoje = () => (S.checkins[dkey()] = S.checkins[dkey()] || {});
ACTS.humor = a => { ckHoje().humor = a.dataset.v; save(); render(); };
ACTS.fez = a => { ckHoje().caminhou = a.dataset.v === '1'; save(); render(); };
ACTS.hab = a => { const k = dkey(), h = (S.habitos[k] = S.habitos[k] || {}), id = a.dataset.id; h[id] = !habOk(k, id); save(); render(); };
ACTS.checkin = () => { R.tab = 'prog'; R.sub.prog = 'hab'; render(); window.scrollTo(0, 0); };
ACTS.tema = a => { S.tema = a.dataset.v; save(); render(); };
function cfg() {
  const p = S.perfil;
  return `<section class="card"><h3>🔔 Notificações</h3><button class="btn ${p.lembrete ? '' : 'sec'}" data-act="lembrete" aria-pressed="${!!p.lembrete}">${p.lembrete ? 'Lembrete ativado — toque para desativar' : 'Ativar lembrete'}</button><p class="small mut">🌅 Horário da caminhada (${esc(p.hora)}) e 🎯 meta diária (${p.metaDia} min) podem ser alterados no formulário acima.</p><h3>📊 Preferências</h3><div class="row">${[['claro', '☀️ Claro'], ['escuro', '🌙 Escuro'], ['auto', '⚙️ Automático']].map(t => `<button class="chip ${S.tema === t[0] ? 'on' : ''}" data-act="tema" data-v="${t[0]}">${t[1]}</button>`).join('')}</div></section>`;
}

/* Telas */
function gpsTxt() {
  if (!W) return '';
  if (W.gps === 'ativo') return '📡 GPS ativo — distância sendo medida';
  if (W.gps === 'pedindo') return '📍 Aguardando o GPS… a caminhada já está sendo cronometrada.';
  return 'Não conseguimos acessar sua localização. Você pode continuar a caminhada e registrar os dados manualmente.';
}
function resumo(p, t) {
  const L = S.walks.filter(w => inP(w, p));
  return `<section class="card"><h3>${t}</h3><div class="g2">${st_(L.length, '🚶 Caminhadas')}${st_(dur(sumBy(L, 'dur')), '⏱️ Minutos')}${st_(fmt(sumBy(L, 'km')) + ' km', '🚶 Distância')}${st_('~' + sumBy(L, 'kcal'), '🔥 Calorias estimadas')}</div></section>`;
}
applyTema();

/* ===== Versão 3.0 ===== */
function calcKcal(sec, km) {
  const kg = +S.perfil.pesoAtual || 70, h = sec / 3600; if (h <= 0) return 0;
  const v = km > 0.05 ? clamp(km / h, 2, 7) : 4.5;
  const met = Math.max(2, (0.1 * v * 1000 / 60 + 3.5) / 3.5);
  return Math.round(met * kg * h / 5) * 5;
}
function metaDia(list) {
  const p = S.perfil;
  if (p.metaTipo === 'dist') { const km = sumBy(list, 'km'), m = +p.metaKm || 3; return { pct: clamp(Math.round(km / m * 100), 0, 100), txt: fmt(km, 1) + ' / ' + fmt(m, 1) + ' km', rot: fmt(m, 1) + ' km' }; }
  const mi = Math.floor(sumBy(list, 'dur') / 60), m = p.metaDia || 30; return { pct: clamp(Math.round(mi / m * 100), 0, 100), txt: mi + ' / ' + m + ' min', rot: m + ' minutos' };
}
function metaNome(m) { const t = TIPOS[m.tipo]; return t ? t.n.replace('X', t.fixo ? '' : fmt(m.alvo, t.u === 'km' || t.u === 'kg' ? 1 : 0)).replace('  ', ' ') : ''; }
function metaFields() {
  const p = S.perfil;
  return `<label for="metaTipo">Meta diária por</label><select id="metaTipo" name="metaTipo"><option value="tempo" ${p.metaTipo !== 'dist' ? 'selected' : ''}>Tempo (minutos)</option><option value="dist" ${p.metaTipo === 'dist' ? 'selected' : ''}>Distância (km)</option></select><label for="metaKm">Meta diária de distância (km)</label><input id="metaKm" name="metaKm" inputmode="decimal" value="${esc(fmt(p.metaKm || 3, 1))}"><p class="small mut">Escolha uma meta realista. Você pode mudar quando quiser.</p>`;
}
function metasBase() {
  const md = metaDia(S.walks.filter(w => inP(w, 'hoje'))), sm = Math.floor(sumBy(S.walks.filter(w => inP(w, 'semana')), 'dur') / 60), ms = S.perfil.metaSemana || 150, b = clamp(Math.round(sm / ms * 100), 0, 100);
  return `<article class="card"><h3>Meta diária: ${md.rot}</h3>${bar(md.pct)}<p class="small mut">${md.txt} · ${md.pct}%</p></article><article class="card"><h3>Meta semanal: ${ms} minutos</h3>${bar(b)}<p class="small mut">${sm} / ${ms} min · ${b}%</p></article>`;
}
function nivel() {
  const s = stats(), pt = s.n * 10 + Math.round(s.sec / 60) + Math.round(s.km * 5); let i = 0; LIM.forEach((l, k) => { if (pt >= l) i = k; });
  i = Math.max(i, S.nivel || 0); const prox = LIM[i + 1];
  return { i, nome: NIVEIS[i], pt, prox, pct: prox ? clamp(Math.round((pt - LIM[i]) / (prox - LIM[i]) * 100), 0, 100) : 100 };
}
function marcaDia(n, q) {
  const f = S.plano.feitos; if (!f.includes(n)) f.push(n); R.pop = n; S.plano.ult = dkey(); const antes = q.length;
  if (!S.fest.w1 && [1, 2, 3, 4, 5, 6, 7].every(d => f.includes(d))) { S.fest.w1 = 1; q.push(['🏆', 'Primeira semana concluída!', '7 dias do desafio completos']); }
  if (!S.fest.fim && f.length >= 30) { S.fest.fim = 1; q.push(['🎉', 'DESAFIO DE 30 DIAS CONCLUÍDO!', 'Você criou o hábito de caminhar']); }
  if (q.length === antes) toast('🟢 Dia ' + n + ' concluído!');
}
function addWalk(w) {
  w.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const antes = nivel().i; S.walks.push(w); const q = [], { cur } = planState();
  if (cur >= 0 && PLANO[cur] > 0 && w.dur >= PLANO[cur] * 60 && dkey(new Date(w.at)) === dkey() && S.plano.ult !== dkey()) marcaDia(cur + 1, q);
  checkAch().forEach(a => q.push([a[1], 'Nova conquista!', a[2]]));
  const dep = nivel(); if (dep.i > antes) q.push(['⭐', 'Subiu de nível!', 'Nível ' + (dep.i + 1) + ' — ' + dep.nome]);
  S.nivel = dep.i; save(); celebraFila(q);
}
const MISSOES = ['Caminhe por 20 minutos.', 'Caminhe 20 minutos em um ritmo confortável.', 'Caminhe por 25 minutos.', 'Dia de descanso: alongue-se e hidrate-se.', 'Caminhe por 25 minutos.', 'Complete sua meta diária.', 'Faça uma caminhada leve de 15 minutos.', 'Caminhe por 25 minutos.', 'Caminhe 25 minutos prestando atenção na respiração.', 'Caminhe por 30 minutos.', 'Dia de descanso: seu corpo também trabalha.', 'Caminhe por 30 minutos.', 'Caminhe por 35 minutos, no seu ritmo.', 'Caminhada leve de 20 minutos.', 'Caminhe por 30 minutos.', 'Caminhe 30 minutos em um percurso novo.', 'Caminhe por 35 minutos.', 'Dia de descanso.', 'Caminhe por 35 minutos.', 'Caminhe por 40 minutos, se estiver confortável.', 'Caminhada leve de 25 minutos.', 'Caminhe por 30 minutos.', 'Caminhe por 35 minutos.', 'Caminhe por 40 minutos, sem forçar.', 'Dia de descanso.', 'Caminhe por 40 minutos, se estiver confortável.', 'Caminhe por 45 minutos, se estiver confortável.', 'Caminhada leve de 30 minutos.', 'Caminhe por 35 minutos.', 'Última missão: 30 minutos para celebrar sua jornada!'];
ACTS.dia = a => {
  const n = +a.dataset.d, f = S.plano.feitos, i = f.indexOf(n);
  if (i >= 0) { f.splice(i, 1); save(); render(); return; }
  const { cur } = planState(), min = PLANO[n - 1];
  if (n !== cur + 1) { toast('Conclua os dias em ordem. O dia atual é o ' + (cur + 1) + '.'); return; }
  if (S.plano.ult === dkey()) { toast('Um dia do desafio por dia. Volte amanhã! 🌱'); return; }
  if (min > 0 && sumBy(S.walks.filter(w => inP(w, 'hoje')), 'dur') < min * 60) { toast('Registre uma caminhada de pelo menos ' + min + ' minutos hoje para concluir este dia.'); return; }
  const q = []; marcaDia(n, q); save(); render(); celebraFila(q);
};
ACTS.hora = a => { S.perfil.hora = a.dataset.v; save(); render(); };
ACTS.ir = a => { R.tab = a.dataset.t; R.sub[a.dataset.t] = a.dataset.s; render(); window.scrollTo(0, 0); };
FORMS.savewalk = fd => {
  const sec = Math.round(W.acc / 1000), raw = String(fd.get('km') || '').trim(), km = raw ? clamp(num(raw) || 0, 0, 300) : 0, mg = W.m / 1000;
  addWalk({ at: W.start, dur: sec, km: +km.toFixed(2), kcal: calcKcal(sec, km), gps: mg > 0.05 && Math.abs(km - mg) < Math.max(0.05, mg * 0.05), hum: fd.get('hum') || '', obs: String(fd.get('obs') || '').trim().slice(0, 140) });
  W = null; saveW(); toast('Caminhada salva! 🎉'); R.tab = 'home'; render(); window.scrollTo(0, 0);
};
function walkItem(w) {
  const d = new Date(w.at), v = w.dur > 0 && w.km > 0 ? ' · ' + fmt(w.km / (w.dur / 3600), 1) + ' km/h' : '';
  return `<article class="card item"><div><b>${fdate(dkey(d))} · ${pad(d.getHours())}:${pad(d.getMinutes())}</b><div>🚶 Caminhada</div><div class="mut">⏱️ ${dur(w.dur)} · 📏 ${fmt(w.km, 2)} km · ⚡ ${pace(w.dur, w.km)}${v}</div><div class="mut">🔥 ~${w.kcal} kcal estimadas · ${w.manual ? '✍️ registro manual' : w.gps ? '📡 com GPS' : '⏱️ sem GPS'}</div>${w.hum ? '<div>' + esc(w.hum) + '</div>' : ''}${w.obs ? '<div class="small mut">“' + esc(w.obs) + '”</div>' : ''}</div><button class="x" aria-label="Excluir caminhada" data-act="delwalk" data-id="${esc(w.id)}">🗑️</button></article>`;
}
const semanaAnt = () => { const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); const a = new Date(s); a.setDate(a.getDate() - 7); return S.walks.filter(w => { const d = new Date(w.at); return d >= a && d < s; }); };
function minhaSemana() {
  const L = S.walks.filter(w => inP(w, 'semana')), st = stats();
  if (!L.length) return '<section class="card"><h3>Minha semana</h3><p class="mut">Você ainda não registrou nenhuma caminhada esta semana.</p></section>';
  const dias = new Set(L.map(w => dkey(new Date(w.at)))).size, sec = sumBy(L, 'dur'), ant = semanaAnt();
  let cmp = ''; if (ant.length) { const dm = Math.round((sec - sumBy(ant, 'dur')) / 60); cmp = `<p class="small mut">Semana anterior: ${dur(sumBy(ant, 'dur'))} e ${fmt(sumBy(ant, 'km'))} km. ${dm > 0 ? 'Você caminhou ' + dm + ' min a mais.' : dm < 0 ? 'Você caminhou ' + (-dm) + ' min a menos. Cada semana é diferente.' : 'Mesmo tempo da semana passada.'}</p>`; }
  const msg = dias >= 5 ? 'Que semana consistente! Você está avançando.' : dias >= 3 ? 'Você está construindo um hábito. Continue no seu ritmo.' : 'Mais um passo dado esta semana.';
  return `<section class="card"><h3>Minha semana</h3><p>Esta semana você caminhou:</p><div class="g2">${st_(dias + (dias === 1 ? ' dia' : ' dias'), 'Dias caminhados')}${st_(dur(sec), 'Tempo total')}${st_(fmt(sumBy(L, 'km')) + ' km', 'Distância')}${st_('~' + fmt(sumBy(L, 'kcal'), 0), 'kcal estimadas')}${st_(dur(sec / L.length), 'Média por caminhada')}${st_(st.cur + ' 🔥', 'Sequência atual')}</div>${cmp}<p class="quote">${msg}</p></section>`;
}
function barras() {
  const hoje = new Date(), d7 = [], w6 = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(hoje.getDate() - i); const k = dkey(d); d7.push({ l: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()], v: Math.round(sumBy(S.walks.filter(w => dkey(new Date(w.at)) === k), 'dur') / 60) }); }
  const ws = new Date(); ws.setHours(0, 0, 0, 0); ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
  for (let i = 5; i >= 0; i--) { const a = new Date(ws); a.setDate(ws.getDate() - i * 7); const b = new Date(a); b.setDate(a.getDate() + 7); w6.push({ l: pad(a.getDate()) + '/' + pad(a.getMonth() + 1), v: Math.round(sumBy(S.walks.filter(w => { const d = new Date(w.at); return d >= a && d < b; }), 'dur') / 60) }); }
  return `<section class="card"><h3>Minutos nos últimos 7 dias</h3>${barChart(d7, 'minutos')}</section><section class="card"><h3>Minutos por semana</h3>${barChart(w6, 'minutos')}</section>`;
}
function vStats() {
  const st = stats(), L = [...S.pesos].sort((a, b) => a.d.localeCompare(b.d)).map(x => ({ x: x.d, y: x.kg }));
  return '<h2>📊 Meu Progresso</h2>' + minhaSemana() + resumo('mes', 'Este mês') +
    `<section class="card"><h3>Totais acumulados</h3><div class="g2">${st_(fmt(st.km) + ' km', '🚶 Distância acumulada')}${st_('~' + fmt(st.kcal, 0), '🔥 Calorias estimadas')}${st_(dur(st.sec), '⏱️ Tempo acumulado')}${st_(st.days.length, '📅 Dias ativos')}${st_(st.best + ' 🔥', 'Melhor sequência')}${st_(Object.keys(S.conq).length + ' / ' + ACH.length, '🏆 Conquistas')}${st_(fmt(st.maxMin, 0) + ' min', 'Maior caminhada')}${st_(st.n, 'Caminhadas')}</div><p class="small mut">${NOTA_KCAL}</p></section>` +
    `<section class="card"><h3>📉 Evolução do peso</h3>${lineChart(L, +S.perfil.pesoMeta || null)}</section>` +
    (S.walks.length ? barras() : '<p class="card mut">Você ainda não registrou nenhuma caminhada.</p>');
}
function vWalk() {
  const p = S.perfil;
  if (W && W.fin) {
    const sec = Math.round(W.acc / 1000), km = W.m / 1000, hoje = S.walks.filter(w => inP(w, 'hoje')), antes = metaDia(hoje).pct, depois = metaDia(hoje.concat([{ dur: sec, km }])).pct;
    return `<section class="card c"><div class="emoji pop">🎉</div><h2>Caminhada concluída!</h2><p class="quote">Muito bem!</p></section><form class="card" data-form="savewalk"><div class="g2">${st_(dur(sec) + ' (' + clock(sec) + ')', '⏱️ Tempo')}${st_('~<span id="s-kcal">' + calcKcal(sec, km) + '</span> kcal', '🔥 Calorias estimadas')}${st_('<span id="s-pace">' + pace(sec, km) + '</span>', '⚡ Ritmo médio')}</div>` +
      `<p class="quote c">${hoje.length ? 'Mais uma caminhada hoje!' : '+1 dia de consistência'}</p>${depois >= 100 && antes < 100 ? '<p class="quote c">🏆 Meta de hoje concluída!</p>' : ''}` +
      `<label for="sum-km">Distância (km)</label><input id="sum-km" name="km" inputmode="decimal" autocomplete="off" value="${km > 0 ? fmt(km, 2) : ''}" placeholder="Ex.: 3,2 (deixe vazio se não souber)"><p class="small mut">${W.m > 0 ? 'Distância medida pelo GPS. Você pode corrigir se quiser.' : 'Sem medição por GPS. Informe a distância se souber.'}</p>` +
      `<fieldset class="fs"><legend>Como foi minha caminhada? (opcional)</legend><div class="rads">${[['😀', 'Muito boa'], ['🙂', 'Boa'], ['😐', 'Normal'], ['😓', 'Cansativa'], ['🥵', 'Muito cansativa']].map(h => `<label class="rd"><input type="radio" name="hum" value="${h[0]} ${h[1]}"><span>${h[0]} ${h[1]}</span></label>`).join('')}</div></fieldset><label for="obs">Observação (opcional)</label><input id="obs" name="obs" maxlength="140" autocomplete="off" placeholder="Ex.: Hoje caminhei mais rápido que ontem.">` +
      `<button class="btn" type="submit">SALVAR CAMINHADA</button><button class="btn sec" type="button" data-act="discard">Descartar</button><p class="small mut">${NOTA_KCAL}</p></form>`;
  }
  if (W) {
    const run = !!W.last;
    return `<h2>Caminhando 🚶</h2><section class="card live hero"><div class="timer" id="t-time">00:00:00</div><div class="g3">${st_('0,00 km', '🚶 Distância', 't-dist')}${st_('~0 kcal', '🔥 Estimadas', 't-kcal')}${st_('--', '⚡ Ritmo', 't-pace')}</div><p class="small mut" id="t-gps">${gpsTxt()}</p></section><button class="btn ${run ? 'sec' : ''}" data-act="pause">${run ? '⏸ PAUSAR' : '▶ CONTINUAR'}</button><button class="btn dan" data-act="finish">⏹ FINALIZAR</button><p class="small mut">${NOTA_KCAL}</p>`;
  }
  const md = metaDia(S.walks.filter(w => inP(w, 'hoje')));
  return `<h2>🚶 Preparado para caminhar?</h2><section class="card c"><div class="emoji">🚶‍♂️</div><div class="g3">${st_(md.rot, 'Meta de hoje')}${st_(esc(p.hora), 'Horário')}${st_(md.pct + '%', 'Já cumprido')}</div>${bar(md.pct)}<button class="btn big" data-act="start">▶ COMEÇAR</button><p class="small mut">O GPS só é pedido ao começar. Se não estiver disponível, o cronômetro continua e você informa a distância no final.</p></section><button class="btn sec" data-act="manual">＋ Registrar caminhada manualmente</button>`;
}
function vRotina() {
  const p = S.perfil;
  return `<h2>Hora do Meu Caminho</h2><section class="card hero c"><div class="emoji">🚶‍♂️</div><p class="quote">${esc(p.hora)}</p><p class="mut" id="cdl">Faltam</p><div class="cd" id="cd">--:--:--</div><p class="mut" id="cdmsg"></p><button class="btn lima" id="cdgo" data-act="tab" data-t="walk" hidden>COMEÇAR AGORA</button></section>` +
    `<section class="card"><h3>Meu horário</h3><div class="chips">${['16:30', '17:00', '17:30', '18:00'].map(h => `<button class="chip ${p.hora === h ? 'on' : ''}" data-act="hora" data-v="${h}">${h}</button>`).join('')}</div><form data-form="hora"><label for="hh">Outro horário</label><input id="hh" name="hora" type="time" value="${esc(p.hora)}" required><button class="btn sec" type="submit">Salvar horário</button></form><p class="small mut">O horário é só uma sugestão: você pode caminhar quando for melhor para o seu dia.</p></section>` +
    `<section class="card"><h3>🔔 Lembrete</h3><button class="btn ${p.lembrete ? '' : 'sec'}" data-act="lembrete" aria-pressed="${!!p.lembrete}">${p.lembrete ? 'Lembrete ativado — toque para desativar' : 'Ativar lembrete'}</button><p class="small mut">O aviso aparece quando o app está aberto ou em segundo plano. Sem servidor, não é possível garantir notificações com o app totalmente fechado. A contagem regressiva sempre funciona.</p></section>`;
}
function vPlano() {
  const { f, cur } = planState(), p = Math.round(f.length / 30 * 100);
  const wk = [0, 1, 2, 3, 4].map(w => `<h3 style="margin-top:14px">${w < 4 ? 'Semana ' + (w + 1) : 'Reta final'}</h3>` + PLANO.slice(w * 7, w * 7 + 7).map((m, j) => {
    const i = w * 7 + j, n = i + 1, ok = f.includes(n), at = i === cur;
    return `<button class="dcard ${ok ? 'ok' : at ? 'cur' : ''} ${R.pop === n ? 'pop' : ''}" data-act="dia" data-d="${n}" aria-label="Dia ${n}. ${MISSOES[i]} ${ok ? 'Concluído' : at ? 'Hoje' : 'Pendente'}"><span><b>Dia ${n}</b><br><small>${MISSOES[i]}</small></span><span>${ok ? '🟢' : at ? '🔵' : '⚪'}</span></button>`;
  }).join('')).join('');
  R.pop = null;
  return `<h2>🚶 Desafio 30 Dias</h2><section class="card hero"><p class="mut">Seu objetivo: criar o hábito de caminhar.</p><p class="quote">${cur < 0 ? '🎉 Desafio concluído!' : 'Dia ' + (cur + 1) + ' de 30'}</p>${bar(p)}<p class="small">${f.length} dias concluídos · ${p}%</p></section>` + (cur >= 0 && PLANO[cur] ? '<button class="btn" data-act="tab" data-t="walk">▶ Caminhar agora</button>' : '') +
    `<section class="card">${wk}<p class="small mut">Um dia só é concluído quando você realmente faz a atividade: ao salvar uma caminhada que cumpra o tempo do dia atual ele é marcado sozinho, e dias de descanso podem ser marcados no próprio dia. Vá no seu ritmo, sem esforço excessivo.</p></section><button class="btn sec" data-act="planoreset">Recomeçar desafio</button>`;
}
function vCal() {
  const c = R.cal, y = c.getFullYear(), m = c.getMonth(), first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), by = {}, today = dkey();
  S.walks.forEach(w => { const k = dkey(new Date(w.at)); (by[k] = by[k] || []).push(w); });
  let cells = ''; for (let i = 0; i < first; i++) cells += '<i></i>';
  for (let d = 1; d <= n; d++) {
    const k = y + '-' + pad(m + 1) + '-' + pad(d), star = by[k] && metaDia(by[k]).pct >= 100;
    cells += `<button class="day ${by[k] ? 'ok' : ''} ${k === today ? 'hoje' : ''} ${k === R.sel ? 'sel' : ''}" data-act="calsel" data-k="${k}" aria-label="Dia ${d}: ${star ? 'meta atingida' : by[k] ? 'caminhou' : 'não caminhou'}${k === today ? ' (hoje)' : ''}">${d}${star ? '<small>⭐</small>' : ''}</button>`;
  }
  let sel = '<p class="mut c">Toque em um dia para ver o resumo.</p>';
  if (R.sel) {
    const L = by[R.sel] || [], pe = S.pesos.find(x => x.d === R.sel);
    sel = `<section class="card"><h3>${fdate(R.sel)}</h3>${L.length ? `<div class="g3">${st_(dur(sumBy(L, 'dur')), 'Tempo')}${st_(fmt(sumBy(L, 'km'), 2) + ' km', 'Distância')}${st_('~' + sumBy(L, 'kcal'), 'kcal estimadas')}</div><p>${metaDia(L).pct >= 100 ? '⭐ Meta do dia atingida' : '🟢 Caminhou (' + metaDia(L).pct + '% da meta)'}</p>` : '<p class="mut">Sem caminhada neste dia.</p>'}${pe ? `<p>⚖️ Peso registrado: <b>${fmt(pe.kg)} kg</b></p>` : ''}</section>` + L.map(walkItem).join('');
  }
  return `<h2>Calendário</h2><section class="card"><div class="item"><button class="x" data-act="calprev" aria-label="Mês anterior">◀</button><b>${c.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b><button class="x" data-act="calnext" aria-label="Próximo mês">▶</button></div><div class="days" style="margin-top:12px">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => '<div class="wd">' + d + '</div>').join('')}${cells}</div><p class="small mut">🟢 caminhou · ⭐ meta atingida · ⚪ não caminhou · 🔵 hoje (contorno azul)</p></section>${sel}`;
}
function anel(pct, txt) {
  const C = 2 * Math.PI * 52, off = C * (1 - pct / 100), a = txt.split(' / ');
  return `<div class="ring" role="img" aria-label="${pct}% da meta de hoje"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="rt"/><circle cx="60" cy="60" r="52" class="rp" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}" transform="rotate(-90 60 60)"/></svg><div class="rc"><b>${a[0]}</b><span>de ${a[1] || ''}</span></div></div>`;
}
function faixaSemana() {
  const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  const hoje = dkey(); let h = '', n = 0;
  ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].forEach((l, i) => {
    const d = new Date(s); d.setDate(s.getDate() + i); const k = dkey(d), L = S.walks.filter(w => dkey(new Date(w.at)) === k), star = L.length && metaDia(L).pct >= 100; if (L.length) n++;
    h += `<span class="wk ${L.length ? 'ok' : ''} ${k === hoje ? 'hoje' : ''}"><small>${l}</small><i>${star ? '⭐' : L.length ? '✓' : ''}</i></span>`;
  });
  return `<button class="card weekb" data-act="ir" data-t="prog" data-s="cal" aria-label="Sua semana: ${n} de 7 dias com caminhada. Toque para abrir o calendário."><div class="wkrow">${h}</div><p class="small mut">${n ? n + (n === 1 ? ' dia' : ' dias') + ' com caminhada esta semana' : 'Nenhuma caminhada esta semana ainda'}</p></button>`;
}
function vHome() {
  const p = S.perfil, st = stats(), hoje = S.walks.filter(w => inP(w, 'hoje')), md = metaDia(hoje), h = new Date().getHours(), sd = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite', nome = p.nome ? ', ' + esc(p.nome.split(' ')[0]) : '';
  const at = +p.pesoAtual || 0, me = +p.pesoMeta || 0, pw = pctPeso(), kg = v => v ? fmt(v) + ' kg' : '—', prox = S.metas.map(m => ({ m, i: metaInfo(m) })).find(x => x.i.pct < 100), nv = nivel();
  const L = [...S.pesos].sort((a, b) => a.d.localeCompare(b.d)); let var_ = '';
  if (L.length > 1) { const d = L[L.length - 1].kg - L[L.length - 2].kg; var_ = d === 0 ? 'Mesmo peso do registro anterior.' : (d < 0 ? '−' : '+') + fmt(Math.abs(d)) + ' kg desde o registro anterior.'; }
  const estado = W ? '<p class="quote">🚶 Caminhada em andamento</p>' : md.pct >= 100 ? '<p class="quote">🏆 Meta de hoje cumprida! 🎉</p>' : '';
  return `<h2 style="margin-bottom:0">${sd}${nome}!</h2><p class="mut small">${MSG_DIA[(Math.floor(Date.now() / 864e5) + R.fr) % MSG_DIA.length]}</p>` +
    (!S.walks.length ? '<section class="card"><h3>Você ainda não registrou nenhuma caminhada.</h3><p class="mut">Hoje é um ótimo dia para o primeiro passo.</p></section>' : '') +
    `<section class="card hero c"><p class="mut">🎯 Meta de hoje: ${md.rot}</p>${anel(md.pct, md.txt)}${estado}<p class="small mut"><span id="cdl"></span> <b id="cd"></b> · caminhada às ${esc(p.hora)}</p><button class="btn lima big" data-act="tab" data-t="walk">${W ? '▶ VER CAMINHADA EM ANDAMENTO' : S.walks.length ? 'COMEÇAR CAMINHADA' : 'COMEÇAR MINHA PRIMEIRA CAMINHADA'}</button></section>` +
    faixaSemana() +
    `<div class="g2 kp"><div class="st k-azul"><b>${kg(at)}</b><span>⚖️ Peso atual</span></div><div class="st k-azul"><b>${at && me ? kg(Math.max(0, at - me)) : '—'}</b><span>Quanto falta</span></div><div class="st k-laranja"><b>${st.cur}${st.cur === 1 ? ' dia' : ' dias'} 🔥</b><span>Sequência atual</span></div><div class="st k-verde"><b>${fmt(st.km)} km</b><span>🚶 Distância total</span></div></div>` +
    `<details class="card more"><summary>Ver mais números</summary><div class="g2" style="margin-top:10px">${st_(st.n, 'Caminhadas')}${st_(dur(st.sec), 'Tempo caminhado')}${st_('~' + fmt(st.kcal, 0) + ' kcal', 'Calorias estimadas')}${st_(kg(me), 'Meta de peso')}</div><p class="small mut">${NOTA_KCAL}</p></details>` +
    `<section class="card"><h3>⚖️ Caminho até a meta</h3>${bar(pw)}<p class="small mut">${at && me ? pw + '% do caminho. ' + (var_ || 'Continue no seu ritmo.') : 'Defina seu peso e sua meta em Configurações.'}</p></section>` +
    `<section class="card"><h3>🎯 Próximo passo</h3>${prox ? `<p><b>${metaNome(prox.m)}</b></p>${bar(prox.i.pct)}<p class="small mut">${prox.i.txt} · ${prox.i.pct}%</p>` : '<p class="mut small">Sem metas pendentes. Crie uma em Metas quando quiser.</p>'}<p style="margin-top:12px"><b>⭐ Nível ${nv.i + 1} — ${nv.nome}</b></p>${bar(nv.pct)}<p class="small mut">${nv.prox ? nv.pt + ' / ' + nv.prox + ' pontos para o próximo nível' : 'Nível máximo alcançado!'}</p></section>` +
    `<div class="g3 qa"><button class="btn sec" data-act="ir" data-t="prog" data-s="peso">⚖️<small>Peso</small></button><button class="btn sec" data-act="checkin">${S.checkins[dkey()] ? '✔' : '✅'}<small>Check-in</small></button><button class="btn sec" data-act="manual">✍️<small>Manual</small></button></div>` +
    '<div class="g2"><button class="btn sec" data-act="ir" data-t="prog" data-s="hist">📅 Histórico</button><button class="btn sec" data-act="ir" data-t="prog" data-s="conq">🏆 Conquistas</button></div>' +
    `<details class="note"><summary>ℹ️ Aviso</summary><p>${NOTA_EMAG}</p></details>`;
}
FORMS.peso = fd => {
  const kg = num(fd.get('kg')), d = fd.get('data') || dkey(), gr = String(fd.get('gord') || '').trim(), g = gr ? num(gr) : null;
  if (!validKg(kg)) return toast('Informe um peso entre 20 e 400 kg.');
  if (gr && !(g >= 3 && g <= 70)) return toast('Informe a gordura corporal entre 3 e 70 %.');
  const o = String(fd.get('obs') || '').trim().slice(0, 120), e = S.pesos.find(p => p.d === d);
  if (e) { e.kg = kg; e.o = o; if (g != null) e.g = g; } else S.pesos.push({ d, kg, o, g });
  syncPeso(); save(); toast('Pesagem registrada. ✔'); render();
};
function vPeso() {
  const p = S.perfil, L = [...S.pesos].sort((a, b) => a.d.localeCompare(b.d)), ini = +p.pesoInicial || 0, at = +p.pesoAtual || 0, me = +p.pesoMeta || 0, ult = L[L.length - 1], dias = ult ? dayDiff(ult.d, dkey()) : null, perto = Math.max(0, ini - at);
  let prox;
  if (!ult) prox = ['⚖️', 'Faça sua primeira pesagem', 'Uma vez por semana, no mesmo dia e horário, já é suficiente.'];
  else if (dias >= 7) prox = ['⚖️', 'Hoje é dia de se pesar', 'Sua última pesagem foi há ' + dias + ' dias.'];
  else { const n = new Date(ult.d + 'T12:00'); n.setDate(n.getDate() + 7); prox = ['📅', 'Próxima pesagem: ' + n.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }), 'Faltam ' + (7 - dias) + (7 - dias === 1 ? ' dia' : ' dias') + '. Sem pressa.']; }
  let varTxt = '';
  if (L.length > 1) {
    const a = L[L.length - 2], dl = ult.kg - a.kg, sem = dayDiff(L[0].d, ult.d) / 7;
    varTxt = dl < 0 ? `Você está avançando: −${fmt(-dl)} kg desde a pesagem anterior.` : dl > 0 ? `+${fmt(dl)} kg desde a pesagem anterior. Oscilações são normais; olhe a tendência das semanas.` : 'Mesmo peso da pesagem anterior.';
    if (sem >= 1) { const m = (ult.kg - L[0].kg) / sem; varTxt += ` Média: ${m <= 0 ? '−' : '+'}${fmt(Math.abs(m), 2)} kg por semana.`; }
  }
  const desde = L.length ? L[0].d : null, cam = S.walks.filter(w => !desde || dkey(new Date(w.at)) >= desde), kc = sumBy(cam, 'kcal');
  const Lg = L.filter(x => x.g != null), g1 = Lg[0], g2 = Lg[Lg.length - 1], fat = x => x.kg * x.g / 100;
  const gordCard = !Lg.length ? '<section class="card"><h3>🧬 Gordura corporal (opcional)</h3><p class="mut">Se a sua balança mede o % de gordura, registre junto com o peso para acompanhar. O app não estima gordura sozinho: usa só o que você informa.</p></section>' :
    `<section class="card"><h3>🧬 Gordura corporal</h3><div class="g2">${st_(fmt(g2.g) + ' %', 'Gordura (última medição)')}${st_('≈ ' + fmt(fat(g2)) + ' kg', 'Gordura em kg')}${st_('≈ ' + fmt(g2.kg - fat(g2)) + ' kg', 'Massa magra')}${Lg.length > 1 ? st_((g2.g - g1.g <= 0 ? '−' : '+') + fmt(Math.abs(g2.g - g1.g)) + ' pp', 'Variação desde ' + fdate(g1.d).slice(0, 5)) : st_('—', 'Variação (precisa de 2 medições)')}</div>${Lg.length > 1 ? `<p class="quote">${fat(g2) < fat(g1) ? '−' : '+'}${fmt(Math.abs(fat(g2) - fat(g1)))} kg de gordura segundo a sua balança.</p>` : ''}<p class="small mut">Valores calculados a partir do % que você registrou. Balanças de bioimpedância variam: compare sempre no mesmo horário e nas mesmas condições.</p></section>`;
  const lin = L.map((x, i) => { const a = L[i - 1], d = a ? x.kg - a.kg : null; return `<div class="item pw"><span><b>${fdate(x.d)}</b> — ${fmt(x.kg)} kg${x.g != null ? ' · ' + fmt(x.g) + '% gord.' : ''}${x.o ? '<br><small class="mut">' + esc(x.o) + '</small>' : ''}</span><span class="dl ${d != null && d < 0 ? 'dn' : ''}">${d == null ? 'início' : d === 0 ? '＝' : (d < 0 ? '↓ ' : '↑ ') + fmt(Math.abs(d)) + ' kg'}</span><button class="x" aria-label="Excluir registro de ${fdate(x.d)}" data-act="delpeso" data-d="${x.d}">🗑️</button></div>`; }).reverse().join('');
  return `<h2>Meu Peso</h2><section class="card wnext ${dias == null || dias >= 7 ? 'hoje' : ''}"><div class="emoji" style="font-size:2.6rem;margin:0">${prox[0]}</div><h3 style="text-transform:capitalize">${prox[1]}</h3><p class="mut">${prox[2]}</p></section>` +
    `<form class="card" data-form="peso"><h3>Registrar pesagem</h3><div class="row"><div><label for="pd">Data</label><input id="pd" name="data" type="date" max="${dkey()}" value="${dkey()}" required></div><div><label for="pk">Peso (kg)</label><input id="pk" name="kg" inputmode="decimal" autocomplete="off" placeholder="Ex.: 91,8" required></div></div><div class="row"><div><label for="pg">% de gordura (opcional)</label><input id="pg" name="gord" inputmode="decimal" autocomplete="off" placeholder="Ex.: 28,5"></div><div><label for="po">Observação (opcional)</label><input id="po" name="obs" maxlength="120" autocomplete="off"></div></div><button class="btn" type="submit">Registrar pesagem</button><p class="small mut">Pesar uma vez por semana é suficiente. Não precisa ser todo dia.</p></form>` +
    `<section class="card hero c"><p class="c">${fmt(ini)} kg<br>↓<br><b style="font-size:1.8rem">${fmt(at)} kg</b><br>↓<br>${fmt(me)} kg</p>${bar(pctPeso())}<p class="small"><b>${pctPeso()}%</b> do caminho até a meta · ${perto > 0 ? 'já foram ' + fmt(perto) + ' kg' : 'continue no seu ritmo'}</p>${varTxt ? '<p>' + varTxt + '</p>' : ''}<div class="g3">${st_(fmt(ini) + ' kg', 'Inicial')}${st_(L.length ? fmt(Math.min(...L.map(x => x.kg), ini || 1e9)) + ' kg' : '—', 'Menor peso')}${st_(fmt(Math.max(0, at - me)) + ' kg', 'Falta')}</div></section>` +
    `<section class="card"><h3>🔥 Calorias estimadas em caminhadas</h3>${cam.length ? `<p class="quote">~${fmt(kc, 0)} kcal</p><p class="small mut">${cam.length} ${cam.length === 1 ? 'caminhada' : 'caminhadas'}${desde ? ' desde a primeira pesagem (' + fdate(desde) + ')' : ''}.</p><div class="note" style="margin:10px 0 0"><b>Referência de energia:</b> isso equivale a cerca de ${fmt(kc / 7700, 2)} kg de gordura corporal, usando a regra aproximada de 7.700 kcal por kg. É só uma referência: o resultado real depende de alimentação, sono, líquidos e outros fatores. Quem mostra seu resultado é a balança.</div>` : '<p class="mut">Você ainda não registrou nenhuma caminhada.</p>'}<p class="small mut">${NOTA_KCAL}</p></section>` +
    gordCard + `<section class="card"><h3>📉 Evolução do peso</h3>${lineChart(L.map(x => ({ x: x.d, y: x.kg })), me || null)}</section>` +
    (Lg.length > 1 ? `<section class="card"><h3>🧬 Evolução da gordura (%)</h3>${lineChart(Lg.map(x => ({ x: x.d, y: x.g })), null, '%', 'da gordura corporal')}</section>` : '') +
    `<section class="card"><h3>Pesagens</h3>${L.length ? lin : '<p class="mut">Nenhum registro ainda.</p>'}</section>`;
}
/* migração: dados da v2 são mantidos; só acrescentamos os campos novos */
if (!Number.isFinite(S.nivel)) S.nivel = 0;
S.nivel = Math.max(S.nivel, nivel().i); S.v = 3; save();

render();
