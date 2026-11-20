CREATE TABLE IF NOT EXISTS diseases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    crop TEXT NOT NULL,
    scientific_name TEXT,
    visual_symptoms TEXT,
    category TEXT NOT NULL,
    symptoms TEXT NOT NULL,
    causes TEXT NOT NULL,
    conditions TEXT NOT NULL,
    prevention TEXT NOT NULL,
    management TEXT NOT NULL,
    symptom_tags TEXT NOT NULL,
    ipm TEXT NOT NULL,
    image TEXT,
    source TEXT NOT NULL DEFAULT 'local-extension-data'
);

CREATE TABLE IF NOT EXISTS crops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    scientific_name TEXT,
    category TEXT NOT NULL,
    source TEXT,
    source_url TEXT
);

CREATE TABLE IF NOT EXISTS crop_aliases (
    alias TEXT PRIMARY KEY COLLATE NOCASE,
    crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crop_diseases (
    crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    disease_id TEXT NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    PRIMARY KEY (crop_id, disease_id)
);

CREATE TABLE IF NOT EXISTS disease_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    disease_id TEXT NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    note TEXT,
    UNIQUE (disease_id, url)
);

CREATE TABLE IF NOT EXISTS symptom_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop TEXT,
    symptom TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS detection_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop TEXT NOT NULL,
    predicted_disease TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'diseased', 'uncertain')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    image_reference TEXT
);

CREATE INDEX IF NOT EXISTS idx_crops_name ON crops(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_crops_scientific_name ON crops(scientific_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_crops_category ON crops(category);
CREATE INDEX IF NOT EXISTS idx_crop_aliases_crop ON crop_aliases(crop_id);
CREATE INDEX IF NOT EXISTS idx_crop_diseases_disease ON crop_diseases(disease_id);
CREATE INDEX IF NOT EXISTS idx_diseases_crop_category ON diseases(crop, category);
CREATE INDEX IF NOT EXISTS idx_disease_references_disease ON disease_references(disease_id);
