# AgroCare frontend

The app is served by the Flask backend from the repository root.

- `index.html` contains the shared shell and navigation.
- `src/main.js` implements routing, dashboard/history views, validated image upload and result rendering, database-backed crop autocomplete, language selection, and API calls.
- `src/styles/global.css` contains responsive layouts and component styling.
- `src/data/diseases.js` supplies the existing browser-side catalogue fallback.
- Crop suggestions use the paginated `/api/crops` endpoint; selecting a crop loads only its linked disease guides before image analysis. Image requests use multipart `FormData` with the `image` field.

Open the application through `http://127.0.0.1:5000`; do not open this file directly when testing API features.
