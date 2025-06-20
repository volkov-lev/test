const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_ACTOR;
const token = process.env.ACCESS_TOKEN;
const REST_API = "https://api.github.com";

if (!token) {
  console.error("Ошибка: ACCESS_TOKEN не определен в переменных окружения.");
  process.exit(1);
}

// Colors for light and dark theme (Цвета для светлой и темной темы)
const colors = {
  light: {
    background: "none", // Background color (Фоновый цвет)
    stroke: "rgb(225, 228, 232)", // Outline color (Цвет обводки)
    iconGithub: "rgb(88, 96, 105)", // GitHub Icon Color (Цвет иконки GitHub)
    titleCards: "#006AFF", // Header Text Color (Цвет текста заголовка)
    textTitle: "#FFFFFF", // Color of statistics column headers (Цвет заголовков столбцов статистики)
    borderColor: "rgb(88, 96, 105)", // Border color of statistics column headers (Цвет обовдки заголовков столбцов статистики)
    folderIcons: "rgb(88, 96, 105)", // Folder Icon Fill Color (Цвет заливки иконок папок)
    folderIconOutline: "rgb(88, 96, 105)", // Folder Icon Outline Color (Цвет обводки иконок папок)
    repositoryText: "rgb(88, 96, 105)", // Repository name color (Цвет названия репозитория)
    uniqueCount: "rgb(88, 96, 105)", // Color of number of visitors (Цвет кол-ва посетителей)
    dateRange: "rgb(88, 96, 105)", // Date range color (Цвет диапазона дат)
  },
  dark: {
    background: "none",
    stroke: "rgb(225, 228, 232, 0.5)",
    iconGithub: "#8b949e",
    titleCards: "#006AFF",
    textTitle: "#000000",
    borderColor: "#8b949e",
    folderIcons: "#8b949e",
    folderIconOutline: "#8b949e",
    repositoryText: "#c9d1d9",
    uniqueCount: "#c9d1d9",
    dateRange: "#c9d1d9",
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
        throw new Error("Не удалось получить данные из GitHub REST API.");
      }
    } while (response.status === 202);

    return response.json();
  }
}

async function getRepos(username, queries) {
  const repos = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await queries.queryRest(
      `/users/${username}/repos?page=${page}&per_page=100`
    );
    if (response.length === 0) {
      hasMore = false;
    } else {
      repos.push(...response.map((repo) => repo.name));
      page++;
    }
  }

  return repos;
}

async function getRepoViews(repos, queries) {
  const repoStats = [];

  for (const repo of repos) {
    try {
      const r = await queries.queryRest(
        `/repos/${username}/${repo}/traffic/views`
      );

      if (r.uniques && r.uniques > 0) {
        const firstView = r.views[0];
        const lastView = r.views[r.views.length - 1];

        const formatDate = (timestamp) => {
          const date = new Date(timestamp);
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          return `${day}.${month}`;
        };

        const dateRange =
          firstView && lastView
            ? `${formatDate(firstView.timestamp)} - ${formatDate(
                lastView.timestamp
              )}`
            : "N/A";

        repoStats.push({
          name: repo,
          uniques: r.uniques,
          dateRange,
        });
      }
    } catch (error) {}
  }

  return repoStats;
}

