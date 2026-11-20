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
let language = localStorage.getItem("agrocare-language") === "ta" ? "ta" : "en";

const translations = {
  en: {
    dashboard: "Dashboard", home: "Home", detect: "Detect Disease", library: "Disease Library",
    history: "History", about: "About", totalCrops: "Supported crops", diseaseRecords: "Disease records",
    detections: "Recent detections (7 days)", healthy: "Healthy", diseased: "Diseased", recent: "Recent detections",
    quickActions: "Quick access", startDetection: "Analyze a crop image", browseLibrary: "Browse disease library",
    viewHistory: "View all history", noHistory: "No saved detections yet. Analyze an image to start your history.",
    imagePrompt: "Choose the crop shown in the image.", uploadProgress: "Uploading and analyzing image…",
    analyze: "Analyze image", saveImage: "Save this image with my history", useCamera: "Use camera",
    replaceImage: "Browse or replace image", removeImage: "Remove image", result: "Detection result",
    uncertain: "Uncertain result", healthyStatus: "Classified as healthy", diseasedStatus: "Disease predicted",
    confidence: "Model confidence", topPredictions: "Top predictions", description: "Description",
    symptoms: "Symptoms", causes: "Possible causes", conditions: "Environmental conditions",
    prevention: "Prevention", management: "Management recommendations", ipm: "Integrated pest management",
    backToDetection: "Analyze another image", downloadReport: "Download PDF report", delete: "Delete",
    loading: "Loading…", recentEmpty: "No detections recorded.", analyzing: "Upload complete. Analyzing image…",
    dashboardIntro: "Quick access to crop guidance and your saved detection history.",
    dashboardDisclaimer: "Healthy and diseased totals include only saved, above-threshold model results. Uncertain results are not counted in either total.",
    detectKicker: "CROP HEALTH CHECK", detectTitle: "Start with what", detectTitleEm: "you observe.",
    detectLead: "Upload a leaf image for model analysis when a validated model is configured. If no model is available, no prediction or confidence score will be shown.",
    photoStep: "STEP 01 · IMAGE ANALYSIS", addCropPhoto: "Add a crop photo",
    photoHelp: "Upload a clear leaf photo. Images are sent to the local Flask server for validation and model inference. They are not saved unless you opt in below.",
    dropPhoto: "Drop a crop image here", browse: "browse files", or: "or",
    fileLimits: "JPG, JPEG, PNG or WEBP · Up to 10 MB", symptomStep: "STEP 02 · SYMPTOM GUIDANCE",
    symptomTitle: "What are you noticing?", symptomHelp: "Choose the closest visible signs to find relevant reading. This is not a diagnosis and does not rank model predictions.",
    chooseCrop: "Choose a crop", cropLabel: "Crop", chooseSign: "Choose an observation",
    signLabel: "Visible sign", findGuides: "Find relevant guides", modelUnavailable: "Image detection is unavailable. Configure a trained, validated model before analyzing images.",
    missingImage: "Choose a JPG, JPEG, PNG or WEBP crop image first.",
    invalidType: "Please choose a JPG, JPEG, PNG or WEBP image.",
    tooLarge: "This image is larger than 10 MB. Choose a smaller file.",
    missingCrop: "Search for and choose the crop shown in the image.",
    cropSearch: "Type a crop name, scientific name or alias",
    cropSearchHelp: "Type at least two characters and select a matching crop. Disease guides are loaded for the selected crop.",
    cropNoResults: "No matching crops. Try another name or alias.",
    cropGuides: "Disease guides for this crop",
    noCropGuides: "No disease guides are currently linked to this crop.",
    notDiagnosis: "These guides are educational references, not a diagnosis.",
    symptomLabels: {
      "leaf spots": "Leaf spots", yellowing: "Yellowing", wilting: "Wilting", "leaf curling": "Leaf curling",
      stunting: "Stunting", "white growth": "White growth", "water-soaked spots": "Water-soaked spots",
      "fruit damage": "Fruit damage", holes: "Holes", insects: "Insects", honeydew: "Honeydew",
      "tuber lesions": "Tuber lesions", deadheart: "Deadheart", whiteheads: "Whiteheads",
      "leaf damage": "Leaf damage", "scorched edges": "Scorched edges",
      "vascular browning": "Vascular browning", "leaf drop": "Leaf drop"
    }
  },
  ta: {
    dashboard: "கட்டுப்பாட்டுப் பலகை", home: "முகப்பு", detect: "நோய் கண்டறிதல்",
    library: "நோய் நூலகம்",     history: "வரலாறு", about: "அறிமுகம்",
    totalCrops: "ஆதரிக்கப்படும் பயிர்கள்", diseaseRecords: "நோய் பதிவுகள்",
    detections: "சமீபத்திய கண்டறிதல்கள் (7 நாட்கள்)", healthy: "ஆரோக்கியமானது", diseased: "நோய் உள்ளது",
    recent: "சமீபத்திய கண்டறிதல்கள்", quickActions: "விரைவு அணுகல்",
    startDetection: "பயிர் படத்தைப் பகுப்பாய்வு செய்", browseLibrary: "நோய் நூலகத்தைப் பார்",
    viewHistory: "முழு வரலாற்றைப் பார்",
    noHistory: "சேமித்த கண்டறிதல்கள் இல்லை. படத்தைப் பகுப்பாய்வு செய்து தொடங்கவும்.",
    imagePrompt: "படத்தில் உள்ள பயிரைத் தேர்ந்தெடுக்கவும்.", uploadProgress: "பதிவேற்றி பகுப்பாய்வு செய்கிறது…",
    analyze: "படத்தைப் பகுப்பாய்வு செய்", saveImage: "இந்தப் படத்தை எனது வரலாற்றுடன் சேமி",
    useCamera: "கேமராவைப் பயன்படுத்து", replaceImage: "படத்தைத் தேர்வு / மாற்று",
    removeImage: "படத்தை நீக்கு", result: "கண்டறிதல் முடிவு", uncertain: "உறுதியற்ற முடிவு",
    healthyStatus: "ஆரோக்கியமானதாக வகைப்படுத்தப்பட்டது", diseasedStatus: "நோய் கணிக்கப்பட்டது",
    confidence: "மாதிரி நம்பகத்தன்மை", topPredictions: "முக்கிய கணிப்புகள்",
    description: "விளக்கம்", symptoms: "அறிகுறிகள்", causes: "சாத்தியமான காரணங்கள்",
    conditions: "சுற்றுச்சூழல் நிலைகள்", prevention: "தடுப்பு",
    management: "மேலாண்மை பரிந்துரைகள்", ipm: "ஒருங்கிணைந்த பூச்சி மேலாண்மை",
    backToDetection: "மற்றொரு படத்தைப் பகுப்பாய்வு செய்", downloadReport: "PDF அறிக்கையைப் பதிவிறக்கு",
    delete: "நீக்கு", loading: "ஏற்றுகிறது…", recentEmpty: "கண்டறிதல்கள் எதுவும் பதிவு செய்யப்படவில்லை.",
    analyzing: "பதிவேற்றம் முடிந்தது. படத்தைப் பகுப்பாய்வு செய்கிறது…",
    dashboardIntro: "பயிர் வழிகாட்டுதலையும் சேமித்த கண்டறிதல் வரலாற்றையும் விரைவாக அணுகவும்.",
    dashboardDisclaimer: "உறுதிப்படுத்தப்பட்ட வரம்புக்கு மேல் உள்ள சேமித்த மாதிரி முடிவுகள் மட்டுமே ஆரோக்கியம் / நோய் எண்ணிக்கையில் சேர்க்கப்படும். உறுதியற்ற முடிவுகள் சேர்க்கப்படாது.",
    detectKicker: "பயிர் ஆரோக்கியச் சோதனை", detectTitle: "நீங்கள்", detectTitleEm: "கவனித்ததில் தொடங்குங்கள்.",
    detectLead: "சரிபார்க்கப்பட்ட மாதிரி அமைக்கப்பட்டிருந்தால் இலைப் படத்தைப் பதிவேற்றவும். மாதிரி இல்லையெனில் கணிப்போ நம்பகத்தன்மை மதிப்போ காட்டப்படாது.",
    photoStep: "படி 01 · படப் பகுப்பாய்வு", addCropPhoto: "பயிர்ப் படத்தைச் சேர்க்கவும்",
    photoHelp: "தெளிவான இலைப் படத்தைப் பதிவேற்றவும். Flask சேவையகம் படத்தைச் சரிபார்த்து மாதிரியில் பகுப்பாய்வு செய்யும். விருப்பம் தெரிவிக்காவிட்டால் படம் சேமிக்கப்படாது.",
    dropPhoto: "பயிர்ப் படத்தை இங்கே விடவும்", browse: "கோப்புகளைத் தேர்ந்தெடுக்கவும்", or: "அல்லது",
    fileLimits: "JPG, JPEG, PNG அல்லது WEBP · அதிகபட்சம் 10 MB", symptomStep: "படி 02 · அறிகுறி வழிகாட்டுதல்",
    symptomTitle: "எதை கவனிக்கிறீர்கள்?", symptomHelp: "தொடர்புடைய வழிகாட்டிகளைப் பார்க்க அருகிலுள்ள அறிகுறியைத் தேர்ந்தெடுக்கவும். இது நோயறிதல் அல்ல; மாதிரி கணிப்புகளை வரிசைப்படுத்தாது.",
    chooseCrop: "பயிரைத் தேர்ந்தெடுக்கவும்", cropLabel: "பயிர்", chooseSign: "அறிகுறியைத் தேர்ந்தெடுக்கவும்",
    signLabel: "காணும் அறிகுறி", findGuides: "தொடர்புடைய வழிகாட்டிகள்",
    modelUnavailable: "படக் கண்டறிதல் கிடைக்கவில்லை. பகுப்பாய்வுக்கு முன் பயிற்சியளிக்கப்பட்ட, சரிபார்க்கப்பட்ட மாதிரியை அமைக்கவும்.",
    missingImage: "முதலில் JPG, JPEG, PNG அல்லது WEBP பயிர்ப் படத்தைத் தேர்ந்தெடுக்கவும்.",
    invalidType: "JPG, JPEG, PNG அல்லது WEBP படத்தைத் தேர்ந்தெடுக்கவும்.",
    tooLarge: "இந்தப் படம் 10 MB-ஐ விடப் பெரியது. சிறிய படத்தைத் தேர்ந்தெடுக்கவும்.",
    missingCrop: "படத்தில் உள்ள பயிரைத் தேடி தேர்ந்தெடுக்கவும்.",
    cropSearch: "பயிர் பெயர், அறிவியல் பெயர் அல்லது மாற்றுப் பெயரை உள்ளிடவும்",
    cropSearchHelp: "குறைந்தது இரண்டு எழுத்துகளை உள்ளிட்டு பொருத்தமான பயிரைத் தேர்ந்தெடுக்கவும். தேர்ந்த பயிரின் நோய் வழிகாட்டிகள் காட்டப்படும்.",
    cropNoResults: "பொருத்தமான பயிர் இல்லை. வேறு பெயர் அல்லது மாற்றுப் பெயரை முயற்சிக்கவும்.",
    cropGuides: "இந்தப் பயிருக்கான நோய் வழிகாட்டிகள்",
    noCropGuides: "இந்தப் பயிருடன் இணைக்கப்பட்ட நோய் வழிகாட்டிகள் தற்போது இல்லை.",
    notDiagnosis: "இவை கல்விக்கான குறிப்புகள் மட்டுமே; நோயறிதல் அல்ல.",
    symptomLabels: {
      "leaf spots": "இலைப் புள்ளிகள்", yellowing: "மஞ்சளாதல்", wilting: "வாடுதல்", "leaf curling": "இலை சுருட்டல்",
      stunting: "வளர்ச்சி குன்றல்", "white growth": "வெள்ளைப் படலம்", "water-soaked spots": "நீர் ஊறிய புள்ளிகள்",
      "fruit damage": "கனி சேதம்", holes: "துளைகள்", insects: "பூச்சிகள்", honeydew: "ஒட்டும் திரவம்",
      "tuber lesions": "கிழங்கு புண்கள்", deadheart: "குருத்து உலர்தல்", whiteheads: "வெண் கதிர்கள்",
      "leaf damage": "இலை சேதம்", "scorched edges": "கருகிய ஓரங்கள்",
      "vascular browning": "நரம்புத் திசு பழுப்பு", "leaf drop": "இலை உதிர்தல்"
    }
  }
};

