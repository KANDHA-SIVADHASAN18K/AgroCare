"""Import sourced crop and disease records into the existing AgroCare SQLite database."""

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
from backend.app import DATABASE, SEED_FILE, get_db, init_db  # noqa: E402


def read_records(path, kind):
    try:
        records = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Unable to read {kind} JSON file: {error}") from error
    if not isinstance(records, list):
        raise ValueError(f"{kind.capitalize()} import must be a JSON array.")
    if any(not isinstance(record, dict) for record in records):
        raise ValueError(f"Every {kind} record must be a JSON object.")
    return records


def require_text(record, key, kind):
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{kind} record is missing non-empty '{key}'.")
    return value.strip()


def validate_source(source, url, kind):
    require_text({"value": source}, "value", kind)
    parsed = urlparse(require_text({"value": url}, "value", kind))
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(f"{kind} source_url must be an absolute HTTP(S) URL.")


def import_crops(connection, records):
    for record in records:
        crop_id = require_text(record, "id", "Crop")
        name = require_text(record, "name", "Crop")
        category = require_text(record, "category", "Crop")
        source = require_text(record, "source", "Crop")
        source_url = require_text(record, "source_url", "Crop")
        validate_source(source, source_url, "Crop")
        scientific_name = record.get("scientific_name")
        if scientific_name is not None and not isinstance(scientific_name, str):
            raise ValueError(f"Crop '{name}' scientific_name must be a string or null.")
        aliases = record.get("aliases", [])
        if not isinstance(aliases, list) or any(
            not isinstance(alias, str) or not alias.strip() for alias in aliases
        ):
            raise ValueError(f"Crop '{name}' aliases must be an array of non-empty strings.")
        connection.execute(
            """
            INSERT OR IGNORE INTO crops
            (id, name, scientific_name, category, source, source_url)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                crop_id,
                name,
                scientific_name,
                category,
                source,
                source_url,
            ),
        )
        crop = connection.execute(
            "SELECT id FROM crops WHERE name = ? COLLATE NOCASE", (name,)
        ).fetchone()
        if crop is None:
            raise ValueError(f"Crop '{name}' conflicts with an existing crop ID.")
        for alias in aliases:
            if alias.strip().casefold() == name.casefold():
                continue
            existing_alias = connection.execute(
                "SELECT crop_id FROM crop_aliases WHERE alias = ? COLLATE NOCASE",
                (alias.strip(),),
            ).fetchone()
            if existing_alias and existing_alias["crop_id"] != crop["id"]:
                raise ValueError(f"Crop alias '{alias.strip()}' is already assigned to another crop.")
            connection.execute(
                "INSERT OR IGNORE INTO crop_aliases (alias, crop_id) VALUES (?, ?)",
                (alias.strip(), crop["id"]),
            )


def import_diseases(connection, records):
    imported = []
    for record in records:
        disease_id = require_text(record, "id", "Disease")
        require_text(record, "name", "Disease")
        crop_names = record.get("crops")
        if crop_names is None:
            crop_names = [require_text(record, "crop", "Disease")]
        if (
            not isinstance(crop_names, list)
            or not crop_names
            or any(not isinstance(name, str) or not name.strip() for name in crop_names)
        ):
            raise ValueError(f"Disease '{disease_id}' must list one or more crop names.")
        crop_names = list(dict.fromkeys(name.strip() for name in crop_names))
        category = require_text(record, "category", "Disease")
        symptoms = require_text(record, "symptoms", "Disease")
        causes = require_text(record, "causes", "Disease")
        conditions = require_text(record, "conditions", "Disease")
        source = require_text(record, "source", f"Disease '{disease_id}'")
        prevention = record.get("prevention", [])
        management = record.get("management", [])
        symptom_tags = record.get("symptomTags", [])
        ipm = record.get("ipm", [])
        if any(not isinstance(value, list) for value in (prevention, management, symptom_tags, ipm)):
            raise ValueError(f"Disease '{disease_id}' list fields must be JSON arrays.")
        for crop_name in crop_names:
            if connection.execute(
                "SELECT 1 FROM crops WHERE name = ? COLLATE NOCASE", (crop_name,)
            ).fetchone() is None:
                raise ValueError(
                    f"Disease '{disease_id}' references unknown crop '{crop_name}'. "
                    "Import the crop record first."
                )
            duplicate = connection.execute(
                """
                SELECT d.id FROM diseases d
                JOIN crop_diseases cd ON cd.disease_id = d.id
                JOIN crops c ON c.id = cd.crop_id
                WHERE d.id != ? AND d.name = ? COLLATE NOCASE
                  AND c.name = ? COLLATE NOCASE
                LIMIT 1
                """,
                (disease_id, record["name"].strip(), crop_name),
            ).fetchone()
            if duplicate:
                raise ValueError(
                    f"Disease '{record['name']}' already exists for crop '{crop_name}' "
                    f"under ID '{duplicate['id']}'."
                )
        connection.execute(
            """
            INSERT OR IGNORE INTO diseases
            (id, name, crop, scientific_name, visual_symptoms, category, symptoms, causes,
             conditions, prevention, management, symptom_tags, ipm, image, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                disease_id,
                record["name"].strip(),
                crop_names[0],
                record.get("scientificName"),
                record.get("visualSymptoms", symptoms),
                category,
                symptoms,
                causes,
                conditions,
                json.dumps(prevention, ensure_ascii=False),
                json.dumps(management, ensure_ascii=False),
                json.dumps(symptom_tags, ensure_ascii=False),
                json.dumps(ipm, ensure_ascii=False),
                record.get("image"),
                source,
            ),
        )
        disease = connection.execute(
            "SELECT id FROM diseases WHERE id = ?", (disease_id,)
        ).fetchone()
        if disease is None:
            raise ValueError(f"Disease ID '{disease_id}' conflicts with an existing record.")
        for crop_name in crop_names:
            connection.execute(
                """
                INSERT OR IGNORE INTO crop_diseases (crop_id, disease_id)
                SELECT id, ? FROM crops WHERE name = ? COLLATE NOCASE
                """,
                (disease_id, crop_name),
            )
        references = record.get("references")
        if not isinstance(references, list) or not references:
            raise ValueError(
                f"Disease '{disease_id}' must include at least one verifiable reference."
            )
        for reference in references:
            if not isinstance(reference, dict):
                raise ValueError(f"Disease '{disease_id}' reference entries must be objects.")
            title = require_text(reference, "title", f"Disease '{disease_id}' reference")
            url = require_text(reference, "url", f"Disease '{disease_id}' reference")
            validate_source(title, url, f"Disease '{disease_id}' reference")
            connection.execute(
                """
                INSERT OR IGNORE INTO disease_references (disease_id, title, url, note)
                VALUES (?, ?, ?, ?)
                """,
                (disease_id, title, url, reference.get("note")),
            )
        imported.append(disease_id)
    return imported


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--crops", help="JSON array of sourced crop records.")
    parser.add_argument("--diseases", help="JSON array of sourced disease records.")
    parser.add_argument("--database", default=str(DATABASE), help="SQLite database path.")
    args = parser.parse_args()
    if not args.crops and not args.diseases:
        parser.error("Provide --crops, --diseases, or both.")

    try:
        crop_records = read_records(args.crops, "crop") if args.crops else []
        disease_records = read_records(args.diseases, "disease") if args.diseases else []
        init_db(args.database, SEED_FILE)
        with get_db(args.database) as connection:
            before_crops = connection.execute("SELECT COUNT(*) FROM crops").fetchone()[0]
            before_diseases = connection.execute("SELECT COUNT(*) FROM diseases").fetchone()[0]
            if crop_records:
                import_crops(connection, crop_records)
            if disease_records:
                import_diseases(connection, disease_records)
            after_crops = connection.execute("SELECT COUNT(*) FROM crops").fetchone()[0]
            after_diseases = connection.execute("SELECT COUNT(*) FROM diseases").fetchone()[0]
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, f"Import failed: {error}\n")

    print(
        f"Import complete. Added {after_crops - before_crops} crops and "
        f"{after_diseases - before_diseases} diseases. "
        f"Database total: {after_crops} crops, {after_diseases} diseases."
    )


if __name__ == "__main__":
    main()
