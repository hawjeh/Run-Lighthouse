// TXT Files
const siteFileBtn = document.getElementById("siteFile");
const siteFileTxt = document.getElementById("siteFileSelected");
if (siteFileBtn && siteFileTxt) {
  siteFileBtn.addEventListener("click", async (e) => {
    e.preventDefault()
    const res = await api.openFile("site");
    if (res) {
      siteFileTxt.value = res;
    }
  });
}

// Directory
const destFolderBtn = document.getElementById("destFolder");
const destFolderTxt = document.getElementById("destFolderSelected");
if (destFolderBtn && destFolderTxt) {
  destFolderBtn.addEventListener("click", async (e) => {
    e.preventDefault()
    const res = await api.openDirectory("dest");
    if (res) {
      destFolderTxt.value = res;
    }
  });
}

// Setting
const perfScore = document.getElementById("perfScore");
const accessScore = document.getElementById("accessScore");
const bestScore = document.getElementById("bestScore");
const seoScore = document.getElementById("seoScore");

const showPerfScore = document.getElementById("showPerfScore");
const showAccessScore = document.getElementById("showAccessScore");
const showBestScore = document.getElementById("showBestScore");
const showSeoScore = document.getElementById("showSeoScore");

const genDesktopReport = document.getElementById("genDesktopReport");
const genMobileReport = document.getElementById("genMobileReport");
const genSummaryReport = document.getElementById("genSummaryReport");
const genAuditReport = document.getElementById("genAuditReport");
const showWarningInSummaryReport = document.getElementById("showWarningInSummaryReport");

const getOption = () => {
  return {
    useGlobal: false,
    sites: [],
    file: siteFileTxt.value,
    out: destFolderTxt.value,
    showPerfScore: showPerfScore.checked,
    showAccessScore: showAccessScore.checked,
    showBestScore: showBestScore.checked,
    showSeoScore: showSeoScore.checked,
    genDesktopReport: genDesktopReport.checked,
    genMobileReport: genMobileReport.checked,
    genSummaryReport: genSummaryReport.checked,
    genAuditReport: genAuditReport.checked,
    showWarningInSummaryReport: showWarningInSummaryReport.checed,
    score: perfScore.value ? perfScore.value : 90,
    access: accessScore.value ? accessScore.value : 90,
    best: bestScore.value ? bestScore.value : 90,
    seo: seoScore.value ? seoScore.value : 90,
    categories: ['accessibility', 'best-practices', 'performance', 'seo']
  }
}

// Button
const generate = document.getElementById("generate");
const generateSummary = document.getElementById("generateSummary");
const generateAudit = document.getElementById("generateAudit");

// Spinner
const loadingReport = document.getElementById("report");

// Download Sample File
const download = document.getElementById("download");
if (download) {
  download.addEventListener("click", async (e) => {
    e.preventDefault();
    if (destFolderTxt && destFolderTxt.value) {
      action();
      await api.downloadSample(destFolderTxt.value);
      callback();
    }
  });
}

// Generate Report
if (generate) {
  generate.addEventListener("click", async (e) => {
    e.preventDefault();
    if (siteFileTxt && siteFileTxt.value && destFolderTxt && destFolderTxt.value) {
      action();
      await api.generateReport(getOption());
      callback();
    } else {
      alert('Please select Site TXT File and Destination Folder.');
    }
  });
}

// Generate Summary Report
if (generateSummary) {
  generateSummary.addEventListener("click", async (e) => {
    e.preventDefault();
    if (destFolderTxt && destFolderTxt.value) {
      action();
      await api.generateReportSummary(getOption());
      callback();
    } else {
      alert('Please select Destination Folder.');
    }
  });
}

// Generate Audit Report
if (generateAudit) {
  generateSummary.addEventListener("click", async (e) => {
    e.preventDefault();
    if (destFolderTxt && destFolderTxt.value) {
      action();
      await api.generateReportAudit(getOption());
      callback();
    } else {
      alert('Please select Destination Folder.');
    }
  });
}

// Open Folder
const openFolder = document.getElementById("openFolder");
if (openFolder) {
  openFolder.addEventListener("click", async (e) => {
    e.preventDefault();
    if (destFolderTxt && destFolderTxt.value) {
      return await api.openFolder(destFolderTxt.value);
    }
  });
}

// UI
const action = () => {
  loadingReport.classList.remove('d-none');
  download.setAttribute('disabled', 'disalbed');
  generate.setAttribute('disabled', 'disabled');
  generateSummary.setAttribute('disabled', 'disabled');
  generateAudit.setAttribute('disabled', 'disalbed');
  openFolder.setAttribute('disabled', 'disalbed');
}

const callback = () => {
  loadingReport.classList.add('d-none');
  download.removeAttribute('disabled');
  generate.removeAttribute('disabled');
  generateSummary.removeAttribute('disabled');
  generateAudit.removeAttribute('disabled');
  openFolder.removeAttribute('disabled');
  return api.openFolder(destFolderTxt.value);
}

// init
const setup = () => {
  api.init().then((setting) => {
    siteFileTxt.value = setting.file;
    destFolderTxt.value = setting.out;

    perfScore.value = setting.score;
    accessScore.value = setting.access;
    bestScore.value = setting.best;
    seoScore.value = setting.seo;
  });
}

window.onload = setup();