function generateSVG(repoStats) {
  const sortedStats = repoStats.sort((a, b) => b.uniques - a.uniques);
  const topRepos = sortedStats.slice(0, 5);

  // Подготовка строк таблицы
  const rowsHTML = topRepos.map((repo, index) => `
    <tr class="repo-row" style="animation-delay: 0s;">
      <td class="repo-name" style="width: 186px; text-align: center;">
        <div style="display: flex; align-items: center;">
          <span style="margin-left: 10px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${repo.name}</span>
        </div>
      </td>
      <td class="unique-count" style="width: 130px; text-align: center;">${repo.uniques}</td>
      <td class="date-range" style="width: 120px; text-align: center;">${repo.dateRange}</td>
    </tr>
  `).join("");

  return `
<svg id="gh-dark-mode-only" width="460" height="210" xmlns="http://www.w3.org/2000/svg">
  <style>
    svg {
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
    }
    #background {
      fill: none;
      stroke: rgb(225, 228, 232);
      stroke-width: 1px;
      rx: 6px;
      ry: 6px;
    }
    #gh-dark-mode-only:target #background {
      fill: none;
      stroke: rgb(225, 228, 232, 0.5);
    }
    .header-outline {
      fill: none;
      stroke: rgb(225, 228, 232); 
      stroke-width: 0.7px;
      rx: 6px;
      ry: 6px;
    }
    #gh-dark-mode-only:target .header-outline {
      stroke: rgb(225, 228, 232, 0.5);
    }
    .title-cards {
      font-size: 15px; 
      font-weight: bold;
      letter-spacing: 0.1px; 
      fill: #006AFF; 
    }
    #gh-dark-mode-only:target .title-cards {
      fill: #006AFF;
    }
    .github-icon path {
      fill: rgb(88, 96, 105);
    }
    #gh-dark-mode-only:target .github-icon path {
      fill: #8b949e;
    }
    th {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #FFFFFF;
      text-shadow: 
        0.5px 0.5px 0px rgb(88, 96, 105), 
        -0.5px -0.5px 0px rgb(88, 96, 105), 
        0.5px -0.5px 0px rgb(88, 96, 105), 
        -0.5px 0.5px 0px rgb(88, 96, 105);
      padding-bottom: 16px;
    }
    #gh-dark-mode-only:target th {
      color: #000000;
      text-shadow: 
        0.5px 0.5px 0px #8b949e, 
        -0.5px -0.5px 0px #8b949e, 
        0.5px -0.5px 0px #8b949e, 
        -0.5px 0.5px 0px #8b949e;
    }
    .folder-icons {
      width: 16px;
      height:16px;
      vertical-align: middle; 
    }
    .folder-icons path {
      fill: rgb(88, 96, 105); 
      stroke: rgb(88, 96, 105); 
      stroke-width: 1; 
    }
    #gh-dark-mode-only:target .folder-icons path {
      fill: #8b949e; 
      stroke: #8b949e; 
    }
    th, td {
      text-align: center; 
      vertical-align: middle;
    }
    td.repo-name {
      display: flex;
      justify-content: center; 
      align-items: center;
    }
    .repo-name {
      font-size: 12px;
      color: rgb(88, 96, 105); 
      line-height: 1.6;
    }
    #gh-dark-mode-only:target .repo-name {
      color: #c9d1d9;
    }
    .unique-count {
      font-size: 12px;
      color: rgb(88, 96, 105);
    }
    #gh-dark-mode-only:target .unique-count {
      color: #c9d1d9;
    }
    .date-range {
      font-size: 12px;
      color: rgb(88, 96, 105);
    }
    #gh-dark-mode-only:target .date-range {
      color: #c9d1d9;
    }
    @keyframes fadein {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    .repo-row {
      opacity: 0;
      animation: fadein 0.5s ease-in forwards;
    }
  </style>
  <g>
    <rect id="background" x="5" y="5" width="450" height="200" />
    <rect class="header-outline" x="9" y="9" width="442" height="37" />
    <g transform="translate(26, 28)">
      <svg class="github-icon" x="5" y="-11" width="19" height="19" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
      </svg>
      <text class="title-cards" x="38" y="4" font-family="Arial">Top 5 Repositories by Traffic (past two weeks)</text>
    </g>
    <!-- Table header outlines -->
    <rect class="header-outline" x="9"   y="50" width="184" height="30" />
    <rect class="header-outline" x="197" y="50" width="121" height="30" />
    <rect class="header-outline" x="322" y="50" width="129" height="30" />
    <!-- Table body outlines -->
    <rect class="header-outline" x="9"   y="84" width="184" height="117" />
    <rect class="header-outline" x="197" y="84" width="121" height="117" />
    <rect class="header-outline" x="322" y="84" width="129" height="117" />
    <foreignObject x="0" y="55" width="450" height="137">
      <table xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="width:186px; text-align: center; ">
              <div style="display: flex; align-items: center; justify-content: center;">
                <svg class="folder-icons" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                  <path d="M456.914 93.284V47.3A18.74 18.74 0 0 0 438.2 28.58H194.069l-5.282-11.194A30.07 30.07 0 0 0 161.359 0H56.835a30.36 30.36 0 0 0-30.328 30.328v314.344A30.36 30.36 0 0 0 56.835 375h53.919c4.417 76.287 67.87 137 145.245 137s140.828-60.713 145.245-137h53.921a30.36 30.36 0 0 0 30.328-30.328V123.558a30.363 30.363 0 0 0-28.579-30.274M438.2 44.58a2.754 2.754 0 0 1 2.718 2.717v45.932H226.3a2.54 2.54 0 0 1-2.458-1.557L201.619 44.58ZM256 496a129.5 129.5 0 1 1 129.5-129.5A129.647 129.647 0 0 1 256 496m213.493-151.328A14.345 14.345 0 0 1 455.165 359h-53.857C397.391 282.243 333.713 221 256 221s-141.393 61.243-145.31 138H56.835a14.345 14.345 0 0 1-14.328-14.328V30.328A14.345 14.345 0 0 1 56.835 16h104.524a13.85 13.85 0 0 1 12.958 8.214L209.37 98.5a18.56 18.56 0 0 0 16.93 10.729h228.865a14.345 14.345 0 0 1 14.328 14.329Zm-149.926-4.406a8 8 0 0 1-11.314 11.314L264 307.325v137.663a8 8 0 0 1-16 0V307.325l-44.256 44.255a8 8 0 1 1-11.314-11.314l57.912-57.912a8 8 0 0 1 11.313 0Z"/>
                </svg>
                <span style="margin-left:5px;">Repository</span>
              </div>
            </th>
            <th style="width: 130px; text-align: center;">
              <div style="display: flex; align-items: center; justify-content: center;">
                <svg class="folder-icons" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                  <path d="M322.971 303.836h-72.195c-4.143 0-7.5 3.358-7.5 7.5s3.357 7.5 7.5 7.5h72.195c4.143 0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5m0 65.819h-72.195c-4.143 0-7.5 3.358-7.5 7.5s3.357 7.5 7.5 7.5h72.195c4.143 0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5m0 65.82h-72.195c-4.143 0-7.5 3.358-7.5 7.5s3.357 7.5 7.5 7.5h72.195c4.143 0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5m67.266-86.1-15.638 16.779-6.341-6.803a7.5 7.5 0 1 0-10.973 10.226l11.827 12.691a7.5 7.5 0 0 0 10.972 0l21.124-22.667a7.5 7.5 0 1 0-10.971-10.226"/>
                  <path d="M501.893 89.88a13.97 13.97 0 0 0-7.958-7.287l-5.733-2.088 3.919-10.767a7.5 7.5 0 1 0-14.095-5.131l-3.918 10.764-5.748-2.094c-7.3-2.641-15.4 1.145-18.059 8.438l-34.152 93.844c-5.084.018-9.86 3.149-11.697 8.196L388.13 228.6h-22.209v-7.882c0-9.995-8.131-18.126-18.126-18.126h-61.866c-9.994 0-18.125 8.131-18.125 18.126v7.882h-62.875c-5.972 0-10.83 4.858-10.83 10.83v9.961l-20.82-7.22v-34.543c9.905-6.876 18.385-15.177 22.395-23.001 2.032-3.956 3.486-9.929 4.513-16.987h12.202c14.954 0 27.12-12.166 27.12-27.12 0-7.578-3.125-14.437-8.15-19.364V96.54c0-53.232-43.308-96.54-96.54-96.54-17.908 0-35.403 4.946-50.594 14.304a7.5 7.5 0 0 0 7.867 12.771C104.916 19.176 119.691 15 134.819 15c44.961 0 81.54 36.579 81.54 81.54v17.144a27 27 0 0 0-3.97-.293h-10.133a672 672 0 0 0-.236-8.089 7.5 7.5 0 0 0-6.311-7.142c-26.763-4.279-52.69-16.685-73.008-34.933a7.5 7.5 0 0 0-12.479 4.884c-1.542 16.521-15.234 28.98-31.851 28.98-1.132 0-2.305-.065-3.485-.193a7.5 7.5 0 0 0-8.303 7.181 713 713 0 0 0-.28 9.313H56.179c-.98 0-1.947.055-2.9.157V96.54c0-17.288 5.341-33.8 15.444-47.75a7.5 7.5 0 1 0-12.149-8.799C44.605 56.517 38.279 76.071 38.279 96.54v23.619c-5.653 4.976-9.229 12.256-9.229 20.361 0 14.954 12.171 27.12 27.13 27.12h12.195c1.029 7.059 2.482 13.028 4.514 16.984 4.015 7.824 12.496 16.124 22.4 22.999v34.548l-47.625 16.521c-23.259 8.059-38.885 30.011-38.885 54.626v83.44c0 6.893 5.607 12.5 12.5 12.5h172.82v91.91c0 5.972 4.858 10.83 10.83 10.83h223.859c5.978 0 10.841-4.858 10.841-10.83V370.3c0-4.142-3.357-7.5-7.5-7.5s-7.5 3.358-7.5 7.5V497h-215.53V243.6h58.91c1.259 8.774 8.804 15.545 17.92 15.545h61.866c9.117 0 16.661-6.772 17.921-15.545h16.978c-1.599 4.927.047 10.181 3.819 13.371l-4.833 13.284a7.5 7.5 0 0 0-.436 3.068l2.26 33.559c.396 5.896 4.092 10.813 9.646 12.834 1.686.613 3.411.913 5.112.913 3.903 0 7.676-1.576 10.524-4.543l15.842-16.488V335.3c0 4.142 3.357 7.5 7.5 7.5s7.5-3.358 7.5-7.5v-59.419a12.5 12.5 0 0 0 4.185-1.116 12.4 12.4 0 0 0 6.453-7.042l21.627-59.42a12.4 12.4 0 0 0-.416-9.542 12.4 12.4 0 0 0-3.27-4.259l34.163-93.851a14.03 14.03 0 0 0-.477-10.771m-367.61 185.342a57.1 57.1 0 0 0 37.796-14.25l-37.796 92.25-37.797-92.251a57.1 57.1 0 0 0 37.797 14.251m90.226-134.702c0 6.683-5.438 12.12-12.12 12.12h-10.696c.515-7.898.716-16.261.731-24.25h9.964c6.684 0 12.121 5.442 12.121 12.13m-168.33 12.12c-6.688 0-12.13-5.437-12.13-12.12 0-6.688 5.441-12.13 12.13-12.13h9.959c.015 8.018.214 16.372.727 24.25zm30.054 25.134c-1.627-3.167-2.895-9.486-3.76-18.161a8 8 0 0 0-.045-.454c-1.163-11.979-1.568-28.352-1.084-47.16 18.618-1.144 34.328-12.973 40.825-29.751 19.098 14.584 41.662 24.877 65.046 29.613q.119 4.576.168 8.952l-.004.078c0 .04.005.079.006.119.166 15.102-.285 28.268-1.271 38.318l-.01.098c-.866 8.778-2.141 15.17-3.777 18.354-6.52 12.722-34.356 30.25-48.041 30.25-13.679-.001-41.523-17.53-48.053-30.256m48.054 45.255c6.887 0 15.425-2.563 23.992-6.659v28.42c0 2.372.742 4.614 2.033 6.469-7.367 5.764-16.484 8.963-26.029 8.963s-18.661-3.199-26.028-8.963a11.3 11.3 0 0 0 2.034-6.468v-28.424c8.57 4.098 17.11 6.662 23.998 6.662M73.284 394.26v-68.25c0-4.142-3.357-7.5-7.5-7.5s-7.5 3.358-7.5 7.5v68.25H23.779v-80.94c0-18.229 11.572-34.485 28.798-40.454l28.518-9.893 40.955 99.957a13.17 13.17 0 0 0 12.234 8.208 13.17 13.17 0 0 0 12.231-8.208l40.956-99.959 6.627 2.298V394.26zm274.511-150.114h-61.866a3.13 3.13 0 0 1-3.125-3.125v-20.302a3.13 3.13 0 0 1 3.125-3.126h61.866a3.13 3.13 0 0 1 3.126 3.126v15.344l-.002.039.002.039v4.881a3.13 3.13 0 0 1-3.126 3.124m50.632 61.072-2.108-31.322 4.024-11.063 23.863 8.685-4.023 11.059zm38.607-44.994-.555-.202c-.033-.012-.063-.029-.096-.041s-.066-.019-.099-.031l-38.5-14.013 19.903-54.684 38.607 14.053.643.234zm17.343-71.578-23.866-8.687 33.58-92.273 23.873 8.696z"/>
                </svg>
                <span style="margin-left: 5px;">Uniques</span>
              </div>
            </th>
            <th style="width: 120px; text-align: center; ">
              <div style="display: flex; align-items: center; justify-content: center;">
                <svg class="folder-icons" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                  <path d="M383 324.262v6.95A56.4 56.4 0 0 0 333.321 381H326.1a6 6 0 0 0 0 12h7.216C336.107 419 357 439.356 383 442.148V449a6 6 0 0 0 12 0v-6.848A55.324 55.324 0 0 0 444.257 393h6.9a6 6 0 0 0 0-12h-6.9C441.46 355 421 334 395 331.212v-6.95a6 6 0 1 0-12 0m12 23.929v-4.885A43.7 43.7 0 0 1 432.16 381h-4.935a6 6 0 0 0 0 12h4.938A44.07 44.07 0 0 1 395 430.054v-4.986a6 6 0 0 0-12 0v4.986A43.47 43.47 0 0 1 345.413 393h4.618a6 6 0 0 0 0-12h-4.615A43.125 43.125 0 0 1 383 343.306v4.885a6 6 0 1 0 12 0m-28.6 38.489a22.391 22.391 0 1 0 22.391-22.391A22.416 22.416 0 0 0 366.4 386.68m32.782 0a10.391 10.391 0 1 1-10.391-10.391 10.4 10.4 0 0 1 10.388 10.391zM276 289.485v37.573a6 6 0 0 0 12 0V295h31.751a6 6 0 0 0 0-12h-37.572c-3.314 0-6.179 3.172-6.179 6.485M496 283h-37.572a6 6 0 0 0 0 12H490v32.058a6 6 0 0 0 12 0v-37.573c0-3.313-2.687-6.485-6-6.485m0 157.5a6 6 0 0 0-6 6V478h-31.572a6 6 0 0 0 0 12H496a5.94 5.94 0 0 0 6-5.93V446.5a6 6 0 0 0-6-6m-214 0a6 6 0 0 0-6 6v37.57a6.1 6.1 0 0 0 6.179 5.93h37.572a6 6 0 0 0 0-12H288v-31.5a6 6 0 0 0-6-6m22.615-3.5A98.294 98.294 0 1 0 418 292.813V100.667A35.95 35.95 0 0 0 382.1 65H360V52.063a30 30 0 1 0-60 0V65H128V52.063a30 30 0 1 0-60 0V65H45.541A35.685 35.685 0 0 0 10 100.667v300.878A35.5 35.5 0 0 0 45.545 437zm170.779-50.223a86.3 86.3 0 1 1-86.3-86.3 86.4 86.4 0 0 1 86.3 86.3M312 52.063a18 18 0 1 1 36 0V89h-36zm-232 0a18 18 0 1 1 36 0V89H80zm-58 48.6A23.647 23.647 0 0 1 45.545 77H68v18.2a5.514 5.514 0 0 0 5.61 5.8h48.266A5.944 5.944 0 0 0 128 95.2V77h172v18.2a5.64 5.64 0 0 0 5.767 5.8h48.265A5.81 5.81 0 0 0 360 95.2V77h22.1a23.946 23.946 0 0 1 23.9 23.667V132H22zm0 300.882V144h384v145.933A98.307 98.307 0 0 0 298.521 425H45.547A23.49 23.49 0 0 1 22 401.547zM146.922 210.4a17.9 17.9 0 1 0-17.893-17.9 17.917 17.917 0 0 0 17.893 17.9m0-23.8a5.9 5.9 0 1 1-5.893 5.9 5.9 5.9 0 0 1 5.893-5.9m66.899 23.8a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.9m66.901 23.8a17.9 17.9 0 1 0-17.894-17.9 17.916 17.916 0 0 0 17.894 17.9m0-23.8a5.9 5.9 0 1 1-5.894 5.9 5.9 5.9 0 0 1 5.894-5.9m66.898 23.8a17.9 17.9 0 1 0-17.892-17.9 17.92 17.92 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.9M80.021 266.186a17.9 17.9 0 1 0-17.892-17.9 17.92 17.92 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903zm66.901 23.8a17.9 17.9 0 1 0-17.893-17.9 17.92 17.92 0 0 0 17.893 17.9m0-23.8a5.9 5.9 0 1 1-5.893 5.9 5.9 5.9 0 0 1 5.893-5.903zm66.899 23.8a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903zm66.901 23.8a17.9 17.9 0 1 0-17.894-17.9 17.917 17.917 0 0 0 17.894 17.9m0-23.8a5.9 5.9 0 1 1-5.894 5.9 5.9 5.9 0 0 1 5.894-5.903zM80.021 321.973a17.9 17.9 0 1 0-17.892-17.9 17.92 17.92 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903zm66.901 23.8a17.9 17.9 0 1 0-17.893-17.9 17.92 17.92 0 0 0 17.893 17.9m0-23.8a5.9 5.9 0 1 1-5.893 5.9 5.9 5.9 0 0 1 5.893-5.903zm66.899 23.8a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903zm-133.8 79.587a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.902zm66.901 23.8a17.9 17.9 0 1 0-17.893-17.9 17.917 17.917 0 0 0 17.893 17.9m0-23.8a5.9 5.9 0 1 1-5.893 5.9 5.9 5.9 0 0 1 5.893-5.902zm66.899 23.8a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.902zM44 175.139a6 6 0 0 0 6-6v-3.1a6 6 0 0 0-12 0v3.1a6 6 0 0 0 6 6m6 103.913v-89.886a6 6 0 0 0-12 0v89.886a6 6 0 0 0 12 0m297.62-12.118a17.9 17.9 0 1 0-17.892-17.9 17.92 17.92 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903z"/>
                </svg>
                <span style="margin-left: 5px;">Date Range</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    </foreignObject>
  </g>
</svg>
`;
}



