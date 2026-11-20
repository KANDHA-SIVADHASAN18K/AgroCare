# AgroCare

AgroCare is a responsive crop-health education app built with the existing HTML/CSS/JavaScript frontend, Flask API and SQLite catalogue. It includes searchable crop guides, symptom guidance, secure leaf-image upload, detection history, a dashboard and a configurable PyTorch MobileNetV2 inference integration.

**AI detection is disabled until you supply trained weights, an exact class mapping and a confidence threshold calibrated on held-out validation data.** No model or training dataset is included in this repository. Without a usable model, the API reports that detection is unavailable and does not invent a disease or confidence score.

AgroCare is educational, not a confirmed field diagnosis. Similar symptoms can have different causes. For treatment decisions, consult a local agricultural extension service and follow applicable regulations. This app does not recommend pesticide products or dosages.

## Existing architecture and data

- `frontend/index.html` and `frontend/src/` provide the single-page HTML/CSS/JavaScript interface.
- `backend/app.py` serves the frontend and JSON endpoints using Flask.
- `database/agrocare.db` is the persistent SQLite catalogue; the crop and disease seed files are imported non-destructively at startup.
- Existing disease rows are retained; initialization only creates missing tables and adds missing seed rows.
- `backend/inference.py` loads a user-supplied PyTorch MobileNetV2 state dictionary only when configured.
- The database currently contains **13 crop/group entries and 20 disease guides**. The pre-existing browser fallback contains 39 guides; it is not counted as database-backed disease data.
- Crop records use scientific names and common aliases where recorded, with botanical references to Kew Plants of the World Online (the pulses group cites FAO). The existing disease seed does not contain per-disease references; the API and UI disclose that gap instead of claiming verification.

## Crop and disease catalog import

Crop search is database-backed (`GET /api/crops?q=...&limit=20&offset=0`), searches names, aliases, categories and scientific-name substrings, and returns at most 50 records per page. `crop_aliases`, `diseases`, `disease_references` and the many-to-many `crop_diseases` table support aliases and cross-crop diseases.

No verified 1,000-record crop or larger sourced disease dataset was present in the repository, so AgroCare does **not** make that count up. Add a sourced JSON array with this command (duplicate crop names/IDs and disease IDs are ignored; malformed or unknown crop relationships fail with an error):

```bat
python database\import_data.py --crops C:\data\crops.json --diseases C:\data\diseases.json
```

Crop objects must include `id`, `name`, `category`, `source`, `source_url`, and optional `scientific_name` and `aliases`. Disease objects use the keys in `database/seed/diseases.json`, may set `crops` to multiple canonical crop names, and must include a `source` label and at least one `references` entry of `{ "title": "...", "url": "https://...", "note": "..." }`; `scientificName` and `visualSymptoms` are optional. Import crops before diseases when running the commands separately. Re-run the command safely to add records; existing records are not overwritten.

## Windows setup (Command Prompt)

From the repository folder in VS Code's integrated terminal (`cmd.exe`):

```bat
py -3 -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
python backend\app.py
```

Open **http://127.0.0.1:5000**. Keep the terminal open while using AgroCare; press `Ctrl+C` to stop the server. If the Python launcher is unavailable, replace `py -3` with `python`.

The base install includes Flask, Pillow for image decoding/verification, and ReportLab for PDF reports. The app binds to `127.0.0.1` by default and does not enable Flask debug mode. Optional environment variables:

```bat
set AGROCARE_MODEL_DIR=C:\path\to\agrocare-model
set FLASK_HOST=127.0.0.1
set FLASK_PORT=5000
```

Run the included launcher with:

```bat
run_agrocare.bat
```

## Add a trained model

The model files are deliberately not committed. Use a trained, evaluated **PyTorch MobileNetV2 classifier** with:

1. A state dictionary whose output layer has exactly the same number/order of classes as the mapping.
2. `model_config.json` and `class_names.json` in one model directory (default: `backend/models/`; override with `AGROCARE_MODEL_DIR`).
3. The exact preprocessing used for training: RGB image, resize to the configured square dimensions, convert to tensor, then normalize with the configured channel means and standard deviations.
4. Disease classes mapped to existing SQLite disease IDs. A healthy class has `"healthy": true` and a null `disease_id`.
5. A confidence threshold calibrated on held-out data using the same crop-scoped class probabilities used at inference, with a note documenting that validation. Do not copy a threshold from an unrelated model or dataset.

Copy the templates `backend/model_config.example.json` and `backend/class_names.example.json` into the model directory as `model_config.json` and `class_names.json`, then replace every example value. The included mapping is only a format example, not a trained class list. Keep the class order identical to the model's training output. Configure a model-specific image size and normalization; the ImageNet values in the template are only a common starting point, not proof that they match your training pipeline.

Install the optional inference runtime in the same virtual environment. For Windows CPU or CUDA, first select a compatible `torch` / `torchvision` wheel pair at https://pytorch.org/get-started/locally/; then either install that pair as directed or run:

```bat
python -m pip install -r backend\requirements-model.txt
```

The classifier can only recognize classes represented in its training data. Rejecting non-leaf photos and unsupported crops reliably requires suitable negative/non-leaf examples and validation in the trained model; an ordinary leaf disease classifier cannot guarantee this. Model health is reported as `not_configured` or `unavailable` until all files and inference dependencies are usable.

### Example configuration format

`model_config.json`:

```json
{
  "architecture": "mobilenet_v2",
  "weights_file": "model.pth",
  "class_names_file": "class_names.json",
  "image_size": 224,
  "mean": [0.485, 0.456, 0.406],
  "std": [0.229, 0.224, 0.225],
  "confidence_threshold": null,
  "threshold_validation": "Replace with held-out validation/calibration details"
}
```

