// === v23 Clean UI Extensions ===

function uiText(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}
function uiButton(text, className, onClick) {
  const btn = uiText('button', className, text);
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