// function generateSVG(repoStats) {
//   const sortedStats = repoStats.sort((a, b) => b.uniques - a.uniques);
//   const topRepos = sortedStats.slice(0, 5);

//   const repoColumnWidth = 160;
//   const uniquesColumnWidth = 140;
//   const dateColumnWidth = 120;

//   const rows = Array.isArray(topRepos) ? topRepos : [];

//   const rowsHTML = rows
//     .map(
//       (repo, index) => `
// <tr class="repo-row" style="animation-delay: ${index * 0.2}s;">
//   <td class="repo-name" style="width: ${repoColumnWidth}px; text-align: center;">
//     <div style="display: flex; align-items: center;">
//       <span style="max-width: 114px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${repo.name}</span>
//     </div>
//   </td>
//   <td class="unique-count" style="width: ${uniquesColumnWidth}px; text-align: center;">${repo.uniques}</td>
//   <td class="date-range" style="width: ${dateColumnWidth}px; text-align: center;">${repo.dateRange}</td>
// </tr>
// `
//     )
//     .join("");

//   return `
// <svg id="gh-dark-mode-only" width="385" height="180" xmlns="http://www.w3.org/2000/svg">
//   <style>
//     svg {
//       font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
//     }

//     #background {
//       fill: none;
//       stroke: rgb(225, 228, 232);
//       stroke-width: 1.7px;
//       rx: 6px;
//       ry: 6px;
//     }

