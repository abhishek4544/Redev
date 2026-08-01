export const OVERLAY_SCRIPT = `
(function() {
  if (window.__REDEV_LOADED__) return;
  window.__REDEV_LOADED__ = true;

  const WS_URL = 'ws://localhost:3001?client=browser';
  let ws = null;
  let overlayEnabled = false;
  let currentHighlight = null;
  let selectedElement = null;
  let statusBadge = null;
  let panel = null;

  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      console.log('[Redev] Connected to backend');
      updateStatus('connected');
    };
    ws.onclose = () => {
      console.log('[Redev] Disconnected. Reconnecting in 2s...');
      updateStatus('disconnected');
      setTimeout(connect, 2000);
    };
    ws.onerror = (err) => {
      console.error('[Redev] WebSocket error:', err);
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        console.error('[Redev] Bad message:', err);
      }
    };
  }

  function handleMessage(message) {
    if (message.type === 'cli-connected') {
      updateStatus('cli-ready');
    } else if (message.type === 'awaiting-agent') {
      showAwaiting(message);
    } else if (message.type === 'agent-completed') {
      showCompleted(message);
    } else if (message.type === 'change-generated' && message.error) {
      showError(message.error);
    } else if (message.type === 'reload-requested') {
      setTimeout(() => location.reload(), 800);
    }
  }

  function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function createStatusBadge() {
    const badge = document.createElement('div');
    badge.id = '__redev_status__';
    Object.assign(badge.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '8px 12px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#fff',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '12px',
      borderRadius: '6px',
      zIndex: '2147483646',
      pointerEvents: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    });
    badge.textContent = '🥔 Redev: press Cmd+Shift+E';
    document.body.appendChild(badge);
    return badge;
  }

  function updateStatus(state) {
    if (!statusBadge) return;
    if (state === 'connected') {
      statusBadge.textContent = '🥔 Redev: connected — press Cmd+Shift+E';
      statusBadge.style.borderLeft = '3px solid #4ade80';
    } else if (state === 'cli-ready') {
      statusBadge.textContent = '🥔 Redev: CLI ready — press Cmd+Shift+E';
      statusBadge.style.borderLeft = '3px solid #60a5fa';
    } else if (state === 'enabled') {
      statusBadge.textContent = '🥔 Redev: overlay ON — click any element';
      statusBadge.style.borderLeft = '3px solid #fbbf24';
    } else if (state === 'disabled') {
      statusBadge.textContent = '🥔 Redev: press Cmd+Shift+E to enable';
      statusBadge.style.borderLeft = '3px solid #6b7280';
    } else if (state === 'disconnected') {
      statusBadge.textContent = '🥔 Redev: disconnected';
      statusBadge.style.borderLeft = '3px solid #f87171';
    }
  }

  function createHighlight() {
    const highlight = document.createElement('div');
    highlight.id = '__redev_highlight__';
    Object.assign(highlight.style, {
      position: 'fixed',
      pointerEvents: 'none',
      border: '2px solid #fbbf24',
      background: 'rgba(251, 191, 36, 0.1)',
      zIndex: '2147483647',
      transition: 'all 60ms ease-out',
      display: 'none',
      boxSizing: 'border-box',
    });
    document.body.appendChild(highlight);
    return highlight;
  }

  function positionHighlight(el) {
    if (!currentHighlight || !el) return;
    const rect = el.getBoundingClientRect();
    Object.assign(currentHighlight.style, {
      display: 'block',
      top: rect.top + 'px',
      left: rect.left + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    });
  }

  function hideHighlight() {
    if (currentHighlight) currentHighlight.style.display = 'none';
  }

  function isOverlayElement(el) {
    if (!el) return false;
    return !!el.closest('#__redev_highlight__, #__redev_status__, #__redev_panel__');
  }

  function createPanel() {
    const p = document.createElement('div');
    p.id = '__redev_panel__';
    Object.assign(p.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '360px',
      background: '#0f172a',
      color: '#e2e8f0',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      borderRadius: '10px',
      zIndex: '2147483647',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      border: '1px solid #334155',
      display: 'none',
      overflow: 'hidden',
    });
    document.body.appendChild(p);
    return p;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function showElementPanel(el) {
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML =
      '<div style="padding:12px 14px; border-bottom:1px solid #334155; background:#1e293b;">' +
      '  <div style="font-size:11px; color:#94a3b8; letter-spacing:.05em; text-transform:uppercase;">Selected element</div>' +
      '  <div style="margin-top:4px; font-size:14px; color:#f1f5f9;"><strong>' + esc(el.component) + '</strong> <span style="color:#64748b;">&lt;' + esc(el.tagName) + '&gt;</span></div>' +
      '  <div style="color:#94a3b8; margin-top:2px;">' + esc(el.file) + ':' + esc(el.line) + '</div>' +
      (el.classes && el.classes.length ? '  <div style="color:#94a3b8; margin-top:4px; word-break:break-all;">' + esc(el.classes.join(' ')) + '</div>' : '') +
      '</div>' +
      '<div style="padding:12px 14px;">' +
      '  <label style="display:block; font-size:11px; color:#94a3b8; letter-spacing:.05em; text-transform:uppercase; margin-bottom:6px;">Describe the change</label>' +
      '  <textarea id="__redev_prompt__" rows="3" style="width:100%; box-sizing:border-box; background:#1e293b; color:#e2e8f0; border:1px solid #334155; border-radius:6px; padding:8px; font-family:inherit; font-size:12px; resize:vertical;" placeholder="e.g. make the padding larger and background red"></textarea>' +
      '  <div style="display:flex; gap:8px; margin-top:8px;">' +
      '    <button id="__redev_submit__" style="flex:1; background:#3b82f6; color:#fff; border:0; padding:8px 12px; border-radius:6px; font-family:inherit; font-size:12px; font-weight:600; cursor:pointer;">Submit</button>' +
      '    <button id="__redev_cancel__" style="background:#334155; color:#e2e8f0; border:0; padding:8px 12px; border-radius:6px; font-family:inherit; font-size:12px; cursor:pointer;">Cancel</button>' +
      '  </div>' +
      '</div>';
    const ta = panel.querySelector('#__redev_prompt__');
    ta.focus();
    panel.querySelector('#__redev_submit__').onclick = () => {
      const prompt = ta.value.trim();
      if (!prompt) { ta.focus(); return; }
      send({ type: 'change-request', prompt });
      showBusy('Writing pending.json...');
    };
    panel.querySelector('#__redev_cancel__').onclick = () => {
      panel.style.display = 'none';
      selectedElement = null;
    };
  }

  function showBusy(text) {
    if (!panel) return;
    panel.innerHTML = '<div style="padding:14px;"><div style="font-size:13px; color:#f1f5f9;">' + esc(text) + '</div></div>';
  }

  function showAwaiting(msg) {
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML =
      '<div style="padding:12px 14px; border-bottom:1px solid #334155; background:#1e293b;">' +
      '  <div style="font-size:11px; color:#94a3b8; letter-spacing:.05em; text-transform:uppercase;">Run in your terminal</div>' +
      '  <div style="margin-top:4px; color:#f1f5f9;">Copy and paste this command:</div>' +
      '</div>' +
      '<div style="padding:12px 14px;">' +
      '  <pre id="__redev_cmd__" style="margin:0; padding:10px; background:#020617; color:#a7f3d0; border-radius:6px; font-size:11px; white-space:pre-wrap; word-break:break-all; max-height:180px; overflow:auto;"></pre>' +
      '  <div style="display:flex; gap:8px; margin-top:8px;">' +
      '    <button id="__redev_copy__" style="flex:1; background:#3b82f6; color:#fff; border:0; padding:8px 12px; border-radius:6px; font-family:inherit; font-size:12px; font-weight:600; cursor:pointer;">Copy command</button>' +
      '    <button id="__redev_cancel_wait__" style="background:#334155; color:#e2e8f0; border:0; padding:8px 12px; border-radius:6px; font-family:inherit; font-size:12px; cursor:pointer;">Cancel</button>' +
      '  </div>' +
      '  <div id="__redev_wait__" style="margin-top:10px; color:#94a3b8;">Waiting for agent to write completed.json&hellip;</div>' +
      '</div>';
    const pre = panel.querySelector('#__redev_cmd__');
    pre.textContent = msg.copyCommand || '';
    panel.querySelector('#__redev_copy__').onclick = () => {
      navigator.clipboard.writeText(msg.copyCommand || '').then(() => {
        panel.querySelector('#__redev_copy__').textContent = 'Copied ✓';
      });
    };
    panel.querySelector('#__redev_cancel_wait__').onclick = () => {
      send({ type: 'cancel-request' });
      panel.style.display = 'none';
    };
  }

  function showCompleted(msg) {
    if (!panel) return;
    panel.style.display = 'block';
    const files = (msg.filesEdited || []).map(esc).join(', ') || '(no files reported)';
    panel.innerHTML =
      '<div style="padding:14px; background:#064e3b; border-bottom:1px solid #065f46;">' +
      '  <div style="font-size:14px; color:#a7f3d0;">✓ Edit applied</div>' +
      '  <div style="color:#d1fae5; margin-top:4px;">' + esc(msg.summary || '') + '</div>' +
      '</div>' +
      '<div style="padding:12px 14px;">' +
      '  <div style="color:#94a3b8; font-size:11px; text-transform:uppercase; letter-spacing:.05em;">Files edited</div>' +
      '  <div style="color:#f1f5f9; margin-top:4px;">' + files + '</div>' +
      '  <div style="color:#94a3b8; margin-top:10px;">Reloading in a moment&hellip;</div>' +
      '</div>';
  }

  function showError(err) {
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML =
      '<div style="padding:14px; background:#7f1d1d;">' +
      '  <div style="font-size:14px; color:#fecaca;">✗ Error</div>' +
      '  <div style="color:#fee2e2; margin-top:4px; word-break:break-word;">' + esc(err) + '</div>' +
      '</div>' +
      '<div style="padding:12px 14px;">' +
      '  <button id="__redev_close_err__" style="background:#334155; color:#e2e8f0; border:0; padding:8px 12px; border-radius:6px; font-family:inherit; font-size:12px; cursor:pointer;">Dismiss</button>' +
      '</div>';
    panel.querySelector('#__redev_close_err__').onclick = () => { panel.style.display = 'none'; };
  }

  function extractElementData(el) {
    const rect = el.getBoundingClientRect();
    const classes = el.className && typeof el.className === 'string'
      ? el.className.split(/\\s+/).filter(Boolean)
      : [];

    const props = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-') && !attr.name.startsWith('data-redev-')) {
        props[attr.name.replace('data-', '')] = attr.value;
      }
    }

    const file = el.getAttribute('data-redev-file') || 'unknown';
    const line = parseInt(el.getAttribute('data-redev-line') || '0', 10);
    const component = el.getAttribute('data-redev-component') || el.tagName.toLowerCase();
    const confidence = file !== 'unknown' ? 0.95 : 0.4;

    return {
      id: 'sel-' + Date.now(),
      component,
      file,
      line,
      column: 0,
      tagName: el.tagName.toLowerCase(),
      classes,
      props,
      confidence,
      bounds: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  function onMouseMove(e) {
    if (!overlayEnabled) return;
    const el = e.target;
    if (isOverlayElement(el)) return;
    positionHighlight(el);
  }

  function onClick(e) {
    if (!overlayEnabled) return;
    const el = e.target;
    if (isOverlayElement(el)) return;

    e.preventDefault();
    e.stopPropagation();

    selectedElement = extractElementData(el);
    console.log('[Redev] Selected:', selectedElement);

    send({
      type: 'element-selected',
      element: selectedElement,
    });

    overlayEnabled = false;
    hideHighlight();
    updateStatus('cli-ready');
    showElementPanel(selectedElement);
  }

  function onKeyDown(e) {
    if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      overlayEnabled = !overlayEnabled;
      if (overlayEnabled) {
        updateStatus('enabled');
        send({ type: 'overlay-enabled' });
      } else {
        hideHighlight();
        updateStatus('disabled');
        send({ type: 'overlay-disabled' });
      }
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    statusBadge = createStatusBadge();
    currentHighlight = createHighlight();
    panel = createPanel();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    connect();
    console.log('[Redev] Overlay initialized. Press Cmd+Shift+E to toggle.');
  }

  init();
})();
`;
