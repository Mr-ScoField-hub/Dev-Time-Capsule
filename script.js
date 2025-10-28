const packageDatabase = {
  react: { desc: "Front-end UI library", category: "UI", license: "MIT" },
  "react-dom": { desc: "React DOM renderer", category: "UI", license: "MIT" },
  vite: { desc: "Modern build tool", category: "Build", license: "MIT" },
  webpack: { desc: "JavaScript bundler", category: "Build", license: "MIT" },
  eslint: { desc: "Code linter", category: "Quality", license: "MIT" },
  prettier: { desc: "Code formatter", category: "Quality", license: "MIT" },
  express: { desc: "Backend framework", category: "Backend", license: "MIT" },
  lodash: { desc: "Utility library", category: "Utilities", license: "MIT" },
  tailwindcss: { desc: "CSS framework", category: "Styling", license: "MIT" },
  axios: { desc: "HTTP client library", category: "Backend", license: "MIT" },
  moment: {
    desc: "Date parsing library",
    category: "Utilities",
    license: "MIT",
    deprecated: true,
  },
};

const pkgInput = document.getElementById("pkgInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const loadExample = document.getElementById("loadExample");
const clearBtn = document.getElementById("clearBtn");
const searchBox = document.getElementById("searchBox");
const pkgGrid = document.getElementById("pkgGrid");
const statsGrid = document.getElementById("statsGrid");
const insights = document.getElementById("insights");
const filterButtons = document.getElementById("filterButtons");
const errorMsg = document.getElementById("errorMsg");
const ghUrl = document.getElementById("ghUrl");

let currentPackagesList = [];
let activeFilter = "All";
const cache = new Map();

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function setLoading(loading) {
  const loader = analyzeBtn.querySelector(".loader");
  analyzeBtn.disabled = loading;
  if (loader) loader.style.display = loading ? "inline-block" : "none";
}

function normalizeRepo(input) {
  if (input.startsWith("https://github.com/")) {
    return input.replace("https://github.com/", "").replace(/\/$/, "");
  }
  return input;
}

async function fetchPackageInfo(name, version) {
  const cacheKey = `${name}@${version}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const npmRes = await fetch(`https://registry.npmjs.org/${name}`);
    let npmData = {};
    if (npmRes.ok) npmData = await npmRes.json();

    const osvRes = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: version.replace(/^[^\d]*/, ""),
        package: { name, ecosystem: "npm" },
      }),
    });

    let vulnerabilities = [];
    if (osvRes.ok) {
      const osvData = await osvRes.json();
      vulnerabilities = osvData.vulns || [];
    }

    const result = {
      desc:
        npmData.description || packageDatabase[name]?.desc || "No description",
      license: npmData.license || packageDatabase[name]?.license || "Unknown",
      deprecated:
        !!npmData.deprecated || packageDatabase[name]?.deprecated || false,
      latest: npmData["dist-tags"]?.latest || "",
      vulnerabilities: vulnerabilities.map((v) => ({
        id: v.id,
        summary: v.summary,
        severity: v.database_specific?.severity || "UNKNOWN",
        details: v.details,
      })),
    };
    cache.set(cacheKey, result);
    return result;
  } catch {
    return {
      desc: packageDatabase[name]?.desc || "No description",
      license: packageDatabase[name]?.license || "Unknown",
      deprecated: packageDatabase[name]?.deprecated || false,
      latest: "",
      vulnerabilities: [],
    };
  }
}

function calculateRisk(pkg) {
  let score = 0;
  if (pkg.deprecated) score += 5;
  if (pkg.latest && pkg.version !== pkg.latest) score += 2;
  score += pkg.vulnerabilities.length * 3;
  return score;
}

