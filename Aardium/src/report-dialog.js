const title = document.getElementById('title');
const subtitle = document.getElementById('subtitle');
const detailsView = document.getElementById('detailsView');
const userContext = document.getElementById('userContext');
const userContextLabel = document.getElementById('userContextLabel');
const btnCopy = document.getElementById('btnCopy');
const btnSave = document.getElementById('btnSave');
const btnGitHub = document.getElementById('btnGitHub');
const btnEmail = document.getElementById('btnEmail');
const btnToggleAccordion = document.getElementById('btnToggleAccordion');
const accordionBox = document.querySelector('.accordion-box');
const statusRibbon = document.getElementById('statusRibbon');
const ribbonText = document.getElementById('ribbonText');
const ribbonActions = document.getElementById('ribbonActions');

async function initializeReporter() {
  try {
    const data = await reportApi.getReportDialogData();

    title.classList.add(data.type);
    title.textContent = data.strings.title;
    subtitle.textContent = data.strings.subtitle;
    userContextLabel.textContent = data.strings.userContext;
    userContext.placeholder = data.strings.userContextPlaceholder;
    detailsView.textContent = data.summary;

  } catch (error) {
    detailsView.textContent = `Failed to load report details: ${error.message}`;
  }
}

const btnCopyLabel = btnCopy.textContent;

async function copySummary() {
  if (btnCopy.textContent !== btnCopyLabel) return;

  try {
    const summary = (userContext.value) ? `${userContext.value}\n\n` + detailsView.textContent : detailsView.textContent;
    await navigator.clipboard.writeText(summary);

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
    alert('Failed to copy text to clipboard.');
  }
}

function hideRibbon() {
  statusRibbon.classList.add('hidden');
}

function showRibbon(type, messageText) {
  hideRibbon();
  void statusRibbon.offsetWidth; // Trigger reflow

  statusRibbon.classList.remove('success', 'error', 'hidden');

  statusRibbon.classList.add(type);
  ribbonText.innerHTML = messageText;

  if (type === 'success') {
    ribbonActions.classList.remove('hidden');
  } else {
    ribbonActions.classList.add('hidden');
  }
}

let savedReport;

async function saveReport() {
  btnSave.disabled = true;

  try {
    const userNote = userContext.value;
    const result = await reportApi.saveZipReport(userNote);

    if (result.status === 'success') {
      savedReport = { filePath: result.filePath, userNote: userNote };
      const tooltip = `Saved to: ${result.filePath}`;
      const html = `<span class="ribbon-file-path-highlight" title="${tooltip}"><strong>Report saved successfully.</strong></span> Finish reporting your issue via:`;
      showRibbon('success', html);

    } else if (result.status === 'canceled') {
      hideRibbon();

    } else {
      showRibbon('error', `<strong>Failed to save report:</strong> ${result.error || 'Unknown error'}`);
    }

  } catch (error) {
    showRibbon('error', `<strong>${error.name}:</strong> ${error.message}`);

  } finally {
    btnSave.disabled = false;
  }
}

async function submitReport(method) {
  try {
    const result = await reportApi.submitReport(method, savedReport.filePath, savedReport.userNote);
    if (result.status !== 'success') {
      showRibbon('error', `<strong>Failed to submit report:</strong> ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    showRibbon('error', `<strong>${error.name}:</strong> ${error.message}`);
  }
}

function handleToggleAccordion() {
  accordionBox.classList.toggle('open');
}

window.addEventListener('DOMContentLoaded', initializeReporter);
btnCopy.addEventListener('click', copySummary);
btnSave.addEventListener('click', saveReport);
btnGitHub.addEventListener('click', () => submitReport('github'));
btnEmail.addEventListener('click', () => submitReport('email'));
btnToggleAccordion.addEventListener('click', handleToggleAccordion);