const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_ACTOR;
const token = process.env.ACCESS_TOKEN;

if (!token) {
  console.error("Ошибка: ACCESS_TOKEN не определен в переменных окружения.");
  process.exit(1);
}

const GRAPHQL_API = "https://api.github.com/graphql";
const REST_API = "https://api.github.com";

// Colors for light and dark themes (Цвета для светлой и темной темы)
const colors = {
  light: {
    background: "none", // Background color (Цвет фона)
    stroke: "rgb(225, 228, 232)", // Outline color (Цвет обводки)
    title: "rgb(0, 106, 255)", // Header color (Цвет заголовка)
    textPrimary: "rgb(88, 96, 105)", // Main text color (Цвет основного текста
    icon: "rgb(88, 96, 105)", // Color of icons (Цвет иконок)
  },
  dark: {
    background: "none",
    stroke: "rgba(225, 228, 232, 0.5)",
    title: "#006AFF",
    textPrimary: "#c9d1d9",
    icon: "#8b949e",
  },
};

class GitHubQueries {
  constructor(token) {
    this.token = token;
  }

  async queryRest(endpoint) {
    let response;
    do {
      response = await fetch(`${REST_API}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 202) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (!response.ok) {
        const errorText = await response.text();
        throw new Error("Не удалось получить данные из GitHub REST API.");
      }
    } while (response.status === 202);

    return response.json();
  }
}

class UserStats {
  constructor(username, queries, repos) {
    this.username = username;
    this.queries = queries;
    this.repos = repos;
    this._linesChanged = null;
    this._views = null;
  }

  async linesChanged() {
    if (this._linesChanged !== null) {
      return this._linesChanged;
    }

    let additions = 0;
    let deletions = 0;

    for (const repo of await this.repos) {
      try {
        const r = await this.queries.queryRest(
          `/repos/${repo}/stats/contributors`
        );

        // console.log(`Данные для репозитория ${repo}:`, r);

        if (!Array.isArray(r)) {
          //   console.warn(`Пропускаем репозиторий ${repo}: Ответ не является массивом.`);
          continue;
        }

        for (const authorObj of r) {
          if (
            typeof authorObj !== "object" ||
            !authorObj.author ||
            typeof authorObj.author !== "object"
          ) {
            // console.warn(`Пропускаем некорректный объект автора в репозитории ${repo}.`);
            continue;
          }

          const author = authorObj.author.login || "";
          if (author !== this.username) {
            // console.log(`Пропускаем автора ${author}, это не ${this.username}`);
            continue;
          }

          //   console.log(`Обрабатываем данные для автора ${author}`);

          for (const week of authorObj.weeks || []) {
            additions += week.a || 0;
            deletions += week.d || 0;
          }
        }
      } catch (error) {
        // console.error(`Ошибка получения статистики для репозитория ${repo}:`,error.message);
      }
    }

    this._linesChanged = additions + deletions;
    return this._linesChanged;
  }

  async views() {
    if (this._views !== null) {
      return this._views;
    }

    let total = 0;

    for (const repo of await this.repos) {
      try {
        const r = await this.queries.queryRest(`/repos/${repo}/traffic/views`);
        // console.log(`Данные о просмотрах для репозитория ${repo}:`, r);

        if (!r.views || !Array.isArray(r.views)) {
          //   console.warn(`Пропускаем репозиторий ${repo}: Некорректные данные о просмотрах.`);
          continue;
        }

        for (const view of r.views) {
          total += view.count || 0;
        }
      } catch (error) {
        // console.error(`Ошибка получения просмотров для репозитория ${repo}:`,error.message);
      }
    }

    this._views = total;
    return total;
  }
}

// Функция для выполнения запросов к GitHub GraphQL API
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
    //console.error("Ошибка GitHub API:", errorText);
    throw new Error("Не удалось получить данные из GitHub API.");
  }

  const data = await response.json();
  if (data.errors) {
    //console.error("Ошибка GitHub API:", JSON.stringify(data.errors, null, 2));
    throw new Error("Не удалось получить данные из GitHub API.");
  }
  return data.data;
}



function generateSVG(stats) {
  return `
<svg width="360" height="210" viewBox="0 0 360 210" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg">
<style>
  .card {
    width: 350px;
    height: 200px;
    fill: ${colors.light.background};
    stroke: ${colors.light.stroke};
    stroke-width: 1px;
    rx: 6px;
    ry: 6px;
  }
  
  .header {
    font-size: 16px;
    font-weight: 600;
    fill: ${colors.light.title};
    text-anchor: start;
  }
  
  .stat-row {
    font-size: 12px;
    fill: ${colors.light.textPrimary};
    transform: translateX(-200%);
    animation: slideIn 1s ease-out forwards;
  }
  
  .stat-label {
    text-anchor: start;
  }
  
  .stat-value {
    text-anchor: end;
    font-weight: bold;
  }
  
  .icon {
    fill: ${colors.light.icon};
  }
  
  /* Dark theme */
  #gh-dark-mode-only:target .card {
    stroke: ${colors.dark.stroke};
  }
  
  #gh-dark-mode-only:target .header {
    fill: ${colors.dark.title};
  }
  
  #gh-dark-mode-only:target .stat-row {
    fill: ${colors.dark.textPrimary};
  }
  