async function analyzeInput(raw) {
  setLoading(true);
  errorMsg.style.display = "none";
  pkgGrid.innerHTML = '<div class="notice">Loading...</div>';
  insights.innerHTML = "";
  statsGrid.innerHTML = "";

  try {
    const parsed = JSON.parse(raw);
    const deps = parsed.dependencies || {};
    const devDeps = parsed.devDependencies || {};
    const allPackages = [
      ...Object.entries(deps).map(([k, v]) => ({ k, v, isDev: false })),
      ...Object.entries(devDeps).map(([k, v]) => ({ k, v, isDev: true })),
    ];

    const list = await Promise.all(
      allPackages.map(async (pkg) => {
        const meta = await fetchPackageInfo(pkg.k, pkg.v);
        return {
          name: pkg.k,
          version: pkg.v,
          category: packageDatabase[pkg.k]?.category || "Other",
          desc: meta.desc,
          license: meta.license,
          isDev: pkg.isDev,
          deprecated: meta.deprecated,
          latest: meta.latest,
          vulnerabilities: meta.vulnerabilities,
          riskScore: calculateRisk({ ...pkg, ...meta }),
        };
      })
    );

    currentPackagesList = list.sort((a, b) => b.riskScore - a.riskScore);
    renderFilters();
    renderGrid();
    renderStats();
    generateInsights(list);
  } catch {
    pkgGrid.innerHTML = "";
    insights.innerHTML = "";
    errorMsg.textContent = "Invalid JSON or error processing input";
    errorMsg.style.display = "block";
  } finally {
    setLoading(false);
  }
}

function renderFilters() {
  const categories = [
    "All",
    "High Risk",
    "Deprecated",
    "Vulnerable",
    ...new Set(currentPackagesList.map((p) => p.category)),
  ];
  filterButtons.innerHTML = "";
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.className = activeFilter === cat ? "filter-btn active" : "filter-btn";
    btn.onclick = () => {
      activeFilter = cat;
      renderFilters();
      renderGrid();
    };
    filterButtons.appendChild(btn);
  });
}

function renderGrid() {
  const q = searchBox.value.toLowerCase();
  let filtered = currentPackagesList.filter((p) =>
    p.name.toLowerCase().includes(q)
  );

  if (activeFilter === "High Risk")
    filtered = filtered.filter((p) => p.riskScore >= 5);
  else if (activeFilter === "Deprecated")
    filtered = filtered.filter((p) => p.deprecated);
  else if (activeFilter === "Vulnerable")
    filtered = filtered.filter((p) => p.vulnerabilities.length > 0);
  else if (activeFilter !== "All")
    filtered = filtered.filter((p) => p.category === activeFilter);

  pkgGrid.innerHTML = filtered.length
    ? filtered
        .map((p) => {
          const riskClass =
            p.riskScore >= 5
              ? "high-risk"
              : p.riskScore >= 3
              ? "medium-risk"
              : "low-risk";
          return `<div class="pkg ${riskClass}">
          <div class="meta">
            <div class="name">${escapeHTML(p.name)} v${escapeHTML(p.version)}${
            p.isDev ? " (dev)" : ""
          }</div>
            <div class="desc">${escapeHTML(p.desc)}</div>
            <div class="status">Category: ${escapeHTML(p.category)}</div>
            <div class="badges">
              ${
                p.deprecated
                  ? '<span class="badge deprecated">Deprecated</span>'
                  : ""
              }
              ${
                p.latest && p.version !== p.latest
                  ? `<span class="badge outdated">Upgrade to ${p.latest}</span>`
                  : ""
              }
              ${
                p.vulnerabilities.length
                  ? `<span class="badge vulnerable" title="Click for details">${
                      p.vulnerabilities.length
                    } vuln(s) (${p.vulnerabilities
                      .map((v) => v.severity)
                      .join(", ")})</span>`
                  : ""
              }
              <span class="badge license">${escapeHTML(p.license)}</span>
            </div>
          </div>
        </div>`;
        })
        .join("")
    : '<div class="notice">No packages found</div>';
}

