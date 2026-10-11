(function(){
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var all = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var rows = all('.res'), groups = all('.vgroup'), start = $('#start');
  var controls = $('#controls'), q = $('#q'), topic = $('#topic'), chips = all('.chip'), count = $('#count'), tgl = $('#tgl');
  if (!controls || !rows.length) return;
  controls.hidden = false;
  var type = 'all';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var plural = function(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); };

  function filtering(){ return !!(q.value.trim() || type !== 'all' || topic.value !== 'all'); }
  function visibleRows(){ return rows.filter(function(r){ return !r.hidden; }); }
  function syncToggle(){
    var v = visibleRows();
    var allOpen = v.length > 0 && v.every(function(r){ return r.open; });
    tgl.textContent = allOpen ? 'Collapse all' : 'Expand all';
    tgl.disabled = v.length === 0;
  }
  function apply(){
    var words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var t = topic.value;
    rows.forEach(function(r){
      var hay = r.getAttribute('data-search');
      var ok = (type === 'all' || r.getAttribute('data-type') === type) &&
        (t === 'all' || (',' + r.getAttribute('data-topics') + ',').indexOf(',' + t + ',') > -1) &&
        words.every(function(w){ return hay.indexOf(w) > -1; });
      r.hidden = !ok;
    });
    groups.forEach(function(g){ g.hidden = !all('.res', g).some(function(r){ return !r.hidden; }); });
    if (start) start.hidden = filtering();
    var v = visibleRows();
    count.textContent = '';
    if (filtering()) {
      count.appendChild(document.createTextNode(v.length ? 'Showing ' + v.length + ' of ' + plural(rows.length, 'resource') + '.' : 'No resources match.'));
      var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Clear filters'; b.addEventListener('click', clear);
      count.appendChild(b);
    } else {
      count.textContent = plural(rows.length, 'resource') + '.';
    }
    if (filtering() && v.length === 1) v[0].open = true;
    syncToggle();
  }
  function clear(){
    q.value = ''; topic.value = 'all'; setType('all', true); apply();
  }
  function setType(t, silent){
    type = t;
    chips.forEach(function(c){ c.setAttribute('aria-pressed', String(c.getAttribute('data-type') === t)); });
    if (!silent) apply();
  }
  chips.forEach(function(c){ c.addEventListener('click', function(){ setType(c.getAttribute('data-type')); }); });
  q.addEventListener('input', apply);
  topic.addEventListener('change', apply);
  tgl.addEventListener('click', function(){
    var v = visibleRows(), allOpen = v.every(function(r){ return r.open; });
    v.forEach(function(r){ r.open = !allOpen; });
    syncToggle();
  });
  rows.forEach(function(r){ r.addEventListener('toggle', syncToggle); });

  // Deep link: /tools/#<slug> opens that row and scrolls to it, on load and on hashchange.
  function openFromHash(){
    var id = ''; try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return; }
    var el = id ? document.getElementById(id) : null;
    if (!el || !el.classList || !el.classList.contains('res')) return;
    if (el.hidden) clear();
    el.open = true;
    var s = $('summary', el);
    try { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
    // Focus after the browser's own fragment handling has finished, or it resets focus to the body.
    if (s && s.focus) setTimeout(function(){ try { s.focus({ preventScroll: true }); } catch (e) { s.focus(); } }, 60);
  }
  window.addEventListener('hashchange', openFromHash);
  all('a.start-card').forEach(function(a){ a.addEventListener('click', function(){ setTimeout(openFromHash, 0); }); });
  apply();
  openFromHash();
})();
