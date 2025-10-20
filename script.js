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
const totalN = document.createElement("div");
const depsN = document.createElement("div");
const devdepsN = document.createElement("div");
const insights = document.getElementById("insights");
const filterButtons = document.getElementById("filterButtons");
const errorMsg = document.getElementById("errorMsg");

let currentPackagesList = [];
let activeFilter = "All";

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

async function fetchPackageInfo(name, version) {
  try {
    // Fetch npm registry info
    const npmRes = await fetch(`https://registry.npmjs.org/${name}`);
    let npmData = {};
    if (npmRes.ok) {
      npmData = await npmRes.json();
    }

    // Fetch OSV vulnerability data
    const osvRes = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: version.replace(/^[^\d]*/, ""), // Remove ^ or ~ prefixes
        package: { name, ecosystem: "npm" },
      }),
    });
    let vulnerabilities = [];
    if (osvRes.ok) {
      const osvData = await osvRes.json();
      vulnerabilities = osvData.vulns || [];
    }

    return {
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
  } catch (e) {
    console.error(`Error fetching info for ${name}:`, e);
    return {
      desc: packageDatabase[name]?.desc || "No description",
      license: packageDatabase[name]?.license || "Unknown",
      deprecated: packageDatabase[name]?.deprecated || false,
      latest: "",
      vulnerabilities: [],
    };
  }
}

async function analyzeInput(raw) {
  analyzeBtn.disabled = true;
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

    const list = [];
    for (const pkg of allPackages) {
      const meta = await fetchPackageInfo(pkg.k, pkg.v);
      list.push({
        name: pkg.k,
        version: pkg.v,
        category: packageDatabase[pkg.k]?.category || "Other",
        desc: meta.desc,
        license: meta.license,
        isDev: pkg.isDev,
        deprecated: meta.deprecated,
        latest: meta.latest,
        vulnerabilities: meta.vulnerabilities,
      });
    }

    currentPackagesList = list;
    renderFilters();
    renderGrid();
    renderStats();
    generateInsights(list);
  } catch (e) {
    pkgGrid.innerHTML = "";
    insights.innerHTML = "";
    errorMsg.textContent = "Invalid JSON or error processing input";
    errorMsg.style.display = "block";
  } finally {
    analyzeBtn.disabled = false;
  }
}

function renderFilters() {
  const categories = [
    "All",
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
  if (activeFilter !== "All")
    filtered = filtered.filter((p) => p.category === activeFilter);
  pkgGrid.innerHTML = filtered.length
    ? filtered
        .map(
          (p) => `
                    <div class="pkg">
                        <div class="meta">
                            <div class="name">${escapeHTML(
                              p.name
                            )} v${escapeHTML(p.version)}${
            p.isDev ? " (dev)" : ""
          }</div>
                            <div class="desc">${escapeHTML(p.desc)}</div>
                            <div class="status">Category: ${escapeHTML(
                              p.category
                            )}</div>
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
                                    ? `<span class="badge vulnerable">${
                                        p.vulnerabilities.length
                                      } vuln${
                                        p.vulnerabilities.length > 1 ? "s" : ""
                                      }</span>`
                                    : ""
                                }
                                <span class="badge license">${escapeHTML(
                                  p.license
                                )}</span>
                            </div>
                        </div>
                    </div>
                `
        )
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

  statsGrid.innerHTML = `
                <div class="stat"><div class="n">${total}</div>Total</div>
                <div class="stat"><div class="n">${deps}</div>Dependencies</div>
                <div class="stat"><div class="n">${devDeps}</div>Dev Deps</div>
                <div class="stat"><div class="n">${vulnerable}</div>Vulnerable</div>
            `;
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
      if (
        pkg.name.toLowerCase().includes("react") &&
        pkg.version.startsWith("^16")
      )
        notes.push("Upgrade to React 18 for better performance and hooks");
      if (pkg.name.toLowerCase().includes("moment"))
        notes.push("Replace with Day.js or date-fns");
      if (
        pkg.name.toLowerCase().includes("lodash") &&
        pkg.version.startsWith("^4.17.15")
      )
        notes.push("Use native JS methods or import specific Lodash modules");
      if (pkg.vulnerabilities.length) {
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
      }
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

analyzeBtn.addEventListener("click", () => analyzeInput(pkgInput.value));
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
});

searchBox.addEventListener("input", debounce(renderGrid, 200));
