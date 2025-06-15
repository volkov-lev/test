const fs = require('fs');
const path = require('path');
const https = require('https');

const LANGUAGES_FILE_URL = 'https://raw.githubusercontent.com/github/linguist/master/lib/linguist/languages.json';
const SVG_DIR = path.join(__dirname, 'svg');
const SVG_WIDTH = 360;
const SVG_HEIGHT = 210;

const token = process.env.ACCESS_TOKEN;
const gh_actor = process.env.GITHUB_ACTOR;

// Helper: fetch JSON from url
function fetchJson(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'lang-card-script',
      ...extraHeaders,
    };
    https.get(url, {headers}, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Helper: fetch data from GitHub API (with optional token)
function ghApi(path) {
  const headers = token ? { Authorization: `token ${token}` } : {};
  return fetchJson(`https://api.github.com${path}`, headers);
}

// Step 1: fetch all repos for user
async function fetchUserRepos(username) {
  let repos = [];
  let page = 1;
  while (true) {
    const batch = await ghApi(`/users/${username}/repos?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return repos;
}

// Step 2: fetch language stats for each repo
async function fetchAllRepoLangs(repos) {
  const out = {};
  for (const repo of repos) {
    // Skip forks & archived
    if (repo.fork || repo.archived) continue;
    try {
      const langs = await ghApi(`/repos/${repo.owner.login}/${repo.name}/languages`);
      for (const [lang, size] of Object.entries(langs)) {
        out[lang] = (out[lang] || 0) + size;
      }
    } catch (e) { /* skip errors */ }
  }
  return out;
}

// Step 3: get language colors
async function getLanguageColors() {
  return await fetchJson(LANGUAGES_FILE_URL);
}

// Step 4: generate SVG
function generateSvg(langStats, langColors, username, author) {
  // Prepare sorted language array
  const total = Object.values(langStats).reduce((a,b)=>a+b,0) || 1;
  const sorted = Object.entries(langStats)
    .map(([lang, size])=>({
      lang, size,
      percent: 100*size/total,
      color: langColors[lang]?.color || '#ccc'
    }))
    .sort((a,b)=>b.size-a.size);
  // Top 24 only
  const top = sorted.slice(0,24);

  // Progress bar
  const progressBar = top.map(l =>
    `<span style="background-color: ${l.color};width: ${l.percent.toFixed(3)}%;" class="progress-item"></span>`
  ).join('');

  // List
  const langList = top.map((l,i)=>`
<li style="animation-delay: ${i*150}ms;">
<svg xmlns="http://www.w3.org/2000/svg" class="octicon" style="fill:${l.color};" viewBox="0 0 16 16" version="1.1" width="16" height="16">
  <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z"></path>
</svg>
<span class="lang">${l.lang}</span>
<span class="percent">${l.percent.toFixed(2)}%</span>
</li>
`).join('');

  // SVG
  return `
<svg id="gh-dark-mode-only" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
<style>
svg {
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
  font-size: 14px;
  line-height: 21px;
}
#background {
  width: calc(100% - 10px);
  height: calc(100% - 10px);
  fill: white;
  stroke: rgb(225, 228, 232);
  stroke-width: 1px;
  rx: 6px;
  ry: 6px;
}
#gh-dark-mode-only:target #background {
  fill: #0d1117;
  stroke-width: 0.5px;
}
foreignObject {
  width: calc(100% - 10px - 32px);
  height: calc(100% - 10px - 24px);
}
h2 {
  margin-top: 0;
  margin-bottom: 0.75em;
  line-height: 24px;
  font-size: 16px;
  font-weight: 600;
  color: rgb(36, 41, 46);
  fill: rgb(36, 41, 46);
}
#gh-dark-mode-only:target h2 {
  color: #c9d1d9;
  fill: #c9d1d9;
}
ul {
  list-style: none;
  padding-left: 0;
  margin-top: 0;
  margin-bottom: 0;
}
li {
  display: inline-flex;
  font-size: 12px;
  margin-right: 2ch;
  align-items: center;
  flex-wrap: nowrap;
  transform: translateX(-500%);
  animation: slideIn 2s ease-in-out forwards;
}
@keyframes slideIn {
  to {
    transform: translateX(0);
  }
}
div.ellipsis {
  height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.octicon {
  fill: rgb(88, 96, 105);
  margin-right: 0.5ch;
  vertical-align: top;
}
#gh-dark-mode-only:target .octicon {
  color: #8b949e;
  fill: #8b949e;
}
.progress {
  display: flex;
  height: 8px;
  overflow: hidden;
  background-color: rgb(225, 228, 232);
  border-radius: 6px;
  outline: 1px solid transparent;
  margin-bottom: 1em;
}
#gh-dark-mode-only:target .progress {
  background-color: rgba(110, 118, 129, 0.4);
}
.progress-item {
  outline: 2px solid rgb(225, 228, 232);
  border-collapse: collapse;
}
#gh-dark-mode-only:target .progress-item {
  outline: 2px solid #393f47;
}
.lang {
  font-weight: 600;
  margin-right: 4px;
  color: rgb(36, 41, 46);
}
#gh-dark-mode-only:target .lang {
  color: #c9d1d9;
}
.percent {
  color: rgb(88, 96, 105)
}
#gh-dark-mode-only:target .percent {
  color: #8b949e;
}
.author {
  font-size: 11px;
  color: #959da5;
  margin-bottom: 0.25em;
  margin-top: 0.3em;
  display: block;
}
#gh-dark-mode-only:target .author {
  color: #6e7681;
}
</style>
<g>
<rect x="5" y="5" id="background" />
<g>
<foreignObject x="21" y="17" width="318" height="176">
<div xmlns="http://www.w3.org/1999/xhtml" class="ellipsis">
<h2>${username}'s Languages Used (By File Size)</h2>
<span class="author">Generated by: ${author || 'unknown'}</span>
<div>
<span class="progress">${progressBar}</span>
</div>
<ul>
${langList}
</ul>
</div>
</foreignObject>
</g>
</g>
</svg>
`.trim();
}

// MAIN
(async ()=>{
  let username = process.argv[2] || gh_actor;
  if (!username) {
    console.error('Usage: node generate-github-lang-card.js <github-username>\nOr set GITHUB_ACTOR env variable.');
    process.exit(1);
  }
  if (!fs.existsSync(SVG_DIR)) fs.mkdirSync(SVG_DIR);

  console.log(`Fetching repos for ${username}...`);
  const repos = await fetchUserRepos(username);
  if (repos.length === 0) {
    console.error('No repositories found or user does not exist.');
    process.exit(1);
  }
  console.log(`Aggregating language stats...`);
  const langStats = await fetchAllRepoLangs(repos);
  if (Object.keys(langStats).length === 0) {
    console.error('No language data found.');
    process.exit(1);
  }
  console.log('Fetching language colors...');
  const langColors = await getLanguageColors();
  console.log('Generating SVG...');
  const svg = generateSvg(langStats, langColors, username, gh_actor);
  const outfile = path.join(SVG_DIR, `${username}-language_stats.svg`);
  fs.writeFileSync(outfile, svg, 'utf8');
  console.log(`SVG generated: ${outfile}`);
})();
