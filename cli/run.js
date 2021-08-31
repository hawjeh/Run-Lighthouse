'use strict';

const program = require('commander');
const execute = require('./index');
const { name, version, description } = require('./package.json');

program
    .name(name)
    .version(version)
    .description(description)
    .option('-f, --file [path]', 'an input file with a site url per-line to analyze with Lighthouse')
    .option('-d, --desktop', 'enable generate desktop report')
    .option('-m, --mobile', 'enable generate mobile report')
    .option('-t, --threshold', 'enable generate summary report with threshold warning')
    .option('-s, --summary', 'enable generate summary report')
    .option('-o, --out [path]', `the output folder to place reports, default to ${execute.OUT}`)
    .option('--accessibility <threshold>', `accessibility score for each site to meet (1-100)`, Number)
    .option('--performance <threshold>', `performance score for each site to meet (1-100)`, Number)
    .option('--best <threshold>', `best practice score for each site to meet (1-100)`, Number)
    .option('--seo <threshold>', `seo score for each site to meet (1-100)`, Number)
    .parse(process.argv);

execute(program);
