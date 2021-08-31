require('shelljs/global');
const { ipcRenderer, shell } = require('electron');
const Store = require('electron-store');
const store = new Store();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const lighthouse = require('lighthouse');
const lighthouesConstant = require('./constant');
const chromeLauncher = require('chrome-launcher');

reloadSetting = () => {
  return store.get('tool');
};

selectFolder = (type) => {
  let resp = ipcRenderer.sendSync('open-directory');
  if (resp && resp.filePaths && resp.filePaths.length > 0) {
    let path = resp.filePaths[0];
    store.set('tool.' + type, path);
    return path;
  }
  return '';
};

selectFile = (type) => {
  let resp = ipcRenderer.sendSync('open-file');
  if (resp && resp.filePaths && resp.filePaths.length > 0) {
    let path = resp.filePaths[0];
    store.set('tool.' + type, path);
    return path;
  }
  return '';
};

openFolder = (dest) => {
  setTimeout(() => {
    shell.openPath(path.join(dest, '/'));
  }, 1000);
};

getSamplePath = (dest) => {
  mkdir('-p', dest);
  var content = 'https://www.websparks.sg/\t\nhttps://www.websparks.sg/about-us/';
  fs.writeFileSync(path.resolve(`${dest}/sample-site.txt`), content);
};

generateReport = async (option) => {
  store.set('tool.desktopReport', option.desktopReport);
  store.set('tool.mobileReport', option.mobileReport);
  store.set('tool.score', option.score);
  store.set('tool.access', option.access);
  store.set('tool.best', option.best);
  store.set('tool.seo', option.seo);
  store.set('tool.summaryReport', option.summaryReport);
  store.set('tool.warningSummaryReport', option.warningSummaryReport);

  let report = { desktopSetting: {}, mobileSetting: {}, desktopResults: [], mobileResults: [] };
  const output = option.out;

  try {
    // Mobile
    if (option.mobileReport) {
      option.isMobile = true;
      option.outFolder = getFolder(option);
      for (let item of getUrls(option)) {
        option.site = item;
        await buildReport(option, report);
      }
    }

    // Desktop
    if (option.desktopReport) {
      option.isMobile = false;
      option.outFolder = getFolder(option);
      for (let item of getUrls(option)) {
        option.site = item;
        await buildReport(option, report);
      }
    }

    if (option.mobileReport || option.desktopReport) {
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

      fs.writeFileSync(path.resolve(`${output}/summary.json`), JSON.stringify(report), 'utf8');

      if (option.summaryReport) {
        generateReportSummary(output, option);
      }
    }
  } catch (e) {
    alert('Build report error');
  }

  callback();
};

buildReport = async (option, report) => {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--no-sandbox', '--headless', '--disable-gpu'] });
  let options = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: option.categories,
    port: chrome.port,
  };

  if (!option.isMobile) {
    options.formFactor = 'desktop';
    options.throttling = lighthouesConstant.throttling.desktopDense4G;
    options.screenEmulation = lighthouesConstant.screenEmulationMetrics.desktop;
    options.emulatedUserAgent = lighthouesConstant.userAgents.desktop;
  }

  const runnerResult = await lighthouse(option.site.url, options);

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
      file: option.site.file,
      detail: runnerResult.lhr.categories,
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

getUrls = (option) => {
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

siteName = (site) => {
  const maxLength = 100;
  let name = site.replace(/^https?:\/\//, '').replace(/[\/\?#:\*\$@\!\.]/g, '_');

  if (name.length > maxLength) {
    const hash = crypto.createHash('sha1').update(name).digest('hex').slice(0, 7);

    name = name.slice(0, maxLength).replace(/_+$/g, ''); // trim any `_` suffix
    name = `${name}_${hash}`;
  }
  return name;
};

getFolder = (option) => {
  // remove and create new folder
  const out = path.join(option.out, option.isMobile ? 'mobile' : 'desktop');
  try {
    const outfiles = fs.readdirSync(option.out);
    outfiles.forEach((f) => {
        const oldFile = path.join(out, f);
        rm('-f', oldFile);
      });
    const files = fs.readdirSync(out);
    files.forEach((f) => {
      const oldFile = path.join(out, f);
      rm('-f', oldFile);
    });
  } catch (e) {}
  mkdir('-p', out);
  return out;
};

generateReportSummary = (dest, option) => {
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
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/css/bootstrap.min.css" rel="stylesheet"><title>WS Lighthouse Reporting Tool App - Summary Report</title></head><body><div class="container m-3">';

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
    body += `<div class="my-3">${borderTableHead}<tr><td>Url</td><td>Filename</td><td>Performance</td><td>Accessibility</td><td>Best-Pratices</td><td>SEO</td>${
      option.warningSummaryReport ? '<td>Warning</td>' : ''
    }</tr>`;
    content.desktopResults.forEach((row) => {
      body += '<tr>';
      body += `<td><a href='${row.url}' target='_blank'>${row.url}</a></td><td><a href='${path.join(desktopOut, row.file)}' target='_blank'>${
        row.file
      }</a></td><td>${row.detail.score}</td><td>${row.detail.access}</td><td>${row.detail.best}</td><td>${row.detail.seo}</td>`;
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
    body += `<div class="my-3">${borderTableHead}<tr><td>Url</td><td>Filename</td><td>Performance</td><td>Accessibility</td><td>Best-Pratices</td><td>SEO</td>${
      option.warningSummaryReport ? '<td>Warning</td>' : ''
    }</tr>`;
    content.desktopResults.forEach((row) => {
      body += '<tr>';
      body += `<td><a href='${row.url}' target='_blank'>${row.url}</a></td><td><a href='${path.join(mobileOut, row.file)}' target='_blank'>${
        row.file
      }</a></td><td>${row.detail.score}</td><td>${row.detail.access}</td><td>${row.detail.best}</td><td>${row.detail.seo}</td>`;
      if (option.warningSummaryReport && row.warning.length > 0) {
        body += `<td>${row.warning.join().replace(',', '<br/>')}</td>`;
      }
      body += '</tr>';
    });
    body += `${borderTableTail}</div>`;
  }

  let tail = '</div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/js/bootstrap.bundle.min.js"></script></body></html>';

  let reportHtml = head + body + tail;
  fs.writeFileSync(path.join(dest, 'summary.html'), reportHtml);

  return true;
};
