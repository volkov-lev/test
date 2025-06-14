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

// Функция для генерации SVG на основе статистики
function generateSVG(stats) {
  return `
<svg id="gh-dark-mode-only" viewBox="0 0 360 210" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
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
  stroke: ${colors.light.stroke};
  stroke-width: 1px;
  rx: 6px;
  ry: 6px;
}
#gh-dark-mode-only:target #background {
  fill: ${colors.dark.background};
  stroke: ${colors.dark.stroke};
  stroke-width: 1px;
}
foreignObject {
  width: calc(100% - 10px - 32px);
  height: calc(100% - 10px - 32px);
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}
th {
  padding: 0.5em;
  padding-top: 0;
  text-align: left;
  font-size: 16px;
  font-weight: 600;
  color: ${colors.light.title};
}
#gh-dark-mode-only:target th {
  color: ${colors.dark.title};
}
td {
  margin-bottom: 16px;
  margin-top: 8px;
  padding: 0.25em;
  font-size: 12px;
  line-height: 18px;
  color: ${colors.light.textPrimary};
}
#gh-dark-mode-only:target td {
  color: ${colors.dark.textPrimary};
}
tr {
  transform: translateX(-200%);
  animation: slideIn 2s ease-in-out forwards;
}
.octicon {
  fill: ${colors.light.icon};
  margin-right: 1ch;
  vertical-align: top;
}
#gh-dark-mode-only:target .octicon {
  fill: ${colors.dark.icon};
}
@keyframes slideIn {
  to {
    transform: translateX(0);
  }
}
/* Убрать любые переносы, только масштабирование! */
</style>
<g>
<rect x="5" y="5" id="background" />
<g>
<foreignObject x="21" y="21" width="318" height="168">
<div xmlns="http://www.w3.org/1999/xhtml">
<table>
<thead><tr style="transform: translateX(0);">
<th colspan="2">${stats.name}'s GitHub Statistics</th>
</tr></thead>
<tbody>
<tr><td><svg class="octicon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" version="1.1" width="16" height="16"><path fill-rule="evenodd" d="..."/></svg>Stars</td><td>${stats.stars}</td></tr>
<tr style="animation-delay: 150ms"><td><svg class="octicon" ...>...</svg>Forks</td><td>${stats.forks}</td></tr>
<tr style="animation-delay: 300ms"><td><svg class="octicon" ...>...</svg>All-time contributions</td><td>${stats.contributions}</td></tr>
<tr style="animation-delay: 450ms"><td><svg class="octicon" ...>...</svg>Lines of code changed</td><td>${stats.linesChanged}</td></tr>
<tr style="animation-delay: 600ms"><td><svg class="octicon" ...>...</svg>Repository views (past two weeks)</td><td>${stats.views}</td></tr>
<tr style="animation-delay: 750ms"><td><svg class="octicon" ...>...</svg>Repositories with contributions</td><td>${stats.repos}</td></tr>
</tbody>
</table>
</div>
</foreignObject>
</g>
</g>
</svg>
`;
}

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
