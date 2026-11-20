# AgroCare backend

`app.py` provides the Flask API, serves the existing frontend and migrates SQLite without replacing existing disease rows. It maintains crop records and aliases, many-to-many crop/disease relationships, disease references, and paginated crop search. The API validates image extensions, MIME types, decoded image format and content, and enforces a 10 MiB file limit.

Install the base dependencies and start from the project root:

```bat
python -m pip install -r backend\requirements.txt
python backend\app.py
```

For inference, install a compatible `torch` / `torchvision` pair using the PyTorch Windows selector or `backend\requirements-model.txt`. Configure `model_config.json` and the ordered `class_names.json` in `backend\models\`, or set `AGROCARE_MODEL_DIR`. Output classes are scoped to the selected crop; calibrate the confidence threshold with crop-scoped class probabilities on held-out data. No model weights or training dataset are included, so image detection remains unavailable until those are supplied and validated.

The database currently has 13 crop/group entries and 20 disease guides. Add sourced records with `python database\import_data.py --crops C:\data\crops.json --diseases C:\data\diseases.json`. See `database\README.md` for the JSON shape and current citation limitations.

Run backend tests from the project root with `python -m unittest discover -s backend\tests -v`. Success-path tests mock the inference adapter and do not establish model accuracy.
