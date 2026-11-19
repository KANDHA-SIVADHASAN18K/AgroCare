import json
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
DATABASE_DIR = PROJECT_DIR / "database"
FRONTEND_DIR = PROJECT_DIR / "frontend"
DATABASE = DATABASE_DIR / "agrocare.db"
SEED_FILE = DATABASE_DIR / "seed" / "diseases.json"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app)


def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS diseases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                crop TEXT NOT NULL,
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
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS symptom_queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crop TEXT,
                symptom TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        seed = json.loads(SEED_FILE.read_text(encoding="utf-8"))
        for disease in seed:
            connection.execute(
                """
                INSERT OR IGNORE INTO diseases
                (id, name, crop, category, symptoms, causes, conditions, prevention,
                 management, symptom_tags, ipm, image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    disease["id"],
                    disease["name"],
                    disease["crop"],
                    disease["category"],
                    disease["symptoms"],
                    disease["causes"],
                    disease["conditions"],
                    json.dumps(disease["prevention"], ensure_ascii=False),
                    json.dumps(disease["management"], ensure_ascii=False),
                    json.dumps(disease["symptomTags"], ensure_ascii=False),
                    json.dumps(disease["ipm"], ensure_ascii=False),
                    None,
                ),
            )


def disease_row(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "crop": row["crop"],
        "category": row["category"],
        "symptoms": row["symptoms"],
        "causes": row["causes"],
        "conditions": row["conditions"],
        "prevention": json.loads(row["prevention"]),
        "management": json.loads(row["management"]),
        "symptomTags": json.loads(row["symptom_tags"]),
        "ipm": json.loads(row["ipm"]),
        "description": row["symptoms"].split(".")[0].strip() + ".",
        "image": row["image"],
    }


init_db()


@app.get("/api/health")
def health():
    with get_db() as connection:
        count = connection.execute("SELECT COUNT(*) AS count FROM diseases").fetchone()["count"]
    return jsonify({"status": "ok", "database": "sqlite", "diseaseCount": count})


@app.get("/api/diseases")
def diseases():
    crop = request.args.get("crop", "").strip()
    category = request.args.get("category", "").strip()
    query = request.args.get("q", "").strip().lower()
    clauses = []
    parameters = []
    if crop:
        clauses.append("crop = ?")
        parameters.append(crop)
    if category:
        clauses.append("category = ?")
        parameters.append(category)
    sql = "SELECT * FROM diseases"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY name COLLATE NOCASE"
    with get_db() as connection:
        rows = connection.execute(sql, parameters).fetchall()
    results = [disease_row(row) for row in rows]
    if query:
        results = [
            item
            for item in results
            if query in " ".join(
                [item["name"], item["crop"], item["category"], item["symptoms"], item["causes"]]
            ).lower()
        ]
    return jsonify({"count": len(results), "diseases": results})


@app.get("/api/diseases/<disease_id>")
def disease_detail(disease_id):
    with get_db() as connection:
        row = connection.execute("SELECT * FROM diseases WHERE id = ?", (disease_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Disease guide not found"}), 404
    return jsonify(disease_row(row))


@app.post("/api/symptom-guidance")
def symptom_guidance():
    data = request.get_json(silent=True) or {}
    crop = str(data.get("crop", "")).strip()
    symptom = str(data.get("symptom", "")).strip().lower()
    if not crop or not symptom:
        return jsonify({"error": "Crop and symptom are required"}), 400
    with get_db() as connection:
        connection.execute(
            "INSERT INTO symptom_queries (crop, symptom) VALUES (?, ?)",
            (crop, symptom),
        )
        rows = connection.execute("SELECT * FROM diseases ORDER BY name").fetchall()
    matches = []
    for row in rows:
        item = disease_row(row)
        if (item["crop"] == crop or item["crop"] in ("Multiple crops", "Pulses")) and symptom in [
            tag.lower() for tag in item["symptomTags"]
        ]:
            matches.append(item)
    return jsonify({"count": len(matches), "matches": matches[:5], "note": "Educational guidance only; not an automated diagnosis."})


@app.post("/api/detection")
def detection():
    return jsonify(
        {
            "configured": False,
            "message": "Actual image detection is not configured. No disease or confidence score was predicted.",
            "fallback": "Use symptom-guidance",
        }
    )


@app.route("/")
@app.route("/<path:path>")
def frontend(path="index.html"):
    if path and (FRONTEND_DIR / path).is_file():
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