//     #gh-dark-mode-only:target #background {
//       fill: none;
//       stroke: rgb(225, 228, 232, 0.5);
//     }

//     .header-outline {
//       fill: none;
//       stroke: rgb(225, 228, 232); 
//       stroke-width: 0.7px;
//       rx: 5px;
//       ry: 5px;
//     }
//     #gh-dark-mode-only:target .header-outline {
//       stroke: rgb(225, 228, 232, 0.5);
//     }

//     .title-cards {
//       font-size: 15px; 
//       font-weight: bold;
//       fill: #006AFF; 
//     }

//     #gh-dark-mode-only:target .title-cards {
//       fill: #006AFF;
//     }

//     .github-icon path {
//       fill: rgb(88, 96, 105);
//     }

//     #gh-dark-mode-only:target .github-icon path {
//       fill: #8b949e;
//     }

//     th {
//       font-size: 11.5px;
//       font-weight: 600;
//       letter-spacing: 1px;
//       color: #FFFFFF;
//       text-shadow: 
//         0.5px 0.5px 0px rgb(88, 96, 105), 
//         -0.5px -0.5px 0px rgb(88, 96, 105), 
//         0.5px -0.5px 0px rgb(88, 96, 105), 
//         -0.5px 0.5px 0px rgb(88, 96, 105);
//       padding-bottom: 10px;
//     }

//     #gh-dark-mode-only:target th {
//       color: #000000;
//       text-shadow: 
//         0.5px 0.5px 0px #8b949e, 
//         -0.5px -0.5px 0px #8b949e, 
//         0.5px -0.5px 0px #8b949e, 
//         -0.5px 0.5px 0px #8b949e;
//     }

//     .folder-icons {
//       vertical-align: middle; 
//     }

//     .folder-icons path {
//       fill: rgb(88, 96, 105); 
//       stroke: rgb(88, 96, 105); 
//       stroke-width: 1; 
//     }

//     #gh-dark-mode-only:target .folder-icons path {
//       fill: #8b949e; 
//       stroke: #8b949e; 
//     }
    
//     th, td {
//       text-align: center;
//       vertical-align: middle;
//     }

//     td.repo-name {
//       display: flex;
//       justify-content: center;
//       align-items: center;
//     }

//     .repo-name {
//       font-size: 12px;
//       color: rgb(88, 96, 105);
//       line-height: 1.6; 
//     }

//     #gh-dark-mode-only:target .repo-name {
//       color: #c9d1d9;
//     }

//     .unique-count {
//       font-size: 12px;
//       color: rgb(88, 96, 105);
//     }

//     #gh-dark-mode-only:target .unique-count {
//       color: #c9d1d9;
//     }

//     .date-range {
//       font-size: 12px;
//       color: rgb(88, 96, 105);
//     }

//     #gh-dark-mode-only:target .date-range {
//       color: #c9d1d9;
//     }

//     @keyframes fadein {
//       0% { opacity: 0; }
//       100% { opacity: 1; }
//     }

//     .repo-row {
//       opacity: 0;
//       animation: fadein 0.5s ease-in forwards;
//     }
//   </style>
//   <g>
//     <rect id="background" x="0" y="0" width="385" height="180" />
    
//     <rect class="header-outline" x="3" y="3" width="379" height="35" />
//     <g transform="translate(16, 15)">
//       <svg class="github-icon" x="-2" y="-4" width="18" height="18" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
//         <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
//       </svg>
//       <text class="title-cards" x="22" y="10" font-family="Arial">Top 5 Repositories by Traffic (past two weeks)</text>
//     </g>
//     <rect class="header-outline" x="3" y="41" width="160" height="20" />
//     <rect class="header-outline" x="166" y="41" width="107" height="20" />
//     <rect class="header-outline" x="276" y="41" width="106" height="20" />
    
//     <rect class="header-outline" x="3" y="64" width="160" height="113" />
//     <rect class="header-outline" x="166" y="64" width="107" height="112" />
//     <rect class="header-outline" x="276" y="64" width="106" height="112" />
    
