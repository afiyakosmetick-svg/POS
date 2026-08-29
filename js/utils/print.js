/**
 * print.js - render a printable document into #print-root and trigger print.
 * print.css hides everything except #print-root during @media print.
 */

let printRoot;

function ensureRoot() {
  if (printRoot && document.body.contains(printRoot)) return printRoot;
  printRoot = document.getElementById('print-root');
  if (!printRoot) {
    printRoot = document.createElement('div');
    printRoot.id = 'print-root';
    printRoot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(printRoot);
  }
  return printRoot;
}

/**
 * printHtml(htmlString) - inject trusted (pre-escaped) HTML and print.
 * Returns a promise resolving after the print dialog closes.
 */
export function printHtml(htmlString) {
  const root = ensureRoot();
  root.innerHTML = htmlString;
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('afterprint', done);
      // Keep content briefly for slow renderers, then clear.
      setTimeout(() => {
        root.innerHTML = '';
        resolve();
      }, 300);
    };
    window.addEventListener('afterprint', done);
    // Give the browser a frame to lay out before printing.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.print();
      // Fallback if afterprint never fires (some browsers).
      setTimeout(done, 60000);
    }));
  });
}

/** Print an existing DOM node (clones it into print-root). */
export function printNode(node) {
  return printHtml(node.outerHTML);
}

/** Open a standalone print window (useful for popup-based receipt printers). */
export function printInWindow(htmlString, { title = 'Print', styles = [] } = {}) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) throw new Error('Popup blocked. Allow popups to print in a new window.');
  const styleLinks = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('');
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${styleLinks}</head><body>${htmlString}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.onload = () => {
    w.print();
    w.onafterprint = () => w.close();
  };
  return w;
}
