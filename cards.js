/* cards.js — resilient decks (Values/Spy/KnowMe/Psy/Pantomime) */

/* -------- polyfills -------- */
if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}
if (!Element.prototype.closest) {
  Element.prototype.closest = function (s) {
    var el = this;
    while (el && el.nodeType === 1) {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    }
    return null;
  };
}

/* -------- helpers -------- */
function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function shuffle(a){ return a.map(function(v){return [Math.random(),v];}).sort(function(x,y){return x[0]-y[0];}).map(function(p){return p[1];}); }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function parseVS(line){
  // Expected shape: "left vs. right when/after/with ..."
  // We keep it robust: split on first " vs. " if present.
  var left='', right='', context='';
  var vsIdx = line.toLowerCase().indexOf(' vs. ');
  if (vsIdx >= 0) {
    left = line.slice(0, vsIdx).trim();
    var rest = line.slice(vsIdx + 5).trim(); // after " vs. "
    // Look for a trailing context keyword to show separately (optional)
    var ctxMatch = /( when | after | during | in | with )/i.exec(rest);
    if (ctxMatch) {
      var ci = ctxMatch.index;
      right = rest.slice(0, ci).trim();
      context = rest.slice(ci).trim();
    } else {
      right = rest.trim();
      context = '';
    }
  } else {
    // fallback (no vs. found)
    left = line.trim();
    right = '';
    context = '';
  }
  return {left:left, right:right, context:context};
}

/* -------- state -------- */
var state = {
  game:null, deck:[], idx:0, history:[], passesLeft:3, answered:0,
  timer:null, timeLeft:0,
  spy:{ players:5, spies:1, roles:[], revealIndex:0, secret:'' },
  values:{ protect:null, trade:null } // per-card picks (ephemeral)
};

/* -------- elements -------- */
var chooser, runner, panel, titleEl, metaEl;

/* -------- data files -------- */
var FILES = {
  spy:        'data/spy.txt',
  knowme:     'data/knowme.txt',
  values:     'data/values.txt',    // <-- your renamed deck
  psy:        'data/psy.txt',
  pantomime:  'data/pantomime.txt'
};
// Optional alias so old IDs still work:
FILES.unspoken = FILES.values;

/* -------- boot -------- */
(function boot(){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else { init(); }
})();

function init(){
  chooser = $('#game-chooser');
  runner  = $('#game-runner');
  panel   = $('#panel');
  titleEl = $('#game-title');
  metaEl  = $('#game-meta');

  setupNavbar();
  setupBack();
  bindChooserOnce();

  console.log('[cards] ready');
}

/* -------- navbar -------- */
function setupNavbar(){
  var menuBtn = $('#mobile-menu');
  var navList = $('#primary-nav ul');
  var dd = $('.has-dropdown');

  if (menuBtn && navList) {
    menuBtn.addEventListener('click', function(){
      var expanded = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', String(!expanded));
      navList.classList.toggle('active');
    });
  }

  if (dd) {
    var closeTimer = 0;
    var trigger  = dd.querySelector(':scope > a') || dd.querySelector(':scope > button');
    var dropdown = dd.querySelector('.dropdown');

    function openDD(){ clearTimeout(closeTimer); dd.classList.add('open'); if (trigger) trigger.setAttribute('aria-expanded','true'); }
    function shutDD(){ dd.classList.remove('open'); if (trigger) trigger.setAttribute('aria-expanded','false'); }

    dd.addEventListener('mouseenter', openDD);
    dd.addEventListener('mouseleave', function(){ clearTimeout(closeTimer); closeTimer = setTimeout(shutDD, 220); });

    if (trigger) {
      trigger.addEventListener('click', function(e){
        if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
          e.preventDefault();
          dd.classList.toggle('open');
          trigger.setAttribute('aria-expanded', String(dd.classList.contains('open')));
        }
      });
    }
    document.addEventListener('click', function(e){
      if (!dd.contains(e.target)) shutDD();
    });
  }
}

/* -------- back -------- */
function setupBack(){
  var back = $('#back-to-games');
  if (!back) return;
  back.addEventListener('click', toChooser);
}

function toChooser(){
  stopTimer();
  if (runner) { runner.hidden = true; runner.setAttribute('hidden',''); runner.style.display = 'none'; }
  if (chooser){ chooser.hidden = false; chooser.removeAttribute('hidden'); chooser.style.display = 'block'; }
  if (titleEl) titleEl.textContent = '';
  if (metaEl)  metaEl.textContent  = '';
  if (panel)   panel.innerHTML     = '';
  state.game = null;
  console.log('[cards] back to chooser');
}