  #gh-dark-mode-only:target .icon {
    fill: ${colors.dark.icon};
  }
  
  @keyframes slideIn {
    to {
      transform: translateX(0);
    }
  }
</style>

<rect x="5" y="5" class="card" />

<!-- Header -->
<text x="20" y="30" class="header">${stats.name}'s GitHub Statistics</text>

<!-- Stars -->
<g class="stat-row" style="animation-delay: 0ms" transform="translate(20, 50)">
  <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
    <path fill-rule="evenodd" d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25zm0 2.445L6.615 5.5a.75.75 0 01-.564.41l-3.097.45 2.24 2.184a.75.75 0 01.216.664l-.528 3.084 2.769-1.456a.75.75 0 01.698 0l2.77 1.456-.53-3.084a.75.75 0 01.216-.664l2.24-2.183-3.096-.45a.75.75 0 01-.564-.41L8 2.694v.001z"></path>
  </svg>
  <text x="20" y="0">
    <tspan class="stat-label">Stars</tspan>
    <tspan x="320" class="stat-value">${stats.stars}</tspan>
  </text>
</g>

<!-- Forks -->
<g class="stat-row" style="animation-delay: 150ms" transform="translate(20, 75)">
  <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
    <path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
  </svg>
  <text x="20" y="0">
    <tspan class="stat-label">Forks</tspan>
    <tspan x="320" class="stat-value">${stats.forks}</tspan>
  </text>
</g>

<!-- Contributions -->
<g class="stat-row" style="animation-delay: 300ms" transform="translate(20, 100)">
  <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
    <path fill-rule="evenodd" d="M1 2.5A2.5 2.5 0 013.5 0h8.75a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V1.5h-8a1 1 0 00-1 1v6.708A2.492 2.492 0 013.5 9h3.25a.75.75 0 010 1.5H3.5a1 1 0 100 2h5.75a.75.75 0 010 1.5H3.5A2.5 2.5 0 011 11.5v-9zm13.23 7.79a.75.75 0 001.06-1.06l-2.505-2.505a.75.75 0 00-1.06 0L9.22 9.229a.75.75 0 001.06 1.061l1.225-1.224v6.184a.75.75 0 001.5 0V9.066l1.224 1.224z"></path>
  </svg>
  <text x="20" y="0">
    <tspan class="stat-label">All-time contributions</tspan>
    <tspan x="320" class="stat-value">${stats.contributions}</tspan>
  </text>
</g>

<!-- Lines changed -->
<g class="stat-row" style="animation-delay: 450ms" transform="translate(20, 125)">
  <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
    <path fill-rule="evenodd" d="M8.75 1.75a.75.75 0 00-1.5 0V5H4a.75.75 0 000 1.5h3.25v3.25a.75.75 0 001.5 0V6.5H12A.75.75 0 0012 5H8.75V1.75zM4 13a.75.75 0 000 1.5h8a.75.75 0 100-1.5H4z"></path>
  </svg>
  <text x="20" y="0">
    <tspan class="stat-label">Lines of code changed</tspan>
    <tspan x="320" class="stat-value">${stats.linesChanged}</tspan>
  </text>
</g>

<!-- Views -->
<g class="stat-row" style="animation-delay: 600ms" transform="translate(20, 150)">
  <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
    <path fill-rule="evenodd" d="M1.679 7.932c.412-.621 1.242-1.75 2.366-2.717C5.175 4.242 6.527 3.5 8 3.5c1.473 0 2.824.742 3.955 1.715 1.124.967 1.954 2.096 2.366 2.717a.119.119 0 010 .136c-.412.621-1.242 1.75-2.366 2.717C10.825 11.758 9.473 12.5 8 12.5c-1.473 0-2.824-.742-3.955-1.715C2.92 9.818 2.09 8.69 1.679 8.068a.119.119 0 010-.136zM8 2c-1.981 0-3.67.992-4.933 2.078C1.797 5.169.88 6.423.43 7.1a1.619 1.619 0 000 1.798c.45.678 1.367 1.932 2.637 3.024C4.329 13.008 6.019 14 8 14c1.981 0 3.67-.992 4.933-2.078 1.27-1.091 2.187-2.345 2.637-3.023a1.619 1.619 0 000-1.798c-.45-.678-1.367-1.932-2.637-3.023C11.671 2.992 9.981 2 8 2zm0 8a2 2 0 100-4 2 2 0 000 4z"></path>
  </svg>
  <text x="20" y="0">
    <tspan class="stat-label">Repository views (past two weeks)</tspan>
    <tspan x="330" class="stat-value">${stats.views}</tspan>
  </text>
