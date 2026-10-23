/* Chapter prelude: native modality, progressive enhancement, no dependencies. */
(function () {
  'use strict';
  var content = document.getElementById('summary');
  var trigger = document.querySelector('[data-summary-open]');
  if (!content || !trigger || typeof HTMLDialogElement === 'undefined') return;
  var dialog = document.createElement('dialog');
  dialog.className = 'summary-dialog';
  dialog.setAttribute('aria-labelledby', 'summaryTitle');
  var bar = document.createElement('div');
  bar.className = 'summary-bar';
  var back = document.createElement('button');
  back.type = 'button';
  back.className = 'ppl-back';
  back.textContent = 'بازگشت به متن ترجمه ←';
  bar.appendChild(back);
  var status = document.createElement('span');
  status.className = 'summary-status';
  status.textContent = 'پیش‌درآمد · فصل ۱';
  bar.appendChild(status);
  var progress = document.createElement('span');
  progress.className = 'summary-progress';
  progress.setAttribute('aria-hidden', 'true');
  bar.appendChild(progress);
  dialog.appendChild(bar);
  content.parentNode.insertBefore(dialog, content);
  dialog.appendChild(content);
  var finish = back.cloneNode(true);
  finish.classList.add('summary-finish');
  finish.textContent = 'آماده‌ام؛ بازگشت به متن ترجمه ←';
  content.querySelector('.summary-wrap').appendChild(finish);

  var root = document.documentElement, savedY = 0, timer, closing = false, pushed = false;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var cards = Array.prototype.slice.call(content.querySelectorAll('.summary-card'));
  var nav = document.createElement('nav');
  nav.className = 'summary-index';
  nav.setAttribute('aria-label', 'بخش‌های خلاصهٔ فصل');
  var navTitle = document.createElement('p');
  navTitle.className = 'summary-index-title';
  navTitle.textContent = 'مسیر این پیش‌درآمد';
  nav.appendChild(navTitle);
  var links = cards.map(function (card, i) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'summary-jump';
    button.setAttribute('aria-controls', card.querySelector('h3').id);
    var num = document.createElement('span');
    num.setAttribute('aria-hidden', 'true');
    num.textContent = card.querySelector('.summary-number').textContent;
    button.appendChild(num);
    button.appendChild(document.createTextNode(card.querySelector('h3').textContent));
    button.addEventListener('click', function () {
      /* Focus the heading immediately; scroll only the dialog, never the deck. */
      var heading = card.querySelector('h3');
      heading.setAttribute('tabindex', '-1');
      heading.focus({preventScroll: true});
      var top = card.getBoundingClientRect().top - dialog.getBoundingClientRect().top + dialog.scrollTop;
      dialog.scrollTo({top: top - bar.offsetHeight - 20, behavior: reduce.matches ? 'instant' : 'smooth'});
    });
    nav.appendChild(button);
    return button;
  });
  content.querySelector('.summary-head').appendChild(nav);

  var frame = 0;
  function updateReading() {
    frame = 0;
    if (!dialog.open) return;
    var max = dialog.scrollHeight - dialog.clientHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, dialog.scrollTop / max)) : 1;
    progress.style.setProperty('--summary-progress', p);
    var active = -1, edge = bar.getBoundingClientRect().bottom + 70;
    cards.forEach(function (card, i) {
      if (card.getBoundingClientRect().top <= edge) active = i;
    });
    if (p > .99) active = cards.length - 1;
    links.forEach(function (button, i) {
      if (i === active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    status.textContent = active < 0 ? 'پیش‌درآمد · فصل ۱' : (active + 1).toLocaleString('fa-IR') + ' از ۷ · ' + cards[active].querySelector('h3').textContent;
  }
  function scheduleReading() { if (!frame) frame = requestAnimationFrame(updateReading); }
  dialog.addEventListener('scroll', scheduleReading, {passive: true});
  window.addEventListener('resize', function () {
    if (dialog.open) {
      var x = parseFloat(dialog.style.getPropertyValue('--summary-ox')) || innerWidth / 2;
      var y = parseFloat(dialog.style.getPropertyValue('--summary-oy')) || innerHeight * .42;
      dialog.style.setProperty('--summary-radius', Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + 40 + 'px');
    }
    scheduleReading();
  }, {passive: true});
  var observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-read-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {root: dialog, threshold: 0, rootMargin: '0px 0px -24px 0px'});
  }
  function open(push) {
    if (dialog.open && !closing) return;
    clearTimeout(timer);
    var wasClosing = closing;
    closing = false;
    if (!wasClosing) savedY = window.scrollY;
    var art = trigger.querySelector('.portal-side').getBoundingClientRect();
    var cx = innerWidth / 2, cy = innerHeight * .42;
    if (art.bottom > 0 && art.top < innerHeight) {
      cx = art.left + art.width / 2;
      cy = art.top + art.height / 2;
    }
    dialog.style.setProperty('--summary-ox', cx + 'px');
    dialog.style.setProperty('--summary-oy', cy + 'px');
    dialog.style.setProperty('--summary-radius', Math.ceil(Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy))) + 40 + 'px');
    root.classList.add('summary-lock');
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    cards.forEach(function (card) {
      card.classList.remove('is-read-visible');
      if (observer) observer.observe(card);
    });
    dialog.classList.toggle('has-reveals', !!observer && !reduce.matches);
    document.getElementById('summaryTitle').focus({preventScroll: true});
    /* Commit the closed shape before transitioning; no first-open flash. */
    void dialog.offsetWidth;
    requestAnimationFrame(function () { if (dialog.open && !closing) dialog.classList.add('is-open'); });
    scheduleReading();
    pushed = !!(history.state && history.state.mfaSummary);
    if (push) {
      history.pushState({mfaSummary: true}, '', '#summary');
      pushed = true;
    }
  }
  function close(fromHistory) {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.classList.remove('is-open');
    timer = setTimeout(function () {
      if (observer) observer.disconnect();
      dialog.close();
      root.classList.remove('summary-lock');
      window.scrollTo({top: savedY, behavior: 'instant'});
      trigger.focus({preventScroll: true});
      closing = false;
    }, reduce.matches ? 0 : 720);
    if (!fromHistory) {
      if (pushed) history.back();
      else if (location.hash === '#summary') history.replaceState(history.state, '', location.pathname + location.search);
    }
    pushed = false;
  }
  trigger.addEventListener('click', function (e) { e.preventDefault(); open(true); });
  back.addEventListener('click', function () { close(false); });
  finish.addEventListener('click', function () { close(false); });
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); close(false); });
  window.addEventListener('popstate', function () {
    if (location.hash === '#summary') open(false);
    else close(true);
  });
  /* Register print hooks once, not on every history navigation. */
  var printOpen = false;
  window.addEventListener('beforeprint', function () {
    printOpen = dialog.open;
    if (printOpen) dialog.close();
  });
  window.addEventListener('afterprint', function () {
    if (printOpen) { dialog.showModal(); printOpen = false; scheduleReading(); }
  });
  if (location.hash === '#summary') open(false);
})();
