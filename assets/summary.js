/* Progressive enhancement: without JS the summary remains readable in flow.
   Native dialog supplies modal inertness, focus containment and focus return. */
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
  dialog.appendChild(bar);
  content.parentNode.insertBefore(dialog, content);
  dialog.appendChild(content);
  var finish = back.cloneNode(true);
  finish.classList.add('summary-finish');
  content.querySelector('.summary-wrap').appendChild(finish);
  var root = document.documentElement, savedY = 0, timer, closing = false, pushed = false;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  function open(push) {
    if (dialog.open) return;
    clearTimeout(timer);
    closing = false;
    savedY = window.scrollY;
    root.classList.add('summary-lock');
    dialog.showModal();
    dialog.scrollTop = 0;
    document.getElementById('summaryTitle').focus({preventScroll: true});
    requestAnimationFrame(function () { if (dialog.open && !closing) dialog.classList.add('is-open'); });
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
      dialog.close();
      root.classList.remove('summary-lock');
      window.scrollTo({top: savedY, behavior: 'instant'});
      trigger.focus({preventScroll: true});
      closing = false;
    }, reduce.matches ? 0 : 650);
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
    var printOpen = false;
  window.addEventListener('beforeprint', function () {
    printOpen = dialog.open;
    if (printOpen) dialog.close();
  });
  window.addEventListener('afterprint', function () {
    if (printOpen) { dialog.showModal(); printOpen = false; }
  });
  if (location.hash === '#summary') open(false);
    else close(true);
  });
  var printOpen = false;
  window.addEventListener('beforeprint', function () {
    printOpen = dialog.open;
    if (printOpen) dialog.close();
  });
  window.addEventListener('afterprint', function () {
    if (printOpen) { dialog.showModal(); printOpen = false; }
  });
  if (location.hash === '#summary') open(false);
})();
