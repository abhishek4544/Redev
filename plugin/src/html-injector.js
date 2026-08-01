export function buildOverlayTag(backendUrl) {
  return `<script src="${backendUrl}/redev/overlay.js" async></script>`;
}

export function injectOverlayIntoHtml(html, backendUrl) {
  const tag = buildOverlayTag(backendUrl);
  if (html.includes('/redev/overlay.js')) return html;
  if (html.includes('</head>')) return html.replace('</head>', `  ${tag}\n</head>`);
  if (html.includes('</body>')) return html.replace('</body>', `  ${tag}\n</body>`);
  return html + `\n${tag}\n`;
}
