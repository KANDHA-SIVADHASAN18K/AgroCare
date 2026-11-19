import { diseases, categories, crops, fallbackImage } from "./data/diseases.js";

let catalogue = diseases;
let catalogueCategories = categories;
let catalogueCrops = crops;

const main = document.querySelector("#main-content");
const modalRoot = document.querySelector("#modal-root");
const nav = document.querySelector(".main-nav");
const menuToggle = document.querySelector(".menu-toggle");
let selectedFile = null;
let previewUrl = null;
let currentFilter = { query: "", crop: "", category: "", sort: "az" };
let toastTimer;

const icon = (name, className = "") => {
  const paths = {
    leaf: '<path d="M20 4c-9 0-14 4-14 11a5 5 0 0 0 5 5c7 0 11-5 11-14V4h-2Z"/><path d="M6 22c3-6 7-9 13-13"/>',
    scan: '<path d="M4 9V5a1 1 0 0 1 1-1h4M16 4h3a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M8 20H5a1 1 0 0 1-1-1v-4"/><path d="M8 12h8"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    water: '<path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13S5 11 5 15a7 7 0 0 0 7 7Z"/>',
    sprout: '<path d="M12 22V9"/><path d="M12 12c-5 0-8-3-8-8 5 0 8 3 8 8Zm0 4c0-5 3-8 8-8 0 5-3 8-8 8Z"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M20 16.5v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'
  };
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
};

const photo = (url, alt, cls = "") =>
  `<img class="${cls}" src="${url}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'">`;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const diseasePath = (disease) => `#library/${disease.id}`;

function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("is-visible"), 3400);
}

function diseaseCard(disease, index = 0) {
  return `<article class="disease-card reveal" style="--delay:${Math.min(index % 6, 5) * 55}ms">
    <a class="disease-card-image" href="${diseasePath(disease)}" aria-label="View ${escapeHtml(disease.name)} details">
      ${photo(disease.image, `Representative ${disease.crop} crop image`, "")}
      <span class="image-caption-chip">Crop photo · illustrative</span>
      <span class="crop-chip">${escapeHtml(disease.crop)}</span>
      <span class="card-image-arrow" aria-hidden="true">↗</span>
    </a>
    <div class="disease-card-body"><span class="eyebrow">${escapeHtml(disease.category)}</span>
      <h3><a href="${diseasePath(disease)}">${escapeHtml(disease.name)}</a></h3>
      <p>${escapeHtml(disease.description)}</p>
      <a class="text-link" href="${diseasePath(disease)}">View details ${icon("arrow")}</a>
    </div>
  </article>`;
}