//     <foreignObject x="0" y="43" width="380" height="140">
//       <table xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; border-collapse: collapse;">
//         <thead>
//           <tr>
//             <th style="width: 160px; text-align: center;">
//               <div style="display: flex; align-items: center; justify-content: center;">
//                 <svg class="folder-icons" width="14" height="14" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
//                   <path d="M456.914 93.284V47.3A18.74 18.74 0 0 0 438.2 28.58H194.069l-5.282-11.194A30.07 30.07 0 0 0 161.359 0H56.835a30.36 30.36 0 0 0-30.328 30.328v314.344A30.36 30.36 0 0 0 56.835 375h53.919c4.417 76.287 67.87 137 145.245 137s140.828-60.713 145.245-137h53.921a30.36 30.36 0 0 0 30.328-30.328V123.558a30.363 30.363 0 0 0-28.579-30.274M438.2 44.58a2.754 2.754 0 0 1 2.718 2.717v45.932H226.3a2.54 2.54 0 0 1-2.458-1.557L201.619 44.58ZM256 496a129.5 129.5 0 1 1 129.5-129.5A129.647 129.647 0 0 1 256 496m213.493-151.328A14.345 14.345 0 0 1 455.165 359h-53.857C397.391 282.243 333.713 221 256 221s-141.393 61.243-145.31 138H56.835a14.345 14.345 0 0 1-14.328-14.328V30.328A14.345 14.345 0 0 1 56.835 16h104.524a13.85 13.85 0 0 1 12.958 8.214L209.37 98.5a18.56 18.56 0 0 0 16.93 10.729h228.865a14.345 14.345 0 0 1 14.328 14.329Zm-149.926-4.406a8 8 0 0 1-11.314 11.314L264 307.325v137.663a8 8 0 0 1-16 0V307.325l-44.256 44.255a8 8 0 1 1-11.314-11.314l57.912-57.912a8 8 0 0 1 11.313 0Z"/>
//                 </svg>
//                 <span style="margin-left:5px;">Repository</span>
//               </div>
//             </th>
//             <th style="width: 140px; text-align: center;">
//               <div style="display: flex; align-items: center; justify-content: center;">
//                 <svg class="folder-icons" width="14" height="14" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
//                   <path d="M322.971 303.836h-72.195c-4.143 0-7.5 3.358-7.5 7.5s3.357 7.5 7.5 7.5h72.195c4.143 0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5m0 65.819h-72.195c-4.143 0-7.5 3.358-7.5 7.5s3.357 7.5 7.5 7.5h72.195c4.143 0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5m0 65.82h-72.195c-4.143 0-7.5 3.358-7.5 7.5s3.357 7.5 7.5 7.5h72.195c4.143 0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5m67.266-86.1-15.638 16.779-6.341-6.803a7.5 7.5 0 1 0-10.973 10.226l11.827 12.691a7.5 7.5 0 0 0 10.972 0l21.124-22.667a7.5 7.5 0 1 0-10.971-10.226"/>
//                   <path d="M501.893 89.88a13.97 13.97 0 0 0-7.958-7.287l-5.733-2.088 3.919-10.767a7.5 7.5 0 1 0-14.095-5.131l-3.918 10.764-5.748-2.094c-7.3-2.641-15.4 1.145-18.059 8.438l-34.152 93.844c-5.084.018-9.86 3.149-11.697 8.196L388.13 228.6h-22.209v-7.882c0-9.995-8.131-18.126-18.126-18.126h-61.866c-9.994 0-18.125 8.131-18.125 18.126v7.882h-62.875c-5.972 0-10.83 4.858-10.83 10.83v9.961l-20.82-7.22v-34.543c9.905-6.876 18.385-15.177 22.395-23.001 2.032-3.956 3.486-9.929 4.513-16.987h12.202c14.954 0 27.12-12.166 27.12-27.12 0-7.578-3.125-14.437-8.15-19.364V96.54c0-53.232-43.308-96.54-96.54-96.54-17.908 0-35.403 4.946-50.594 14.304a7.5 7.5 0 0 0 7.867 12.771C104.916 19.176 119.691 15 134.819 15c44.961 0 81.54 36.579 81.54 81.54v17.144a27 27 0 0 0-3.97-.293h-10.133a672 672 0 0 0-.236-8.089 7.5 7.5 0 0 0-6.311-7.142c-26.763-4.279-52.69-16.685-73.008-34.933a7.5 7.5 0 0 0-12.479 4.884c-1.542 16.521-15.234 28.98-31.851 28.98-1.132 0-2.305-.065-3.485-.193a7.5 7.5 0 0 0-8.303 7.181 713 713 0 0 0-.28 9.313H56.179c-.98 0-1.947.055-2.9.157V96.54c0-17.288 5.341-33.8 15.444-47.75a7.5 7.5 0 1 0-12.149-8.799C44.605 56.517 38.279 76.071 38.279 96.54v23.619c-5.653 4.976-9.229 12.256-9.229 20.361 0 14.954 12.171 27.12 27.13 27.12h12.195c1.029 7.059 2.482 13.028 4.514 16.984 4.015 7.824 12.496 16.124 22.4 22.999v34.548l-47.625 16.521c-23.259 8.059-38.885 30.011-38.885 54.626v83.44c0 6.893 5.607 12.5 12.5 12.5h172.82v91.91c0 5.972 4.858 10.83 10.83 10.83h223.859c5.978 0 10.841-4.858 10.841-10.83V370.3c0-4.142-3.357-7.5-7.5-7.5s-7.5 3.358-7.5 7.5V497h-215.53V243.6h58.91c1.259 8.774 8.804 15.545 17.92 15.545h61.866c9.117 0 16.661-6.772 17.921-15.545h16.978c-1.599 4.927.047 10.181 3.819 13.371l-4.833 13.284a7.5 7.5 0 0 0-.436 3.068l2.26 33.559c.396 5.896 4.092 10.813 9.646 12.834 1.686.613 3.411.913 5.112.913 3.903 0 7.676-1.576 10.524-4.543l15.842-16.488V335.3c0 4.142 3.357 7.5 7.5 7.5s7.5-3.358 7.5-7.5v-59.419a12.5 12.5 0 0 0 4.185-1.116 12.4 12.4 0 0 0 6.453-7.042l21.627-59.42a12.4 12.4 0 0 0-.416-9.542 12.4 12.4 0 0 0-3.27-4.259l34.163-93.851a14.03 14.03 0 0 0-.477-10.771m-367.61 185.342a57.1 57.1 0 0 0 37.796-14.25l-37.796 92.25-37.797-92.251a57.1 57.1 0 0 0 37.797 14.251m90.226-134.702c0 6.683-5.438 12.12-12.12 12.12h-10.696c.515-7.898.716-16.261.731-24.25h9.964c6.684 0 12.121 5.442 12.121 12.13m-168.33 12.12c-6.688 0-12.13-5.437-12.13-12.12 0-6.688 5.441-12.13 12.13-12.13h9.959c.015 8.018.214 16.372.727 24.25zm30.054 25.134c-1.627-3.167-2.895-9.486-3.76-18.161a8 8 0 0 0-.045-.454c-1.163-11.979-1.568-28.352-1.084-47.16 18.618-1.144 34.328-12.973 40.825-29.751 19.098 14.584 41.662 24.877 65.046 29.613q.119 4.576.168 8.952l-.004.078c0 .04.005.079.006.119.166 15.102-.285 28.268-1.271 38.318l-.01.098c-.866 8.778-2.141 15.17-3.777 18.354-6.52 12.722-34.356 30.25-48.041 30.25-13.679-.001-41.523-17.53-48.053-30.256m48.054 45.255c6.887 0 15.425-2.563 23.992-6.659v28.42c0 2.372.742 4.614 2.033 6.469-7.367 5.764-16.484 8.963-26.029 8.963s-18.661-3.199-26.028-8.963a11.3 11.3 0 0 0 2.034-6.468v-28.424c8.57 4.098 17.11 6.662 23.998 6.662M73.284 394.26v-68.25c0-4.142-3.357-7.5-7.5-7.5s-7.5 3.358-7.5 7.5v68.25H23.779v-80.94c0-18.229 11.572-34.485 28.798-40.454l28.518-9.893 40.955 99.957a13.17 13.17 0 0 0 12.234 8.208 13.17 13.17 0 0 0 12.231-8.208l40.956-99.959 6.627 2.298V394.26zm274.511-150.114h-61.866a3.13 3.13 0 0 1-3.125-3.125v-20.302a3.13 3.13 0 0 1 3.125-3.126h61.866a3.13 3.13 0 0 1 3.126 3.126v15.344l-.002.039.002.039v4.881a3.13 3.13 0 0 1-3.126 3.124m50.632 61.072-2.108-31.322 4.024-11.063 23.863 8.685-4.023 11.059zm38.607-44.994-.555-.202c-.033-.012-.063-.029-.096-.041s-.066-.019-.099-.031l-38.5-14.013 19.903-54.684 38.607 14.053.643.234zm17.343-71.578-23.866-8.687 33.58-92.273 23.873 8.696z"/>
//                 </svg>
//                 <span style="margin-left: 5px;">Uniques</span>
//               </div>
//             </th>
//             <th style="width: 120px; text-align: center; ">
//               <div style="display: flex; align-items: center; justify-content: center;">
//                 <svg class="folder-icons" width="14" height="14" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
//                   <path d="M383 324.262v6.95A56.4 56.4 0 0 0 333.321 381H326.1a6 6 0 0 0 0 12h7.216C336.107 419 357 439.356 383 442.148V449a6 6 0 0 0 12 0v-6.848A55.324 55.324 0 0 0 444.257 393h6.9a6 6 0 0 0 0-12h-6.9C441.46 355 421 334 395 331.212v-6.95a6 6 0 1 0-12 0m12 23.929v-4.885A43.7 43.7 0 0 1 432.16 381h-4.935a6 6 0 0 0 0 12h4.938A44.07 44.07 0 0 1 395 430.054v-4.986a6 6 0 0 0-12 0v4.986A43.47 43.47 0 0 1 345.413 393h4.618a6 6 0 0 0 0-12h-4.615A43.125 43.125 0 0 1 383 343.306v4.885a6 6 0 1 0 12 0m-28.6 38.489a22.391 22.391 0 1 0 22.391-22.391A22.416 22.416 0 0 0 366.4 386.68m32.782 0a10.391 10.391 0 1 1-10.391-10.391 10.4 10.4 0 0 1 10.388 10.391zM276 289.485v37.573a6 6 0 0 0 12 0V295h31.751a6 6 0 0 0 0-12h-37.572c-3.314 0-6.179 3.172-6.179 6.485M496 283h-37.572a6 6 0 0 0 0 12H490v32.058a6 6 0 0 0 12 0v-37.573c0-3.313-2.687-6.485-6-6.485m0 157.5a6 6 0 0 0-6 6V478h-31.572a6 6 0 0 0 0 12H496a5.94 5.94 0 0 0 6-5.93V446.5a6 6 0 0 0-6-6m-214 0a6 6 0 0 0-6 6v37.57a6.1 6.1 0 0 0 6.179 5.93h37.572a6 6 0 0 0 0-12H288v-31.5a6 6 0 0 0-6-6m22.615-3.5A98.294 98.294 0 1 0 418 292.813V100.667A35.95 35.95 0 0 0 382.1 65H360V52.063a30 30 0 1 0-60 0V65H128V52.063a30 30 0 1 0-60 0V65H45.541A35.685 35.685 0 0 0 10 100.667v300.878A35.5 35.5 0 0 0 45.545 437zm170.779-50.223a86.3 86.3 0 1 1-86.3-86.3 86.4 86.4 0 0 1 86.3 86.3M312 52.063a18 18 0 1 1 36 0V89h-36zm-232 0a18 18 0 1 1 36 0V89H80zm-58 48.6A23.647 23.647 0 0 1 45.545 77H68v18.2a5.514 5.514 0 0 0 5.61 5.8h48.266A5.944 5.944 0 0 0 128 95.2V77h172v18.2a5.64 5.64 0 0 0 5.767 5.8h48.265A5.81 5.81 0 0 0 360 95.2V77h22.1a23.946 23.946 0 0 1 23.9 23.667V132H22zm0 300.882V144h384v145.933A98.307 98.307 0 0 0 298.521 425H45.547A23.49 23.49 0 0 1 22 401.547zM146.922 210.4a17.9 17.9 0 1 0-17.893-17.9 17.917 17.917 0 0 0 17.893 17.9m0-23.8a5.9 5.9 0 1 1-5.893 5.9 5.9 5.9 0 0 1 5.893-5.9m66.899 23.8a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.9m66.901 23.8a17.9 17.9 0 1 0-17.894-17.9 17.916 17.916 0 0 0 17.894 17.9m0-23.8a5.9 5.9 0 1 1-5.894 5.9 5.9 5.9 0 0 1 5.894-5.9m66.898 23.8a17.9 17.9 0 1 0-17.892-17.9 17.92 17.92 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.9M80.021 266.186a17.9 17.9 0 1 0-17.892-17.9 17.92 17.92 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903zm66.901 23.8a17.9 17.9 0 1 0-17.893-17.9 17.92 17.92 0 0 0 17.893 17.9m0-23.8a5.9 5.9 0 1 1-5.893 5.9 5.9 5.9 0 0 1 5.893-5.903zm66.899 23.8a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903zm66.901 23.8a17.9 17.9 0 1 0-17.894-17.9 17.917 17.917 0 0 0 17.894 17.9m0-23.8a5.9 5.9 0 1 1-5.894 5.9 5.9 5.9 0 0 1 5.894-5.903zM80.021 321.973a17.9 17.9 0 1 0-17.892-17.9 17.92 17.92 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903zm66.901 23.8a17.9 17.9 0 1 0-17.893-17.9 17.92 17.92 0 0 0 17.893 17.9m0-23.8a5.9 5.9 0 1 1-5.893 5.9 5.9 5.9 0 0 1 5.893-5.903zm66.899 23.8a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903zm-133.8 79.587a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.902zm66.901 23.8a17.9 17.9 0 1 0-17.893-17.9 17.917 17.917 0 0 0 17.893 17.9m0-23.8a5.9 5.9 0 1 1-5.893 5.9 5.9 5.9 0 0 1 5.893-5.902zm66.899 23.8a17.9 17.9 0 1 0-17.892-17.9 17.917 17.917 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.902zM44 175.139a6 6 0 0 0 6-6v-3.1a6 6 0 0 0-12 0v3.1a6 6 0 0 0 6 6m6 103.913v-89.886a6 6 0 0 0-12 0v89.886a6 6 0 0 0 12 0m297.62-12.118a17.9 17.9 0 1 0-17.892-17.9 17.92 17.92 0 0 0 17.892 17.9m0-23.8a5.9 5.9 0 1 1-5.892 5.9 5.9 5.9 0 0 1 5.892-5.903z"/>
//                 </svg>
//                 <span style="margin-left: 5px;">Date Range</span>
//               </div>
//             </th>
//           </tr>
//         </thead>
//         <tbody>
//           ${rowsHTML}
//         </tbody>
//       </table>
//     </foreignObject>
//   </g>
// </svg>
// `
// }

