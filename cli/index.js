'use strict';
require('shelljs/global');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const OUT = './report';
const DESKTOP_OUT = './desktop';
const MOBILE_OUT = './mobile';
const SUMMARY = 'summary.json';
const HTML = 'summary.html';
const AUDIT_HTML = 'audit.html';

execute.OUT = OUT;
module.exports = execute;

async function execute({ _optionValues }) {
  let options = _optionValues;

  if (!options.file) {
    console.error('No input file');
    process.exit(1);
  }
  options.accessibility = options.accessibility ?? 90;
  options.performance = options.performance ?? 90;
  options.best = options.best ?? 90;
  options.seo = options.seo ?? 90;

  if (!options.desktop && !options.mobile) {
    console.error('No report needed');
    process.exit(1);
  }

  const out = path.resolve(__dirname, options.out || OUT);
  const desktop_out = path.join(out, DESKTOP_OUT);
  const mobile_out = path.join(out, MOBILE_OUT);

  try {
    const files1 = fs.readdirSync(out);
    files1.forEach((f) => {
      const oldFile = path.join(out, f);
      console.log(`Removing old file: ${oldFile}`);
      rm('-rf', oldFile);
    });
  } catch (e) { }

  if (options.desktop) {
    mkdir('-p', desktop_out);
  }
  if (options.mobile) {
    mkdir('-p', mobile_out);
  }

  // command
  const lhScript = `node ${path.resolve(`${__dirname}/node_modules/lighthouse/cli/index.js`)}`;
  const desktopFlag =
    '--chrome-flags="--no-sandbox --headless --disable-gpu" --preset=desktop --only-categories=accessibility, best-practices, performance, seo';
  const mobileFlag = '--chrome-flags="--no-sandbox --headless --disable-gpu" --only-categories=accessibility, best-practices, performance, seo';

  let reports = await Promise.all(
    getUrls(options).map(async (site, i) => {
      console.log(`Executing ${site.url}`);

      let desktopOutput = path.join(desktop_out, site.file);
      const desktopCmd = `${lhScript} ${site.url} --output json --output html --output-path "${desktopOutput}" ${desktopFlag}`;

      let mobileOutput = path.join(mobile_out, site.file);
      const mobileCmd = `${lhScript} ${site.url} --output json --output html --output-path "${mobileOutput}" ${mobileFlag}`;

      if (options.desktop) {
        await exec(`${desktopCmd}`);
      }
      if (options.mobile) {
        await exec(`${mobileCmd}`);
      }

      return { desktop: desktopOutput + '.report.json', mobile: mobileOutput + '.report.json' };
    })
  );

  var reportResult = buildReport(options, reports, out);

  if (options.summary) {
    console.log('Building Summary Report');
    buildSummaryHtml(reportResult, reports, out);
  }

  if (options.audit) {
    console.log('Building Audit Report');
    buildAuditHtml(reportResult, out);
  }

  console.log('Finish');
}

function buildReport(options, reports, out) {
  const summaryPath = path.join(out, SUMMARY);

  let summary = { desktopResults: [], mobileResults: [] };
  reports.forEach((report) => {
    if (report.desktop) {
      let json = JSON.parse(fs.readFileSync(report.desktop));
      summary.desktopResults.push({
        url: json.finalUrl,
        type: 'desktop',
        file: report.desktop.replace('.json', '.html'),
        environment: json.environment,
        lighthouseVersion: json.lighthouseVersion,
        detail: {
          score: json.categories['performance'].score * 100,
          access: json.categories['accessibility'].score * 100,
          best: json.categories['best-practices'].score * 100,
          seo: json.categories['seo'].score * 100,
        },
        warning: [],
      });
    }
    if (report.mobile) {
      let json = JSON.parse(fs.readFileSync(report.mobile));
      summary.mobileResults.push({
        url: json.finalUrl,
        type: 'mobile',
        file: report.mobile.replace('.json', '.html'),
        environment: json.environment,
        lighthouseVersion: json.lighthouseVersion,
        detail: {
          score: json.categories['performance'].score * 100,
          access: json.categories['accessibility'].score * 100,
          best: json.categories['best-practices'].score * 100,
          seo: json.categories['seo'].score * 100,
        },
        warning: [],
      });
    }
  });

  if (summary.desktopResults.length == 0 && summary.mobileResults.length === 0) {
    console.error('No summary json generated');
    process.exit(1);
  }

  summary.desktopResults.map((res) => {
    let { score, access, best, seo } = res.detail;
    if (options.score > score) {
      res.warning.push(`Performance ${score} < threshold ${options.score}`);
    }
    if (options.access > access) {
      res.warning.push(`Accessibility ${access} < threshold ${options.access}`);
    }
    if (options.best > best) {
      res.warning.push(`Best-Practices ${best} < threshold ${options.best}`);
    }
    if (options.seo > seo) {
      res.warning.push(`SEO ${score} < threshold ${options.seo}`);
    }
  });

  summary.mobileResults.map((res) => {
    let { score, access, best, seo } = res.detail;
    if (options.score > score) {
      res.warning.push(`Performance ${score} < threshold ${options.score}`);
    }
    if (options.access > access) {
      res.warning.push(`Accessibility ${access} < threshold ${options.access}`);
    }
    if (options.best > best) {
      res.warning.push(`Best-Practices ${best} < threshold ${options.best}`);
    }
    if (options.seo > seo) {
      res.warning.push(`SEO ${score} < threshold ${options.seo}`);
    }
  });

  fs.writeFileSync(summaryPath, JSON.stringify(summary), 'utf-8');
  return summary;
}