function renderStats() {
  const total = currentPackagesList.length;
  const deps = currentPackagesList.filter((p) => !p.isDev).length;
  const devDeps = currentPackagesList.filter((p) => p.isDev).length;
  const vulnerable = currentPackagesList.filter(
    (p) => p.vulnerabilities.length > 0
  ).length;
  const maxScore = 10 * total;
  const totalScore = currentPackagesList.reduce(
    (acc, p) => acc + p.riskScore,
    0
  );
  const healthPercent = total
    ? Math.max(0, 100 - (totalScore / maxScore) * 100).toFixed(0)
    : 100;

  statsGrid.innerHTML = `
    <div class="stat"><div class="n">${total}</div>Total</div>
    <div class="stat"><div class="n">${deps}</div>Dependencies</div>
    <div class="stat"><div class="n">${devDeps}</div>Dev Deps</div>
    <div class="stat"><div class="n">${vulnerable}</div>Vulnerable</div>
    <div class="stat"><div class="n">${healthPercent}%</div>Health</div>`;
}

function generateInsights(list) {
  if (!list.length) {
    insights.innerHTML = '<div class="notice">No insights available</div>';
    return;
  }

  const suggestions = list
    .map((pkg) => {
      let notes = [];
      if (pkg.deprecated)
        notes.push("Package is deprecated. Consider alternatives.");
      if (pkg.latest && pkg.version !== pkg.latest)
        notes.push(`Upgrade to ${pkg.latest}`);
      if (pkg.name.toLowerCase().includes("moment"))
        notes.push("Replace with Day.js or date-fns");
      if (pkg.vulnerabilities.length)
        notes.push(
          `Found ${
            pkg.vulnerabilities.length
          } vulnerabilities: ${pkg.vulnerabilities
            .map(
              (v) =>
                `<a href="https://osv.dev/vulnerability/${v.id}" target="_blank">${v.id}</a> (${v.severity})`
            )
            .join(", ")}`
        );
      return notes.length
        ? `<div><strong>${escapeHTML(pkg.name)}</strong>: ${notes.join(
            "; "
          )}</div>`
        : "";
    })
    .filter(Boolean);

  insights.innerHTML = suggestions.length
    ? "<strong>Suggestions:</strong><br>" + suggestions.join("")
    : '<div class="notice">No suggestions found</div>';
}

async function fetchFromGitHub(input) {
  setLoading(true);
  errorMsg.style.display = "none";
  try {
    const repo = normalizeRepo(input);
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`);
    if (!repoRes.ok) throw new Error("Repo not found");
    const { default_branch } = await repoRes.json();

    // Get package.json recursively
    const treeRes = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${default_branch}?recursive=1`
    );
    if (!treeRes.ok) throw new Error("Failed to fetch repo tree");
    const tree = (await treeRes.json()).tree;
    const pkgFile = tree.find(
      (f) => f.path.endsWith("package.json") && f.type === "blob"
    );
    if (!pkgFile) throw new Error("No package.json found in repo");

    const pkgRes = await fetch(pkgFile.url, {
      headers: { Accept: "application/vnd.github.v3.raw" },
    });
    if (!pkgRes.ok) throw new Error("Failed to fetch package.json");
    const pkgJson = await pkgRes.json();
    pkgInput.value = JSON.stringify(pkgJson, null, 2);
    await analyzeInput(JSON.stringify(pkgJson));
  } catch (e) {
    errorMsg.textContent =
      "Failed to fetch package.json from GitHub: " + e.message;
    errorMsg.style.display = "block";
  } finally {
    setLoading(false);
  }
}

analyzeBtn.addEventListener("click", () => {
  if (ghUrl.value.trim()) fetchFromGitHub(ghUrl.value.trim());
  else analyzeInput(pkgInput.value);
});

loadExample.addEventListener("click", () => {
  pkgInput.value = JSON.stringify(
    {
      name: "demo",
      dependencies: {
        react: "^16.13.1",
        lodash: "^4.17.15",
        moment: "^2.29.1",
      },
      devDependencies: { eslint: "^8.0.0" },
    },
    null,
    2
  );
});

clearBtn.addEventListener("click", () => {
  pkgInput.value = "";
  pkgGrid.innerHTML = "";
  insights.innerHTML = "";
  statsGrid.innerHTML = "";
  errorMsg.style.display = "none";
  ghUrl.value = "";
});

searchBox.addEventListener("input", debounce(renderGrid, 200));