function renderHome() {
  const featured = ["rice-blast", "tomato-late-blight", "maize-fall-armyworm"].map((id) => catalogue.find((item) => item.id === id));
  main.innerHTML = `<section class="hero">
    ${photo("https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=2200&q=90", "Farmer working among green crops in an agricultural field", "hero-image")}
    <div class="hero-shade"></div>
    <div class="hero-content page-container">
      <span class="hero-kicker"><span class="kicker-dot"></span> Crop health, made clearer</span>
      <h1>Protect your crops<br>before it’s <em>too late.</em></h1>
      <p>Spot the signs. Understand the risks. Make informed decisions for healthier fields and stronger harvests.</p>
      <div class="hero-actions"><a class="button button-lime" href="#detect">Explore symptom guide ${icon("arrow")}</a><a class="button button-glass" href="#library">Browse disease library <span>↗</span></a></div>
      <div class="hero-trust"><span class="trust-avatars" aria-hidden="true"><b>🌾</b><b>🌱</b><b>🍃</b></span><span>Practical knowledge for<br><strong>every growing season</strong></span></div>
    </div>
    <div class="hero-side-note"><span>01 — 04</span><i></i><span>GROW WITH CONFIDENCE</span></div>
    <div class="hero-bottom page-container"><span>FIELD NOTES FOR BETTER HARVESTS</span><span>SCROLL TO EXPLORE ↓</span></div>
  </section>
  <section class="intro-section section-pad page-container">
    <div class="intro-heading"><span class="eyebrow">${icon("leaf")} THE CHALLENGE</span><h2>Small signs can make<br><em>a big difference.</em></h2></div>
    <div class="intro-copy"><p class="lead">Crop diseases and pests can spread before the damage is easy to see. The earlier a problem is understood, the more options a farmer has to respond.</p><p>AgroCare brings clear, crop-specific information together in one place—so growers can learn what to look for, reduce avoidable losses and know when to seek local expertise.</p><a class="text-link" href="#about">Meet AgroCare ${icon("arrow")}</a></div>
  </section>
  <section class="how-section section-pad">
    <div class="page-container"><div class="section-heading centered"><span class="eyebrow">A SIMPLE WAY FORWARD</span><h2>From field observation<br>to <em>informed action.</em></h2><p>Start with what you see. Learn what it may mean. Choose your next step with care.</p></div>
      <div class="steps-grid">
        <article class="step-card"><div class="step-top"><span class="step-number">01</span><span class="step-icon">${icon("upload")}</span></div><h3>Share what you see</h3><p>Upload a clear crop photo and note the visible symptoms for a more useful field record.</p><span class="step-caption">OBSERVE &nbsp;·&nbsp; DOCUMENT</span></article>
        <article class="step-card step-featured"><div class="step-top"><span class="step-number">02</span><span class="step-icon">${icon("scan")}</span></div><h3>Explore possible causes</h3><p>Compare symptoms with our crop health library. Guidance is educational—not an AI diagnosis.</p><span class="step-caption">COMPARE &nbsp;·&nbsp; LEARN</span></article>
        <article class="step-card"><div class="step-top"><span class="step-number">03</span><span class="step-icon">${icon("sprout")}</span></div><h3>Plan a responsible response</h3><p>Review prevention and management practices, and consult local experts when needed.</p><span class="step-caption">PREVENT &nbsp;·&nbsp; MANAGE</span></article>
      </div>
    </div>
  </section>
  <section class="problems-section section-pad page-container">
    <div class="section-heading split-heading"><div><span class="eyebrow">KNOW WHAT TO LOOK FOR</span><h2>Crop challenges,<br><em>clearly explained.</em></h2></div><a class="text-link" href="#library">Explore the library ${icon("arrow")}</a></div>
    <div class="problem-grid">
      ${[
        ["Leaf diseases","Spots, streaks and wilting can signal different causes.",cropImagesFor("Rice"),"rice-blast"],
        ["Fungal infections","Moisture-loving pathogens can spread across a field.",cropImagesFor("Tomato"),"tomato-late-blight"],
        ["Bacterial diseases","Some infections move quickly through water and plant material.",cropImagesFor("Cotton"),"cotton-bacterial-blight"],
        ["Viral infections","Insect vectors and infected planting material can carry viruses.",cropImagesFor("Chilli"),"tomato-tylcv"],
        ["Pest infestations","Regular scouting helps spot insects before pressure builds.",cropImagesFor("Maize"),"maize-fall-armyworm"],
        ["Nutrient disorders","Soil and water conditions can mimic disease symptoms.",cropImagesFor("Multiple crops"),"nutrient-deficiency"]
      ].map(([title, copy, image, id], i) => `<a class="problem-card reveal" style="--delay:${i*55}ms" href="${diseasePath(catalogue.find((d) => d.id === id))}">
          ${photo(image, `Representative crop image for ${title}`)}<span class="problem-number">0${i+1}</span><div class="problem-card-copy"><span>FIELD GUIDE · 0${i+1}</span><h3>${title}</h3><p>${copy}</p><span class="round-arrow">↗</span></div>
        </a>`).join("")}
    </div>
  </section>
  <section class="early-section">
    <div class="early-image-wrap">${photo("https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1200&q=85","Farmer inspecting a healthy crop in the field","early-image")}<div class="image-caption"><span>${icon("leaf")}</span><p>Healthy fields begin<br>with attentive care.</p></div></div>
    <div class="early-copy"><span class="eyebrow">${icon("sun")} WHY EARLY DETECTION MATTERS</span><h2>More time to act.<br><em>More to protect.</em></h2><p>When crop problems are noticed early, farmers can investigate the cause, limit spread and choose a response suited to the field. Waiting may mean greater crop stress, more costly interventions and avoidable yield loss.</p><div class="early-points"><div><span>01</span><p><strong>Protect crop potential</strong><small>Notice changes before they affect more plants.</small></p></div><div><span>02</span><p><strong>Make better decisions</strong><small>Match actions to the actual cause—not guesswork.</small></p></div><div><span>03</span><p><strong>Use inputs responsibly</strong><small>Prevention and scouting can reduce unnecessary treatments.</small></p></div></div><a class="button button-dark" href="#library">Learn the warning signs ${icon("arrow")}</a></div>
  </section>
  <section class="tips-section section-pad page-container">
    <div class="tips-intro"><span class="eyebrow">HEALTHIER FIELDS, EVERY DAY</span><h2>Good habits grow<br><em>stronger crops.</em></h2><p>Simple, consistent field practices can prevent many problems and make emerging issues easier to manage.</p><a class="text-link" href="#about">Our approach to crop care ${icon("arrow")}</a></div>
    <div class="tips-grid"><article class="tip-card"><span class="tip-icon">${icon("scan")}</span><span class="tip-index">01 / SCOUT</span><h3>Walk your fields</h3><p>Check plants regularly, including field edges and leaf undersides. Record when symptoms first appear.</p></article><article class="tip-card"><span class="tip-icon">${icon("shield")}</span><span class="tip-index">02 / PREVENT</span><h3>Start with clean</h3><p>Use healthy seed or planting material and varieties suited to local pest and disease pressures.</p></article><article class="tip-card"><span class="tip-icon">${icon("water")}</span><span class="tip-index">03 / BALANCE</span><h3>Care for soil & water</h3><p>Use balanced nutrition and sound irrigation and drainage to avoid unnecessary crop stress.</p></article><article class="tip-card"><span class="tip-icon">${icon("sprout")}</span><span class="tip-index">04 / PROTECT</span><h3>Keep nature in balance</h3><p>Conserve beneficial organisms and use integrated pest management before reaching for a spray.</p></article></div>
  </section>
  <section class="featured-section section-pad"><div class="page-container"><div class="section-heading split-heading"><div><span class="eyebrow">A FEW PLACES TO START</span><h2>Popular field <em>guides.</em></h2></div><a class="text-link" href="#library">See all crop guides ${icon("arrow")}</a></div><div class="disease-grid">${featured.map((d, i) => diseaseCard(d, i)).join("")}</div></div></section>
  <section class="cta-section page-container"><div class="cta-content"><span class="eyebrow">YOUR NEXT STEP STARTS HERE</span><h2>Start protecting your crops <em>today.</em></h2><p>Explore the field guide or use symptom-based guidance to learn what to check next.</p><div class="hero-actions"><a class="button button-lime" href="#detect">Explore symptom guide ${icon("arrow")}</a><a class="button button-glass" href="#library">Browse crop guides <span>↗</span></a></div></div><div class="cta-decoration">${icon("leaf")}<span>GROW<br>FORWARD</span></div></section>`;
  observeReveals();
}

