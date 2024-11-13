import { ipcRenderer } from "electron";
import fs from 'fs';
import path from 'path';
import { launch } from 'chrome-launcher';

const getFolder = (option) => {
  // remove and create new folder
  const out = path.join(option.out, option.isMobile ? 'mobile' : 'desktop');
  try {
    const outfiles = fs.readdirSync(out);
    outfiles.forEach((f) => {
      const oldFile = path.join(out, f);
      rm('-f', oldFile);
    });
    const files = fs.readdirSync(out);
    files.forEach((f) => {
      const oldFile = path.join(out, f);
      rm('-f', oldFile);
    });
  } catch (e) { }
  mkdirp(out);
  return out;
};

const getUrls = (option) => {
  let sites = [];
  if (option.file) {
    try {
      const contents = fs.readFileSync(option.file, 'utf8');
      sites = contents.trim().split('\n');
    } catch (e) {
      console.error(`Failed to read file ${option.file}, aborting.\n`, e);
      log('Exiting with code 1');
      process.exit(1);
    }
  }
  if (option.sites) {
    sites = sites.concat(option.sites);
  }
  const existingNames = {};
  return sites.map((url) => {
    url = url.trim();
    if (!url.match(/^https?:/)) {
      if (!url.startsWith('//')) url = `//${url}`;
      url = `https:${url}`;
    }
    const origName = siteName(url);
    let name = origName;

    // if the same page is being tested multiple times then
    // give each one an incremented name to avoid collisions
    let j = 1;
    while (existingNames[name]) {
      name = `${origName}_${j}`;
      j++;
    }
    existingNames[name] = true;

    const info = {
      url,
      name,
      file: `${name}.html`,
    };
    return info;
  });
};