// function generateSVG(repoStats) {
//   const sortedStats = repoStats.sort((a, b) => b.uniques - a.uniques);
//   const topRepos = sortedStats.slice(0, 5);

//   const iconColumnWidth = 30;
//   const repoColumnWidth = 140;
//   const uniquesColumnWidth = 100;
//   const dateColumnWidth = 110;

//   const rows = Array.isArray(topRepos) ? topRepos : [];

//   const rowsHTML = rows
//     .map(
//       (repo, index) => `
// <tr class="repo-row" style="animation-delay: ${index * 0.2}s;">
//   <td class="repo-name" style="width: ${repoColumnWidth}px; text-align: left; padding-left: 11.5px;">
//     <div style="display: flex; align-items: center;">
//       <svg class="folder-icons" width="14" height="14" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
//         <path d="M 6 4 C 4.3545455 4 3 5.3545455 3 7 L 3 16 L 3 43 C 3 44.645455 4.3545455 46 6 46 L 44 46 C 45.645455 46 47 44.645455 47 43 L 47 16 L 47 11 C 47 9.3545455 45.645455 8 44 8 L 19 8 C 19.06944 8 18.95032 7.99708 18.705078 7.7167969 C 18.459833 7.4365165 18.160156 6.9707031 17.847656 6.4707031 C 17.535156 5.9707031 17.209833 5.4365165 16.798828 4.9667969 C 16.387823 4.4970773 15.819444 4 15 4 L 6 4 z M 6 6 L 15 6 C 14.93056 6 15.04968 6.00292 15.294922 6.2832031 C 15.540167 6.5634835 15.839844 7.0292969 16.152344 7.5292969 C 16.464844 8.0292969 16.790167 8.5634835 17.201172 9.0332031 C 17.612177 9.5029227 18.180556 10 19 10 L 44 10 C 44.554545 10 45 10.445455 45 11 L 45 13.1875 C 44.685079 13.07397 44.351946 13 44 13 L 6 13 C 5.6480538 13 5.3149207 13.07397 5 13.1875 L 5 7 C 5 6.4454545 5.4454545 6 6 6 z M 6 15 L 44 15 C 44.554545 15 45 15.445455 45 16 L 45 43 C 45 43.554545 44.554545 44 44 44 L 6 44 C 5.4454545 44 5 43.554545 5 43 L 5 16 C 5 15.445455 5.4454545 15 6 15 z" transform="translate(0, -4)" />
//       </svg>
//       <span style="margin-left: 8px; max-width: ${
//         repoColumnWidth - iconColumnWidth - 16
//       }px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${
//         repo.name
//       }</span>
//     </div>
//   </td>
//   <td class="unique-count" style="width: ${uniquesColumnWidth}px; text-align: center; padding-right: 28px;">${
//         repo.uniques
//       }</td>
//   <td class="date-range" style="width: ${dateColumnWidth}px; text-align: center;">${
//         repo.dateRange
//       }</td>
// </tr>
// `
//     )
//     .join("");