/* -------- chooser -------- */
function bindChooserOnce(){
  if (!chooser) return;
  chooser.addEventListener('click', function(e){
    var card = e.target.closest && e.target.closest('.game-card[data-game]');
    if (!card) return;
    e.preventDefault();
    var id = card.getAttribute('data-game');
    console.log('[cards] click:', id);
    startGame(id);
  }, false);
}

/* -------- loader -------- */
function loadDeck(gameId){
  var path = FILES[gameId];
  if (!path) throw new Error('No file mapping for deck id: '+gameId);
  console.log('[cards] loading', gameId, '→', path);
  return fetch(path, {cache:'no-store'})
    .then(function(res){
      if (!res.ok) throw new Error('HTTP '+res.status+' for '+path);
      return res.text();
    })
    .then(function(txt){
      var lines = txt.split(/\r?\n/).map(function(s){return s.trim();}).filter(function(s){return s && s[0] !== '#';});
      // All current decks are plain line-per-card
      return lines;
    });
}

/* -------- start -------- */
function startGame(gameId){
  stopTimer();

  // swap views quickly so user sees runner
  if (chooser){ chooser.hidden = true; chooser.setAttribute('hidden',''); chooser.style.display = 'none'; }
  if (runner){ runner.hidden = false; runner.removeAttribute('hidden'); runner.style.display = 'block'; }

  if (titleEl) titleEl.textContent = gameTitle(gameId);
  if (metaEl)  metaEl.textContent  = '';
  if (panel)   panel.innerHTML =
    '<div class="tool-card" style="gap:8px">' +
      '<div class="tool-title"><i class="ico fas fa-sync fa-spin"></i><span>Loading deck…</span></div>' +
      '<div style="font-size:14px;color:#666">If this hangs, check /data files and that you’re on http(s).</div>' +
    '</div>';

  loadDeck(gameId)
    .then(function(deck){
      if (!deck.length) throw new Error('Empty deck: '+gameId);
      state.game = gameId;
      state.deck = deck;

      if (gameId === 'spy') renderSpySetup();
      else if (gameId === 'values' || gameId === 'unspoken') renderValues();
      else if (gameId === 'psy') renderPsy();
      else if (gameId === 'pantomime') renderPantomimeSetup();
      else if (gameId === 'knowme') renderKnowMe();
      else showErrorCard('Unknown game: '+gameId);

      try { runner.scrollIntoView({behavior:'smooth', block:'start'}); } catch(_){}
      console.log('[cards] deck ready:', gameId, '('+deck.length+' cards)');
    })
    .catch(function(err){
      console.error('[cards] load error:', err);
      showErrorCard('Could not load "'+ gameTitle(gameId) +'". '+ String(err && err.message || err));
    });
}

/* -------- error card -------- */
function showErrorCard(msg){
  if (!panel) return;
  panel.innerHTML =
    '<div class="tool-card" style="gap:10px">' +
      '<div class="tool-title"><i class="ico fas fa-exclamation-triangle"></i><span>Can’t load deck</span></div>' +
      '<div style="font-size:15px;line-height:1.6">'+ msg +'</div>' +
      '<div class="tool-actions"><button id="back-to-games-inline" class="tool-actions"><i class="ico fas fa-arrow-left"></i>Back</button></div>' +
    '</div>';
  var b = $('#back-to-games-inline'); if (b) b.addEventListener('click', toChooser);
}

/* -------- titles -------- */
function gameTitle(id){
  switch(id){
    case 'spy':        return 'Spy';
    case 'values':     return 'Values Under Pressure';
    case 'unspoken':   return 'Values Under Pressure';
    case 'psy':        return 'Psychedelic Mix';
    case 'pantomime':  return 'Pantomime';
    case 'knowme':     return 'How Well Do You Know Me';
    default:           return 'Cards';
  }
}

/* =========================
   VALUES UNDER PRESSURE
   ========================= */
