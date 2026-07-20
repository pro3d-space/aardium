const { app, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

let activeReport;

function readLogFile(path) {
  if (!path) return 'Failed to locate PRo3D log file';

  try {
      return fs.readFileSync(path, 'utf8');
  } catch (error) {
      return `Failed to read PRo3D log file '${path}': ${error}`;
  }
}

function formatDate(date, dateOnly) {
  const options = {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  };

  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));

  if (dateOnly) {
    return `${map.year}-${map.month}-${map.day}`;
  } else {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} (${timezone})`;
  }
}

function formatHeader(header) {
  const line = '-'.repeat(50);
  return `${line}\n${header}\n${line}\n`;
}

function capitalizeFirstLetter(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + '\n\n... [TRUNCATED DUE TO URL LENGTH LIMITS] ...' : text;
}

const dialogStrings = {
    crash : {
      title: 'The application closed unexpectedly',
      subtitle: 'We apologize for the inconvenience. Please help us fix this bug by reporting the issue.',
      userContext: 'What were you doing when the crash occurred? (Optional)',
      userContextPlaceholder: 'e.g., I tried to load OPC dataset XYZ.'
    },

    error : {
      title: 'An unexpected error occurred',
      subtitle: 'We apologize for the inconvenience. Please help us fix this bug by reporting the issue.',
      userContext: 'What were you doing when the error occurred? (Optional)',
      userContextPlaceholder: 'e.g., I tried to load OPC dataset XYZ.'
    },

    issue : {
      title: 'Report an issue or unexpected behavior',
      subtitle: 'Describe the issue you encountered below and submit a report.',
      userContext: 'What unexpected behavior did you observe?',
      userContextPlaceholder: 'Detail the steps taken and how the application misbehaved.'
    },
  }

function getReportDialogData() {
  if (!activeReport) {
    throw Error('No report active.');
  }

  return {
    type: activeReport.type,
    summary: activeReport.summary,
    strings: dialogStrings[activeReport.type]
  }
}

function showReportDialog(parent, type, config) {
  if (activeReport) return null;

  activeReport = {
      type: type,
      exitCode: (type === 'crash') ? config.exit.signal ?? config.exit.code : undefined,
      error: (type === 'error') ? config.error : undefined,
      date: new Date(),
      log: readLogFile(config.logFilePath),
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      version: app.getVersion(),
  }

  const truncatedLog =
    activeReport.log
      .split(/\r?\n/)
      .slice(-30)
      .join('\n');

  const systemInfo =
    `OS: ${activeReport.os}\n` +
    `Local Time: ${formatDate(activeReport.date)}\n` +
    `PRo3D Version: ${activeReport.version}\n` +
    ((type === 'crash') ? `.NET Process Exit Code: ${activeReport.exitCode}\n` : '');

  activeReport.summary =
    ((type === 'error') ? config.error + '\n\n' : '') +
    formatHeader('System Info') + systemInfo + '\n' +
    formatHeader('Application Log (Last 30 Lines)') + truncatedLog;

  let parentValid = parent && !parent.isDestroyed();

  const window = new BrowserWindow({
    icon: config.icon,
    title: `${config.title} - Report ${capitalizeFirstLetter(type)}`,
    width: 640,
    height: 520,
    minWidth: 500,
    minHeight: 450,
    parent: parentValid ? parent : null,
    modal: parentValid && process.platform !== 'linux', // https://github.com/electron/electron/issues/21128
    show: false,
    frame: true,
    webPreferences : {
      devTools: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'report-dialog-preload.js')
    }
  });

  window.setMenu(null);
  window.loadURL(`file://${__dirname}/report-dialog.html`);
  window.once('ready-to-show', () => { window.show(); window.focus(); });
  window.on('closed', () => { activeReport = null; });

  activeReport.window = window;
  return window;
}

async function saveZipReport(userNote) {
  if (!activeReport) {
    throw Error('No report active.');
  }

  const defaultName = `PRo3D-${activeReport.version}-${activeReport.type}-report-${formatDate(activeReport.date, true)}.zip`

  const { canceled, filePath } = await dialog.showSaveDialog(activeReport.window, {
    title: 'Save Report',
    defaultPath: path.join(app.getPath('desktop'), defaultName),
    filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
  });

  if (canceled || !filePath) return null;

  const zip = new AdmZip();

  const summary = (userNote) ? `${userNote}\n\n` + activeReport.summary : activeReport.summary;
  zip.addFile('report.txt', Buffer.from(summary, 'utf8'));
  zip.addFile('log.txt', Buffer.from(activeReport.log, 'utf8'));
  zip.writeZip(filePath);

  return filePath;
}

function getGitHubReportUrl(filePath, userNote) {
  const repoUrl = 'https://github.com/pro3d-space/PRo3D/issues/new';
  const description = (activeReport.type === 'crash') ? 'Application closed unexpectedly' : `Unexpected ${activeReport.type} occurred`;
  const title = encodeURIComponent(`Bug: ${description}`);

  const repro = userNote
    ? truncateText(userNote, 2000)
    : `> Please write here what you were doing or what steps we can take to reproduce this ${activeReport.type}.`

  const error = (activeReport.type === 'error')
    ? `### Error Message\n` + '```\n' + activeReport.error + '\n```\n'
    : '';

  const body = encodeURIComponent(
    `### Description\n${repro}\n\n` +
    error +
    `### Environment Details\n` +
    `- **PRo3D Version:** ${activeReport.version}\n` +
    `- **Operating System:** ${activeReport.os}\n\n` +
    `> IMPORTANT: Please attach your generated \`${path.basename(filePath)}\` file by dragging and dropping it into this issue box.`
  );

  return `${repoUrl}?title=${title}&body=${body}`;
}

function getEmailReportUrl(filePath, userNote) {
  const address = 'pro3d-support@vrvis.at'
  const description = (activeReport.type === 'crash') ? 'Application closed unexpectedly' : `Unexpected ${activeReport.type} occurred`;
  const subject = encodeURIComponent(`Bug: ${description}`);

  const repro = userNote
    ? truncateText(userNote, 1000)
    : `>> Please write here what you were doing or what steps we can take to reproduce this ${activeReport.type}. <<`

  const error = (activeReport.type === 'error')
    ? formatHeader('Error Message') + activeReport.error + '\n\n'
    : '';

  const body = encodeURIComponent(
    `Hi PRo3D Team,\n\n` +
    `${repro}\n\n` +
    error +
    formatHeader('System Information') +
    `- PRo3D Version: ${activeReport.version}\n` +
    `- Operating System: ${activeReport.os}\n\n` +
    `>> IMPORTANT: Please manually attach your generated '${path.basename(filePath)}' file to this email before hitting send. <<\n\n` +
    `Best regards`
  );

  return `mailto:${address}?subject=${subject}&body=${body}`;
}

function getReportUrl(method, filePath, userNote) {
  if (!activeReport) {
    throw Error('No report active.');
  }

  return (method === 'github')
    ? getGitHubReportUrl(filePath, userNote)
    : getEmailReportUrl(filePath, userNote);
}

module.exports = {
  getReportDialogData,
  showReportDialog,
  saveZipReport,
  getReportUrl
};