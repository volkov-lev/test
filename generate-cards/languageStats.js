const fs = require("fs");
const path = require("path");

// ---------- CONFIGURATION ----------------
const username = process.env.GITHUB_ACTOR;
const token = process.env.ACCESS_TOKEN;
const exclusionThreshold = 0.9; // Exclude languages that are above 90%
const SVG_WIDTH = 360;
const SVG_HEIGHT = 210;
const MAX_LANGUAGES = 25;

// ---- STRICT STYLES, CLOSE TO EXAMPLE ----
const styles = `
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
`;

// --------------- GRAPHQL/UTILS ---------------
const GRAPHQL_API = "https://api.github.com/graphql";

async function fetchFromGitHub(query, variables = {}) {
  const response = await fetch(GRAPHQL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("GitHub API Error:", errorText);
    throw new Error("Failed to fetch data from GitHub API.");
  }

  const data = await response.json();
  if (data.errors) {
    console.error("GitHub API Error:", JSON.stringify(data.errors, null, 2));
    throw new Error("Failed to fetch data from GitHub API.");
  }
  return data.data;
}

// --- Fetch user's top languages (aggregate by repo) ---
async function fetchTopLanguages() {
  const query = `
    query {
      user(login: "${username}") {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          nodes {
            languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await fetchFromGitHub(query);
  const languages = {};

  for (const repo of data.user.repositories.nodes) {
    for (const langEdge of repo.languages.edges) {
      const lang = langEdge.node.name;
      const size = langEdge.size;
      const color = langEdge.node.color;

      if (!languages[lang]) {
        languages[lang] = { size: 0, color: color || "#cccccc" };
      }
      languages[lang].size += size;
    }
  }

  const totalBytes = Object.values(languages).reduce(
    (sum, lang) => sum + lang.size,
    0
  );

  // Exclude dominant language if > threshold (e.g., if one is >90%)
  let sorted = Object.entries(languages)
    .map(([name, lang]) => ({
      lang: name,
      percent: totalBytes > 0 ? (lang.size / totalBytes) * 100 : 0,
      color: lang.color || "#cccccc",
      size: lang.size,
    }))
    .sort((a, b) => b.percent - a.percent);

  // If top language exceeds exclusionThreshold, filter it out
  if (sorted.length > 0 && sorted[0].percent >= exclusionThreshold * 100) {
    sorted = sorted.slice(1);
  }

  // Limit number of languages
  return sorted.slice(0, MAX_LANGUAGES);
}

// ----------- SVG GENERATOR ----------------
function generateSVG(languageStats) {
  const svgWidth = SVG_WIDTH;
  const svgHeight = SVG_HEIGHT;

  // Progress bar
  let progressBar = languageStats
    .map(
      ({ color, percent }) =>
        `<span style="background-color: ${color};width: ${percent.toFixed(3)}%;" class="progress-item"></span>`
    )
    .join("");

  // List items
  let langList = languageStats
    .map(
      ({ lang, percent, color }, idx) => `
<li style="animation-delay: ${idx * 150}ms;">
<svg xmlns="http://www.w3.org/2000/svg" class="octicon" style="fill:${color};"
viewBox="0 0 16 16" version="1.1" width="16" height="16"><path
fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z"></path></svg>
<span class="lang">${lang}</span>
<span class="percent">${percent.toFixed(2)}%</span>
</li>
`
    )
    .join("");

  return `<svg id="gh-dark-mode-only" width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
<style>
${styles}
</style>
<g>
<rect x="5" y="5" id="background" />
<g>
<foreignObject x="21" y="17" width="318" height="176">
<div xmlns="http://www.w3.org/1999/xhtml" class="ellipsis">

<h2>Languages Used (By File Size)</h2>

<div>
<span class="progress">
${progressBar}
</span>
</div>

<ul>
${langList}
</ul>

</div>
</foreignObject>
</g>
</g>
</svg>`;
}

// ----------- MAIN -----------------
async function createLanguageStatisticsSVG() {
  try {
    if (!token) {
      throw new Error("Error: ACCESS_TOKEN is not defined in the environment variables.");
    }
    if (!username) {
      throw new Error("Error: GITHUB_ACTOR is not defined in the environment variables.");
    }

    const languageStats = await fetchTopLanguages();
    const svg = generateSVG(languageStats);

    const dir = "svg";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const filePath = path.join(dir, "language_stats.svg");
    fs.writeFileSync(filePath, svg);

    console.log(`Создан svg файл: ${filePath}`);
  } catch (error) {
    console.error("Error generating SVG:", error);
  }
}

createLanguageStatisticsSVG();
