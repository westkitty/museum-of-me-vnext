/** Tiny typed DOM builder. The museum's UI is semantic HTML, not a framework. */
type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') {
      node.addEventListener(key.replace(/^on/, '').toLowerCase(), value as EventListener);
    } else if (key === 'class') {
      node.className = String(value);
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'html') {
      node.innerHTML = String(value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Trap focus inside a modal so keyboard visitors cannot fall out of it. */
export function trapFocus(container: HTMLElement): () => void {
  const selector =
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = [...container.querySelectorAll<HTMLElement>(selector)].filter(
      (n) => n.offsetParent !== null,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKeyDown);
  return () => container.removeEventListener('keydown', onKeyDown);
}
