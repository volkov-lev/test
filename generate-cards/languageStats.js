const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_ACTOR;
const token = process.env.ACCESS_TOKEN;
const exclusionThreshold = 0.9;

if (!token) {
  console.error(
    "Error: ACCESS_TOKEN is not defined in the environment variables."
  );
  process.exit(1);
}

const GRAPHQL_API = "https://api.github.com/graphql";

// Colors for light and dark themes (Цвета для светлой и темной тем)
const colors = {
  light: {
    outline: "none", // Outline color (Цвет обводки)
    background: "none", // Background color (Цвет фона)
    title: "#006AFF", // Header color (Цвет заголовка)
    lang: "#000000", // Language text color (Цвет текста языка)
    percent: "rgb(88, 96, 105)", // Color of percentages (Цвет процентов)
    progressBackground: "#e1e4e8", // Progress bar background color (Цвет фона прогресс-бара)
    progressItemOutline: "rgb(225, 228, 232)", // Progress bar element outline color (Цвет обводки элементов прогресс-бара)
  },
  dark: {
    outline: "none",
    background: "none",
    title: "#006AFF",
    lang: "#c9d1d9",
    percent: "#8b949e",
    progressBackground: "rgba(110, 118, 129, 0.4)",
    progressItemOutline: "#393f47",
  },
};

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

async function fetchTopLanguages() {
  const query = `
    query {
      user(login: "${username}") {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          nodes {
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
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
        languages[lang] = { size: 0, color };
      }
      languages[lang].size += size;
    }
  }

  const totalBytes = Object.values(languages).reduce(
    (sum, lang) => sum + lang.size,
    0
  );

  const filteredLanguages = Object.entries(languages)
    .filter(
      ([_, lang]) => (lang.size / totalBytes) * 100 < exclusionThreshold * 100
    )
    .map(([name, lang]) => ({
      lang: name,
      percent: (lang.size / totalBytes) * 100,
      color: lang.color,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 12); // Отображаем 12 языков

  return filteredLanguages;
}

function generateSVG(languageStats, colors) {
  const svgWidth = 360;
  const svgHeight = 210;

  let svgContent = `<svg id="gh-dark-mode-only" width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
<style>
svg {
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
  font-size: 14px;
  line-height: 21px;
}

#background {
  width: calc(100% - 10px);
  height: calc(100% - 10px);
  fill: ${colors.light.background}; 
  stroke: ${colors.light.outline};
  stroke-width: 1px;
  rx: 6px;
  ry: 6px;
}

#gh-dark-mode-only:target #background {
  fill: ${colors.dark.background};
  stroke: ${colors.dark.outline};
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
  color: ${colors.light.title}; /* Цвет заголовка */
}

#gh-dark-mode-only:target h2 {
  color: ${colors.dark.title}; /* Цвет заголовка для темной темы */
}

ul {
  list-style: none;
  padding-left: 0;
  margin-top: 0;
  margin-bottom: 0;
}

@keyframes progressGrow {
  from { width: 0; }
  to { width: var(--final-width); }
}

.progress {
  display: flex;
  height: 8px;
  overflow: hidden;
  background-color: ${colors.light.progressBackground}; 
  border-radius: 6px;
  outline: 1px solid transparent;
  margin-bottom: 1em;
}

#gh-dark-mode-only:target .progress {
  background-color: ${colors.dark.progressBackground}; 
}

.progress-item {
  width: 0;
  outline: 2px solid ${colors.light.progressItemOutline};
  border-collapse: collapse;
  animation: progressGrow 2s cubic-bezier(.33,1.53,.53,1.01) forwards;
  animation-delay: var(--delay);
  background-color: var(--color);
}

#gh-dark-mode-only:target .progress-item {
  outline: 2px solid ${colors.dark.progressItemOutline};
}