//   return `
// <svg id="gh-dark-mode-only" width="385" height="180" xmlns="http://www.w3.org/2000/svg">
//   <style>
//     svg {
//       font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
//     }

//     #background {
//       fill: ${colors.light.background};
//       stroke: ${colors.light.stroke};
//       stroke-width: 1.7px;
//       rx: 6px;
//       ry: 6px;
//     }

//     #gh-dark-mode-only:target #background {
//       fill: ${colors.dark.background};
//       stroke: ${colors.dark.stroke};
//     }

//     .header-outline {
//       fill: none;
//       stroke: ${colors.light.stroke}; 
//       stroke-width: 0.7px;
//       rx: 5px;
//       ry: 5px;
//     }
//     #gh-dark-mode-only:target .header-outline {
//       stroke: ${colors.dark.stroke};
//     }

//     .title-cards {
//       font-size: 15px; 
//       font-weight: bold;
//       fill: ${colors.light.titleCards}; 
//     }

//     #gh-dark-mode-only:target .title-cards {
//       fill: ${colors.dark.titleCards};
//     }

//     .github-icon path {
//       fill: ${colors.light.iconGithub};
//     }

//     #gh-dark-mode-only:target .github-icon path {
//       fill: ${colors.dark.iconGithub};
//     }

//     th {
//       font-size: 11.5px;
//       font-weight: 600;
//       letter-spacing: 1px;
//       color: ${colors.light.textTitle};
//       text-shadow: 
//         0.5px 0.5px 0px ${colors.light.borderColor}, 
//         -0.5px -0.5px 0px ${colors.light.borderColor}, 
//         0.5px -0.5px 0px ${colors.light.borderColor}, 
//         -0.5px 0.5px 0px ${colors.light.borderColor};
//       padding-bottom: 10px;
//     }

//     #gh-dark-mode-only:target th {
//       color: ${colors.dark.textTitle};
//       text-shadow: 
//         0.5px 0.5px 0px ${colors.dark.borderColor}, 
//         -0.5px -0.5px 0px ${colors.dark.borderColor}, 
//         0.5px -0.5px 0px ${colors.dark.borderColor}, 
//         -0.5px 0.5px 0px ${colors.dark.borderColor};
//     }

//     .folder-icons {
//       vertical-align: middle; 
//     }

//     .folder-icons path {
//       fill: ${colors.light.folderIcons}; 
//       stroke: ${colors.light.folderIconOutline}; 
//       stroke-width: 1; 
//     }

//     #gh-dark-mode-only:target .folder-icons path {
//       fill: ${colors.dark.folderIcons}; 
//       stroke: ${colors.dark.folderIconOutline}; 
//     }

//     .repo-name {
//       font-size: 12px;
//       color: ${colors.light.repositoryText};
//       line-height: 1.6; 
//     }

//     #gh-dark-mode-only:target .repo-name {
//       color: ${colors.dark.repositoryText};
//     }

