"""Lazy PyTorch MobileNetV2 inference for user-supplied AgroCare models."""

import json
import logging
import math
from io import BytesIO
from pathlib import Path
from threading import Lock

from PIL import Image, ImageOps

LOGGER = logging.getLogger(__name__)
_PREDICTORS = {}
_PREDICTOR_LOCK = Lock()


class ModelUnavailableError(RuntimeError):
    """Raised when a configured, validated model cannot be used."""


def _read_model_files(model_dir):
    model_dir = Path(model_dir).resolve()
    config_path = model_dir / "model_config.json"
    if not config_path.is_file():
        raise ModelUnavailableError("No trained crop-disease model is configured.")
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
        if not isinstance(config, dict):
            raise ModelUnavailableError("The model configuration must be a JSON object.")
        class_file = config.get("class_names_file", "class_names.json")
        class_path = (model_dir / class_file).resolve()
        if class_path.parent != model_dir or not class_path.is_file():
            raise ModelUnavailableError("The model class mapping is missing or invalid.")
        classes = json.loads(class_path.read_text(encoding="utf-8"))
    except ModelUnavailableError:
        raise
    except (OSError, ValueError, TypeError) as error:
        raise ModelUnavailableError("The model configuration or class mapping is invalid.") from error

    if config.get("architecture") != "mobilenet_v2":
        raise ModelUnavailableError("Only the configured MobileNetV2 architecture is supported.")
    weights_name = config.get("weights_file", "model.pth")
    if not isinstance(weights_name, str) or not weights_name:
        raise ModelUnavailableError("The configured model weight filename is invalid.")
    weights_path = (model_dir / weights_name).resolve()
    if weights_path.parent != model_dir or not weights_path.is_file():
        raise ModelUnavailableError("The trained model weights are missing or invalid.")
    if not isinstance(classes, list) or not classes:
        raise ModelUnavailableError("The model class mapping must be a non-empty JSON list.")

    threshold = config.get("confidence_threshold")
    validation = config.get("threshold_validation")
    if (
        not isinstance(threshold, (int, float))
        or isinstance(threshold, bool)
        or not math.isfinite(threshold)
        or not 0 < threshold <= 1
        or not isinstance(validation, str)
        or len(validation.strip()) < 8
    ):
        raise ModelUnavailableError(
            "Set a confidence threshold and document its held-out validation basis."
        )

    names = set()
    for label in classes:
        if not isinstance(label, dict):
            raise ModelUnavailableError("Each class mapping entry must be an object.")
        name = label.get("name")
        crop = label.get("crop")
        healthy = label.get("healthy", False)
        if not isinstance(name, str) or not name.strip() or name in names:
            raise ModelUnavailableError("The model class names must be non-empty and unique.")
        if not isinstance(crop, str) or not crop.strip():
            raise ModelUnavailableError("Each model class must specify its crop.")
        if not isinstance(healthy, bool) or (not healthy and not label.get("disease_id")):
            raise ModelUnavailableError("Disease classes must map to a catalogue disease ID.")
        names.add(name)

    image_size = config.get("image_size", 224)
    mean = config.get("mean", [0.485, 0.456, 0.406])
    std = config.get("std", [0.229, 0.224, 0.225])
    if (
        not isinstance(image_size, int)
        or isinstance(image_size, bool)
        or image_size < 32
        or image_size > 2048
        or not isinstance(mean, list)
        or not isinstance(std, list)
        or len(mean) != 3
        or len(std) != 3
        or any(not isinstance(value, (int, float)) for value in mean + std)
        or any(not math.isfinite(value) for value in mean + std)
        or any(value <= 0 for value in std)
    ):
        raise ModelUnavailableError("The model image preprocessing configuration is invalid.")
    return model_dir, config, classes, weights_path, image_size, mean, std