@keyframes fadeInScale {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

li {
  display: inline-flex;
  font-size: 12px;
  margin-right: 2ch;
  align-items: center;
  flex-wrap: nowrap;
  opacity: 0;
  transform: scale(0.9);
  animation: fadeInScale 1s cubic-bezier(.33,1.53,.53,1.01) forwards;
  animation-delay: var(--li-delay);
}

@keyframes bounceIn {
  0% { transform: translateY(18px) scale(0.7);}
  60% { transform: translateY(-7px) scale(1.08);}
  80% { transform: translateY(2px) scale(0.96);}
  100% { transform: translateY(0) scale(1);}
}

.octicon {
  fill: ${colors.light.percent};
  margin-right: 0.5ch;
  vertical-align: top;
  animation: bounceIn 1.2s cubic-bezier(.33,1.53,.53,1.01) both;
  animation-delay: var(--li-delay);
}

#gh-dark-mode-only:target .octicon {
  fill: ${colors.dark.percent};
}

.lang {
  font-weight: 600;
  margin-right: 4px;
  color: ${colors.light.lang}; 
}

#gh-dark-mode-only:target .lang {
  color: ${colors.dark.lang}; 
}

.percent {
  color: ${colors.light.percent};
}

#gh-dark-mode-only:target .percent {
  color: ${colors.dark.percent};
}