//     .unique-count {
//       font-size: 12px;
//       color: ${colors.light.uniqueCount};
//     }

//     #gh-dark-mode-only:target .unique-count {
//       color: ${colors.dark.uniqueCount};
//     }

//     .date-range {
//       font-size: 12px;
//       color: ${colors.light.dateRange};
//     }

//     #gh-dark-mode-only:target .date-range {
//       color: ${colors.dark.dateRange};
//     }

//     @keyframes fadein {
//       0% { opacity: 0; }
//       100% { opacity: 1; }
//     }

//     .repo-row {
//       opacity: 0;
//       animation: fadein 0.5s ease-in forwards;
//     }
//   </style>
//   <g>
//     <rect id="background" x="0" y="0" width="385" height="180" />
    
//     <rect class="header-outline" x="3" y="3" width="379" height="35" />
//     <g transform="translate(16, 15)">
//       <svg class="github-icon" x="-2" y="-4" width="18" height="18" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
//         <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
//       </svg>
//       <text class="title-cards" x="22" y="10" font-family="Arial">Top 5 Repositories by Traffic (past two weeks)</text>
//     </g>

//     <rect class="header-outline" x="3" y="41" width="141" height="20" />
//     <rect class="header-outline" x="147" y="41" width="116" height="20" />
//     <rect class="header-outline" x="266" y="41" width="116" height="20" />
    
//     <rect class="header-outline" x="3" y="64" width="141" height="112" />
//     <rect class="header-outline" x="147" y="64" width="116" height="112" />
//     <rect class="header-outline" x="266" y="64" width="116" height="112" />
    
//     <foreignObject x="0" y="43" width="380" height="140">
//       <table xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; border-collapse: collapse;">
//         <thead>
//           <tr>
//             <th style="width: ${repoColumnWidth}px; text-align: center;">Repository</th>
//             <th style="width: ${uniquesColumnWidth}px; text-align: center; padding-right: 28px;">Uniques</th>
//             <th style="width: ${dateColumnWidth}px; text-align: center; padding-right: 8px;">Date Range</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${rowsHTML}
//         </tbody>
//       </table>
//     </foreignObject>
//   </g>
// </svg>
// `;
// }


//   return `
// <svg id="gh-dark-mode-only" width="385" height="180" xmlns="http://www.w3.org/2000/svg">
//   <style>
//     svg {
//       font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
//     }

//     #background {
//       fill: ${colors.light.background};
//       stroke: ${colors.light.stroke};
//       stroke-width: 1.7px;
//       rx: 6px;
//       ry: 6px;
//     }

//     #gh-dark-mode-only:target #background {
//       fill: ${colors.dark.background};
//       stroke: ${colors.dark.stroke};
//     }

//     .title-cards {
//       font-size: 15px; 
//       font-weight: bold;
//       fill: ${colors.light.titleCards}; 
//     }

//     #gh-dark-mode-only:target .title-cards {
//       fill: ${colors.dark.titleCards};
//     }

//     .github-icon path {
//       fill: ${colors.light.iconGithub};
//     }

//     #gh-dark-mode-only:target .github-icon path {
//       fill: ${colors.dark.iconGithub};
//     }

//     th {
//       font-size: 11.5px;
//       font-weight: 600;
//       color: ${colors.light.textTitle};
//       text-shadow: 
//         1px 1px 0px ${colors.light.borderColor}, 
//         -1px -1px 0px ${colors.light.borderColor}, 
//         1px -1px 0px ${colors.light.borderColor}, 
//         -1px 1px 0px ${colors.light.borderColor};
//       padding-bottom: 5px;
//     }

//     #gh-dark-mode-only:target th {
//       color: ${colors.dark.textTitle};
//       text-shadow: 
//         0.7px 0.7px 0px ${colors.dark.borderColor}, 
//         -0.7px -0.7px 0px ${colors.dark.borderColor}, 
//         0.7px -0.7px 0px ${colors.dark.borderColor}, 
//         -0.7px 0.7px 0px ${colors.dark.borderColor};
//     }

//     .folder-icons {
//       vertical-align: middle; 
//     }

//     .folder-icons path {
//       fill: ${colors.light.folderIcons}; 
//       stroke: ${colors.light.folderIconOutline}; 
//       stroke-width: 1; 
//     }

//     #gh-dark-mode-only:target .folder-icons path {
//       fill: ${colors.dark.folderIcons}; 
//       stroke: ${colors.dark.folderIconOutline}; 
//     }

//     .repo-name {
//       font-size: 12px;
//       font-weight: 600;
//       color: ${colors.light.repositoryText};
//       line-height: 1.5; 
//     }

//     #gh-dark-mode-only:target .repo-name {
//       color: ${colors.dark.repositoryText};
//     }

//     .unique-count {
//       font-size: 11.5px;
//       font-weight: 600;
//       color: ${colors.light.uniqueCount};
//     }

//     #gh-dark-mode-only:target .unique-count {
//       color: ${colors.dark.uniqueCount};
//     }

//     .date-range {
//       font-size: 11.5px;
//       font-weight: 600; 
//       color: ${colors.light.dateRange};
//     }

//     #gh-dark-mode-only:target .date-range {
//       color: ${colors.dark.dateRange};
//     }

//     @keyframes fadein {
//       0% { opacity: 0; }
//       100% { opacity: 1; }
//     }

//     .repo-row {
//       opacity: 0;
//       animation: fadein 0.5s ease-in forwards;
//     }
//   </style>
//   <g>
//     <rect id="background" x="0" y="0" width="385" height="180" />
    
//     <g transform="translate(16, 15)">
//       <svg class="github-icon" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
//         <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
//       </svg>
//       <text class="title-cards" x="22" y="13" font-family="Arial">Top 5 Repositories by Traffic (past two weeks)</text>
//     </g>

//     <foreignObject x="5" y="40" width="365" height="140">
//       <table xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; border-collapse: collapse;">
//         <thead>
//           <tr>
//             <th style="width: ${repoColumnWidth}px; text-align: left; padding-left: 35px;">Repository</th>
//             <th style="width: ${uniquesColumnWidth}px; text-align: center; padding-right: 30px;">Uniques</th>
//             <th style="width: ${dateColumnWidth}px; text-align: center;">Date Range</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${rowsHTML}
//         </tbody>
//       </table>
//     </foreignObject>
//   </g>
// </svg>
// `;
// }

async function main() {
  try {
    const queries = new GitHubQueries(token);
    const repos = await getRepos(username, queries);
    const repoStats = await getRepoViews(repos, queries);
    const svg = generateSVG(repoStats);
    const svgDir = path.resolve(__dirname, "..", "svg");
    if (!fs.existsSync(svgDir)) {
      fs.mkdirSync(svgDir, { recursive: true });
    }

    const svgFilePath = path.join(svgDir, "traffic_stats.svg");
    fs.writeFileSync(svgFilePath, svg);
    console.log("Создан svg файл: traffic_stats.svg");
  } catch (error) {
    console.error("Error generating SVG:", error);
  }
}

main();
