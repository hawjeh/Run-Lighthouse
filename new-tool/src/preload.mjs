import { contextBridge, ipcRenderer, shell } from "electron";
import fs from 'fs';
import path from 'path';
import { mkdirp, getFolder, getUrls, buildReport, buildReportSummary, buildReportAudit } from './helper.mjs';

contextBridge.exposeInMainWorld('api', {
  init: () => {
    return ipcRenderer.invoke('getSetting');
  },
  openFile: (type) => {
    let resp = ipcRenderer.sendSync('openFile');
    if (resp && resp.filePaths && resp.filePaths.length > 0) {
      let path = resp.filePaths[0];
      return path;
    }
    return '';
  },
  openDirectory: (type) => {
    let resp = ipcRenderer.sendSync('openDirectory');
    if (resp && resp.filePaths && resp.filePaths.length > 0) {
      let path = resp.filePaths[0];
      return path;
    }
    return '';
  },
  downloadSample: (dest) => {
    mkdirp('-p', dest);
    var content = 'https://www.websparks.sg/\t\nhttps://www.websparks.sg/about-us/';
    fs.writeFileSync(path.resolve(`${dest}/sample-site.txt`), content);
  },
  generateReport: async (option) => {
    await ipcRenderer.invoke('saveSetting', { options: option });
    let report = { desktopSetting: {}, mobileSetting: {}, desktopResults: [], mobileResults: [] };

    const items = getUrls(option);

    try {
      if (option.genMobileReport) {
        option.isMobile = true;
        option.outFolder = getFolder(option);
        for (let item of items) {
          option.site = item;
          await buildReport(option, report);
        }
      }

      if (option.genDesktopReport) {
        option.isMobile = false;
        option.outFolder = getFolder(option);
        for (let item of items) {
          option.site = item;
          await buildReport(option, report);
        }
      }
    } catch (e) {
      alert(`Lighthouse error ${e}`);
    }

    try {
      if (option.genDesktopReport || option.genMobileReport) {
        report.desktopResults.map((res) => {
          let { score, access, best, seo } = res.detail;
          if (option.score > score) {
            res.warning.push(`Performance ${score} < threshold ${option.score}`);
          }
          if (option.access > access) {
            res.warning.push(`Accessibility ${access} < threshold ${option.access}`);
          }
          if (option.best > best) {
            res.warning.push(`Best-Practices ${best} < threshold ${option.best}`);
          }
          if (option.seo > seo) {
            res.warning.push(`SEO ${score} < threshold ${option.seo}`);
          }
        });

        report.mobileResults.map((res) => {
          let { score, access, best, seo } = res.detail;
          if (option.score > score) {
            res.warning.push(`Performance ${score} < threshold ${option.score}`);
          }
          if (option.access > access) {
            res.warning.push(`Accessibility ${access} < threshold ${option.access}`);
          }
          if (option.best > best) {
            res.warning.push(`Best-Practices ${best} < threshold ${option.best}`);
          }
          if (option.seo > seo) {
            res.warning.push(`SEO ${score} < threshold ${option.seo}`);
          }
        });

        fs.writeFileSync(path.resolve(`${option.out}/summary.json`), JSON.stringify(report), 'utf8');

        if (option.genSummaryReport) {
          buildReportSummary(option.out, option);
        }

        if (option.genAuditReport) {
          buildReportAudit(option.out, option);
        }
      }
    } catch (e) {
      alert(`Build report error ${e}`);
    }
  },
  generateReportSummary: (option) => {
    buildReportSummary(option.out, option);
  },
  generateReportAudit: (option) => {
    buildReportAudit(option.out, option);
  },
  openFolder: (dest) => {
    setTimeout(() => {
      shell.openPath(path.join(dest, '/'));
    }, 1000);
  },
});