div.ellipsis {
  height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<g>
<rect x="5" y="5" id="background" />
<g>
<foreignObject x="21" y="17" width="318" height="176">
<div xmlns="http://www.w3.org/1999/xhtml" class="ellipsis">

<h2>Languages Used (By File Size)</h2>

<div>
<span class="progress">
${languageStats
  .map(
    ({ lang, percent, color }, i) =>
      `<span class="progress-item" style="--final-width: ${percent}%; --color: ${color || "#cccccc"}; --delay: ${i * 0.5}s;"></span>`
  )
  .join("")}
</span>
</div>

<ul>
${languageStats
  .map(
    ({ lang, percent, color }, index) => `
<li style="--li-delay: ${(1.5 + index * 0.25).toFixed(2)}s;">
<svg xmlns="http://www.w3.org/2000/svg" class="octicon" style="fill:${
      color || "#cccccc"
    };"
viewBox="0 0 16 16" version="1.1" width="16" height="16"><path
fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z"></path></svg>
<span class="lang">${lang}</span>
<span class="percent">${Number(percent).toFixed(2)}%</span>
</li>`
  )
  .join("")}
</ul>

</div>
</foreignObject>
</g>
</g>
</svg>`;



// function generateSVG(languageStats, colors) {
//   const svgWidth = 360;
//   const svgHeight = 210;

//   let svgContent = `<svg id="gh-dark-mode-only" width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
// <style>
// svg {
//   font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
//   font-size: 14px;
//   line-height: 21px;
// }

// #background {
//   width: calc(100% - 10px);
//   height: calc(100% - 10px);
//   fill: ${colors.light.background}; 
//   stroke: ${colors.light.outline};
//   stroke-width: 1px;
//   rx: 6px;
//   ry: 6px;
// }

// #gh-dark-mode-only:target #background {
//   fill: ${colors.dark.background};
//   stroke: ${colors.dark.outline};
//   stroke-width: 0.5px;
// }

// foreignObject {
//   width: calc(100% - 10px - 32px);
//   height: calc(100% - 10px - 24px);
// }

// h2 {
//   margin-top: 0;
//   margin-bottom: 0.75em;
//   line-height: 24px;
//   font-size: 16px;
//   font-weight: 600;
//   color: ${colors.light.title}; /* Цвет заголовка */
// }

// #gh-dark-mode-only:target h2 {
//   color: ${colors.dark.title}; /* Цвет заголовка для темной темы */
// }

// ul {
//   list-style: none;
//   padding-left: 0;
//   margin-top: 0;
//   margin-bottom: 0;
// }

// @keyframes progressGrow {
//   from { width: 0; }
//   to { width: var(--final-width); }
// }

// .progress {
//   display: flex;
//   height: 8px;
//   overflow: hidden;
//   background-color: ${colors.light.progressBackground}; 
//   border-radius: 6px;
//   outline: 1px solid transparent;
//   margin-bottom: 1em;
// }

// #gh-dark-mode-only:target .progress {
//   background-color: ${colors.dark.progressBackground}; 
// }

// .progress-item {
//   width: 0;
//   outline: 2px solid ${colors.light.progressItemOutline};
//   border-collapse: collapse;
//   animation: progressGrow 1.1s cubic-bezier(.33,1.53,.53,1.01) forwards;
//   animation-delay: var(--delay);
//   background-color: var(--color);
// }

// #gh-dark-mode-only:target .progress-item {
//   outline: 2px solid ${colors.dark.progressItemOutline};
// }

// @keyframes fadeInScale {
//   to {
//     opacity: 1;
//     transform: scale(1);
//   }
// }

// li {
//   display: inline-flex;
//   font-size: 12px;
//   margin-right: 2ch;
//   align-items: center;
//   flex-wrap: nowrap;
//   opacity: 0;
//   transform: scale(0.9);
//   animation: fadeInScale 0.45s cubic-bezier(.33,1.53,.53,1.01) forwards;
//   animation-delay: var(--li-delay);
// }

// @keyframes bounceIn {
//   0% { transform: translateY(18px) scale(0.7);}
//   60% { transform: translateY(-7px) scale(1.08);}
//   80% { transform: translateY(2px) scale(0.96);}
//   100% { transform: translateY(0) scale(1);}
// }

// .octicon {
//   fill: ${colors.light.percent};
//   margin-right: 0.5ch;
//   vertical-align: top;
//   animation: bounceIn 0.7s cubic-bezier(.33,1.53,.53,1.01) both;
//   animation-delay: var(--li-delay);
// }

// #gh-dark-mode-only:target .octicon {
//   fill: ${colors.dark.percent};
// }

// .lang {
//   font-weight: 600;
//   margin-right: 4px;
//   color: ${colors.light.lang}; 
// }

// #gh-dark-mode-only:target .lang {
//   color: ${colors.dark.lang}; 
// }

// .percent {
//   color: ${colors.light.percent};
// }

// #gh-dark-mode-only:target .percent {
//   color: ${colors.dark.percent};
// }

// div.ellipsis {
//   height: 100%;
//   overflow: hidden;
//   text-overflow: ellipsis;
// }
// </style>

// <g>
// <rect x="5" y="5" id="background" />
// <g>
// <foreignObject x="21" y="17" width="318" height="176">
// <div xmlns="http://www.w3.org/1999/xhtml" class="ellipsis">

// <h2>Languages Used (By File Size)</h2>

// <div>
// <span class="progress">
// ${languageStats
//   .map(
//     ({ lang, percent, color }, i) =>
//       `<span class="progress-item" style="--final-width: ${percent}%; --color: ${color || "#cccccc"}; --delay: ${i * 0.3}s;"></span>`
//   )
//   .join("")}
// </span>
// </div>

// <ul>
// ${languageStats
//   .map(
//     ({ lang, percent, color }, index) => `
// <li style="--li-delay: ${(1.1 + index * 0.15).toFixed(2)}s;">
// <svg xmlns="http://www.w3.org/2000/svg" class="octicon" style="fill:${
//       color || "#cccccc"
//     };"
// viewBox="0 0 16 16" version="1.1" width="16" height="16"><path
// fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z"></path></svg>
// <span class="lang">${lang}</span>
// <span class="percent">${Number(percent).toFixed(2)}%</span>
// </li>`
//   )
//   .join("")}
// </ul>

// </div>
// </foreignObject>
// </g>
// </g>
// </svg>`;

  return svgContent;
}

async function createLanguageStatisticsSVG() {
  try {
    const languageStats = await fetchTopLanguages();
    const svg = generateSVG(languageStats, colors); 

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