function renderValues(){ state.idx=0; state.history=[]; state.passesLeft=3; state.answered=0; drawValues(); }
function drawValues(showIndex){
  if (typeof showIndex === 'number') state.idx = clamp(showIndex,0,state.deck.length-1);
  var raw = state.deck[state.idx];
  var parts = parseVS(raw);

  state.values.protect = null;
  state.values.trade = null;

  var ctx = parts.context ? ('<div style="color:#666;font-size:14px;margin-top:4px">'+escapeHTML(parts.context)+'</div>') : '';

  panel.innerHTML =
    '<div class="tool-card" style="gap:12px">' +
      '<div class="tool-title"><i class="ico fas fa-scale-balanced"></i><span>Values Under Pressure</span></div>' +

      '<div style="font-size:18px;line-height:1.5">' +
        '<strong>'+ escapeHTML(parts.left || 'Value A') +'</strong>' +
        ' <span style="opacity:.7">vs.</span> ' +
        '<strong>'+ escapeHTML(parts.right || 'Value B') +'</strong>' +
      '</div>' + ctx +

      '<div style="display:grid;gap:10px;margin-top:8px">' +
        '<div><span style="font-weight:700">Protect:</span> ' +
          buttonChip('protect', 'left',  parts.left) + ' ' +
          buttonChip('protect', 'right', parts.right) +
        '</div>' +
        '<div><span style="font-weight:700">Trade:</span> ' +
          buttonChip('trade', 'left',  parts.left) + ' ' +
          buttonChip('trade', 'right', parts.right) +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
        '<button id="btn-lock" class="tool-actions" disabled><i class="ico fas fa-check"></i>Lock Choice</button>' +
        '<button id="btn-pass" class="tool-actions" '+(state.passesLeft<=0?'disabled':'')+'><i class="ico fas fa-forward"></i>Pass ('+state.passesLeft+' left)</button>' +
        '<button id="btn-back" class="tool-actions"><i class="ico fas fa-undo"></i>Back</button>' +
        '<button id="btn-next" class="tool-actions"><i class="ico fas fa-step-forward"></i>Next</button>' +
      '</div>' +

      '<div style="font-size:14px;color:#666;margin-top:4px">Card '+(state.idx+1)+' / '+state.deck.length+' • Answered: '+state.answered+'</div>' +
    '</div>';

  function onPick(kind, side){
    state.values[kind] = side;
    updateButtonStates();
  }
  function updateButtonStates(){
    // highlight selection chips
    $$('#panel .chip').forEach(function(b){
      var k = b.getAttribute('data-kind');
      var s = b.getAttribute('data-side');
      var active = (state.values[k] === s);
      b.classList.toggle('active', active);
      b.style.background = active ? '#111' : '#f2f2f2';
      b.style.color      = active ? '#fff' : '#222';
    });
    // enable lock when both chosen and different
    var canLock = state.values.protect && state.values.trade && (state.values.protect !== state.values.trade);
    var lockBtn = $('#btn-lock');
    if (lockBtn) lockBtn.disabled = !canLock;
  }

  $$('#panel .chip').forEach(function(b){
    b.addEventListener('click', function(){
      var k = b.getAttribute('data-kind');
      var s = b.getAttribute('data-side');
      onPick(k, s);
    });
  });

  $('#btn-lock').addEventListener('click', function(){
    state.answered++;
    state.history.push(state.idx);
    state.idx = (state.idx + 1) % state.deck.length;
    drawValues();
  });
  $('#btn-pass').addEventListener('click', function(){
    if (state.passesLeft<=0) return;
    state.passesLeft--;
    state.history.push(state.idx);
    state.idx = (state.idx + 1) % state.deck.length;
    drawValues();
  });
  $('#btn-back').addEventListener('click', function(){
    var prev = state.history.pop();
    if (typeof prev === 'number') drawValues(prev);
  });
  $('#btn-next').addEventListener('click', function(){
    state.history.push(state.idx);
    state.idx = (state.idx + 1) % state.deck.length;
    drawValues();
  });
}

function buttonChip(kind, side, label){
  var safe = escapeHTML(label || (side==='left'?'Left':'Right'));
  return '<button class="chip" data-kind="'+kind+'" data-side="'+side+'" style="display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 10px;border:1px solid #ddd;background:#f2f2f2;color:#222;cursor:pointer">'+ safe +'</button>';
}

/* tiny escape util (prevent HTML injection from deck lines) */
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

/* =========================
   SPY
   ========================= */
function renderSpySetup(){
  state.spy.players = 5; state.spy.spies = 1;
  panel.innerHTML =
    '<div class="tool-card" style="gap:12px">' +
      '<div class="tool-title"><i class="ico fas fa-user-secret"></i><span>Spy — Setup</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">' +
        '<label>Players<input id="spy-players" type="number" min="3" max="12" value="5" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ddd"/></label>' +
        '<label>Spies<input id="spy-spies" type="number" min="1" max="3" value="1" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ddd"/></label>' +
      '</div>' +
      '<div class="tool-actions"><button id="spy-start" class="tool-actions"><i class="ico fas fa-play"></i>Start</button></div>' +
      '<p style="font-size:14px;color:#666;margin-top:6px">Pass the device. Each player reveals their role privately.</p>' +
    '</div>';

  $('#spy-start').addEventListener('click', function(){
    var players = clamp(parseInt($('#spy-players').value,10)||5, 3, 12);
    var spies   = clamp(parseInt($('#spy-spies').value,10)||1, 1, Math.max(1, players-1));
    var secret  = pick(state.deck);

    state.spy.players = players;
    state.spy.spies   = spies;
    state.spy.secret  = secret;
    state.spy.revealIndex = 0;

    var roles = Array(players - spies).fill('CIVILIAN').concat(Array(spies).fill('SPY'));
    state.spy.roles = shuffle(roles);

    renderSpyReveal();
  });
}