</g>

<!-- Repositories -->
<g class="stat-row" style="animation-delay: 750ms" transform="translate(20, 175)">
  <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
    <path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path>
  </svg>
  <text x="20" y="0">
    <tspan class="stat-label">Repositories with contributions</tspan>
    <tspan x="330" class="stat-value">${stats.repos}</tspan>
  </text>
</g>

</svg>
`;
}



// Функция для генерации SVG на основе статистики
// function generateSVG(stats) {
//   return `
// <svg width="360" height="210" viewBox="0 0 360 210" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg">
// <style>
//   .card {
//     width: 350px;
//     height: 200px;
//     fill: ${colors.light.background};
//     stroke: ${colors.light.stroke};
//     stroke-width: 1px;
//     rx: 6px;
//     ry: 6px;
//   }
  
//   .header {
//     font-size: 16px;
//     font-weight: 600;
//     fill: ${colors.light.title};
//     text-anchor: start;
//   }
  
//   .stat-row {
//     font-size: 12px;
//     fill: ${colors.light.textPrimary};
//   }
  
//   .stat-label {
//     text-anchor: start;
//     font-size: 12px;
//   }
  
//   .stat-value {
//     text-anchor: end;
//     font-weight: bold;
//     font-size: 12px;
//   }
  
//   .icon {
//     fill: ${colors.light.icon};
//   }
  
//   /* Dark theme */
//   #gh-dark-mode-only:target .card {
//     stroke: ${colors.dark.stroke};
//   }
  
//   #gh-dark-mode-only:target .header {
//     fill: ${colors.dark.title};
//   }
  
//   #gh-dark-mode-only:target .stat-row {
//     fill: ${colors.dark.textPrimary};
//   }
  
//   #gh-dark-mode-only:target .icon {
//     fill: ${colors.dark.icon};
//   }
// </style>

// <rect x="5" y="5" class="card" />

// <!-- Header -->
// <text x="20" y="30" class="header">${stats.name}'s GitHub Stats</text>

// <!-- Stars -->
// <g transform="translate(20, 50)">
//   <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
//     <path fill-rule="evenodd" d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25zm0 2.445L6.615 5.5a.75.75 0 01-.564.41l-3.097.45 2.24 2.184a.75.75 0 01.216.664l-.528 3.084 2.769-1.456a.75.75 0 01.698 0l2.77 1.456-.53-3.084a.75.75 0 01.216-.664l2.24-2.183-3.096-.45a.75.75 0 01-.564-.41L8 2.694v.001z"></path>
//   </svg>
//   <text x="20" y="0" class="stat-row">
//     <tspan class="stat-label">Stars:</tspan>
//     <tspan x="320" class="stat-value">${stats.stars}</tspan>
//   </text>
// </g>

// <!-- Forks -->
// <g transform="translate(20, 75)">
//   <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
//     <path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
//   </svg>
//   <text x="20" y="0" class="stat-row">
//     <tspan class="stat-label">Forks:</tspan>
//     <tspan x="320" class="stat-value">${stats.forks}</tspan>
//   </text>
// </g>

// <!-- Contributions -->
// <g transform="translate(20, 100)">
//   <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
//     <path fill-rule="evenodd" d="M1 2.5A2.5 2.5 0 013.5 0h8.75a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V1.5h-8a1 1 0 00-1 1v6.708A2.492 2.492 0 013.5 9h3.25a.75.75 0 010 1.5H3.5a1 1 0 100 2h5.75a.75.75 0 010 1.5H3.5A2.5 2.5 0 011 11.5v-9zm13.23 7.79a.75.75 0 001.06-1.06l-2.505-2.505a.75.75 0 00-1.06 0L9.22 9.229a.75.75 0 001.06 1.061l1.225-1.224v6.184a.75.75 0 001.5 0V9.066l1.224 1.224z"></path>
//   </svg>
//   <text x="20" y="0" class="stat-row">
//     <tspan class="stat-label">Contributions:</tspan>
//     <tspan x="320" class="stat-value">${stats.contributions}</tspan>
//   </text>
// </g>