const t = (key) => translations[language][key] || translations.en[key] || key;

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
const safeExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "";
  } catch {
    return "";
  }
};
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

function historyRows(items) {
  if (!items.length) return `<p class="history-empty">${t("noHistory")}</p>`;
  const statusLabel = (status) => status === "healthy" ? t("healthy") : status === "diseased" ? t("diseasedStatus") : t("uncertain");
  return `<div class="history-list">${items.map((item) => `<article class="history-item">
    ${item.image_url ? photo(item.image_url, `${escapeHtml(item.crop)} saved detection image`, "history-image") : `<span class="history-image history-image-empty">${icon("leaf")}</span>`}
    <div class="history-copy"><span class="eyebrow">${escapeHtml(item.crop)} · ${escapeHtml(statusLabel(item.status))}</span>
      <strong>${escapeHtml(item.predicted_disease)}</strong><small>${new Date(`${item.created_at.replace(" ", "T")}Z`).toLocaleString(language === "ta" ? "ta-IN" : "en-IN")} · ${t("confidence")}: ${(item.confidence * 100).toFixed(1)}%</small></div>
    <div class="history-actions"><a class="button button-outline" href="/api/history/${item.id}/report.pdf">${t("downloadReport")}</a><button type="button" class="button button-outline history-delete" data-id="${item.id}">${t("delete")}</button></div>
  </article>`).join("")}</div>`;
}

