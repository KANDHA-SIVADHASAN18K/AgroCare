import json
import logging
import os
import re
import sqlite3
import uuid
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

if __package__:
    from .inference import ModelUnavailableError, model_health, predict_image
else:
    from inference import ModelUnavailableError, model_health, predict_image

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
DATABASE_DIR = PROJECT_DIR / "database"
FRONTEND_DIR = PROJECT_DIR / "frontend"
DATABASE = DATABASE_DIR / "agrocare.db"
SEED_FILE = DATABASE_DIR / "seed" / "diseases.json"
CROP_SEED_FILE = DATABASE_DIR / "seed" / "crops.json"
MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_FORMATS = {
    ".jpg": ("image/jpeg", "JPEG"),
    ".jpeg": ("image/jpeg", "JPEG"),
    ".png": ("image/png", "PNG"),
    ".webp": ("image/webp", "WEBP"),
}
LOGGER = logging.getLogger(__name__)


@contextmanager
def get_db(database_path):
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db(database_path, seed_file):
    Path(database_path).parent.mkdir(parents=True, exist_ok=True)
    with get_db(database_path) as connection:
        connection.execute(
            """
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
            )
            """
        )
        disease_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(diseases)")
        }
        for column, definition in (
            ("scientific_name", "TEXT"),
            ("visual_symptoms", "TEXT"),
            ("source", "TEXT NOT NULL DEFAULT 'local-extension-data'"),
        ):
            if column not in disease_columns:
                connection.execute(f"ALTER TABLE diseases ADD COLUMN {column} {definition}")
        connection.execute(
            "UPDATE diseases SET visual_symptoms = symptoms WHERE visual_symptoms IS NULL OR visual_symptoms = ''"
        )
        connection.executescript(
            """
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
            CREATE INDEX IF NOT EXISTS idx_crops_name ON crops(name COLLATE NOCASE);
            CREATE INDEX IF NOT EXISTS idx_crops_scientific_name ON crops(scientific_name COLLATE NOCASE);
            CREATE INDEX IF NOT EXISTS idx_crops_category ON crops(category);
            CREATE INDEX IF NOT EXISTS idx_crop_aliases_crop ON crop_aliases(crop_id);
            CREATE INDEX IF NOT EXISTS idx_crop_diseases_disease ON crop_diseases(disease_id);
            CREATE INDEX IF NOT EXISTS idx_diseases_crop_category ON diseases(crop, category);
            CREATE INDEX IF NOT EXISTS idx_disease_references_disease ON disease_references(disease_id);
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
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS detection_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crop TEXT NOT NULL,
                predicted_disease TEXT NOT NULL,
                confidence REAL NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('healthy', 'diseased', 'uncertain')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                image_reference TEXT
            )
            """
        )
        crop_seed_path = Path(CROP_SEED_FILE)
        if crop_seed_path.is_file():
            crop_seed = json.loads(crop_seed_path.read_text(encoding="utf-8"))
            for crop in crop_seed:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO crops
                    (id, name, scientific_name, category, source, source_url)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        crop["id"],
                        crop["name"],
                        crop.get("scientific_name"),
                        crop["category"],
                        crop.get("source"),
                        crop.get("source_url"),
                    ),
                )
                crop_row = connection.execute(
                    "SELECT id FROM crops WHERE name = ? COLLATE NOCASE", (crop["name"],)
                ).fetchone()
                for alias in crop.get("aliases", []):
                    if alias.strip() and alias.casefold() != crop["name"].casefold():
                        connection.execute(
                            "INSERT OR IGNORE INTO crop_aliases (alias, crop_id) VALUES (?, ?)",
                            (alias.strip(), crop_row["id"]),
                        )
        seed = json.loads(Path(seed_file).read_text(encoding="utf-8"))
        for disease in seed:
            crop_names = disease.get("crops") or [disease["crop"]]
            crop_names = list(dict.fromkeys(name.strip() for name in crop_names if name.strip()))
            primary_crop = disease.get("crop") or crop_names[0]
            connection.execute(
                """
                INSERT OR IGNORE INTO diseases
                (id, name, crop, scientific_name, visual_symptoms, category, symptoms,
                 causes, conditions, prevention, management, symptom_tags, ipm, image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    disease["id"],
                    disease["name"],
                    primary_crop,
                    disease.get("scientificName"),
                    disease.get("visualSymptoms", disease["symptoms"]),
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
            for crop_name in crop_names or [primary_crop]:
                crop_row = connection.execute(
                    "SELECT id FROM crops WHERE name = ? COLLATE NOCASE", (crop_name,)
                ).fetchone()
                if crop_row is None:
                    crop_id = re.sub(r"[^a-z0-9]+", "-", crop_name.casefold()).strip("-")
                    crop_id = crop_id or f"legacy-{uuid.uuid4().hex[:8]}"
                    connection.execute(
                        """
                        INSERT OR IGNORE INTO crops (id, name, category, source)
                        VALUES (?, ?, ?, ?)
                        """,
                        (crop_id, crop_name, "Unclassified crop", "Existing AgroCare disease record"),
                    )
                    crop_row = connection.execute(
                        "SELECT id FROM crops WHERE name = ? COLLATE NOCASE", (crop_name,)
                    ).fetchone()
                connection.execute(
                    "INSERT OR IGNORE INTO crop_diseases (crop_id, disease_id) VALUES (?, ?)",
                    (crop_row["id"], disease["id"]),
                )
            for reference in disease.get("references", []):
                if reference.get("title") and reference.get("url"):
                    connection.execute(
                        """
                        INSERT OR IGNORE INTO disease_references
                        (disease_id, title, url, note) VALUES (?, ?, ?, ?)
                        """,
                        (disease["id"], reference["title"], reference["url"], reference.get("note")),
                    )

        # Backfill crop relationships for records retained from older databases.
        legacy_diseases = connection.execute("SELECT id, crop FROM diseases").fetchall()
        for disease in legacy_diseases:
            crop_row = connection.execute(
                "SELECT id FROM crops WHERE name = ? COLLATE NOCASE", (disease["crop"],)
            ).fetchone()
            if crop_row is None:
                crop_id = re.sub(r"[^a-z0-9]+", "-", disease["crop"].casefold()).strip("-")
                crop_id = crop_id or f"legacy-{uuid.uuid4().hex[:8]}"
                connection.execute(
                    "INSERT OR IGNORE INTO crops (id, name, category, source) VALUES (?, ?, ?, ?)",
                    (crop_id, disease["crop"], "Unclassified crop", "Existing AgroCare disease record"),
                )
                crop_row = connection.execute(
                    "SELECT id FROM crops WHERE name = ? COLLATE NOCASE", (disease["crop"],)
                ).fetchone()
            connection.execute(
                "INSERT OR IGNORE INTO crop_diseases (crop_id, disease_id) VALUES (?, ?)",
                (crop_row["id"], disease["id"]),
            )


def disease_row(row, connection=None):
    item = {
        "id": row["id"],
        "name": row["name"],
        "crop": row["crop"],
        "scientificName": row["scientific_name"],
        "visualSymptoms": row["visual_symptoms"] or row["symptoms"],
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
        "source": (
            row["source"]
            if row["source"] != "local-extension-data"
            else "AgroCare seed data; per-record citation was not supplied."
        ),
    }
    item["crops"] = [row["crop"]]
    item["relatedCrops"] = []
    item["references"] = []
    if connection is not None:
        crops = connection.execute(
            """
            SELECT c.id, c.name, c.scientific_name, c.category, c.source, c.source_url
            FROM crops c JOIN crop_diseases cd ON cd.crop_id = c.id
            WHERE cd.disease_id = ? ORDER BY c.name COLLATE NOCASE
            """,
            (row["id"],),
        ).fetchall()
        if crops:
            item["crops"] = [crop["name"] for crop in crops]
            item["relatedCrops"] = [dict(crop) for crop in crops]
        item["references"] = [
            dict(reference)
            for reference in connection.execute(
                """
                SELECT title, url, note FROM disease_references
                WHERE disease_id = ? ORDER BY id
                """,
                (row["id"],),
            ).fetchall()
        ]
    return item


def history_row(row):
    return {
        "id": row["id"],
        "crop": row["crop"],
        "predicted_disease": row["predicted_disease"],
        "confidence": row["confidence"],
        "status": row["status"],
        "created_at": row["created_at"],
        "image_url": f"/api/uploads/{row['image_reference']}" if row["image_reference"] else None,
    }


def resolve_crop(connection, value):
    return connection.execute(
        """
        SELECT c.* FROM crops c
        WHERE c.name = ? COLLATE NOCASE
        UNION
        SELECT c.* FROM crops c
        JOIN crop_aliases a ON a.crop_id = c.id
        WHERE a.alias = ? COLLATE NOCASE
        LIMIT 1
        """,
        (value.strip(), value.strip()),
    ).fetchone()


def create_app(test_config=None):
    app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
    app.config.from_mapping(
        DATABASE=str(DATABASE),
        SEED_FILE=str(SEED_FILE),
        UPLOAD_FOLDER=str(BASE_DIR / "uploads"),
        MODEL_DIR=os.environ.get("AGROCARE_MODEL_DIR", str(BASE_DIR / "models")),
        MAX_CONTENT_LENGTH=MAX_IMAGE_BYTES + 128 * 1024,
    )
    if test_config:
        app.config.update(test_config)
    CORS(app)
    init_db(app.config["DATABASE"], app.config["SEED_FILE"])

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(error):
        return jsonify(
            {"error": "file_too_large", "message": "Image files must be 10 MB or smaller."}
        ), error.code

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify({"error": error.name.lower().replace(" ", "_"), "message": error.description}), error.code

    @app.errorhandler(Exception)
    def unexpected_error(error):
        LOGGER.error("Unhandled AgroCare API error: %s", error, exc_info=True)
        return jsonify(
            {
                "error": "internal_server_error",
                "message": "The request could not be completed. Please try again.",
            }
        ), 500

    @app.get("/api/health")
    def health():
        try:
            with get_db(app.config["DATABASE"]) as connection:
                count = connection.execute("SELECT COUNT(*) AS count FROM diseases").fetchone()["count"]
                crop_count = connection.execute("SELECT COUNT(*) AS count FROM crops").fetchone()["count"]
        except sqlite3.Error:
            LOGGER.exception("SQLite health check failed")
            return jsonify(
                {
                    "status": "degraded",
                    "database": {"status": "unavailable", "engine": "sqlite"},
                    "model": model_health(app.config["MODEL_DIR"]),
                }
            ), 503
        return jsonify(
            {
                "status": "ok",
                "database": {
                    "status": "ok",
                    "engine": "sqlite",
                    "crop_count": crop_count,
                    "disease_count": count,
                },
                "model": model_health(app.config["MODEL_DIR"]),
            }
        )

    @app.get("/api/dashboard")
    def dashboard():
        with get_db(app.config["DATABASE"]) as connection:
            totals = connection.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM crops) AS crop_count,
                    (SELECT COUNT(*) FROM diseases) AS disease_count,
                    COUNT(*) AS detection_count,
                    SUM(
                        CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END
                    ) AS recent_detection_count,
                    SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) AS healthy_count,
                    SUM(CASE WHEN status = 'diseased' THEN 1 ELSE 0 END) AS diseased_count
                FROM detection_history
                """
            ).fetchone()
            recent = connection.execute(
                "SELECT * FROM detection_history ORDER BY id DESC LIMIT 8"
            ).fetchall()
        return jsonify(
            {
                "supported_crops": totals["crop_count"],
                "disease_records": totals["disease_count"],
                "detection_count": totals["detection_count"],
                "recent_detection_count": totals["recent_detection_count"] or 0,
                "healthy_count": totals["healthy_count"] or 0,
                "diseased_count": totals["diseased_count"] or 0,
                "recent_history": [history_row(row) for row in recent],
            }
        )

    @app.get("/api/crops")
    def crops():
        query = request.args.get("q", "").strip()
        try:
            limit = min(max(int(request.args.get("limit", 20)), 1), 50)
            offset = max(int(request.args.get("offset", 0)), 0)
        except ValueError:
            return jsonify(
                {"error": "invalid_pagination", "message": "Limit and offset must be integers."}
            ), 400
        clauses = []
        parameters = []
        if query:
            escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"{escaped}%"
            contains_pattern = f"%{escaped}%"
            clauses.append(
                """
                (c.name LIKE ? ESCAPE '\\' COLLATE NOCASE
                 OR c.scientific_name LIKE ? ESCAPE '\\' COLLATE NOCASE
                 OR c.category LIKE ? ESCAPE '\\' COLLATE NOCASE
                 OR EXISTS (
                     SELECT 1 FROM crop_aliases a
                     WHERE a.crop_id = c.id AND a.alias LIKE ? ESCAPE '\\' COLLATE NOCASE
                 )
                 OR c.name LIKE ? ESCAPE '\\' COLLATE NOCASE
                 OR c.scientific_name LIKE ? ESCAPE '\\' COLLATE NOCASE
                 OR c.category LIKE ? ESCAPE '\\' COLLATE NOCASE
                 OR EXISTS (
                     SELECT 1 FROM crop_aliases a
                     WHERE a.crop_id = c.id AND a.alias LIKE ? ESCAPE '\\' COLLATE NOCASE
                 ))
                """
            )
            parameters.extend([pattern] * 4)
            parameters.extend([contains_pattern] * 4)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        with get_db(app.config["DATABASE"]) as connection:
            count = connection.execute(
                f"SELECT COUNT(*) AS count FROM crops c{where}", parameters
            ).fetchone()["count"]
            rows = connection.execute(
                f"""
                SELECT c.* FROM crops c{where}
                ORDER BY c.name COLLATE NOCASE
                LIMIT ? OFFSET ?
                """,
                [*parameters, limit, offset],
            ).fetchall()
            results = []
            for row in rows:
                item = dict(row)
                item["aliases"] = [
                    alias["alias"]
                    for alias in connection.execute(
                        "SELECT alias FROM crop_aliases WHERE crop_id = ? ORDER BY alias COLLATE NOCASE",
                        (row["id"],),
                    ).fetchall()
                ]
                results.append(item)
        return jsonify({"count": count, "limit": limit, "offset": offset, "crops": results})

    @app.get("/api/diseases")
    def diseases():
        crop = request.args.get("crop", "").strip()
        category = request.args.get("category", "").strip()
        query = request.args.get("q", "").strip().lower()
        clauses = []
        parameters = []
        if crop:
            with get_db(app.config["DATABASE"]) as connection:
                crop_record = resolve_crop(connection, crop)
            if crop_record is None:
                return jsonify({"count": 0, "diseases": []})
            clauses.append(
                "id IN (SELECT disease_id FROM crop_diseases WHERE crop_id = ?)"
            )
            parameters.append(crop_record["id"])
        if category:
            clauses.append("category = ?")
            parameters.append(category)
        sql = "SELECT * FROM diseases"
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY name COLLATE NOCASE"
        with get_db(app.config["DATABASE"]) as connection:
            rows = connection.execute(sql, parameters).fetchall()
            results = [disease_row(row, connection) for row in rows]
        if query:
            lowered = query.casefold()
            results = [
                item
                for item in results
                if lowered
                in " ".join(
                    [item["name"], *item["crops"], item["category"], item["symptoms"], item["causes"]]
                ).casefold()
            ]
        return jsonify({"count": len(results), "diseases": results})

    @app.get("/api/diseases/<disease_id>")
    def disease_detail(disease_id):
        with get_db(app.config["DATABASE"]) as connection:
            row = connection.execute(
                "SELECT * FROM diseases WHERE id = ?", (disease_id,)
            ).fetchone()
            item = disease_row(row, connection) if row is not None else None
        if row is None:
            return jsonify({"error": "disease_not_found", "message": "Disease guide not found."}), 404
        return jsonify(item)

    @app.post("/api/symptom-guidance")
    def symptom_guidance():
        data = request.get_json(silent=True) or {}
        crop = str(data.get("crop", "")).strip()
        symptom = str(data.get("symptom", "")).strip().lower()
        if not crop or not symptom:
            return jsonify({"error": "invalid_request", "message": "Crop and symptom are required."}), 400
        with get_db(app.config["DATABASE"]) as connection:
            crop_record = resolve_crop(connection, crop)
            connection.execute(
                "INSERT INTO symptom_queries (crop, symptom) VALUES (?, ?)", (crop, symptom)
            )
            if crop_record:
                rows = connection.execute(
                    """
                    SELECT d.* FROM diseases d
                    JOIN crop_diseases cd ON cd.disease_id = d.id
                    WHERE cd.crop_id = ? ORDER BY d.name COLLATE NOCASE
                    """,
                    (crop_record["id"],),
                ).fetchall()
            else:
                rows = []
        matches = []
        for row in rows:
            item = disease_row(row)
            tags = [tag.lower() for tag in item["symptomTags"]]
            if symptom in tags:
                matches.append(item)
        return jsonify(
            {
                "count": len(matches),
                "matches": matches[:5],
                "note": "Educational guidance only; not an automated diagnosis.",
            }
        )

    @app.post("/api/predict")
    @app.post("/api/detection")
    def detection():
        image_file = request.files.get("image")
        if image_file is None or not image_file.filename:
            return jsonify({"error": "image_required", "message": "Choose a crop image to analyze."}), 400
        selected_crop = request.form.get("crop", "").strip()
        if not selected_crop:
            return jsonify({"error": "crop_required", "message": "Choose the crop shown in the image."}), 400

        extension = Path(image_file.filename).suffix.lower()
        expected = ALLOWED_FORMATS.get(extension)
        if expected is None:
            return jsonify({"error": "unsupported_file_type", "message": "Use a JPG, JPEG, PNG or WEBP image."}), 415
        mime_type, image_format = expected
        if image_file.mimetype != mime_type:
            return jsonify(
                {"error": "invalid_mime_type", "message": "The image extension and MIME type do not match."}
            ), 415
        image_bytes = image_file.stream.read(MAX_IMAGE_BYTES + 1)
        if len(image_bytes) > MAX_IMAGE_BYTES:
            return jsonify({"error": "file_too_large", "message": "Image files must be 10 MB or smaller."}), 413
        try:
            with Image.open(BytesIO(image_bytes)) as image:
                if image.format != image_format:
                    return jsonify(
                        {"error": "invalid_image", "message": "The file content does not match its image type."}
                    ), 400
                image.verify()
            with Image.open(BytesIO(image_bytes)) as image:
                image.load()
                if image.width < 2 or image.height < 2:
                    return jsonify({"error": "invalid_image", "message": "The image dimensions are invalid."}), 400
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            return jsonify({"error": "invalid_image", "message": "The image is corrupted or cannot be decoded."}), 400

        try:
            with get_db(app.config["DATABASE"]) as connection:
                crop_record = resolve_crop(connection, selected_crop)
            if crop_record is None:
                return jsonify(
                    {"error": "unsupported_crop", "message": "This crop is not in the supported catalogue."}
                ), 422
            crop = crop_record["name"]
            prediction = predict_image(image_bytes, app.config["MODEL_DIR"], crop)
        except ValueError as error:
            if str(error) == "unsupported_crop":
                return jsonify(
                    {"error": "unsupported_crop", "message": "This crop is not supported by the configured model."}
                ), 422
            if str(error) == "crop_mismatch":
                return jsonify(
                    {
                        "error": "crop_mismatch",
                        "message": "The image prediction does not match the selected crop. Check the image and crop selection.",
                    }
                ), 422
            raise
        except ModelUnavailableError as error:
            return jsonify(
                {
                    "error": "model_unavailable",
                    "message": str(error),
                }
            ), 503

        predicted = prediction["predicted"]
        uncertain = predicted["confidence"] < prediction["confidence_threshold"]
        status = "uncertain" if uncertain else ("healthy" if predicted["healthy"] else "diseased")
        disease_info = None
        candidate_name = "Healthy" if predicted["healthy"] else predicted["name"]
        display_name = candidate_name
        if not predicted["healthy"]:
            with get_db(app.config["DATABASE"]) as connection:
                disease = connection.execute(
                    """
                    SELECT d.* FROM diseases d
                    JOIN crop_diseases cd ON cd.disease_id = d.id
                    JOIN crops c ON c.id = cd.crop_id
                    WHERE d.id = ? AND c.id = ?
                    """,
                    (predicted.get("disease_id"), crop_record["id"]),
                ).fetchone()
            if disease is None:
                LOGGER.error("Model class has no disease record associated with the selected crop")
                return jsonify(
                    {
                        "error": "model_mapping_invalid",
                        "message": "The model prediction has no disease record associated with the selected crop.",
                    }
                ), 503
            with get_db(app.config["DATABASE"]) as connection:
                disease_info = disease_row(disease, connection)
            display_name = disease_info["name"]
            candidate_name = display_name
        if uncertain:
            display_name = "Unable to identify"

        top_predictions = []
        for item in prediction["top_predictions"]:
            display_item = dict(item)
            if item["healthy"]:
                display_item["name"] = "Healthy"
            elif item.get("disease_id"):
                with get_db(app.config["DATABASE"]) as connection:
                    mapped_disease = connection.execute(
                        """
                        SELECT d.name FROM diseases d
                        JOIN crop_diseases cd ON cd.disease_id = d.id
                        WHERE d.id = ? AND cd.crop_id = ?
                        """,
                        (item["disease_id"], crop_record["id"]),
                    ).fetchone()
                if mapped_disease is None:
                    LOGGER.error("Top model class has no disease record for the selected crop")
                    return jsonify(
                        {
                            "error": "model_mapping_invalid",
                            "message": "A model class has no disease record associated with the selected crop.",
                        }
                    ), 503
                display_item["name"] = mapped_disease["name"]
            top_predictions.append(display_item)

        image_reference = None
        save_image = request.form.get("save_image", "").lower() in ("1", "true", "yes", "on")
        if save_image:
            image_reference = f"{uuid.uuid4().hex}{extension}"
            upload_folder = Path(app.config["UPLOAD_FOLDER"])
            upload_folder.mkdir(parents=True, exist_ok=True)
            (upload_folder / image_reference).write_bytes(image_bytes)
        try:
            with get_db(app.config["DATABASE"]) as connection:
                cursor = connection.execute(
                    """
                    INSERT INTO detection_history
                    (crop, predicted_disease, confidence, status, image_reference)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        crop,
                        display_name,
                        predicted["confidence"],
                        status,
                        image_reference,
                    ),
                )
                detection_id = cursor.lastrowid
        except sqlite3.Error:
            if image_reference:
                (Path(app.config["UPLOAD_FOLDER"]) / image_reference).unlink(missing_ok=True)
            raise

        response = {
            "detection_id": detection_id,
            "crop": crop,
            "predicted_disease": display_name,
            "candidate_disease": candidate_name,
            "status": status,
            "uncertain": uncertain,
            "confidence": predicted["confidence"],
            "confidence_threshold": prediction["confidence_threshold"],
            "top_predictions": top_predictions,
            "disease_info": disease_info,
            "image_url": f"/api/uploads/{image_reference}" if image_reference else None,
        }
        return jsonify(response), 201

    @app.get("/api/history")
    def history():
        try:
            limit = min(max(int(request.args.get("limit", 50)), 1), 100)
        except ValueError:
            return jsonify({"error": "invalid_limit", "message": "Limit must be an integer."}), 400
        with get_db(app.config["DATABASE"]) as connection:
            rows = connection.execute(
                "SELECT * FROM detection_history ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return jsonify({"count": len(rows), "history": [history_row(row) for row in rows]})

    @app.delete("/api/history/<int:detection_id>")
    def delete_history(detection_id):
        with get_db(app.config["DATABASE"]) as connection:
            row = connection.execute(
                "SELECT image_reference FROM detection_history WHERE id = ?", (detection_id,)
            ).fetchone()
            if row is None:
                return jsonify(
                    {"error": "detection_not_found", "message": "Detection history entry not found."}
                ), 404
            connection.execute("DELETE FROM detection_history WHERE id = ?", (detection_id,))
        if row["image_reference"]:
            image_path = Path(app.config["UPLOAD_FOLDER"]) / Path(row["image_reference"]).name
            image_path.unlink(missing_ok=True)
        return jsonify({"deleted": True, "id": detection_id})

    @app.get("/api/uploads/<path:filename>")
    def saved_upload(filename):
        safe_name = Path(filename).name
        with get_db(app.config["DATABASE"]) as connection:
            exists = connection.execute(
                "SELECT 1 FROM detection_history WHERE image_reference = ?", (safe_name,)
            ).fetchone()
        if not exists:
            return jsonify({"error": "image_not_found", "message": "Saved image not found."}), 404
        return send_from_directory(app.config["UPLOAD_FOLDER"], safe_name, as_attachment=False)

    @app.get("/api/history/<int:detection_id>/report.pdf")
    def detection_report(detection_id):
        with get_db(app.config["DATABASE"]) as connection:
            record = connection.execute(
                "SELECT * FROM detection_history WHERE id = ?", (detection_id,)
            ).fetchone()
            disease = None
            if record and record["status"] != "healthy":
                disease = connection.execute(
                    "SELECT * FROM diseases WHERE crop = ? AND name = ?",
                    (record["crop"], record["predicted_disease"]),
                ).fetchone()
        if record is None:
            return jsonify({"error": "detection_not_found", "message": "Detection history entry not found."}), 404
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib.units import inch
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except ImportError:
            return jsonify(
                {"error": "reporting_unavailable", "message": "Install reportlab to download PDF reports."}
            ), 503

        output = BytesIO()
        document = SimpleDocTemplate(output, pagesize=letter, rightMargin=0.65 * inch, leftMargin=0.65 * inch)
        styles = getSampleStyleSheet()
        story = [
            Paragraph("AgroCare crop health detection report", styles["Title"]),
            Spacer(1, 0.2 * inch),
            Table(
                [
                    ["Crop", record["crop"]],
                    ["Predicted class", record["predicted_disease"]],
                    ["Classification status", record["status"].title()],
                    ["Model confidence", f"{record['confidence'] * 100:.1f}%"],
                    ["Detected at (UTC)", record["created_at"]],
                ],
                colWidths=[1.8 * inch, 4.8 * inch],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eaf0e4")),
                        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#203629")),
                        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dce3d8")),
                        ("PADDING", (0, 0), (-1, -1), 8),
                    ]
                ),
            ),
            Spacer(1, 0.2 * inch),
        ]
        if record["status"] == "uncertain":
            story.append(
                Paragraph(
                    "The model confidence was below its configured validation-based threshold. "
                    "Treat this result as uncertain and seek local confirmation.",
                    styles["BodyText"],
                )
            )
        elif record["status"] == "healthy":
            story.append(Paragraph("The model classified this image as healthy.", styles["BodyText"]))
        elif disease:
            guide = disease_row(disease)
            for title, text in (
                ("Description", guide["description"]),
                ("Symptoms", guide["symptoms"]),
                ("Possible causes", guide["causes"]),
                ("Environmental conditions", guide["conditions"]),
            ):
                story.extend(
                    [
                        Paragraph(title, styles["Heading2"]),
                        Paragraph(escape(text), styles["BodyText"]),
                    ]
                )
            for title, key in (
                ("Prevention", "prevention"),
                ("Management", "management"),
                ("Integrated pest management", "ipm"),
            ):
                story.append(Paragraph(title, styles["Heading2"]))
                story.append(
                    Paragraph("<br/>".join(escape(item) for item in guide[key]), styles["BodyText"])
                )
        story.extend(
            [
                Spacer(1, 0.2 * inch),
                Paragraph(
                    "Educational guidance only. Image classification can be wrong and does not replace "
                    "confirmation by a local agricultural specialist. Follow locally approved guidance.",
                    styles["Italic"],
                ),
            ]
        )
        document.build(story)
        output.seek(0)
        return send_file(
            output,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"agrocare-detection-{detection_id}.pdf",
        )

    @app.route("/")
    @app.route("/<path:path>")
    def frontend(path="index.html"):
        if path and (FRONTEND_DIR / path).is_file():
            return send_from_directory(FRONTEND_DIR, path)
        return send_from_directory(FRONTEND_DIR, "index.html")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.environ.get("FLASK_HOST", "127.0.0.1"),
        port=int(os.environ.get("FLASK_PORT", "5000")),
        debug=os.environ.get("FLASK_DEBUG", "").strip().lower() == "true",
    )