The null threshold above is a format placeholder only; replace it with a value selected using your own validation set. The API refuses null or out-of-range thresholds and requires a validation note.

`class_names.json` is an ordered JSON list. Each disease entry must use a disease ID that exists in `GET /api/diseases`:

```json
[
  {
    "name": "Mango___Anthracnose",
    "crop": "Mango",
    "disease_id": "mango-anthracnose",
    "healthy": false
  },
  {
    "name": "Mango___healthy",
    "crop": "Mango",
    "disease_id": null,
    "healthy": true
  }
]
```

Create `model.pth` from the state dictionary for the same MobileNetV2 architecture and ordered classes. The loader uses CPU inference and strict state-dictionary matching; no weights are downloaded automatically.

## Run and test

Start the backend as above, then:

- Dashboard: http://127.0.0.1:5000/#dashboard
- Detection: http://127.0.0.1:5000/#detect
- API health: http://127.0.0.1:5000/api/health
- Disease catalogue: http://127.0.0.1:5000/api/diseases

Run the focused automated backend suite from the repository root:

```bat
python -m unittest discover -s backend\tests -v
```

These tests verify upload validation, unavailable-model behavior, database/history/dashboard handling, uncertainty threshold handling, and deletion. The API success-path tests use a test-only mocked inference adapter to validate persistence and response wiring; they do **not** validate a trained model. Genuine model accuracy/inference remains unverified until real weights and validation data are supplied.

## API

All detection requests use `multipart/form-data`. The `image` file and `crop` field are required; `save_image=true` opts into saving the uploaded image, and is false by default.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | SQLite catalogue and model readiness |
| `GET` | `/api/dashboard` | Crop/disease totals and genuine saved-result statistics |
| `GET` | `/api/crops?q=...&limit=20&offset=0` | Paginated crop search with scientific names and aliases |
| `GET` | `/api/diseases?crop=...&category=...&q=...` | Search/filter disease catalogue |
| `GET` | `/api/diseases/<id>` | One disease guide |
| `POST` | `/api/symptom-guidance` | Educational crop/symptom guide matches |
| `POST` | `/api/predict` | Validate uploaded image, run configured model and return the disease prediction and confidence |
| `POST` | `/api/detection` | Backward-compatible alias for `/api/predict` |
| `GET` | `/api/history?limit=50` | Recent saved detections (maximum 100) |
| `DELETE` | `/api/history/<id>` | Delete a history row and any opted-in image |
| `GET` | `/api/history/<id>/report.pdf` | Download a PDF report for a saved detection |
| `GET` | `/api/uploads/<filename>` | Retrieve an image explicitly saved with a detection |

Example requests in Windows Command Prompt:

```bat
curl.exe http://127.0.0.1:5000/api/health
curl.exe "http://127.0.0.1:5000/api/diseases?crop=Mango"
curl.exe -F "image=@C:\images\mango-leaf.jpg" -F "crop=Mango" -F "save_image=false" http://127.0.0.1:5000/api/predict
curl.exe http://127.0.0.1:5000/api/history
```

Current health response when model files have not been added:

```json
{
  "status": "ok",
  "database": {
    "status": "ok",
    "engine": "sqlite",
    "crop_count": 13,
    "disease_count": 20
  },
  "model": {
    "status": "not_configured",
    "message": "No trained crop-disease model is configured."
  }
}
```

With the same unconfigured model, a valid image request returns:

```http
HTTP/1.1 503 SERVICE UNAVAILABLE
Content-Type: application/json
```

```json
{
  "error": "model_unavailable",
  "message": "Image detection is unavailable. Configure a trained, validated model before analyzing images."
}
```

An image request without a usable model returns HTTP `503` with an `error` code and a clear message; it does not save a result. A successful response contains the actual model's `detection_id`, `crop`, `predicted_disease`, `status` (`healthy`, `diseased` or `uncertain`), `confidence`, `confidence_threshold`, `top_predictions`, matching `disease_info` where applicable, and an `image_url` only when the image was explicitly saved. No confidence values are supplied in this documentation because no real model has been tested.

## Dashboard, history, language and privacy

- The dashboard totals are calculated from SQLite. Recent detections counts saved results from the last 7 days. Healthy/diseased totals include only saved, above-threshold model results; uncertain results are counted in total detections but excluded from those two totals.
- Images are validated and processed in memory and are not retained by default. Opt in to save an image when analyzing; removing its history entry also deletes the saved file.
- History and saved uploads are local to the SQLite installation. This application does not implement accounts or per-farmer access control; do not expose an unauthenticated instance to a public network.
- English and Tamil UI controls and detection/dashboard/history workflows are available from the language selector. Existing disease-catalogue content is currently authored in English and is not automatically translated.
- PDF files contain the saved detection and available catalogue guidance. They are educational records, not diagnostic certificates.

## Project layout

```text
backend/
  app.py                         Flask routes, SQLite setup, upload/history/report APIs
  inference.py                   Lazy MobileNetV2 inference adapter
  requirements.txt               Core backend, Pillow and PDF dependencies
  requirements-model.txt         Optional PyTorch/torchvision dependencies
  model_config.example.json      Model configuration template
  class_names.example.json       Ordered class-mapping template
  tests/test_app.py              API and database tests
database/
  agrocare.db                    Persistent local database (ignored by Git)
  schema.sql                     Reference schema
  import_data.py                 Validated JSON crop/disease importer
  seed/crops.json                Sourced crop names, taxonomy and aliases
  seed/diseases.json             Non-destructive initial disease catalogue
frontend/
  index.html                     Single-page application shell
  src/main.js                    Routing, UI, bilingual controls and API calls
  src/styles/global.css          Responsive styling
```