function bindHistoryActions(container = main) {
  container.querySelectorAll(".history-delete").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const response = await fetch(`/api/history/${button.dataset.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to delete this detection.");
      toast("Detection history deleted.");
      if (location.hash === "#history") renderHistory();
      else renderDashboard();
    } catch (error) {
      button.disabled = false;
      toast(error.message || "Unable to delete this detection.");
    }
  }));
}

async function renderDashboard() {
  main.innerHTML = `<section class="page-hero dashboard-hero"><div class="page-container"><span class="eyebrow">${icon("leaf")} AGROCARE</span><h1>${t("dashboard")}</h1><p>${t("dashboardIntro")}</p></div></section>
    <section class="dashboard-content page-container">
      <div class="dashboard-stats" aria-live="polite"><article><span>${t("totalCrops")}</span><strong id="dash-crops">—</strong></article><article><span>${t("diseaseRecords")}</span><strong id="dash-diseases">—</strong></article><article><span>${t("detections")}</span><strong id="dash-detections">—</strong></article><article><span>${t("healthy")} / ${t("diseased")}</span><strong id="dash-classifications">—</strong></article></div>
      <div class="dashboard-actions"><a class="button button-dark" href="#detect">${icon("scan")} ${t("startDetection")}</a><a class="button button-outline" href="#library">${icon("leaf")} ${t("browseLibrary")}</a><a class="button button-outline" href="#history">${t("viewHistory")}</a></div>
      <section class="dashboard-history"><div class="section-heading split-heading"><div><span class="eyebrow">${t("recent")}</span><h2>${t("recent")}</h2></div><a class="text-link" href="#history">${t("viewHistory")} ${icon("arrow")}</a></div><div id="dashboard-recent" class="dashboard-recent"><p class="history-empty">${t("loading")}</p></div></section>
      <p class="dashboard-note">${t("dashboardDisclaimer")}</p>
    </section>`;
  try {
    const response = await fetch("/api/dashboard");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Dashboard data is unavailable.");
    document.querySelector("#dash-crops").textContent = data.supported_crops;
    document.querySelector("#dash-diseases").textContent = data.disease_records;
    document.querySelector("#dash-detections").textContent = data.recent_detection_count;
    document.querySelector("#dash-classifications").textContent = `${data.healthy_count} / ${data.diseased_count}`;
    document.querySelector("#dashboard-recent").innerHTML = historyRows(data.recent_history);
    bindHistoryActions();
  } catch (error) {
    document.querySelector("#dashboard-recent").innerHTML = `<p class="history-error" role="alert">${escapeHtml(error.message)}</p>`;
  }
}

async function renderHistory() {
  main.innerHTML = `<section class="page-hero dashboard-hero"><div class="page-container"><span class="eyebrow">${icon("leaf")} AGROCARE</span><h1>${t("history")}</h1><p>${t("recent")} — saved classifications only.</p></div></section><section class="dashboard-content page-container"><div id="history-content"><p class="history-empty">${t("loading")}</p></div></section>`;
  try {
    const response = await fetch("/api/history");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Detection history is unavailable.");
    document.querySelector("#history-content").innerHTML = historyRows(data.history);
    bindHistoryActions();
  } catch (error) {
    document.querySelector("#history-content").innerHTML = `<p class="history-error" role="alert">${escapeHtml(error.message)}</p>`;
  }
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
        <article class="step-card step-featured"><div class="step-top"><span class="step-number">02</span><span class="step-icon">${icon("scan")}</span></div><h3>Explore possible causes</h3><p>Compare symptoms with our crop health library. Model output, when enabled, is educational and requires local confirmation.</p><span class="step-caption">COMPARE &nbsp;·&nbsp; LEARN</span></article>
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
  main.innerHTML = `<section class="page-hero detect-hero"><div class="page-container"><span class="eyebrow">${icon("scan")} ${t("detectKicker")}</span><h1>${t("detectTitle")}<br><em>${t("detectTitleEm")}</em></h1><p>${t("detectLead")}</p></div></section>
    <section class="detect-layout page-container">
      <div class="detect-main">
        <div class="detect-card">
          <div class="detect-card-head"><div><span class="eyebrow">${t("photoStep")}</span><h2>${t("addCropPhoto")}</h2></div><span class="step-icon">${icon("upload")}</span></div>
          <p class="detect-help">${t("photoHelp")}</p>
          <input type="file" id="image-input" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden>
          <input type="file" id="camera-input" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" capture="environment" hidden>
          <div class="upload-zone" id="upload-zone" role="group" aria-labelledby="upload-empty">
            <div class="upload-empty" id="upload-empty"><span class="upload-icon">${icon("upload")}</span><strong>${t("dropPhoto")}</strong><span>${t("or")} <button type="button" class="browse-button" id="browse-image">${t("browse")}</button></span><small>${t("fileLimits")}</small></div>
            <div class="preview-wrap" id="preview-wrap" hidden><img id="image-preview" alt="Selected crop image preview"><div class="preview-overlay"><span id="file-name"></span><button type="button" id="remove-image" class="remove-image">${icon("close")} Remove image</button></div></div>
          </div>
          <p class="upload-error" id="upload-error" role="alert"></p>
          <div class="upload-tools"><button type="button" class="button button-outline" id="camera-image">${icon("scan")} ${t("useCamera")}</button><button type="button" class="button button-outline" id="replace-image">${t("replaceImage")}</button></div>
          <div class="form-grid detection-options"><label class="form-field crop-search-field"><span>${t("imagePrompt")}</span><input id="detection-crop" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="crop-suggestions" autocomplete="off" placeholder="${escapeHtml(t("cropSearch"))}" required><div class="crop-suggestions" id="crop-suggestions" role="listbox" hidden></div><small class="crop-search-help" id="crop-search-help" role="status">${t("cropSearchHelp")}</small></label><label class="save-image-option"><input id="save-image" type="checkbox"><span>${t("saveImage")}</span></label></div>
          <div class="crop-disease-guides" id="crop-disease-guides" aria-live="polite"></div>
          <button type="button" class="button button-dark detect-button" id="detect-image">${t("analyze")} ${icon("arrow")}</button>
          <div class="upload-progress" id="upload-progress" hidden><div class="progress-track" id="progress-track" role="progressbar" aria-label="Image upload and analysis progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="progress-value"></span></div><p id="progress-label" role="status" aria-live="polite">${t("uploadProgress")}</p></div>
          <p class="upload-error model-notice" id="model-notice" role="status" aria-live="polite"></p>
        </div>
        <div class="detect-card symptoms-card">
          <div class="detect-card-head"><div><span class="eyebrow">${t("symptomStep")}</span><h2>${t("symptomTitle")}</h2></div><span class="step-icon">${icon("leaf")}</span></div>
          <p class="detect-help">${t("symptomHelp")}</p>
          <div class="form-grid"><label class="form-field"><span>${t("cropLabel")}</span><select id="symptom-crop"><option value="">${t("chooseCrop")}</option>${catalogueCrops.map((crop) => `<option value="${escapeHtml(crop)}">${escapeHtml(crop)}</option>`).join("")}</select></label>
            <label class="form-field"><span>${t("signLabel")}</span><select id="symptom-select"><option value="">${t("chooseSign")}</option>${["leaf spots","yellowing","wilting","leaf curling","stunting","white growth","water-soaked spots","fruit damage","holes","insects","honeydew","tuber lesions","deadheart","whiteheads","leaf damage","scorched edges","vascular browning","leaf drop"].map((item) => `<option value="${item}">${translations[language].symptomLabels[item]}</option>`).join("")}</select></label></div>
          <button type="button" class="button button-dark detect-button" id="find-guidance">${t("findGuides")} ${icon("arrow")}</button>
          <div class="guidance-results" id="guidance-results" aria-live="polite"></div>
        </div>
      </div>
      <aside class="detect-aside"><div class="model-status"><span class="status-pulse"></span><div><span class="eyebrow">IMAGE DETECTION</span><strong>Model availability is checked by the API</strong></div></div><div class="aside-divider"></div><h3>No guesswork, no fake results.</h3><p>Detection is enabled only when configured trained weights, their ordered class mapping, and a threshold validated on held-out data are available.</p><div class="status-list"><div><span class="status-check">${icon("check")}</span><span><strong>Secure image validation</strong><small>Type, size and image content checked by Flask</small></span></div><div><span class="status-check">${icon("check")}</span><span><strong>Symptom-based browsing</strong><small>Links to educational disease guides</small></span></div><div><span class="status-pending">—</span><span><strong>Leaf-only verification</strong><small>Requires a dataset/model that includes non-leaf examples</small></span></div></div><div class="aside-callout">${icon("shield")}<p>If symptoms are spreading or unclear, contact a local plant clinic or agricultural extension officer before treating.</p></div></aside>
    </section>`;
  const input = document.querySelector("#image-input");
  const cameraInput = document.querySelector("#camera-input");
  const zone = document.querySelector("#upload-zone");
  const error = document.querySelector("#upload-error");
  const cropInput = document.querySelector("#detection-crop");
  const cropSuggestions = document.querySelector("#crop-suggestions");
  const cropHelp = document.querySelector("#crop-search-help");
  const cropDiseaseGuides = document.querySelector("#crop-disease-guides");
  let cropMatches = [];
  let activeCropIndex = -1;
  let cropSearchTimer;
  let cropGuideRequest = 0;
  let cropSearchRequest = 0;
  let isDetecting = false;
  const hideCropSuggestions = () => {
    cropSuggestions.hidden = true;
    cropInput.setAttribute("aria-expanded", "false");
    activeCropIndex = -1;
  };
  const selectCrop = (crop) => {
    cropInput.value = crop.name;
    cropInput.dataset.cropId = crop.id;
    cropInput.dataset.cropName = crop.name;
    cropHelp.textContent = [crop.scientific_name, crop.category].filter(Boolean).join(" · ");
    hideCropSuggestions();
    const requestId = ++cropGuideRequest;
    cropDiseaseGuides.innerHTML = `<p>${escapeHtml(t("loading"))}</p>`;
    fetch(`/api/diseases?crop=${encodeURIComponent(crop.name)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load crop disease guides.");
        return response.json();
      })
      .then((payload) => {
        if (requestId !== cropGuideRequest) return;
        const guides = payload.diseases || [];
        cropDiseaseGuides.innerHTML = `<h3>${t("cropGuides")}</h3>${guides.length
          ? `<ul>${guides.map((item) => `<li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)}</span></li>`).join("")}</ul>`
          : `<p>${t("noCropGuides")}</p>`}<small>${t("notDiagnosis")}</small>`;
      })
      .catch(() => {
        if (requestId === cropGuideRequest) cropDiseaseGuides.textContent = "Could not load crop disease guides. Check the Flask connection and try again.";
      });
  };
  const updateCropSuggestions = async () => {
    const query = cropInput.value.trim();
    const requestId = ++cropSearchRequest;
    if (cropInput.dataset.cropName !== query) {
      delete cropInput.dataset.cropId;
      delete cropInput.dataset.cropName;
      cropGuideRequest += 1;
      cropDiseaseGuides.replaceChildren();
    }
    if (query.length < 2) {
      cropMatches = [];
      cropSuggestions.replaceChildren();
      hideCropSuggestions();
      cropDiseaseGuides.replaceChildren();
      cropHelp.textContent = t("cropSearchHelp");
      return;
    }
    try {
      const response = await fetch(`/api/crops?q=${encodeURIComponent(query)}&limit=12`);
      if (!response.ok) throw new Error("Crop search failed.");
      const payload = await response.json();
      if (requestId !== cropSearchRequest) return;
      cropMatches = payload.crops || [];
      cropSuggestions.innerHTML = cropMatches.map((crop, index) => `<button type="button" class="crop-suggestion${index === activeCropIndex ? " is-active" : ""}" id="crop-option-${index}" role="option" aria-selected="${index === activeCropIndex}" data-crop-index="${index}"><strong>${escapeHtml(crop.name)}</strong><span>${escapeHtml([crop.scientific_name, crop.category].filter(Boolean).join(" · "))}</span></button>`).join("");
      cropSuggestions.hidden = cropMatches.length === 0;
      cropInput.setAttribute("aria-expanded", String(cropMatches.length > 0));
      cropHelp.textContent = cropMatches.length ? `${payload.count} matching crop${payload.count === 1 ? "" : "s"} · ${t("cropSearchHelp")}` : t("cropNoResults");
    } catch {
      if (requestId !== cropSearchRequest) return;
      cropMatches = [];
      cropSuggestions.replaceChildren();
      hideCropSuggestions();
      cropHelp.textContent = "Crop search is unavailable. Check that the Flask server is running.";
    }
  };
  cropInput.addEventListener("input", () => {
    cropSearchRequest += 1;
    cropMatches = [];
    activeCropIndex = -1;
    hideCropSuggestions();
    if (cropInput.dataset.cropName !== cropInput.value.trim()) {
      delete cropInput.dataset.cropId;
      delete cropInput.dataset.cropName;
      cropGuideRequest += 1;
      cropDiseaseGuides.replaceChildren();
    }
    clearTimeout(cropSearchTimer);
    cropSearchTimer = setTimeout(updateCropSuggestions, 180);
  });
  cropInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && cropMatches.length) {
      event.preventDefault();
      activeCropIndex = (activeCropIndex + 1) % cropMatches.length;
      updateCropSuggestions();
    } else if (event.key === "ArrowUp" && cropMatches.length) {
      event.preventDefault();
      activeCropIndex = (activeCropIndex - 1 + cropMatches.length) % cropMatches.length;
      updateCropSuggestions();
    } else if (event.key === "Enter" && activeCropIndex >= 0) {
      event.preventDefault();
      selectCrop(cropMatches[activeCropIndex]);
    } else if (event.key === "Escape") {
      hideCropSuggestions();
    }
  });
  cropSuggestions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-crop-index]");
    if (option) selectCrop(cropMatches[Number(option.dataset.cropIndex)]);
  });
  cropInput.addEventListener("blur", () => setTimeout(hideCropSuggestions, 150));
  if (selectedFile && previewUrl) {
    document.querySelector("#image-preview").src = previewUrl;
    document.querySelector("#file-name").textContent = selectedFile.name;
    document.querySelector("#upload-empty").hidden = true;
    document.querySelector("#preview-wrap").hidden = false;
  }
  const selectFile = (file) => {
    if (isDetecting) return;
    error.textContent = "";
    document.querySelector("#model-notice").textContent = "";
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      error.textContent = t("invalidType");
      input.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      error.textContent = t("tooLarge");
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
  const openFilePicker = () => { input.value = ""; input.click(); };
  document.querySelector("#browse-image").addEventListener("click", openFilePicker);
  document.querySelector("#replace-image").addEventListener("click", openFilePicker);
  document.querySelector("#camera-image").addEventListener("click", () => { cameraInput.value = ""; cameraInput.click(); });
  zone.addEventListener("click", (event) => { if (!isDetecting && !event.target.closest("button")) input.click(); });
  input.addEventListener("change", () => selectFile(input.files[0]));
  cameraInput.addEventListener("change", () => selectFile(cameraInput.files[0]));
  ["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("is-dragging"); }));
  ["dragleave", "drop"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove("is-dragging"); }));
  zone.addEventListener("drop", (event) => { if (!isDetecting) selectFile(event.dataTransfer.files[0]); });
  document.querySelector("#remove-image").addEventListener("click", (event) => {
    event.stopPropagation();
    selectedFile = null;
    input.value = "";
    cameraInput.value = "";
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
    const crop = cropInput.value.trim();
    if (!selectedFile) {
      error.textContent = t("missingImage");
      document.querySelector("#upload-zone").focus();
      return;
    }
    if (!crop) {
      error.textContent = t("missingCrop");
      cropInput.focus();
      return;
    }
    error.textContent = "";
    notice.textContent = "";
    const progress = document.querySelector("#upload-progress");
    const progressValue = document.querySelector("#progress-value");
    const progressLabel = document.querySelector("#progress-label");
    const button = document.querySelector("#detect-image");
    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("crop", crop);
    formData.append("save_image", document.querySelector("#save-image").checked ? "true" : "false");
    button.disabled = true;
    isDetecting = true;
    ["#browse-image", "#replace-image", "#camera-image", "#remove-image", "#image-input", "#camera-input"].forEach((selector) => {
      const control = document.querySelector(selector);
      if (control) control.disabled = true;
    });
    progress.hidden = false;
    progressValue.style.width = "0%";
    progressLabel.textContent = t("uploadProgress");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/predict");
    xhr.timeout = 120000;
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        progressValue.style.width = `${percentage}%`;
        document.querySelector("#progress-track").setAttribute("aria-valuenow", String(percentage));
        progressLabel.textContent = `${t("uploadProgress")} ${percentage}%`;
      }
    });
    xhr.upload.addEventListener("load", () => {
      progressLabel.textContent = t("analyzing");
      document.querySelector("#progress-track").classList.add("is-indeterminate");
      document.querySelector("#progress-track").removeAttribute("aria-valuenow");
    });
    xhr.addEventListener("load", () => {
      let payload;
      try { payload = JSON.parse(xhr.responseText); }
      catch { payload = { message: "The server returned an invalid response." }; }
      if (xhr.status < 200 || xhr.status >= 300) {
        notice.textContent = payload.message || (payload.error === "model_unavailable" ? t("modelUnavailable") : "Image analysis failed.");
        progress.hidden = true;
        button.disabled = false;
        isDetecting = false;
        ["#browse-image", "#replace-image", "#camera-image", "#remove-image", "#image-input", "#camera-input"].forEach((selector) => {
          const control = document.querySelector(selector);
          if (control) control.disabled = false;
        });
        return;
      }
      progressValue.style.width = "100%";
      renderDetectionResult(payload, previewUrl);
    });
    xhr.addEventListener("error", () => {
      notice.textContent = "Could not reach the AgroCare server. Check that Flask is running and try again.";
      progress.hidden = true;
      button.disabled = false;
      isDetecting = false;
      ["#browse-image", "#replace-image", "#camera-image", "#remove-image", "#image-input", "#camera-input"].forEach((selector) => {
        const control = document.querySelector(selector);
        if (control) control.disabled = false;
      });
    });
    xhr.addEventListener("timeout", () => {
      notice.textContent = "Image analysis timed out. Check the model and server logs, then try again.";
      progress.hidden = true;
      button.disabled = false;
      isDetecting = false;
      ["#browse-image", "#replace-image", "#camera-image", "#remove-image", "#image-input", "#camera-input"].forEach((selector) => {
        const control = document.querySelector(selector);
        if (control) control.disabled = false;
      });
    });
    xhr.send(formData);
  });
}