function renderSpyReveal(){
  var i = state.spy.revealIndex, total = state.spy.players, role = state.spy.roles[i];
  panel.innerHTML =
    '<div class="tool-card" style="gap:10px">' +
      '<div class="tool-title"><i class="ico fas fa-user"></i><span>Player '+(i+1)+' of '+total+'</span></div>' +
      '<div style="display:grid;gap:10px">' +
        '<button id="reveal-btn" class="tool-actions"><i class="ico fas fa-eye"></i>Reveal</button>' +
        '<div id="reveal-card" style="display:none;padding:14px;border:1px dashed #ddd;border-radius:10px;background:#fff"><div id="reveal-text" style="font-weight:600"></div></div>' +
        '<button id="next-player" class="tool-actions" style="display:none"><i class="ico fas fa-chevron-right"></i>Next player</button>' +
      '</div>' +
    '</div>';

  $('#reveal-btn').addEventListener('click', function(){
    $('#reveal-card').style.display = 'block';
    $('#next-player').style.display = 'inline-flex';
    $('#reveal-text').textContent = (role === 'SPY') ? 'You are the SPY' : ('Secret word: ' + state.spy.secret);
  });

  $('#next-player').addEventListener('click', function(){
    state.spy.revealIndex++;
    if (state.spy.revealIndex >= total) renderSpyDiscussionStart(); else renderSpyReveal();
  });
}

function renderSpyDiscussionStart(){
  panel.innerHTML =
    '<div class="tool-card" style="gap:10px">' +
      '<div class="tool-title"><i class="ico fas fa-comments"></i><span>Discussion</span></div>' +
      '<p>Ask questions without naming the place/word. Vote to expose the spy or let the spy guess the secret.</p>' +
      '<div class="tool-actions"><button id="spy-new-round" class="tool-actions"><i class="ico fas fa-redo"></i>New Round</button></div>' +
    '</div>';
  $('#spy-new-round').addEventListener('click', renderSpySetup);
}

/* =========================
   PSYCHEDELIC MIX
   ========================= */
function renderPsy(){ state.idx=0; state.history=[]; state.passesLeft=3; state.answered=0; drawPsy(); }
function drawPsy(showIndex){
  if (typeof showIndex === 'number') state.idx = clamp(showIndex,0,state.deck.length-1);
  var prompt = state.deck[state.idx];

  panel.innerHTML =
    '<div class="tool-card" style="gap:10px">' +
      '<div class="tool-title"><i class="ico fas fa-brain"></i><span>Psychedelic Prompt</span></div>' +
      '<div style="font-size:18px;line-height:1.6">'+ escapeHTML(prompt) +'</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
        '<button id="btn-answer" class="tool-actions"><i class="ico fas fa-check"></i>Answer</button>' +
        '<button id="btn-pass" class="tool-actions" '+(state.passesLeft<=0?'disabled':'')+'><i class="ico fas fa-forward"></i>Pass ('+state.passesLeft+' left)</button>' +
        '<button id="btn-back" class="tool-actions"><i class="ico fas fa-undo"></i>Back</button>' +
        '<button id="btn-next" class="tool-actions"><i class="ico fas fa-step-forward"></i>Next</button>' +
      '</div>' +
      '<div style="font-size:14px;color:#666;margin-top:4px">Card '+(state.idx+1)+' / '+state.deck.length+' • Answered: '+state.answered+'</div>' +
    '</div>';

  function nextIdx(){ return (state.idx + 1) % state.deck.length; }
  $('#btn-answer').addEventListener('click', function(){ state.answered++; state.history.push(state.idx); state.idx = nextIdx(); drawPsy(); });
  $('#btn-pass').addEventListener('click', function(){ if (state.passesLeft<=0) return; state.passesLeft--; state.history.push(state.idx); state.idx = nextIdx(); drawPsy(); });
  $('#btn-back').addEventListener('click', function(){ var prev = state.history.pop(); if (typeof prev === 'number') drawPsy(prev); });
  $('#btn-next').addEventListener('click', function(){ state.history.push(state.idx); state.idx = nextIdx(); drawPsy(); });
}

