const parseBtn = document.getElementById("parseBtn");
const clearBtn = document.getElementById("clearBtn");
const exampleBtn = document.getElementById("exampleBtn");
const pkgInput = document.getElementById("pkgInput");
const output = document.getElementById("output");

const packageDatabase = {
  react: {
    desc: "A declarative library for building user interfaces",
    category: "UI Framework",
  },
  "react-dom": { desc: "DOM renderer for React", category: "UI Framework" },
  next: { desc: "React framework with SSR and SSG", category: "Framework" },
  vite: { desc: "Next-generation frontend build tool", category: "Build Tool" },
  typescript: { desc: "Typed superset of JavaScript", category: "Language" },
  tailwindcss: { desc: "Utility-first CSS framework", category: "Styling" },
  axios: { desc: "Promise-based HTTP client", category: "HTTP" },
  "react-hook-form": { desc: "Performant React forms", category: "Forms" },
  zod: { desc: "Type-safe schema validation", category: "Validation" },
  eslint: { desc: "Linting utility for JavaScript", category: "Code Quality" },
  prettier: { desc: "Opinionated code formatter", category: "Code Quality" },
};

function describePackage(pkg) {
  return (
    packageDatabase[pkg] || {
      desc: "JavaScript/Node.js package",
      category: "Other",
    }
  );
}

function renderStats(deps, devDeps) {
  const total = deps.length + devDeps.length;
  return `
    <div class="stats">
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Total Packages</div></div>
      <div class="stat-card"><div class="stat-number">${deps.length}</div><div class="stat-label">Dependencies</div></div>
      <div class="stat-card"><div class="stat-number">${devDeps.length}</div><div class="stat-label">Dev Dependencies</div></div>
    </div>
  `;
}

function renderPackages(packages, title, desc) {
  let html = `
    <div class="section">
      <h2>${title}</h2>
      <p style="color:#94a3b8; margin-bottom:20px;">${desc}</p>
      <input type="text" class="search-box" placeholder="Search packages..." data-target="${title}">
      <div class="package-grid" id="grid-${title}">
  `;
  for (const [name, version] of Object.entries(packages)) {
    const info = describePackage(name);
    html += `
      <div class="package-item" data-name="${name.toLowerCase()}" data-desc="${info.desc.toLowerCase()}">
        <div class="pkg-name">${name}</div>
        <div class="pkg-version">${version}</div>
        <div class="pkg-desc">${info.desc}</div>
        <span class="pkg-category">${info.category}</span>
      </div>`;
  }
  html += "</div></div>";
  return html;
}

function analyzePackage() {
  output.innerHTML = "";
  let data;
  try {
    data = JSON.parse(pkgInput.value);
  } catch (e) {
    output.innerHTML = `<div class="error"><strong>Invalid JSON:</strong> ${e.message}</div>`;
    return;
  }

  const deps = Object.entries(data.dependencies || {});
  const devDeps = Object.entries(data.devDependencies || {});
  if (!deps.length && !devDeps.length) {
    output.innerHTML = `<div class="empty-state">
      <h3>No dependencies found</h3>
      <p>Try loading an <span class="example-link" id="loadExampleLink">example</span></p>
    </div>`;
    document
      .getElementById("loadExampleLink")
      .addEventListener("click", loadExample);
    return;
  }

  output.innerHTML = renderStats(deps, devDeps);
  if (deps.length)
    output.innerHTML += renderPackages(
      Object.fromEntries(deps),
      "Dependencies",
      "Production packages"
    );
  if (devDeps.length)
    output.innerHTML += renderPackages(
      Object.fromEntries(devDeps),
      "Dev Dependencies",
      "Development packages"
    );
}

function clearAll() {
  pkgInput.value = "";
  output.innerHTML = "";
}

function loadExample() {
  const example = {
    name: "my-awesome-app",
    dependencies: {
      react: "^18.2.0",
      "react-dom": "^18.2.0",
      axios: "^1.4.0",
      tailwindcss: "^3.3.3",
      zod: "^3.21.4",
    },
    devDependencies: {
      vite: "^4.4.7",
      typescript: "^5.1.6",
      eslint: "^8.45.0",
      prettier: "^3.0.0",
    },
  };
  pkgInput.value = JSON.stringify(example, null, 2);
  analyzePackage();
}

parseBtn.addEventListener("click", analyzePackage);
clearBtn.addEventListener("click", clearAll);
exampleBtn.addEventListener("click", loadExample);

document.addEventListener("keyup", (e) => {
  if (e.target.classList.contains("search-box")) {
    const query = e.target.value.toLowerCase();
    const grid = document.getElementById(`grid-${e.target.dataset.target}`);
    grid.querySelectorAll(".package-item").forEach((item) => {
      const match =
        item.dataset.name.includes(query) || item.dataset.desc.includes(query);
      item.style.display = match ? "" : "none";
    });
  }
});