function cropImagesFor(crop) {
  const map = {
    Rice: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80",
    Tomato: "https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=800&q=80",
    Cotton: "https://images.unsplash.com/photo-1595348020949-87cdfbb44174?auto=format&fit=crop&w=800&q=80",
    Chilli: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=800&q=80",
    Maize: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=800&q=80",
    "Multiple crops": fallbackImage
  };
  return map[crop] || fallbackImage;
}

function renderLibrary() {
  const query = currentFilter.query.trim().toLowerCase();
  const shown = catalogue.filter((d) => {
    const text = `${d.name} ${d.crop} ${d.category} ${d.description}`.toLowerCase();
    return (!query || text.includes(query)) && (!currentFilter.crop || d.crop === currentFilter.crop) && (!currentFilter.category || d.category === currentFilter.category);
  }).sort((a, b) => currentFilter.sort === "za" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
  main.innerHTML = `<section class="page-hero library-hero"><div class="page-container"><span class="eyebrow">${icon("leaf")} THE AGROCARE FIELD GUIDE</span><h1>Understand the signs.<br><em>Know your options.</em></h1><p>Explore crop diseases, pests and disorders with practical notes on symptoms, prevention and responsible management.</p><div class="library-stats"><span><strong>${catalogue.length.toString().padStart(2,"0")}</strong> field guides</span><i></i><span><strong>${catalogueCrops.length.toString().padStart(2,"0")}</strong> crop groups</span><i></i><span>Clear, practical information</span></div></div></section>
    <section class="library-content page-container">
      <div class="library-toolbar"><div class="library-title"><span class="eyebrow">BROWSE THE LIBRARY</span><h2>Find a field guide</h2></div><label class="search-box">${icon("search")}<input type="search" id="disease-search" value="${escapeHtml(currentFilter.query)}" placeholder="Search crops, symptoms, diseases…" aria-label="Search disease library"><kbd>⌘ K</kbd></label></div>
      <div class="filter-row"><div class="filter-selects"><label class="select-wrap"><span class="sr-only">Filter by crop</span><select id="crop-filter"><option value="">All crops</option>${catalogueCrops.map((crop) => `<option ${currentFilter.crop === crop ? "selected" : ""} value="${escapeHtml(crop)}">${escapeHtml(crop)}</option>`).join("")}</select></label><label class="select-wrap"><span class="sr-only">Filter by category</span><select id="category-filter"><option value="">All categories</option>${catalogueCategories.map((category) => `<option ${currentFilter.category === category ? "selected" : ""} value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select></label><label class="select-wrap"><span class="sr-only">Sort alphabetically</span><select id="sort-filter"><option value="az" ${currentFilter.sort === "az" ? "selected" : ""}>A to Z</option><option value="za" ${currentFilter.sort === "za" ? "selected" : ""}>Z to A</option></select></label></div><span class="results-count"><strong>${shown.length}</strong> guides found</span></div>
      <div class="disease-grid library-grid" id="disease-grid">${shown.map(diseaseCard).join("") || `<div class="empty-state"><span>${icon("search")}</span><h3>No matching field guides</h3><p>Try a different search or clear one of the filters.</p><button class="button button-dark" id="clear-filters">Clear filters</button></div>`}</div>
      <div class="library-disclaimer"><span>${icon("shield")}</span><p><strong>A note on crop health:</strong> Symptoms can have multiple causes and vary by region. This library is for education, not a confirmed diagnosis. For treatment decisions, consult a local agricultural extension service and follow applicable product labels and regulations.</p></div>
    </section>`;
  document.querySelector("#disease-search").addEventListener("input", (event) => {
    currentFilter.query = event.target.value;
    const position = event.target.selectionStart;
    renderLibrary();
    const next = document.querySelector("#disease-search");
    next.focus();
    next.setSelectionRange(position, position);
  });
  document.querySelector("#crop-filter").addEventListener("change", (event) => { currentFilter.crop = event.target.value; renderLibrary(); });
  document.querySelector("#category-filter").addEventListener("change", (event) => { currentFilter.category = event.target.value; renderLibrary(); });
  document.querySelector("#sort-filter").addEventListener("change", (event) => { currentFilter.sort = event.target.value; renderLibrary(); });
  document.querySelector("#clear-filters")?.addEventListener("click", () => { currentFilter = { query: "", crop: "", category: "", sort: "az" }; renderLibrary(); });
}

function openDiseaseDetails(disease) {
  if (!disease) return;
  modalRoot.innerHTML = `<div class="modal-backdrop" role="presentation"><section class="detail-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <button class="modal-close" type="button" aria-label="Close details">${icon("close")}</button>
    <div class="detail-cover">${photo(disease.image, `Representative ${disease.crop} crop image`)}<span class="crop-chip">${escapeHtml(disease.crop)}</span><div class="detail-cover-shade"></div><div class="detail-cover-title"><span class="eyebrow">${escapeHtml(disease.category)}</span><h2 id="modal-title">${escapeHtml(disease.name)}</h2></div></div>
    <div class="detail-content"><p class="detail-description">${escapeHtml(disease.description)}</p>
      <div class="detail-facts"><span><small>AFFECTED CROP</small><strong>${escapeHtml(disease.crop)}</strong></span><span><small>CATEGORY</small><strong>${escapeHtml(disease.category)}</strong></span></div>
      <div class="detail-section"><span class="detail-section-number">01</span><div><h3>Symptoms to look for</h3><p>${escapeHtml(disease.symptoms)}</p></div></div>
      <div class="detail-section"><span class="detail-section-number">02</span><div><h3>Causes & transmission</h3><p>${escapeHtml(disease.causes)}</p></div></div>
      <div class="detail-section"><span class="detail-section-number">03</span><div><h3>Conditions that favor it</h3><p>${escapeHtml(disease.conditions)}</p></div></div>
      <div class="detail-section"><span class="detail-section-number">04</span><div><h3>Prevention</h3><ul>${disease.prevention.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></div>
      <div class="detail-section"><span class="detail-section-number">05</span><div><h3>Management & treatment</h3><ul>${disease.management.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></div>
      <div class="detail-section ipm-section"><span class="detail-section-number">06</span><div><h3>Integrated crop protection</h3><ul>${disease.ipm.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></div>
      <div class="detail-note">${icon("shield")}<p>This guide is educational. Similar symptoms can have different causes; confirm locally before taking action. The image is representative crop imagery, not a photograph of confirmed symptoms.</p></div>
    </div>
  </section></div>`;
  document.body.classList.add("modal-open");
  const close = () => {
    modalRoot.innerHTML = "";
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", escapeModal);
    if (location.hash.startsWith("#library/")) {
      history.replaceState(null, "", `${location.pathname}${location.search}#library`);
    }
  };
  const escapeModal = (event) => { if (event.key === "Escape" && modalRoot.firstChild) close(); };
  modalRoot.querySelector(".modal-close").addEventListener("click", close);
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", (event) => { if (event.target.classList.contains("modal-backdrop")) close(); });
  document.addEventListener("keydown", escapeModal);
  modalRoot.querySelector(".modal-close").focus();
}

function renderDetect() {
  main.innerHTML = `<section class="page-hero detect-hero"><div class="page-container"><span class="eyebrow">${icon("scan")} CROP HEALTH CHECK</span><h1>Start with what<br><em>you observe.</em></h1><p>Record a field photo, then compare visible symptoms with crop-specific guides. No image-based AI diagnosis is configured in this version.</p></div></section>
    <section class="detect-layout page-container">
      <div class="detect-main">
        <div class="detect-card">
          <div class="detect-card-head"><div><span class="eyebrow">STEP 01 · OPTIONAL PHOTO</span><h2>Add a crop photo</h2></div><span class="step-icon">${icon("upload")}</span></div>
          <p class="detect-help">A clear photo can help you document changes. Your image stays in this browser session and is not analyzed or uploaded.</p>
          <input type="file" id="image-input" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden>
          <div class="upload-zone" id="upload-zone" tabindex="0" role="button" aria-label="Choose a crop image or drag and drop it here">
            <div class="upload-empty" id="upload-empty"><span class="upload-icon">${icon("upload")}</span><strong>Drop a crop image here</strong><span>or <button type="button" class="browse-button" id="browse-image">browse files</button></span><small>JPG, JPEG, PNG or WEBP · Up to 10 MB</small></div>
            <div class="preview-wrap" id="preview-wrap" hidden><img id="image-preview" alt="Selected crop image preview"><div class="preview-overlay"><span id="file-name"></span><button type="button" id="remove-image" class="remove-image">${icon("close")} Remove image</button></div></div>
          </div>
          <p class="upload-error" id="upload-error" role="alert"></p>
          <button type="button" class="button button-dark detect-button" id="detect-image">Detect Disease ${icon("arrow")}</button>
          <p class="upload-error model-notice" id="model-notice" role="status" aria-live="polite"></p>
        </div>
        <div class="detect-card symptoms-card">
          <div class="detect-card-head"><div><span class="eyebrow">STEP 02 · SYMPTOM GUIDANCE</span><h2>What are you noticing?</h2></div><span class="step-icon">${icon("leaf")}</span></div>
          <p class="detect-help">Choose the closest visible signs to find relevant reading. This is not a diagnosis and does not rank model predictions.</p>
          <div class="form-grid"><label class="form-field"><span>Crop</span><select id="symptom-crop"><option value="">Choose a crop</option>${catalogueCrops.map((crop) => `<option value="${escapeHtml(crop)}">${escapeHtml(crop)}</option>`).join("")}</select></label>
            <label class="form-field"><span>Visible sign</span><select id="symptom-select"><option value="">Choose an observation</option>${["leaf spots","yellowing","wilting","leaf curling","stunting","white growth","water-soaked spots","fruit damage","holes","insects","honeydew","tuber lesions","deadheart","whiteheads","leaf damage","scorched edges","vascular browning","leaf drop"].map((item) => `<option value="${item}">${item[0].toUpperCase()+item.slice(1)}</option>`).join("")}</select></label></div>
          <button type="button" class="button button-dark detect-button" id="find-guidance">Find relevant guides ${icon("arrow")}</button>
          <div class="guidance-results" id="guidance-results" aria-live="polite"></div>
        </div>
      </div>
      <aside class="detect-aside"><div class="model-status"><span class="status-pulse"></span><div><span class="eyebrow">IMAGE DETECTION</span><strong>AI model not connected</strong></div></div><div class="aside-divider"></div><h3>No guesswork, no fake results.</h3><p>There is no trained image classifier or external detection service connected to AgroCare yet. Your photo will not be labeled with an invented disease or confidence score.</p><div class="status-list"><div><span class="status-check">${icon("check")}</span><span><strong>Photo preview</strong><small>Processed locally in your browser</small></span></div><div><span class="status-check">${icon("check")}</span><span><strong>Symptom-based browsing</strong><small>Links to relevant educational guides</small></span></div><div><span class="status-pending">—</span><span><strong>Automated diagnosis</strong><small>Requires a real model integration</small></span></div></div><div class="aside-callout">${icon("shield")}<p>If symptoms are spreading or unclear, contact a local plant clinic or agricultural extension officer before treating.</p></div></aside>
    </section>`;
  const input = document.querySelector("#image-input");
  const zone = document.querySelector("#upload-zone");
  const error = document.querySelector("#upload-error");
  const selectFile = (file) => {
    error.textContent = "";
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      error.textContent = "Please choose a JPG, JPEG, PNG or WEBP image.";
      input.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      error.textContent = "This image is larger than 10 MB. Choose a smaller file.";
      input.value = "";
      return;
    }
    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    document.querySelector("#image-preview").src = previewUrl;
    document.querySelector("#file-name").textContent = file.name;
    document.querySelector("#upload-empty").hidden = true;
    document.querySelector("#preview-wrap").hidden = false;
  };
  document.querySelector("#browse-image").addEventListener("click", () => input.click());
  zone.addEventListener("click", (event) => { if (!event.target.closest("button")) input.click(); });
  zone.addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && event.target === zone) { event.preventDefault(); input.click(); } });
  input.addEventListener("change", () => selectFile(input.files[0]));
  ["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("is-dragging"); }));
  ["dragleave", "drop"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove("is-dragging"); }));
  zone.addEventListener("drop", (event) => selectFile(event.dataTransfer.files[0]));
  document.querySelector("#remove-image").addEventListener("click", (event) => {
    event.stopPropagation();
    selectedFile = null;
    input.value = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    document.querySelector("#image-preview").removeAttribute("src");
    document.querySelector("#preview-wrap").hidden = true;
    document.querySelector("#upload-empty").hidden = false;
    error.textContent = "";
  });
  document.querySelector("#find-guidance").addEventListener("click", findGuidance);
  document.querySelector("#detect-image").addEventListener("click", () => {
    const notice = document.querySelector("#model-notice");
    notice.textContent = "Checking detection service…";
    fetch("/api/detection", { method: "POST", headers: { "Content-Type": "application/json" } })
      .then((response) => response.json())
      .then((result) => {
        notice.textContent = result.message || "Image analysis is unavailable because no trained model is connected.";
      })
      .catch(() => {
        notice.textContent = selectedFile
          ? "Image analysis is unavailable because no trained model is connected. Use the symptom guide below to explore educational references."
          : "Add a crop photo first. Image analysis is not configured; symptom-based guidance is available below.";
      });
    if (!selectedFile) document.querySelector("#upload-zone").focus();
    else document.querySelector(".symptoms-card").scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function findGuidance() {
  const crop = document.querySelector("#symptom-crop").value;
  const symptom = document.querySelector("#symptom-select").value;
  const results = document.querySelector("#guidance-results");
  if (!crop || !symptom) {
    results.innerHTML = `<p class="guidance-message guidance-warning">Choose both a crop and a visible sign to browse relevant guides.</p>`;
    return;
  }
  results.innerHTML = `<p class="guidance-message">Checking field guides…</p>`;
  fetch("/api/symptom-guidance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crop, symptom })
  }).then((response) => response.ok ? response.json() : null).then((apiResult) => {
    if (apiResult) renderGuidanceResults(apiResult.matches || [], crop);
    else renderGuidanceResults(catalogue.filter((d) => (d.crop === crop || d.crop === "Multiple crops") && d.symptomTags.includes(symptom)).slice(0, 5), crop);
  }).catch(() => {
    renderGuidanceResults(catalogue.filter((d) => (d.crop === crop || d.crop === "Multiple crops") && d.symptomTags.includes(symptom)).slice(0, 5), crop);
  });
}

function renderGuidanceResults(matches, crop) {
  const results = document.querySelector("#guidance-results");
  if (!results) return;
  results.innerHTML = `<div class="guidance-result-head"><span class="eyebrow">READING TO EXPLORE · NOT A DIAGNOSIS</span><strong>${matches.length} relevant ${matches.length === 1 ? "guide" : "guides"} for ${escapeHtml(crop)}</strong></div>
    ${matches.length ? `<div class="guidance-cards">${matches.map((d) => `<a class="guidance-card" href="${diseasePath(d)}"><span><small>${escapeHtml(d.category)}</small><strong>${escapeHtml(d.name)}</strong><small>${escapeHtml(d.description)}</small></span><span class="guidance-arrow">↗</span></a>`).join("")}</div>` : `<p class="guidance-message">No exact symptom matches are tagged for ${escapeHtml(crop)}. Browse all ${escapeHtml(crop)} guides or ask a local specialist to help identify the cause.</p><a class="text-link" href="#library">Browse ${escapeHtml(crop)} guides ${icon("arrow")}</a>`}
    <p class="guidance-caveat">These guides are selected only by crop and symptom tags; they do not represent probability, diagnosis or confidence.</p>`;
}

function renderAbout() {
  main.innerHTML = `<section class="about-hero">
    ${photo("https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=2200&q=90","Expansive green farm fields in warm evening light","about-hero-image")}<div class="hero-shade"></div>
    <div class="page-container about-hero-content"><span class="eyebrow">ABOUT AGROCARE</span><h1>Healthy crops begin<br>with <em>better knowledge.</em></h1><p>Early Detection and Management of Crop Diseases and Pest Infestations.</p><a class="button button-lime" href="#library">Explore the field guide ${icon("arrow")}</a></div>
    <div class="about-hero-note">GROWING KNOWLEDGE<br>FOR EVERY FIELD</div>
  </section>
  <section class="about-intro section-pad page-container"><div><span class="eyebrow">01 / ABOUT THE PROJECT</span><h2>Practical crop health<br>information, <em>in one place.</em></h2></div><div><p class="lead">AgroCare is an educational platform designed to help farmers and learners recognize common crop health concerns earlier.</p><p>It brings together crop-specific information on symptoms, causes, prevention and responsible management. The platform does not replace a field diagnosis, but helps users ask better questions and take informed next steps.</p></div></section>
  <section class="about-problem"><div class="page-container about-problem-inner"><div class="about-problem-image">${photo("https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1100&q=85","Farmer inspecting plants in an agricultural field")}</div><div class="about-problem-copy"><span class="eyebrow">02 / THE PROBLEM</span><h2>Crop losses start<br>with <em>uncertainty.</em></h2><p>Plant diseases, insect pests and abiotic disorders can all reduce yield and quality. Similar symptoms may have very different causes, and a delayed or incorrect response can waste time and inputs.</p><p>Farmers need accessible, trustworthy information that helps them recognize warning signs, understand prevention and know when local expert advice is important.</p><div class="problem-stat"><strong>EARLY OBSERVATION</strong><span>creates more room for thoughtful action.</span></div></div></div></section>
  <section class="objectives-section section-pad page-container"><div class="section-heading"><span class="eyebrow">03 / PROJECT OBJECTIVES</span><h2>Built around the<br><em>needs of the field.</em></h2></div><div class="objectives-grid"><article><span>01</span><h3>Make information accessible</h3><p>Organize crop health guidance in a clear, easy-to-navigate format.</p></article><article><span>02</span><h3>Encourage early scouting</h3><p>Help users learn common symptoms and the value of regular field checks.</p></article><article><span>03</span><h3>Support responsible choices</h3><p>Promote prevention, integrated management and expert confirmation.</p></article><article><span>04</span><h3>Reduce avoidable losses</h3><p>Improve awareness so emerging problems can be investigated sooner.</p></article></div></section>
  <section class="solution-section"><div class="page-container solution-inner"><div><span class="eyebrow">04 / THE PROPOSED SOLUTION</span><h2>Clarity from the<br>first <em>field sign.</em></h2><p>AgroCare pairs a searchable disease and pest library with optional image documentation and symptom-based guide discovery. The current version makes its limits clear: automated image diagnosis is not connected.</p><a class="button button-lime" href="#detect">Try symptom guidance ${icon("arrow")}</a></div><div class="solution-steps"><div><span>01</span><p><strong>Observe</strong><small>Document visible signs and affected crop.</small></p>${icon("scan")}</div><div><span>02</span><p><strong>Compare</strong><small>Explore crop-specific educational guides.</small></p>${icon("search")}</div><div><span>03</span><p><strong>Confirm & act</strong><small>Use local expertise for diagnosis and treatment decisions.</small></p>${icon("shield")}</div></div></div></section>
  <section class="about-details section-pad page-container"><div class="about-detail-card"><span class="eyebrow">05 / TECHNOLOGIES USED</span><h2>Frontend, API &<br><em>database.</em></h2><p>AgroCare uses semantic HTML5, responsive CSS3 and modular JavaScript for the interface, Flask for the REST API and SQLite for persistent crop-health data. No external image-classification model is connected.</p><div class="tech-tags"><span>HTML5</span><span>CSS3</span><span>JavaScript ES modules</span><span>Flask REST API</span><span>SQLite database</span></div></div><div class="about-detail-card benefits-card"><span class="eyebrow">06 / BENEFITS TO FARMERS</span><h2>Knowledge that<br><em>travels to the field.</em></h2><ul><li>${icon("check")} Easier access to crop-specific learning</li><li>${icon("check")} Better awareness of early warning signs</li><li>${icon("check")} Practical prevention and scouting habits</li><li>${icon("check")} Clear prompts to seek expert help when needed</li></ul></div></section>
  <section class="future-section page-container"><div class="future-content"><span class="eyebrow">07 / FUTURE ENHANCEMENTS</span><h2>Designed to <em>grow.</em></h2><p>With validated data and responsible partnerships, future iterations could add regional languages, offline access, expert-reviewed local advisories and an image analysis service evaluated on diverse field images.</p><a class="text-link" href="#library">Explore the crop library ${icon("arrow")}</a></div><div class="future-stamp">${icon("leaf")}<span>ROOTED IN<br>KNOWLEDGE</span></div></section>`;
  observeReveals();
}

function observeReveals() {
  const items = document.querySelectorAll(".reveal:not(.is-visible)");
  if (!("IntersectionObserver" in window)) { items.forEach((item) => item.classList.add("is-visible")); return; }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
  }), { threshold: 0.1 });
  items.forEach((item) => observer.observe(item));
}