function renderDetectionResult(result, imageUrl) {
  const info = result.disease_info;
  const statusText = result.uncertain ? t("uncertain") : result.status === "healthy" ? t("healthyStatus") : t("diseasedStatus");
  const sections = info ? [
    ["description", info.description],
    ["symptoms", info.visualSymptoms || info.symptoms],
    ["causes", info.causes],
    ["conditions", info.conditions],
    ["prevention", info.prevention],
    ["management", info.management],
    ["ipm", info.ipm]
  ].map(([label, content]) => `<section class="result-guidance"><h3>${result.uncertain ? `${t("uncertain")} · ` : ""}${t(label)}</h3>${Array.isArray(content) ? `<ul>${content.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>${escapeHtml(content)}</p>`}</section>`).join("") : `<section class="result-guidance"><h3>${result.uncertain ? t("uncertain") : t("healthyStatus")}</h3><p>${result.uncertain ? "The model did not meet its reliability threshold. No health condition could be identified reliably." : "This model classifies the image as healthy. Continue regular field scouting and compare against locally observed conditions."}</p></section>`;
  const image = imageUrl ? `<img class="result-image" src="${imageUrl}" alt="Uploaded ${escapeHtml(result.crop)} image">` : "";
  const confidence = Number.isFinite(result.confidence) ? `<span class="result-confidence">${t("confidence")}<strong>${(result.confidence * 100).toFixed(1)}%</strong></span>` : "";
  const predictions = Array.isArray(result.top_predictions) ? result.top_predictions : [];
  const diseaseMeta = info ? `<p class="result-disease-meta">${result.uncertain ? `Top candidate reference · ` : ""}${escapeHtml(info.category)}${info.scientificName ? ` · <em>${escapeHtml(info.scientificName)}</em>` : ""}</p>` : "";
  const relatedCrops = info?.relatedCrops?.length
    ? `<section class="result-guidance"><h3>Related crop information</h3><ul>${info.relatedCrops.map((crop) => `<li><strong>${escapeHtml(crop.name)}</strong>${crop.scientific_name ? ` · <em>${escapeHtml(crop.scientific_name)}</em>` : ""} · ${escapeHtml(crop.category)}</li>`).join("")}</ul></section>`
    : "";
  const references = info?.references?.length
    ? `<section class="result-guidance"><h3>References</h3><ul>${info.references.map((reference) => {
      const url = safeExternalUrl(reference.url);
      return `<li>${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(reference.title)}</a>` : escapeHtml(reference.title)}${reference.note ? `<p>${escapeHtml(reference.note)}</p>` : ""}</li>`;
    }).join("")}</ul></section>`
    : info ? `<section class="result-guidance"><h3>References</h3><p>No per-record reference was supplied for this existing guide; verify details with an agricultural extension service.</p><small>${escapeHtml(info.source || "")}</small></section>` : "";
  main.innerHTML = `<section class="page-hero result-hero"><div class="page-container"><span class="eyebrow">${icon("scan")} ${t("result")}</span><h1>${escapeHtml(result.crop)}<br><em>${escapeHtml(result.predicted_disease)}</em></h1><p>${statusText}</p></div></section>
    <section class="result-layout page-container"><div class="result-main">
      <article class="result-summary"><div class="result-photo">${image}</div><div class="result-facts"><span class="result-status ${escapeHtml(result.status)}">${statusText}</span>${confidence}</div>
        ${diseaseMeta}
        ${result.uncertain ? `<p class="result-warning" role="alert">${Number.isFinite(result.confidence_threshold) ? `The top candidate${result.candidate_disease ? ` (${escapeHtml(result.candidate_disease)})` : ""} is below the model's configured validation-based threshold (${(result.confidence_threshold * 100).toFixed(1)}%).` : "The model did not meet its reliability threshold."} Unable to identify reliably; do not make treatment decisions from this result alone.</p>` : ""}
      </article>
      ${predictions.length ? `<article class="result-card"><h2>${t("topPredictions")}</h2><ol class="prediction-list">${predictions.map((item) => `<li><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.crop)}</small></span><strong>${Number.isFinite(item.confidence) ? `${(item.confidence * 100).toFixed(1)}%` : ""}</strong></li>`).join("")}</ol></article>` : ""}
      ${sections}
      ${relatedCrops}
      ${references}
      <p class="dashboard-note">Educational guidance only. Confirm the cause with a local agricultural specialist before acting. Follow locally approved guidance; AgroCare does not provide pesticide products or dosages.</p>
      <div class="result-actions"><a class="button button-dark" href="/api/history/${result.detection_id}/report.pdf">${t("downloadReport")}</a><a class="button button-outline" href="#history">${t("viewHistory")}</a><button type="button" class="button button-outline" id="analyze-another">${t("backToDetection")}</button></div>
    </div></section>`;
  document.querySelector("#analyze-another").addEventListener("click", () => { location.hash = "#detect"; });
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
  <section class="solution-section"><div class="page-container solution-inner"><div><span class="eyebrow">04 / THE PROPOSED SOLUTION</span><h2>Clarity from the<br>first <em>field sign.</em></h2><p>AgroCare pairs a searchable disease and pest library with image upload, symptom-based guide discovery and a locally configurable model integration. Image predictions are available only after trained weights and validation-based settings are supplied.</p><a class="button button-lime" href="#detect">Try symptom guidance ${icon("arrow")}</a></div><div class="solution-steps"><div><span>01</span><p><strong>Observe</strong><small>Document visible signs and affected crop.</small></p>${icon("scan")}</div><div><span>02</span><p><strong>Compare</strong><small>Explore crop-specific educational guides.</small></p>${icon("search")}</div><div><span>03</span><p><strong>Confirm & act</strong><small>Use local expertise for diagnosis and treatment decisions.</small></p>${icon("shield")}</div></div></div></section>
  <section class="about-details section-pad page-container"><div class="about-detail-card"><span class="eyebrow">05 / TECHNOLOGIES USED</span><h2>Frontend, API &<br><em>database.</em></h2><p>AgroCare uses semantic HTML5, responsive CSS3 and modular JavaScript for the interface, Flask for the REST API, SQLite for crop-health data and an optional PyTorch MobileNetV2 inference adapter. Trained model weights are not included.</p><div class="tech-tags"><span>HTML5</span><span>CSS3</span><span>JavaScript ES modules</span><span>Flask REST API</span><span>SQLite database</span><span>PyTorch MobileNetV2</span></div></div><div class="about-detail-card benefits-card"><span class="eyebrow">06 / BENEFITS TO FARMERS</span><h2>Knowledge that<br><em>travels to the field.</em></h2><ul><li>${icon("check")} Easier access to crop-specific learning</li><li>${icon("check")} Better awareness of early warning signs</li><li>${icon("check")} Practical prevention and scouting habits</li><li>${icon("check")} Clear prompts to seek expert help when needed</li></ul></div></section>
  <section class="future-section page-container"><div class="future-content"><span class="eyebrow">07 / FUTURE ENHANCEMENTS</span><h2>Designed to <em>grow.</em></h2><p>With validated data and responsible partnerships, future iterations could add additional regional languages, offline access, expert-reviewed local advisories and broader image validation across diverse field conditions.</p><a class="text-link" href="#library">Explore the crop library ${icon("arrow")}</a></div><div class="future-stamp">${icon("leaf")}<span>ROOTED IN<br>KNOWLEDGE</span></div></section>`;
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
  const current = ["dashboard", "home", "detect", "library", "history", "about"].includes(route) ? route : "dashboard";
  document.documentElement.lang = language === "ta" ? "ta" : "en";
  document.querySelectorAll(".main-nav [data-route]").forEach((link) => {
    link.textContent = t(link.dataset.route);
    link.classList.toggle("active", link.dataset.route === current);
    if (link.dataset.route === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector("#language-select").value = language;
  nav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  if (current === "dashboard") renderDashboard();
  if (current === "home") renderHome();
  if (current === "detect") renderDetect();
  if (current === "history") renderHistory();
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
document.querySelector("#language-select").addEventListener("change", (event) => {
  language = event.target.value === "ta" ? "ta" : "en";
  localStorage.setItem("agrocare-language", language);
  navigate();
});
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
    if (location.hash === "#detect") {
      const cropSelect = document.querySelector("#symptom-crop");
      if (cropSelect) {
        const selectedCrop = cropSelect.value;
        cropSelect.innerHTML = `<option value="">${t("chooseCrop")}</option>${catalogueCrops.map((crop) => `<option value="${escapeHtml(crop)}">${escapeHtml(crop)}</option>`).join("")}`;
        cropSelect.value = selectedCrop;
      }
    }
  } catch {
    catalogue = diseases;
  }
}

loadDatabaseCatalogue();
if (!location.hash) location.hash = "#dashboard";
else navigate();
