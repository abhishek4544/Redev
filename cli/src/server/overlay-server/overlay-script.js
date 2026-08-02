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
  let hoverCard = null;

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
      zIndex: '2147483647',
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

  function createHoverCard() {
    const card = document.createElement('div');
    card.id = '__redev_hover_card__';
    Object.assign(card.style, {
      position: 'fixed',
      display: 'none',
      width: '280px',
      maxWidth: 'calc(100vw - 24px)',
      background: '#ffffff',
      color: '#111827',
      border: '1px solid #d7dee8',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 12px 28px rgba(15,23,42,0.22)',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      lineHeight: '1.4',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });
    document.body.appendChild(card);
    return card;
  }

  function colorText(value) {
    if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return 'none';
    const match = value.match(/^rgba?\\(([^)]+)\\)$/);
    if (!match) return value;
    const parts = match[1].split(',').map((part) => parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part, index) => index < 3 && Number.isNaN(part))) return value;
    return '#' + parts.slice(0, 3).map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function colorValue(value) {
    const label = colorText(value);
    if (label === 'none') return '<span style="color:#6b7280;">none</span>';
    return '<span style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">' +
      '<span style="display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid #9ca3af;background:' + esc(label) + ';"></span>' +
      '<span>' + esc(label) + '</span></span>';
  }

  function hoverField(label, value) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 0;">' +
      '<span style="color:#6b7280;">' + esc(label) + '</span><span style="color:#111827;font-weight:500;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + value + '</span>' +
      '</div>';
  }

  function selectorFor(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
    const className = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2) : [];
    return tag + (className.length ? '.' + className.join('.') : '');
  }

  function showHoverCard(el) {
    if (!hoverCard || !el || el === document.body || el === document.documentElement) return;
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    hoverCard.innerHTML =
      '<div style="padding:10px 12px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;">' +
      '  <div style="font-size:11px;color:#374151;font-weight:700;">Redev · hover to inspect</div>' +
      '  <div style="margin-top:5px;color:#111827;font-size:15px;font-weight:700;word-break:break-word;">' + esc(selectorFor(el)) + '</div>' +
      '  <div style="margin-top:2px;color:#6b7280;">' + Math.round(rect.width) + ' × ' + Math.round(rect.height) + '</div>' +
      '</div>' +
      '<div style="padding:10px 12px;">' +
      hoverField('Text color', colorValue(computed.color)) +
      hoverField('Background', colorValue(computed.backgroundColor)) +
      hoverField('Font family', esc(computed.fontFamily)) +
      hoverField('Font size', esc(computed.fontSize)) +
      '</div>';
    hoverCard.style.display = 'block';
    const cardWidth = Math.min(280, window.innerWidth - 24);
    hoverCard.style.width = cardWidth + 'px';
    const cardRect = hoverCard.getBoundingClientRect();
    let left = Math.max(12, Math.min(rect.left, window.innerWidth - cardRect.width - 12));
    let top = rect.bottom + 12;
    if (top + cardRect.height > window.innerHeight - 12) top = rect.top - cardRect.height - 12;
    top = Math.max(12, Math.min(top, window.innerHeight - cardRect.height - 12));
    hoverCard.style.left = left + 'px';
    hoverCard.style.top = top + 'px';
  }

  function hideHoverCard() {
    if (hoverCard) hoverCard.style.display = 'none';
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
      width: '420px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100vh - 40px)',
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
      overflow: 'auto',
    });
    document.body.appendChild(p);
    return p;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function styleField(label, value, swatch) {
    const safeValue = value && value !== 'normal' ? value : '—';
    const colorSwatch = swatch && swatch !== 'transparent' && swatch !== 'rgba(0, 0, 0, 0)'
      ? '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;border:1px solid #64748b;vertical-align:-1px;background:' + esc(swatch) + ';"></span>'
      : '';
    return '<div style="min-width:0;padding:7px 8px;border:1px solid #334155;border-radius:6px;background:#111c31;">' +
      '<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;">' + esc(label) + '</div>' +
      '<div style="margin-top:2px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + colorSwatch + esc(safeValue) + '</div>' +
      '</div>';
  }

  function styleSection(title, fields) {
    return '<div style="margin-top:10px;">' +
      '<div style="margin-bottom:6px;font-size:11px;color:#cbd5e1;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">' + esc(title) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' + fields.join('') + '</div>' +
      '</div>';
  }

  function showElementPanel(el) {
    if (!panel) return;
    const styles = el.computedStyle || {};
    const selectedKind = el.selectionKind === 'content' ? 'content' : 'container';
    const styleSnapshot =
      '<div style="padding:12px 14px;border-bottom:1px solid #334155;background:#0f1b30;">' +
      '  <div style="display:flex;align-items:center;justify-content:space-between;">' +
      '    <div style="font-size:11px;color:#94a3b8;letter-spacing:.05em;text-transform:uppercase;">Style snapshot</div>' +
      '    <span style="font-size:10px;color:#94a3b8;padding:3px 6px;border:1px solid #334155;border-radius:999px;">' + esc(selectedKind) + '</span>' +
      '  </div>' +
      styleSection('Typography', [
        styleField('Font family', styles.fontFamily),
        styleField('Weight', styles.fontWeight),
        styleField('Size', styles.fontSize),
        styleField('Line height', styles.lineHeight),
        styleField('Letter spacing', styles.letterSpacing),
        styleField('Alignment', styles.textAlign),
      ]) +
      styleSection('Layout & spacing', [
        styleField('Display', styles.display),
        styleField('Position', styles.position),
        styleField('Width', styles.width),
        styleField('Height', styles.height),
        styleField('Padding top', styles.paddingTop),
        styleField('Padding right', styles.paddingRight),
        styleField('Padding bottom', styles.paddingBottom),
        styleField('Padding left', styles.paddingLeft),
        styleField('Margin top', styles.marginTop),
        styleField('Margin bottom', styles.marginBottom),
        styleField('Gap', styles.gap),
        styleField('Top', styles.top),
        styleField('Right', styles.right),
        styleField('Bottom', styles.bottom),
        styleField('Left', styles.left),
        styleField('Content position', (styles.justifyContent || '—') + ' / ' + (styles.alignItems || '—')),
      ]) +
      styleSection('Surface', [
        styleField('Background', styles.backgroundColor, styles.backgroundColor),
        styleField('Text color', styles.color, styles.color),
        styleField('Radius', styles.borderRadius),
        styleField('Border', styles.border),
      ]) +
      '</div>';
    panel.style.display = 'block';
    panel.innerHTML =
      '<div style="padding:12px 14px; border-bottom:1px solid #334155; background:#1e293b;">' +
      '  <div style="font-size:11px; color:#94a3b8; letter-spacing:.05em; text-transform:uppercase;">Selected element</div>' +
      '  <div style="margin-top:4px; font-size:14px; color:#f1f5f9;"><strong>' + esc(el.component) + '</strong> <span style="color:#64748b;">&lt;' + esc(el.tagName) + '&gt;</span></div>' +
      '  <div style="color:#94a3b8; margin-top:2px;">' + esc(el.file) + ':' + esc(el.line) + '</div>' +
      '</div>' +
      styleSnapshot +
      (el.classes && el.classes.length ? '<details style="padding:9px 14px;border-bottom:1px solid #334155;"><summary style="cursor:pointer;color:#94a3b8;font-size:11px;">Source classes</summary><div style="margin-top:6px;color:#94a3b8;word-break:break-all;line-height:1.45;">' + esc(el.classes.join(' ')) + '</div></details>' : '') +
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

 function showCompactElementPanel(el) {
   if (!panel) return;
   const styles = el.computedStyle || {};
   const changed = {};
   let promptDirty = false;
   const canEditSharedComponent = el.componentScopeAvailable === true;
   let editScope = canEditSharedComponent && el.editScope !== 'instance' ? 'component' : 'instance';
   el.editScope = editScope;
   const panelStyle = {
     top: '12px',
     right: '12px',
     bottom: '12px',
     width: 'min(380px, calc(100vw - 24px))',
     maxWidth: 'calc(100vw - 24px)',
     height: 'calc(100vh - 24px)',
     maxHeight: 'calc(100vh - 24px)',
     overflow: 'hidden',
     borderRadius: '14px',
     background: '#1f1f1f',
     color: '#f5f5f5',
     fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
     fontSize: '13px',
     lineHeight: '1.35',
     border: '1px solid #3f3f46',
     boxShadow: '0 20px 60px rgba(0,0,0,.42)',
   };
   Object.assign(panel.style, panelStyle);

   function hexColor(value) {
     const hex = colorText(value);
     return /^#[0-9A-F]{6}$/i.test(hex) ? hex.toLowerCase() : '#ffffff';
   }
   function valueFor(key) {
     return styles[key] || '';
   }
   function inputField(label, key, type) {
     const value = valueFor(key);
     const inputType = type || 'text';
     const inputValue = inputType === 'color' ? hexColor(value) : value;
     const style = inputType === 'color'
       ? 'width:100%;height:34px;padding:3px;border:1px solid #45454d;border-radius:7px;background:#2b2b2f;cursor:pointer;'
       : 'width:100%;box-sizing:border-box;height:34px;padding:0 9px;border:1px solid #45454d;border-radius:7px;background:#2b2b2f;color:#f5f5f5;font:inherit;outline:none;';
     return '<label style="display:flex;flex-direction:column;gap:5px;min-width:0;">' +
       '<span style="font-size:11px;color:#a1a1aa;">' + esc(label) + '</span>' +
       '<input data-redev-style="' + esc(key) + '" type="' + inputType + '" value="' + esc(inputValue) + '" style="' + style + '" /></label>';
   }
   function selectField(label, key, options) {
     const current = valueFor(key);
     return '<label style="display:flex;flex-direction:column;gap:5px;min-width:0;">' +
       '<span style="font-size:11px;color:#a1a1aa;">' + esc(label) + '</span>' +
       '<select data-redev-style="' + esc(key) + '" style="width:100%;box-sizing:border-box;height:34px;padding:0 7px;border:1px solid #45454d;border-radius:7px;background:#2b2b2f;color:#f5f5f5;font:inherit;outline:none;">' +
       options.map((option) => '<option value="' + esc(option) + '"' + (option === current ? ' selected' : '') + '>' + esc(option) + '</option>').join('') +
       '</select></label>';
   }
   function section(title, content) {
     return '<section style="padding:14px 15px;border-bottom:1px solid #34343a;">' +
       '<div style="margin-bottom:10px;font-size:12px;font-weight:700;color:#f4f4f5;">' + esc(title) + '</div>' + content + '</section>';
   }
   function grid(content) {
     return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' + content + '</div>';
   }
   function scopeControls() {
     if (!canEditSharedComponent) return '';
     const option = (value, title, description) =>
       '<label style="display:flex;gap:8px;align-items:flex-start;padding:9px;border:1px solid ' +
       (editScope === value ? '#a1a1aa' : '#45454d') +
       ';border-radius:8px;background:' + (editScope === value ? '#34343a' : '#2b2b2f') + ';cursor:pointer;">' +
       '<input data-redev-scope type="radio" name="__redev_edit_scope__" value="' + value + '"' +
       (editScope === value ? ' checked' : '') + ' style="margin:2px 0 0;accent-color:#f4f4f5;" />' +
       '<span><strong style="display:block;color:#f4f4f5;font-size:12px;">' + esc(title) + '</strong>' +
       '<span style="display:block;margin-top:2px;color:#a1a1aa;font-size:11px;line-height:1.35;">' + esc(description) + '</span></span></label>';
     return '<div style="display:grid;gap:8px;">' +
       option('component', 'Shared ' + el.component, 'Update every instance of this component.') +
       option('instance', 'This instance only', 'Keep the shared component unchanged.') +
       '</div>';
   }
   function promptText() {
     const entries = Object.keys(changed);
     const summary = entries.length
       ? entries.map((key) => key + ': ' + changed[key]).join('; ')
       : 'the selected element’s visual styling';
     const scopeInstruction = editScope === 'component'
       ? 'Apply it to the shared ' + el.component + ' component so every instance stays consistent.'
       : 'Apply it only to this selected instance and leave the shared component unchanged.';
     return 'Update ' + selectorFor(el) + ' in ' + (el.file || 'the source file') + ': ' + summary + '. ' + scopeInstruction + ' Keep the rest of the component unchanged.';
   }
   function updatePrompt() {
     const prompt = panel.querySelector('#__redev_prompt__');
     if (prompt && !promptDirty) prompt.value = promptText();
     const count = panel.querySelector('#__redev_change_count__');
     if (count) {
       const total = Object.keys(changed).length;
       count.textContent = total ? total + ' pending style change' + (total === 1 ? '' : 's') : 'Preview changes, then send them to your agent';
     }
   }
   function applyStyle(key, rawValue) {
     let value = rawValue;
     const pixelKeys = ['fontSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap'];
     if (pixelKeys.indexOf(key) !== -1 && value && /^-?\d+(\.\d+)?$/.test(value)) value += 'px';
     el.style[key] = value;
     styles[key] = value;
     changed[key] = value;
     updatePrompt();
   }

   const typography = grid(
     inputField('Font family', 'fontFamily') +
     selectField('Weight', 'fontWeight', ['300', '400', '500', '600', '700', '800']) +
     inputField('Font size', 'fontSize') +
     inputField('Line height', 'lineHeight') +
     inputField('Letter spacing', 'letterSpacing') +
     selectField('Text align', 'textAlign', ['left', 'center', 'right', 'justify'])
   );
   const spacing = grid(
     inputField('Padding top', 'paddingTop') +
     inputField('Padding right', 'paddingRight') +
     inputField('Padding bottom', 'paddingBottom') +
     inputField('Padding left', 'paddingLeft') +
     inputField('Gap', 'gap') +
     selectField('Display', 'display', ['block', 'flex', 'grid', 'inline-flex', 'inline-block', 'none'])
   );
   const layout = grid(
     selectField('Justify', 'justifyContent', ['normal', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around']) +
     selectField('Align items', 'alignItems', ['normal', 'stretch', 'flex-start', 'center', 'flex-end']) +
     inputField('Width', 'width') +
     inputField('Height', 'height')
   );
   const surface = grid(
     inputField('Text color', 'color', 'color') +
     inputField('Background', 'backgroundColor', 'color') +
     inputField('Radius', 'borderRadius') +
     inputField('Border', 'border')
   );

   panel.style.display = 'block';
   panel.innerHTML =
     '<div style="height:58px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 15px;border-bottom:1px solid #34343a;background:#252529;position:sticky;top:0;z-index:2;">' +
     '<div style="min-width:0;"><div style="font-size:10px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.12em;">Selected element</div><div style="margin-top:3px;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(selectorFor(el)) + '</div></div>' +
     '<button id="__redev_close__" aria-label="Close inspector" style="width:30px;height:30px;border:0;border-radius:7px;background:#34343a;color:#d4d4d8;font-size:18px;cursor:pointer;">×</button></div>' +
     '<div id="__redev_inspector_scroll__" style="height:calc(100% - 198px);overflow:auto;">' +
     (canEditSharedComponent ? section('Apply changes to', scopeControls()) : '') +
     section('Typography', typography) +
     section('Spacing', spacing) +
     section('Layout', layout) +
     section('Surface', surface) +
     '<section style="padding:14px 15px;"><details><summary style="cursor:pointer;color:#a1a1aa;font-size:11px;">Source context</summary><div style="margin-top:8px;color:#a1a1aa;word-break:break-word;">' + esc(el.file) + ':' + esc(el.line) + '<br />' + esc(el.classes && el.classes.join(' ') || '') + '</div></details></section></div>' +
     '<div style="height:140px;box-sizing:border-box;padding:10px 15px 12px;border-top:1px solid #3f3f46;background:#252529;position:absolute;left:0;right:0;bottom:0;">' +
     '<div id="__redev_change_count__" style="margin-bottom:5px;font-size:10px;color:#a1a1aa;">Preview changes, then send them to your agent</div>' +
     '<textarea id="__redev_prompt__" rows="2" style="width:100%;height:49px;box-sizing:border-box;resize:none;padding:8px;border:1px solid #45454d;border-radius:7px;background:#2b2b2f;color:#f4f4f5;font:12px/1.35 ui-sans-serif,system-ui,sans-serif;outline:none;" placeholder="Describe a change manually or edit the generated request"></textarea>' +
     '<div style="display:flex;gap:8px;margin-top:8px;"><button id="__redev_submit__" style="flex:1;height:32px;border:0;border-radius:7px;background:#f4f4f5;color:#18181b;font-size:12px;font-weight:700;cursor:pointer;">Send to agent</button><button id="__redev_reset_prompt__" style="height:32px;padding:0 10px;border:1px solid #45454d;border-radius:7px;background:#2b2b2f;color:#d4d4d8;font-size:11px;cursor:pointer;">Auto</button></div></div>';

   panel.querySelectorAll('[data-redev-style]').forEach((input) => {
     input.addEventListener('input', () => applyStyle(input.getAttribute('data-redev-style'), input.value));
     input.addEventListener('change', () => applyStyle(input.getAttribute('data-redev-style'), input.value));
   });
   panel.querySelectorAll('[data-redev-scope]').forEach((input) => {
     input.addEventListener('change', () => {
       if (!input.checked) return;
       editScope = input.value;
       el.editScope = editScope;
       promptDirty = false;
       updatePrompt();
     });
   });
   panel.querySelector('#__redev_prompt__').addEventListener('input', () => { promptDirty = true; });
   panel.querySelector('#__redev_reset_prompt__').onclick = () => { promptDirty = false; updatePrompt(); };
   panel.querySelector('#__redev_submit__').onclick = () => {
     const prompt = panel.querySelector('#__redev_prompt__').value.trim();
     if (!prompt) return;
     send({ type: 'change-request', prompt, editScope });
     showBusy('Writing pending.json...');
   };
   panel.querySelector('#__redev_close__').onclick = () => {
     panel.style.display = 'none';
     selectedElement = null;
   };
   updatePrompt();
 }

 function showBusy(text) {
    if (!panel) return;
    panel.innerHTML = '<div style="padding:14px;"><div style="font-size:13px; color:#f1f5f9;">' + esc(text) + '</div></div>';
  }

  function showAwaiting(msg) {
    if (!panel) return;
    panel.style.display = 'block';
    const shellCmd = msg.copyCommand || '';
    const chatPrompt = msg.pendingPath
      ? 'Read ' + msg.pendingPath + ', follow the instructions inside, then write completed.json in the same folder when done.'
      : (msg.promptForAgent || '');

    panel.innerHTML =
      '<div style="padding:12px 14px; border-bottom:1px solid #334155; background:#1e293b;">' +
      '  <div style="font-size:11px; color:#94a3b8; letter-spacing:.05em; text-transform:uppercase;">Send to your agent</div>' +
      '  <div style="display:flex; gap:6px; margin-top:8px;">' +
      '    <button id="__redev_tab_shell__" data-tab="shell" class="__redev_tab__" style="flex:1; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; border:1px solid #3b82f6; background:#3b82f6; color:#fff;">Terminal</button>' +
      '    <button id="__redev_tab_chat__" data-tab="chat" class="__redev_tab__" style="flex:1; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; border:1px solid #334155; background:transparent; color:#cbd5e1;">Claude Code chat</button>' +
      '  </div>' +
      '</div>' +
      '<div style="padding:12px 14px;">' +
      '  <div id="__redev_hint__" style="font-size:11px; color:#94a3b8; margin-bottom:6px;"></div>' +
      '  <pre id="__redev_cmd__" style="margin:0; padding:10px; background:#020617; color:#a7f3d0; border-radius:6px; font-size:11px; white-space:pre-wrap; word-break:break-all; max-height:180px; overflow:auto;"></pre>' +
      '  <div style="display:flex; gap:8px; margin-top:8px;">' +
      '    <button id="__redev_copy__" style="flex:1; background:#3b82f6; color:#fff; border:0; padding:8px 12px; border-radius:6px; font-family:inherit; font-size:12px; font-weight:600; cursor:pointer;">Copy</button>' +
      '    <button id="__redev_cancel_wait__" style="background:#334155; color:#e2e8f0; border:0; padding:8px 12px; border-radius:6px; font-family:inherit; font-size:12px; cursor:pointer;">Cancel</button>' +
      '  </div>' +
      '  <div id="__redev_wait__" style="margin-top:10px; color:#94a3b8; font-size:11px;">Waiting for agent to write completed.json&hellip;</div>' +
      '</div>';

    const pre = panel.querySelector('#__redev_cmd__');
    const hint = panel.querySelector('#__redev_hint__');
    const copyBtn = panel.querySelector('#__redev_copy__');
    const tabShell = panel.querySelector('#__redev_tab_shell__');
    const tabChat = panel.querySelector('#__redev_tab_chat__');
    let currentText = shellCmd;
    let currentMode = 'shell';

    function setMode(mode) {
      currentMode = mode;
      copyBtn.textContent = 'Copy';
      if (mode === 'shell') {
        currentText = shellCmd;
        pre.textContent = shellCmd;
        hint.textContent = 'Paste this in a NEW terminal tab — spawns Claude Code headless.';
        tabShell.style.background = '#3b82f6'; tabShell.style.color = '#fff'; tabShell.style.borderColor = '#3b82f6';
        tabChat.style.background = 'transparent'; tabChat.style.color = '#cbd5e1'; tabChat.style.borderColor = '#334155';
      } else {
        currentText = chatPrompt;
        pre.textContent = chatPrompt;
        hint.textContent = 'Paste this into your existing Claude Code chat — uses the current session.';
        tabChat.style.background = '#3b82f6'; tabChat.style.color = '#fff'; tabChat.style.borderColor = '#3b82f6';
        tabShell.style.background = 'transparent'; tabShell.style.color = '#cbd5e1'; tabShell.style.borderColor = '#334155';
      }
    }
    setMode('shell');

    tabShell.onclick = () => setMode('shell');
    tabChat.onclick = () => setMode('chat');

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(currentText).then(() => {
        copyBtn.textContent = 'Copied ✓';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1400);
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

    const mappedFile = el.getAttribute('data-redev-file');
    const reactSource = mappedFile ? null : findReactDebugSource(el);
    const file = mappedFile || (reactSource && reactSource.file) || 'unknown';
    const line = parseInt(el.getAttribute('data-redev-line') || String((reactSource && reactSource.line) || 0), 10);
    const component = el.getAttribute('data-redev-component') || (reactSource && reactSource.component) || el.tagName.toLowerCase();
    const componentScopeAvailable = file !== 'unknown' && component.toLowerCase() !== el.tagName.toLowerCase();
    const confidence = mappedFile ? 0.95 : reactSource ? 0.75 : 0.4;

    const computed = window.getComputedStyle(el);
    const hasDirectText = Array.from(el.childNodes || []).some((node) => node.nodeType === 3 && (node.textContent || '').trim());
    const contentTag = /^(A|BUTTON|CODE|EM|H1|H2|H3|H4|H5|H6|LABEL|LI|P|SMALL|SPAN|STRONG|TEXTAREA)$/.test(el.tagName);
    const computedStyle = {
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      textAlign: computed.textAlign,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      display: computed.display,
      position: computed.position,
      width: Math.round(rect.width * 100) / 100 + 'px',
      height: Math.round(rect.height * 100) / 100 + 'px',
      paddingTop: computed.paddingTop,
      paddingRight: computed.paddingRight,
      paddingBottom: computed.paddingBottom,
      paddingLeft: computed.paddingLeft,
      marginTop: computed.marginTop,
      marginBottom: computed.marginBottom,
      gap: computed.gap,
      top: computed.top,
      right: computed.right,
      bottom: computed.bottom,
      left: computed.left,
      justifyContent: computed.justifyContent,
      alignItems: computed.alignItems,
      borderRadius: computed.borderRadius,
      border: computed.border,
    };

    // richer hints so MCP-mode agents can find the source file without a bundler plugin
    const text = (el.innerText || el.textContent || '').trim().slice(0, 200);
    const xpath = buildXPath(el);
    const id_attr = el.id || null;

    return {
      id: 'sel-' + Date.now(),
      component,
      componentScopeAvailable,
      editScope: componentScopeAvailable ? 'component' : 'instance',
      file,
      line,
      column: 0,
      tagName: el.tagName.toLowerCase(),
      classes,
      props,
      text,
      xpath,
      elementId: id_attr,
      confidence,
      selectionKind: hasDirectText || contentTag ? 'content' : 'container',
      computedStyle,
      bounds: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  function findReactDebugSource(el) {
    let node = el;
    while (node && node instanceof Element) {
      const fiberKey = Object.keys(node).find((key) => key.indexOf('__reactFiber$') === 0);
      const fiber = fiberKey ? node[fiberKey] : null;
      if (fiber) {
        let current = fiber;
        let source = null;
        let component = null;
        while (current) {
          if (!source && current._debugSource && current._debugSource.fileName) {
            source = current._debugSource;
          }
          const type = current.elementType || current.type;
          const name = typeof type === 'function'
            ? (type.displayName || type.name)
            : (type && (type.displayName || type.name));
          if (name && name.charAt(0) === name.charAt(0).toUpperCase()) {
            component = name;
          }
          if (source && component) {
            return {
              file: String(source.fileName).replace(/^file:\/\//, ''),
              line: source.lineNumber || 0,
              component,
            };
          }
          current = current.return;
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function buildXPath(el) {
    if (!el || el === document.body) return '/html/body';
    if (el.id) return '//*[@id="' + el.id + '"]';
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      let idx = 1;
      let sib = node.previousSibling;
      while (sib) {
        if (sib.nodeType === 1 && sib.tagName === node.tagName) idx++;
        sib = sib.previousSibling;
      }
      parts.unshift(node.tagName.toLowerCase() + '[' + idx + ']');
      node = node.parentElement;
    }
    return '/html/body/' + parts.join('/');
  }

  function onMouseMove(e) {
    if (!overlayEnabled) { hideHoverCard(); return; }
    const el = e.target;
    if (!(el instanceof Element) || isOverlayElement(el)) { hideHoverCard(); return; }
    positionHighlight(el);
    showHoverCard(el);
  }

  function onClick(e) {
    if (!overlayEnabled) return;
    const el = e.target;
    if (isOverlayElement(el)) return;

    e.preventDefault();
    e.stopPropagation();
    hideHoverCard();

    selectedElement = extractElementData(el);
    console.log('[Redev] Selected:', selectedElement);

    send({
      type: 'element-selected',
      element: selectedElement,
    });

    overlayEnabled = false;
    hideHighlight();
    updateStatus('cli-ready');
    if (typeof showCompactElementPanel === 'function') showCompactElementPanel(selectedElement);
    else showElementPanel(selectedElement);
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
        hideHoverCard();
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
    hoverCard = createHoverCard();
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
