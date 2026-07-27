
const logView = document.getElementById('logView');
const btnCopy = document.getElementById('btnCopy');
const btnOpen = document.getElementById('btnOpen');

function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appendLines(lines, maxLines) {
  const html = Array.isArray(lines)
    ? lines.map(line => `<div class="log-line">${escapeHTML(line)}</div>`).join('')
    : `<div class="log-line">${escapeHTML(lines)}</div>`;

  logView.insertAdjacentHTML('beforeend', html);

  while (logView.children.length > maxLines) {
    logView.firstElementChild.remove();
  }
}

async function initializeLogViewer() {
  try {
    let isUserScrolling = true;
    let isAutoScrollEnabled = true;

    logView.addEventListener('scroll', () => {
      if (!isUserScrolling) {
        isUserScrolling = true;
        return;
      }
      const isAtBottom = (logView.scrollHeight - logView.scrollTop - logView.clientHeight) <= 20;
      isAutoScrollEnabled = isAtBottom;
    });

    function autoScroll() {
      if (!isAutoScrollEnabled) return;
      requestAnimationFrame(() => {
        isUserScrolling = false;
        logView.scrollBy({ top: 999999, behavior: 'auto' })
      });
    }

    const { data, MAX_LOG_LINES } = await logApi.getLogData();
    appendLines(data, MAX_LOG_LINES);
    autoScroll();

    logApi.onLogLine((line) => {
      appendLines(line, MAX_LOG_LINES);
      autoScroll();
    });

  } catch (error) {
    appendLines(`Failed to load log contents: ${error.message}`, 1);
  }
}

const btnCopyLabel = btnCopy.textContent;

async function copyLog() {
  if (btnCopy.textContent !== btnCopyLabel) return;

  try {
    await navigator.clipboard.writeText(logView.innerText);

    btnCopy.textContent = 'Copied';
    btnCopy.style.background = '#10b981';
    btnCopy.style.color = '#ffffff';
    btnCopy.style.borderColor = '#10b981';

    setTimeout(() => {
      btnCopy.textContent = btnCopyLabel;
      btnCopy.style.background = '';
      btnCopy.style.color = '';
      btnCopy.style.borderColor = '';
    }, 2000);
  } catch (err) {
    alert(`Failed to copy text to clipboard: ${err}`);
  }
}

window.addEventListener('DOMContentLoaded', initializeLogViewer);
btnCopy.addEventListener('click', copyLog);
btnOpen.addEventListener('click', () => logApi.openLogFolder());