function navigate() {
  const [route, detail] = location.hash.replace(/^#/, "").split("/");
  const current = ["home", "detect", "library", "about"].includes(route) ? route : "home";
  document.querySelectorAll(".main-nav [data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === current);
    if (link.dataset.route === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  nav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  if (current === "home") renderHome();
  if (current === "detect") renderDetect();
  if (current === "library") {
    if (detail) {
      renderLibrary();
      openDiseaseDetails(catalogue.find((item) => item.id === detail));
    } else renderLibrary();
  }
  if (current === "about") renderAbout();
  window.scrollTo({ top: 0, behavior: "auto" });
}

menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
});
window.addEventListener("hashchange", navigate);
window.addEventListener("scroll", () => document.querySelector(".back-top").classList.toggle("is-visible", window.scrollY > 560), { passive: true });
document.querySelector(".back-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
document.querySelector("#year").textContent = new Date().getFullYear();
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (location.hash.split("/")[0] !== "#library") location.hash = "#library";
    setTimeout(() => document.querySelector("#disease-search")?.focus(), 0);
  }
});

async function loadDatabaseCatalogue() {
  try {
    const response = await fetch("/api/diseases");
    if (!response.ok) return;
    const payload = await response.json();
    const backendDiseases = (payload.diseases || []).map((disease) => ({
      ...disease,
      image: disease.image || fallbackImage
    }));
    const merged = [...diseases];
    backendDiseases.forEach((disease) => {
      if (!merged.some((item) => item.id === disease.id)) merged.push(disease);
    });
    catalogue = merged;
    catalogueCrops = [...new Set(catalogue.map((disease) => disease.crop))].sort((a, b) => a.localeCompare(b));
    catalogueCategories = [...new Set(catalogue.map((disease) => disease.category))].sort((a, b) => a.localeCompare(b));
    if (location.hash.startsWith("#library")) renderLibrary();
  } catch {
    catalogue = diseases;
  }
}

loadDatabaseCatalogue();
if (!location.hash) location.hash = "#home";
else navigate();