// <!-- Lines changed -->
// <g transform="translate(20, 125)">
//   <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
//     <path fill-rule="evenodd" d="M8.75 1.75a.75.75 0 00-1.5 0V5H4a.75.75 0 000 1.5h3.25v3.25a.75.75 0 001.5 0V6.5H12A.75.75 0 0012 5H8.75V1.75zM4 13a.75.75 0 000 1.5h8a.75.75 0 100-1.5H4z"></path>
//   </svg>
//   <text x="20" y="0" class="stat-row">
//     <tspan class="stat-label">Lines changed:</tspan>
//     <tspan x="320" class="stat-value">${stats.linesChanged}</tspan>
//   </text>
// </g>

// <!-- Views -->
// <g transform="translate(20, 150)">
//   <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
//     <path fill-rule="evenodd" d="M1.679 7.932c.412-.621 1.242-1.75 2.366-2.717C5.175 4.242 6.527 3.5 8 3.5c1.473 0 2.824.742 3.955 1.715 1.124.967 1.954 2.096 2.366 2.717a.119.119 0 010 .136c-.412.621-1.242 1.75-2.366 2.717C10.825 11.758 9.473 12.5 8 12.5c-1.473 0-2.824-.742-3.955-1.715C2.92 9.818 2.09 8.69 1.679 8.068a.119.119 0 010-.136zM8 2c-1.981 0-3.67.992-4.933 2.078C1.797 5.169.88 6.423.43 7.1a1.619 1.619 0 000 1.798c.45.678 1.367 1.932 2.637 3.024C4.329 13.008 6.019 14 8 14c1.981 0 3.67-.992 4.933-2.078 1.27-1.091 2.187-2.345 2.637-3.023a1.619 1.619 0 000-1.798c-.45-.678-1.367-1.932-2.637-3.023C11.671 2.992 9.981 2 8 2zm0 8a2 2 0 100-4 2 2 0 000 4z"></path>
//   </svg>
//   <text x="20" y="0" class="stat-row">
//     <tspan class="stat-label">Views:</tspan>
//     <tspan x="320" class="stat-value">${stats.views}</tspan>
//   </text>
// </g>

// <!-- Repositories -->
// <g transform="translate(20, 175)">
//   <svg class="icon" width="16" height="16" viewBox="0 0 16 16" y="-11">
//     <path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path>
//   </svg>
//   <text x="20" y="0" class="stat-row">
//     <tspan class="stat-label">Repos:</tspan>
//     <tspan x="320" class="stat-value">${stats.repos}</tspan>
//   </text>
// </g>

// </svg>
// `;
// }

// Основная функция для получения статистики и генерации SVG
async function main() {
  try {
    // Запрос данных с GitHub
    const query = `
      query {
        user(login: "${username}") {
          name
          repositories(first: 100, isFork: false) {
            totalCount
            nodes {
              nameWithOwner
              stargazers {
                totalCount
              }
              forkCount
            }
          }
          contributionsCollection {
            totalCommitContributions
          }
        }
      }
    `;

    const data = await fetchFromGitHub(query);
    const user = data.user;

    const repos = user.repositories.nodes.map((repo) => repo.nameWithOwner);

    // Инициализация UserStats
    const queries = new GitHubQueries(token);
    const userStats = new UserStats(username, queries, repos);

    // Получаем данные о строках и просмотрах
    const totalLinesChanged = await userStats.linesChanged();
    const views = await userStats.views();

    // Формирование статистики
    const stats = {
      name: user.name || username,
      stars: user.repositories.nodes.reduce(
        (sum, repo) => sum + repo.stargazers.totalCount,
        0
      ),
      forks: user.repositories.nodes.reduce(
        (sum, repo) => sum + repo.forkCount,
        0
      ),
      contributions: user.contributionsCollection.totalCommitContributions,
      linesChanged: totalLinesChanged,
      views: views,
      repos: user.repositories.totalCount,
    };

    // Генерация SVG
    const svg = generateSVG(stats);

    // Создание папки svg, если она не существует
    const svgDir = path.resolve(__dirname, "..", "svg"); // Путь к папке svg в корне проекта
    if (!fs.existsSync(svgDir)) {
      fs.mkdirSync(svgDir, { recursive: true });
    }

    // Сохранение SVG в файл
    const svgFilePath = path.join(svgDir, "github_stats.svg");
    fs.writeFileSync(svgFilePath, svg);
    console.log("Создан svg файл: github_stats.svg");
  } catch (error) {
    console.error("Error generating SVG:", error);
  }
}

main();