const siteName = (site) => {
  const maxLength = 100;
  let name = site.replace(/^https?:\/\//, '').replace(/[\/\?#:\*\$@\!\.]/g, '_');

  if (name.length > maxLength) {
    const hash = cyrb53(name).slice(0, 7);

    name = name.slice(0, maxLength).replace(/_+$/g, ''); // trim any `_` suffix
    name = `${name}_${hash}`;
  }
  return name;
};

const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

const mkdirp = (dir) => {
  if (fs.existsSync(dir)) { return true }
  const dirname = path.dirname(dir)
  mkdirp(dirname);
  fs.mkdirSync(dir);
}

const groupBy = function (xs, key) {
  return xs.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

const buildReport = async (option, report) => {
  const chrome = await launch({ chromeFlags: ['--no-sandbox', '--headless', '--disable-gpu'] });
  let options = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: option.categories,
    port: chrome.port,
    formFactor: option.isMobile ? 'mobile' : 'desktop',
    throttling: option.isMobile ?
      {
        "rttMs": 150,
        "throughputKbps": 1638.4,
        "requestLatencyMs": 562.5,
        "downloadThroughputKbps": 1474.5600000000002,
        "uploadThroughputKbps": 675,
        "cpuSlowdownMultiplier": 4
      } : {
        "rttMs": 40,
        "throughputKbps": 10240,
        "requestLatencyMs": 0,
        "downloadThroughputKbps": 0,
        "uploadThroughputKbps": 0,
        "cpuSlowdownMultiplier": 1
      },
    screenEmulation: option.isMobile ?
      {
        "mobile": true,
        "width": 412,
        "height": 823,
        "deviceScaleFactor": 1.75,
        "disabled": false
      } : {
        "mobile": false,
        "width": 1920,
        "height": 1080,
        "deviceScaleFactor": 1,
        "disabled": false
      },
    emulatedUserAgent: option.isMobile ?
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36" :
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  };

  const runnerResult = await ipcRenderer.invoke('buildReport', { url: option.site.url, options: options });

  if (option.isMobile) {
    if (report.mobileSetting && Object.keys(report.mobileSetting).length === 0) {
      report.mobileSetting = {
        environment: runnerResult.lhr.environment,
        enumaltedUserAgent: runnerResult.lhr.configSettings.emulatedUserAgent,
        throttling: runnerResult.lhr.configSettings.throttling,
        screenEmulation: runnerResult.lhr.configSettings.screenEmulation,
        version: runnerResult.lhr.lighthouseVersion,
      };
    }

    report.mobileResults.push({
      url: runnerResult.lhr.requestedUrl,
      name: option.site.name,
      type: 'mobile',
      file: option.site.file,
      detail: {
        score: runnerResult.lhr.categories['performance'].score * 100,
        access: runnerResult.lhr.categories['accessibility'].score * 100,
        best: runnerResult.lhr.categories['best-practices'].score * 100,
        seo: runnerResult.lhr.categories['seo'].score * 100,
      },
      warning: [],
    });
  } else {
    if (report.desktopSetting && Object.keys(report.desktopSetting).length === 0) {
      report.desktopSetting = {
        environment: runnerResult.lhr.environment,
        enumaltedUserAgent: runnerResult.lhr.configSettings.emulatedUserAgent,
        throttling: runnerResult.lhr.configSettings.throttling,
        screenEmulation: runnerResult.lhr.configSettings.screenEmulation,
        version: runnerResult.lhr.lighthouseVersion,
      };
    }

    report.desktopResults.push({
      url: runnerResult.lhr.requestedUrl,
      name: option.site.name,
      type: 'desktop',
      file: option.site.file,
      detail: {
        score: runnerResult.lhr.categories['performance'].score * 100,
        access: runnerResult.lhr.categories['accessibility'].score * 100,
        best: runnerResult.lhr.categories['best-practices'].score * 100,
        seo: runnerResult.lhr.categories['seo'].score * 100,
      },
      warning: [],
    });
  }

  const reportHtml = runnerResult.report;
  fs.writeFileSync(`${path.join(option.outFolder, option.site.file)}`, reportHtml);

  await chrome.kill();
};

const buildReportSummary = (dest, option) => {
  const summaryFile = path.join(dest, 'summary.json');
  let content = '';

  try {
    const fileContent = fs.readFileSync(summaryFile, 'utf8');
    content = JSON.parse(fileContent);
  } catch (e) {
    alert('Report summary.json not found');
  }

  if (!content) {
    return false;
  }

  const desktopOut = path.join(dest, 'desktop');
  const mobileOut = path.join(dest, 'mobile');
  let head =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><title>WS Lighthouse Reporting Tool App - Summary Report</title></head><body><div class="container m-3">';

  let borderTableHead = '<div class="table-responsive"><table class="table table-bordered table-striped">';
  let borderTableTail = '</table></div>';
  let body = '';

  if (content.desktopSetting && Object.keys(content.desktopSetting).length !== 0) {
    body += '<h3>Desktop Setting</h3>';
    body += borderTableHead;
    // Network throttling
    body += `<tr><td>Network throttling</td><td>${content.desktopSetting.throttling.rttMs} ms TCP RTT, ${content.desktopSetting.throttling.throughputKbps} Kbps throughput (Simulated)</td></tr>`;

    // CPU throttling
    body += `<tr><td>CPU throttling</td><td>${content.desktopSetting.throttling.cpuSlowdownMultiplier}x slowdown (Simuated)</td></tr>`;

    // User agent (host)
    body += `<tr><td>User agent (host)</td><td>${content.desktopSetting.environment.hostUserAgent}</td></tr>`;

    // User agent (network)
    body += `<tr><td>User agent (network)</td><td>${content.desktopSetting.environment.networkUserAgent}</td></tr>`;

    // CPU/Memory Power
    body += `<tr><td>CPU/Memory Power</td><td>${content.desktopSetting.environment.benchmarkIndex}</td></tr>`;

    // Axe version
    body += `<tr><td>Axe version</td><td>${content.desktopSetting.environment.credits['axe-core']}</td></tr>`;

    // Lighthouse version
    body += `<tr><td>Lighthouse version</td><td>${content.desktopSetting.version}</td></tr>`;

    body += borderTableTail;
  }

  if (content.desktopResults.length > 0) {
    body += `<div class="my-3">${borderTableHead}<tr><td>Url</td><td>Filename</td>` +
      `${option.showPerfScore ? '<td>Performance</td>' : ''}` +
      `${option.showAccessScore ? '<td>Accessibility</td>' : ''}` +
      `${option.showBestScore ? '<td>Best-Pratices</td>' : ''}` +
      `${option.showSeoScore ? '<td>SEO</td>' : ''}` +
      `${option.warningSummaryReport ? '<td>Warning</td>' : ''}</tr>`;
    content.desktopResults.forEach((row) => {
      body += '<tr>';
      body += `<td><a href='${row.url}' target='_blank'>${row.url}</a></td>` +
        `<td><a href='${path.join(desktopOut, row.file)}' target='_blank'>${row.file}</a></td>` +
        `${option.showPerfScore ? `<td>${row.detail.score}</td>` : ''}` +
        `${option.showAccessScore ? `<td>${row.detail.access}</td>` : ''}` +
        `${option.showBestScore ? `<td>${row.detail.best}</td>` : ''}` +
        `${option.showSeoScore ? `<td>${row.detail.seo}</td>` : ''}`;
      if (option.warningSummaryReport && row.warning.length > 0) {
        body += `<td>${row.warning.join().replace(',', '<br/>')}</td>`;
      }
      body += '</tr>';
    });
    body += `${borderTableTail}</div>`;
  }

  if (content.mobileSetting && Object.keys(content.mobileSetting).length !== 0) {
    body += '<h3>Mobile Setting</h3>';
    body += borderTableHead;
    // Network throttling
    body += `<tr><td>Network throttling</td><td>${content.mobileSetting.throttling.rttMs} ms TCP RTT, ${content.mobileSetting.throttling.throughputKbps} Kbps throughput (Simulated)</td></tr>`;

    // CPU throttling
    body += `<tr><td>CPU throttling</td><td>${content.mobileSetting.throttling.cpuSlowdownMultiplier}x slowdown (Simuated)</td></tr>`;

    // User agent (host)
    body += `<tr><td>User agent (host)</td><td>${content.mobileSetting.environment.hostUserAgent}</td></tr>`;

    // User agent (network)
    body += `<tr><td>User agent (network)</td><td>${content.mobileSetting.environment.networkUserAgent}</td></tr>`;

    // CPU/Memory Power
    body += `<tr><td>CPU/Memory Power</td><td>${content.mobileSetting.environment.benchmarkIndex}</td></tr>`;

    // Axe version
    body += `<tr><td>Axe version</td><td>${content.mobileSetting.environment.credits['axe-core']}</td></tr>`;

    // Lighthouse version
    body += `<tr><td>Lighthouse version</td><td>${content.mobileSetting.version}</td></tr>`;

    body += borderTableTail;
  }

  if (content.mobileResults.length > 0) {
    body += `<div class="my-3">${borderTableHead}<tr><td>Url</td><td>Filename</td>` +
      `${option.showPerfScore ? '<td>Performance</td>' : ''}` +
      `${option.showAccessScore ? '<td>Accessibility</td>' : ''}` +
      `${option.showBestScore ? '<td>Best-Pratices</td>' : ''}` +
      `${option.showSeoScore ? '<td>SEO</td>' : ''}` +
      `${option.warningSummaryReport ? '<td>Warning</td>' : ''}</tr>`;
    content.mobileResults.forEach((row) => {
      body += '<tr>';
      body += `<td><a href='${row.url}' target='_blank'>${row.url}</a></td>` +
        `<td><a href='${path.join(mobileOut, row.file)}' target='_blank'>${row.file}</a></td>` +
        `${option.showPerfScore ? `<td>${row.detail.score}</td>` : ''}` +
        `${option.showAccessScore ? `<td>${row.detail.access}</td>` : ''}` +
        `${option.showBestScore ? `<td>${row.detail.best}</td>` : ''}` +
        `${option.showSeoScore ? `<td>${row.detail.seo}</td>` : ''}`;
      if (option.warningSummaryReport && row.warning.length > 0) {
        body += `<td>${row.warning.join().replace(',', '<br/>')}</td>`;
      }
      body += '</tr>';
    });
    body += `${borderTableTail}</div>`;
  }

  let tail = '</div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/js/bootstrap.min.js"></script></body></html>';

  let reportHtml = head + body + tail;
  fs.writeFileSync(path.join(dest, 'summary.html'), reportHtml);

  return true;
};

const buildReportAudit = (dest, option) => {
  const summaryFile = path.join(dest, 'summary.json');
  let content = '';

  try {
    const fileContent = fs.readFileSync(summaryFile, 'utf8');
    content = JSON.parse(fileContent);
  } catch (e) {
    alert('Report summary.json not found');
  }

  if (!content) {
    return false;
  }

  let head =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><title>WS Lighthouse Reporting Tool App - Audit Report</title></head><body><div class="container m-3">';

  let borderTableHead = '<div class="table-responsive"><table class="table table-bordered table-striped">';
  let borderTableTail = '</table></div>';
  let body = '';
  let combined = content.desktopResults.concat(content.mobileResults);

  if (combined.length > 0) {
    var groupedCombined = groupBy(combined, 'url');

    body += `<div class="my-3">${borderTableHead}<tr><td>Website Url</td>` +
      `${option.showPerfScore ? '<td>Mobile Performance</td>' : ''}` +
      `${option.showAccessScore ? '<td>Mobile Accessibility</td>' : ''}` +
      `${option.showBestScore ? '<td>Mobile Best-Pratices</td>' : ''}` +
      `${option.showSeoScore ? '<td>Mobile SEO</td>' : ''}` +
      `${option.showPerfScore ? '<td>Performance</td>' : ''}` +
      `${option.showAccessScore ? '<td>Accessibility</td>' : ''}` +
      `${option.showBestScore ? '<td>Best-Pratices</td>' : ''}` +
      `${option.showSeoScore ? '<td>SEO</td>' : ''}` +
      `<td>PWA</td><td>Date Run</td></tr>`;
    for (var gCombined in groupedCombined) {
      var url = gCombined;
      var desktop = groupedCombined[gCombined].filter(x => x.type === 'desktop')[0];
      var mobile = groupedCombined[gCombined].filter(x => x.type === 'mobile')[0];
      body += '<tr>';
      body += `<td><a href='${url}' target='_blank'>${url}</a></td>` +
        `${option.showPerfScore ? `<td>${mobile.detail.score}</td>` : ''}` +
        `${option.showAccessScore ? `<td>${mobile.detail.access}</td>` : ''}` +
        `${option.showBestScore ? `<td>${mobile.detail.best}</td>` : ''}` +
        `${option.showSeoScore ? `<td>${mobile.detail.seo}</td>` : ''}` +
        `${option.showPerfScore ? `<td>${desktop.detail.score}</td>` : ''}` +
        `${option.showAccessScore ? `<td>${desktop.detail.access}</td>` : ''}` +
        `${option.showBestScore ? `<td>${desktop.detail.best}</td>` : ''}` +
        `${option.showSeoScore ? `<td>${desktop.detail.seo}</td>` : ''}` +
        `<td>N/A</td><td></td>`;
      body += '</tr>';
    }
    body += `${borderTableTail}</div>`;
  }

  let tail = '</div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.min.js"></script></body></html>';

  let reportHtml = head + body + tail;
  fs.writeFileSync(path.join(dest, 'audit.html'), reportHtml);

  return true;
};

export { mkdirp, getFolder, getUrls, buildReport, buildReportSummary, buildReportAudit };