/* =========================
   HOW WELL DO YOU KNOW ME
   ========================= */
function renderKnowMe(){ state.idx=0; state.history=[]; state.passesLeft=3; state.answered=0; drawKnowMe(); }
function drawKnowMe(showIndex){
  if (typeof showIndex === 'number') state.idx = clamp(showIndex,0,state.deck.length-1);
  var q = state.deck[state.idx];

  panel.innerHTML =
    '<div class="tool-card" style="gap:10px">' +
      '<div class="tool-title"><i class="ico fas fa-heart"></i><span>How Well Do You Know Me</span></div>' +
      '<div style="font-size:18px;line-height:1.6">'+ escapeHTML(q) +'</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
        '<button id="btn-answer" class="tool-actions"><i class="ico fas fa-check"></i>Answered</button>' +
        '<button id="btn-pass" class="tool-actions" '+(state.passesLeft<=0?'disabled':'')+'><i class="ico fas fa-forward"></i>Pass ('+state.passesLeft+' left)</button>' +
        '<button id="btn-back" class="tool-actions"><i class="ico fas fa-undo"></i>Back</button>' +
        '<button id="btn-next" class="tool-actions"><i class="ico fas fa-step-forward"></i>Next</button>' +
      '</div>' +
      '<div style="font-size:14px;color:#666;margin-top:4px">Card '+(state.idx+1)+' / '+state.deck.length+' • Answered: '+state.answered+'</div>' +
    '</div>';

  function nextIdx(){ return (state.idx + 1) % state.deck.length; }
  $('#btn-answer').addEventListener('click', function(){ state.answered++; state.history.push(state.idx); state.idx = nextIdx(); drawKnowMe(); });
  $('#btn-pass').addEventListener('click', function(){ if (state.passesLeft<=0) return; state.passesLeft--; state.history.push(state.idx); state.idx = nextIdx(); drawKnowMe(); });
  $('#btn-back').addEventListener('click', function(){ var prev = state.history.pop(); if (typeof prev === 'number') drawKnowMe(prev); });
  $('#btn-next').addEventListener('click', function(){ state.history.push(state.idx); state.idx = nextIdx(); drawKnowMe(); });
}

/* =========================
   PANTOMIME
   ========================= */
function renderPantomimeSetup(){
  panel.innerHTML =
    '<div class="tool-card" style="gap:10px">' +
      '<div class="tool-title"><i class="ico fas fa-theater-masks"></i><span>Pantomime — Setup</span></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="tool-actions" data-time="30"><i class="ico fas fa-hourglass-start"></i>30 sec</button>' +
        '<button class="tool-actions" data-time="60"><i class="ico fas fa-hourglass-half"></i>1 min</button>' +
      '</div>' +
    '</div>';

  $$('#panel [data-time]').forEach(function(b){
    b.addEventListener('click', function(){
      state.timeLeft = parseInt(b.getAttribute('data-time'), 10);
      renderPantomimeRound();
    });
  });
}

function renderPantomimeRound(){
  stopTimer();
  var prompt = pick(state.deck);
  panel.innerHTML =
    '<div class="tool-card" style="gap:12px">' +
      '<div class="tool-title"><i class="ico fas fa-theater-masks"></i><span>Act this</span></div>' +
      '<div style="font-size:20px">'+ escapeHTML(prompt) +'</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<div id="timer" style="font-weight:700">'+ state.timeLeft +'s</div>' +
        '<button id="start-timer" class="tool-actions"><i class="ico fas fa-play"></i>Start</button>' +
        '<button id="next-card" class="tool-actions"><i class="ico fas fa-step-forward"></i>Next Card</button>' +
        '<button id="change-time" class="tool-actions"><i class="ico fas fa-clock"></i>Change Time</button>' +
      '</div>' +
    '</div>';

  $('#start-timer').addEventListener('click', function(){
    stopTimer();
    startTimer(function(){
      var t = $('#timer');
      if (t) t.textContent = state.timeLeft + 's';
      if (state.timeLeft <= 0) { stopTimer(); alert('Time’s up!'); }
    });
  });
  $('#next-card').addEventListener('click', renderPantomimeRound);
  $('#change-time').addEventListener('click', renderPantomimeSetup);
}

/* -------- timer -------- */
function startTimer(onTick){
  state.timeLeft = Math.max(0, parseInt(state.timeLeft,10) || 60);
  state.timer = setInterval(function(){
    state.timeLeft--;
    if (onTick) onTick();
    if (state.timeLeft <= 0) stopTimer();
  }, 1000);
}
function stopTimer(){
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}