class MobileNetV2Predictor:
    def __init__(self, model_dir):
        (
            self.model_dir,
            self.config,
            self.classes,
            weights_path,
            image_size,
            mean,
            std,
        ) = _read_model_files(model_dir)
        try:
            import torch
            from torchvision import models, transforms
        except (ImportError, OSError, RuntimeError) as error:
            raise ModelUnavailableError(
                "Install the optional PyTorch inference dependencies to enable image detection."
            ) from error

        self.torch = torch
        self.transform = transforms.Compose(
            [
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=mean, std=std),
            ]
        )
        self.model = models.mobilenet_v2(weights=None)
        self.model.classifier[1] = torch.nn.Linear(
            self.model.last_channel, len(self.classes)
        )
        try:
            checkpoint = torch.load(weights_path, map_location="cpu", weights_only=True)
            state_dict = checkpoint.get("state_dict", checkpoint) if isinstance(checkpoint, dict) else checkpoint
            if not isinstance(state_dict, dict):
                raise ValueError("Checkpoint does not contain a state dictionary.")
            if any(key.startswith("module.") for key in state_dict):
                state_dict = {
                    key.removeprefix("module."): value for key, value in state_dict.items()
                }
            self.model.load_state_dict(state_dict, strict=True)
        except (OSError, RuntimeError, ValueError, AttributeError) as error:
            LOGGER.exception("Unable to load configured MobileNetV2 weights")
            raise ModelUnavailableError("The configured model weights could not be loaded.") from error
        self.model.eval()

    def predict(self, image_bytes, crop):
        matching_indexes = [
            index
            for index, label in enumerate(self.classes)
            if label["crop"].casefold() == crop.casefold()
        ]
        if not matching_indexes:
            raise ValueError("unsupported_crop")
        try:
            with Image.open(BytesIO(image_bytes)) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
            tensor = self.transform(image).unsqueeze(0)
            with self.torch.inference_mode():
                logits = self.model(tensor)[0]
            if (
                logits.numel() != len(self.classes)
                or not self.torch.isfinite(logits).all().item()
            ):
                raise ValueError("Model output does not match the class mapping.")
            crop_indexes = self.torch.tensor(matching_indexes, dtype=self.torch.long)
            crop_probabilities = self.torch.softmax(logits[crop_indexes], dim=0)
            values, local_indexes = self.torch.topk(
                crop_probabilities, k=min(3, len(matching_indexes))
            )
            predictions = []
            for value, local_index in zip(values.tolist(), local_indexes.tolist()):
                index = matching_indexes[local_index]
                label = self.classes[index]
                predictions.append(
                    {
                        "name": label["name"],
                        "crop": label["crop"],
                        "disease_id": label.get("disease_id"),
                        "healthy": label.get("healthy", False),
                        "confidence": float(value),
                    }
                )
        except Exception as error:
            LOGGER.exception("Crop image inference failed")
            raise ModelUnavailableError("Image analysis failed; no result was saved.") from error

        return {
            "crop": crop,
            "predicted": predictions[0],
            "top_predictions": predictions,
            "confidence_threshold": float(self.config["confidence_threshold"]),
        }


def get_predictor(model_dir):
    key = str(Path(model_dir).resolve())
    with _PREDICTOR_LOCK:
        if key not in _PREDICTORS:
            _PREDICTORS[key] = MobileNetV2Predictor(model_dir)
        return _PREDICTORS[key]


def predict_image(image_bytes, model_dir, crop):
    return get_predictor(model_dir).predict(image_bytes, crop)


def model_health(model_dir):
    try:
        predictor = get_predictor(model_dir)
        return {
            "status": "ready",
            "architecture": "MobileNetV2",
            "class_count": len(predictor.classes),
            "confidence_threshold": predictor.config["confidence_threshold"],
        }
    except ModelUnavailableError as error:
        message = str(error)
        status = "not_configured" if message.startswith("No trained") else "unavailable"
        return {"status": status, "message": message}
