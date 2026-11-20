import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from backend import app as app_module


def png_bytes():
    image = Image.new("RGB", (16, 16), color=(30, 120, 45))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_prediction(confidence=0.94):
    predicted = {
        "name": "Mango___Anthracnose",
        "crop": "Mango",
        "disease_id": "mango-anthracnose",
        "healthy": False,
        "confidence": confidence,
    }
    return {
        "crop": "Mango",
        "predicted": predicted,
        "top_predictions": [predicted],
        "confidence_threshold": 0.8,
    }


class AgroCareApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        root = Path(self.temporary_directory.name)
        self.app = app_module.create_app(
            {
                "TESTING": True,
                "DATABASE": str(root / "test.db"),
                "UPLOAD_FOLDER": str(root / "uploads"),
                "MODEL_DIR": str(root / "missing-model"),
                "SEED_FILE": str(Path(__file__).resolve().parents[2] / "database" / "seed" / "diseases.json"),
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temporary_directory.cleanup()

    def post_image(
        self,
        image_data=None,
        filename="leaf.png",
        crop="Mango",
        save_image="false",
        endpoint="/api/detection",
    ):
        return self.client.post(
            endpoint,
            data={
                "image": (io.BytesIO(image_data if image_data is not None else png_bytes()), filename, "image/png"),
                "crop": crop,
                "save_image": save_image,
            },
            content_type="multipart/form-data",
        )

    def test_health_reports_seeded_database_and_missing_model_without_claiming_ready(self):
        response = self.client.get("/api/health")
        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["database"]["disease_count"], 20)
        self.assertEqual(payload["database"]["crop_count"], 13)
        self.assertEqual(payload["model"]["status"], "not_configured")

    def test_health_reports_database_connection_failure(self):
        blocker = Path(self.temporary_directory.name) / "not-a-directory"
        blocker.write_text("test", encoding="utf-8")
        self.app.config["DATABASE"] = str(blocker / "database.db")
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["database"]["status"], "unavailable")
        response.close()

    def test_invalid_and_corrupted_images_are_rejected(self):
        missing = self.client.post("/api/detection", data={}, content_type="multipart/form-data")
        unsupported = self.post_image(filename="leaf.gif")
        corrupted = self.post_image(b"not an image")
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(unsupported.status_code, 415)
        self.assertEqual(corrupted.status_code, 400)

    def test_extension_mime_and_actual_image_format_must_match(self):
        mismatched_mime = self.client.post(
            "/api/detection",
            data={
                "image": (io.BytesIO(png_bytes()), "leaf.jpg", "image/png"),
                "crop": "Mango",
            },
            content_type="multipart/form-data",
        )
        jpeg = Image.new("RGB", (16, 16), color=(30, 120, 45))
        jpeg_output = io.BytesIO()
        jpeg.save(jpeg_output, format="JPEG")
        mismatched_content = self.post_image(jpeg_output.getvalue())
        self.assertEqual(mismatched_mime.status_code, 415)
        self.assertEqual(mismatched_content.status_code, 400)

    def test_jpeg_and_webp_uploads_are_accepted_by_the_image_validator(self):
        for image_format, extension, mime_type in (
            ("JPEG", ".jpg", "image/jpeg"),
            ("WEBP", ".webp", "image/webp"),
        ):
            image = Image.new("RGB", (16, 16), color=(30, 120, 45))
            output = io.BytesIO()
            image.save(output, format=image_format)
            with patch.object(app_module, "predict_image", return_value=test_prediction()):
                response = self.client.post(
                    "/api/predict",
                    data={
                        "image": (
                            io.BytesIO(output.getvalue()),
                            f"leaf{extension}",
                            mime_type,
                        ),
                        "crop": "Mango",
                    },
                    content_type="multipart/form-data",
                )
            self.assertEqual(response.status_code, 201, image_format)

    def test_oversized_images_are_rejected_before_decode(self):
        response = self.post_image(b"x" * (10 * 1024 * 1024 + 1))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.get_json()["error"], "file_too_large")

    def test_valid_image_returns_model_unavailable_without_a_fake_prediction(self):
        response = self.post_image()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["error"], "model_unavailable")
        self.assertEqual(self.client.get("/api/history").get_json()["count"], 0)

    def test_predict_route_returns_clear_error_when_configured_weights_are_missing(self):
        model_dir = Path(self.temporary_directory.name) / "model"
        model_dir.mkdir()
        (model_dir / "model_config.json").write_text(
            json.dumps(
                {
                    "architecture": "mobilenet_v2",
                    "weights_file": "missing.pth",
                    "class_names_file": "class_names.json",
                    "confidence_threshold": 0.8,
                    "threshold_validation": "validated on held-out data",
                }
            ),
            encoding="utf-8",
        )
        (model_dir / "class_names.json").write_text(
            json.dumps(
                [
                    {
                        "name": "Mango___Anthracnose",
                        "crop": "Mango",
                        "disease_id": "mango-anthracnose",
                        "healthy": False,
                    }
                ]
            ),
            encoding="utf-8",
        )
        self.app.config["MODEL_DIR"] = str(model_dir)

        response = self.post_image(endpoint="/api/predict")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["error"], "model_unavailable")
        self.assertIn("weights are missing", response.get_json()["message"])
        self.assertEqual(self.client.get("/api/history").get_json()["count"], 0)

    def test_predict_route_returns_model_result(self):
        with patch.object(app_module, "predict_image", return_value=test_prediction()):
            response = self.post_image(endpoint="/api/predict")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["predicted_disease"], "Mango Anthracnose")
        self.assertEqual(response.get_json()["confidence"], 0.94)

    def test_successful_adapter_result_is_saved_and_can_be_deleted(self):
        with patch.object(app_module, "predict_image", return_value=test_prediction()):
            response = self.post_image(save_image="true")
        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["status"], "diseased")
        self.assertEqual(result["disease_info"]["id"], "mango-anthracnose")
        self.assertTrue(result["image_url"])
        saved_image = self.client.get(result["image_url"])
        self.assertEqual(saved_image.status_code, 200)
        saved_image.close()

        history = self.client.get("/api/history").get_json()
        self.assertEqual(history["count"], 1)
        self.assertEqual(history["history"][0]["predicted_disease"], "Mango Anthracnose")
        dashboard = self.client.get("/api/dashboard").get_json()
        self.assertEqual(dashboard["diseased_count"], 1)
        self.assertEqual(dashboard["recent_detection_count"], 1)
        report = self.client.get(f"/api/history/{result['detection_id']}/report.pdf")
        self.assertEqual(report.status_code, 200)
        self.assertTrue(report.data.startswith(b"%PDF"))
        report.close()

        deleted = self.client.delete(f"/api/history/{result['detection_id']}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get("/api/history").get_json()["count"], 0)
        missing_image = self.client.get(result["image_url"])
        self.assertEqual(missing_image.status_code, 404)
        missing_image.close()

    def test_low_confidence_is_saved_as_uncertain_and_excluded_from_class_totals(self):
        with patch.object(app_module, "predict_image", return_value=test_prediction(0.42)):
            response = self.post_image()
        result = response.get_json()
        self.assertEqual(response.status_code, 201)
        self.assertTrue(result["uncertain"])
        self.assertEqual(result["status"], "uncertain")
        self.assertEqual(result["predicted_disease"], "Unable to identify")
        self.assertEqual(result["candidate_disease"], "Mango Anthracnose")
        dashboard = self.client.get("/api/dashboard").get_json()
        self.assertEqual(dashboard["detection_count"], 1)
        self.assertEqual(dashboard["diseased_count"], 0)

    def test_healthy_model_class_is_saved_as_a_healthy_result(self):
        healthy = test_prediction()
        healthy_class = {
            "name": "Mango___healthy",
            "crop": "Mango",
            "disease_id": None,
            "healthy": True,
            "confidence": 0.91,
        }
        healthy["predicted"] = healthy_class
        healthy["top_predictions"] = [healthy_class]
        with patch.object(app_module, "predict_image", return_value=healthy):
            response = self.post_image()
        self.assertEqual(response.get_json()["predicted_disease"], "Healthy")
        self.assertEqual(response.get_json()["status"], "healthy")
        self.assertEqual(self.client.get("/api/dashboard").get_json()["healthy_count"], 1)

    def test_unsupported_crop_is_rejected(self):
        response = self.post_image(crop="Unsupported crop")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["error"], "unsupported_crop")

    def test_catalogue_search_detail_and_symptom_guidance(self):
        listing = self.client.get("/api/diseases?crop=Mango").get_json()
        detail = self.client.get("/api/diseases/mango-anthracnose")
        guidance = self.client.post(
            "/api/symptom-guidance",
            json={"crop": "Mango", "symptom": "fruit lesions"},
        )
        self.assertEqual(listing["count"], 2)
        self.assertEqual(detail.status_code, 200)
        self.assertIn("mango-anthracnose", [item["id"] for item in guidance.get_json()["matches"]])

    def test_crop_search_supports_aliases_scientific_names_and_pagination(self):
        response = self.client.get("/api/crops?q=pean&limit=1")
        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["crops"][0]["name"], "Groundnut")
        self.assertEqual(payload["crops"][0]["scientific_name"], "Arachis hypogaea")
        self.assertIn("Peanut", payload["crops"][0]["aliases"])
        scientific = self.client.get("/api/crops?q=melongena").get_json()
        self.assertEqual(scientific["crops"][0]["name"], "Brinjal")

    def test_crop_alias_filters_only_linked_disease_records(self):
        response = self.client.get("/api/diseases?crop=Eggplant")
        diseases = response.get_json()["diseases"]
        self.assertTrue(diseases)
        self.assertTrue(all(item["crop"] == "Brinjal" for item in diseases))
        missing = self.client.get("/api/diseases?crop=not-a-crop").get_json()
        self.assertEqual(missing["count"], 0)

    def test_detection_resolves_crop_alias_before_model_prediction(self):
        with patch.object(app_module, "predict_image", return_value=test_prediction()):
            response = self.post_image(crop="Mango tree")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["crop"], "Mango")

    def test_model_disease_mapping_must_match_the_selected_crop(self):
        with patch.object(app_module, "predict_image", return_value=test_prediction()):
            response = self.post_image(crop="Banana")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["error"], "model_mapping_invalid")

    def test_disease_record_exposes_missing_source_metadata_instead_of_fabricating_it(self):
        detail = self.client.get("/api/diseases/mango-anthracnose").get_json()
        self.assertEqual(detail["references"], [])
        self.assertIn("citation was not supplied", detail["source"])
        self.assertEqual(detail["crops"], ["Mango"])

    def test_existing_catalogue_records_are_not_replaced(self):
        with app_module.get_db(self.app.config["DATABASE"]) as connection:
            before = connection.execute("SELECT id, name FROM diseases ORDER BY id").fetchall()
        app_module.init_db(self.app.config["DATABASE"], self.app.config["SEED_FILE"])
        with app_module.get_db(self.app.config["DATABASE"]) as connection:
            after = connection.execute("SELECT id, name FROM diseases ORDER BY id").fetchall()
        self.assertEqual([tuple(row) for row in before], [tuple(row) for row in after])

    def test_legacy_database_migration_preserves_diseases_and_adds_crop_links(self):
        database_path = Path(self.temporary_directory.name) / "legacy.db"
        seed_path = Path(self.temporary_directory.name) / "empty-seed.json"
        seed_path.write_text("[]", encoding="utf-8")
        with app_module.get_db(str(database_path)) as connection:
            connection.execute(
                """
                CREATE TABLE diseases (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, crop TEXT NOT NULL,
                    category TEXT NOT NULL, symptoms TEXT NOT NULL, causes TEXT NOT NULL,
                    conditions TEXT NOT NULL, prevention TEXT NOT NULL, management TEXT NOT NULL,
                    symptom_tags TEXT NOT NULL, ipm TEXT NOT NULL, image TEXT,
                    source TEXT NOT NULL DEFAULT 'local-extension-data'
                )
                """
            )
            connection.execute(
                """
                INSERT INTO diseases
                (id, name, crop, category, symptoms, causes, conditions, prevention,
                 management, symptom_tags, ipm, image)
                VALUES ('legacy-guide', 'Legacy Guide', 'Legacy Crop', 'Fungal disease',
                        'Visible signs.', 'Cause.', 'Conditions.', '[]', '[]', '[]', '[]', NULL)
                """
            )

        app_module.init_db(str(database_path), str(seed_path))
        with app_module.get_db(str(database_path)) as connection:
            disease = connection.execute(
                "SELECT name, scientific_name, visual_symptoms FROM diseases WHERE id = 'legacy-guide'"
            ).fetchone()
            crop_link = connection.execute(
                """
                SELECT c.name FROM crops c JOIN crop_diseases cd ON cd.crop_id = c.id
                WHERE cd.disease_id = 'legacy-guide'
                """
            ).fetchone()
        self.assertEqual(disease["name"], "Legacy Guide")
        self.assertEqual(disease["visual_symptoms"], "Visible signs.")
        self.assertEqual(crop_link["name"], "Legacy Crop")


if __name__ == "__main__":
    unittest.main()