function buildSummaryHtml(summary, options, out) {
  const htmlPath = path.join(out, HTML);

  let head =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/css/bootstrap.min.css" rel="stylesheet"><title>WS Lighthouse Reporting Tool App - Summary Report</title></head><body><div class="container m-3">';

  let borderTableHead = '<div class="table-responsive"><table class="table table-bordered table-striped">';
  let borderTableTail = '</table></div>';
  let body = '';

  if (summary.desktopResults.length > 0) {
    body += `<h3>Desktop Report</h3>`;
    body += `<div class="my-3">${borderTableHead}<tr><td>Url</td><td>Filename</td><td>Performance</td><td>Accessibility</td><td>Best-Pratices</td><td>SEO</td>${options.threshold ? '<td>Warning</td>' : ''
      }</tr>`;
    summary.desktopResults.forEach((row) => {
      body += '<tr>';
      body += `<td><a href='${row.url}' target='_blank'>${row.url}</a></td><td><a href='${row.file}' target='_blank'>${row.file}</a></td><td>${row.detail.score}</td><td>${row.detail.access}</td><td>${row.detail.best}</td><td>${row.detail.seo}</td>`;
      if (options.threshold && row.warning.length > 0) {
        body += `<td>${row.warning.join().replace(',', '<br/>')}</td>`;
      }
      body += '</tr>';
    });
    body += `${borderTableTail}</div>`;
  }

  if (summary.mobileResults.length > 0) {
    body += `<h3>Mobile Report</h3>`;
    body += `<div class="my-3">${borderTableHead}<tr><td>Url</td><td>Filename</td><td>Performance</td><td>Accessibility</td><td>Best-Pratices</td><td>SEO</td>${options.threshold ? '<td>Warning</td>' : ''
      }</tr>`;
    summary.mobileResults.forEach((row) => {
      body += '<tr>';
      body += `<td><a href='${row.url}' target='_blank'>${row.url}</a></td><td><a href='${row.file}' target='_blank'>${row.file}</a></td><td>${row.detail.score}</td><td>${row.detail.access}</td><td>${row.detail.best}</td><td>${row.detail.seo}</td>`;
      if (options.threshold && row.warning.length > 0) {
        body += `<td>${row.warning.join().replace(',', '<br/>')}</td>`;
      }
      body += '</tr>';
    });
    body += `${borderTableTail}</div>`;
  }

  let tail = '</div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/js/bootstrap.bundle.min.js"></script></body></html>';

  let reportHtml = head + body + tail;
  fs.writeFileSync(htmlPath, reportHtml);

  console.log('Html Summary Report Finish Build');

  return true;
}

function groupBy(xs, key) {
  return xs.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

function buildAuditHtml(summary, out) {
  const htmlPath = path.join(out, AUDIT_HTML);

  let head =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/css/bootstrap.min.css" rel="stylesheet"><title>WS Lighthouse Reporting Tool App - Audit Report</title></head><body><div class="container m-3">';

  let borderTableHead = '<div class="table-responsive"><table class="table table-bordered table-striped">';
  let borderTableTail = '</table></div>';
  let body = '';
  let combined = summary.desktopResults.concat(summary.mobileResults);

  if (combined.length > 0) {
    var groupedCombined = groupBy(combined, 'url');
    body += `<div class="my-3">${borderTableHead}<tr><td>Website Url</td><td>Mobile Performance</td><td>Mobile Accessibility</td><td>Mobile Best-Pratices</td><td>Mobile SEO</td><td>Performance</td><td>Accessibility</td><td>Best-Pratices</td><td>SEO</td><td>PWA</td><td>Date Run</td></tr>`;
    for (var gCombined in groupedCombined) {
      var url = gCombined;
      var desktop = groupedCombined[gCombined].filter(x => x.type === 'desktop')[0];
      var mobile = groupedCombined[gCombined].filter(x => x.type === 'mobile')[0];
      body += '<tr>';
      body += `<td><a href='${url}' target='_blank'>${url}</a></td><td>${mobile.detail.score}</td><td>${mobile.detail.access}</td><td>${mobile.detail.best}</td><td>${mobile.detail.seo}</td><td>${desktop.detail.score}</td><td>${desktop.detail.access}</td><td>${desktop.detail.best}</td><td>${desktop.detail.seo}</td><td>N/A</td><td></td>`;
      body += '</tr>';
    }
    body += `${borderTableTail}</div>`;
  }

  let tail = '</div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/js/bootstrap.bundle.min.js"></script></body></html>';

  let reportHtml = head + body + tail;
  fs.writeFileSync(htmlPath, reportHtml);

  console.log('Html Audit Report Finish Build');

  return true;
}

function getUrls(options) {
  let sites = [];
  if (options.file) {
    try {
      const contents = fs.readFileSync(options.file, 'utf8');
      sites = contents.trim().split('\n');
    } catch (e) {
      console.error(`Failed to read file ${options.file}, aborting.\n`, e);
      process.exit(1);
    }
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
      file: `${name}`,
    };
    return info;
  });
}

function siteName(site) {
  const maxLength = 100;
  let name = site.replace(/^https?:\/\//, '').replace(/[\/\?#:\*\$@\!\.]/g, '_');

  if (name.length > maxLength) {
    const hash = crypto.createHash('sha1').update(name).digest('hex').slice(0, 7);

    name = name.slice(0, maxLength).replace(/_+$/g, ''); // trim any `_` suffix
    name = `${name}_${hash}`;
  }
  return name;
}
