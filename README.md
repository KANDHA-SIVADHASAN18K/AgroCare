# AgroCare

AgroCare is a responsive crop-health application for browsing crop diseases, reviewing symptoms and causes, and receiving responsible symptom-based guidance. It combines a modular HTML, CSS and JavaScript frontend with a Flask REST API and a local SQLite database.

> **Educational use:** AgroCare provides reference information only. It does not provide an automated diagnosis or replace advice from a qualified agricultural professional.

## Features

- Responsive, single-page frontend
- Crop and symptom-based disease search
- Detailed prevention, management and integrated pest-management guidance
- Flask REST API
- SQLite database with automatic schema initialization and seed data
- Browser-side image upload preview
- Clear fallback behavior when image detection is not configured

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Python 3, Flask |
| Database | SQLite |
| API support | Flask-CORS |
| Platform | Windows 10/11 |

## Prerequisites

Install:

- Python 3.10 or newer
- Windows Command Prompt (`cmd.exe`)
- Internet access, only when dependencies or the Google fonts need to be downloaded

Verify Python from Command Prompt:

```bat
python --version
```

If `python` is not recognized, try:

```bat
py --version
```

## Quick Start for Windows

### Option 1: Use the included launcher

Open Command Prompt in the project directory and run:

```bat
cd /d "C:\Users\KANDHA\OneDrive\Desktop\SDP--PROJECT"
run_agrocare.bat
```

Then open:

**http://127.0.0.1:5000**

Keep the terminal open while using the application. Press `Ctrl+C` to stop the server.

### Option 2: Run from standard Command Prompt

1. Open Command Prompt.
2. Change to the project directory:

   ```bat
   cd /d "C:\Users\KANDHA\OneDrive\Desktop\SDP--PROJECT"
   ```

3. Create a virtual environment:

   ```bat
   py -m venv .venv
   ```

   If `py` is unavailable, use:

   ```bat
   python -m venv .venv
   ```

4. Activate the environment:

   ```bat
   .venv\Scripts\activate.bat
   ```

5. Install the backend dependencies:

   ```bat
   python -m pip install --upgrade pip
   python -m pip install -r backend\requirements.txt
   ```

6. Start the application:

   ```bat
   python backend\app.py
   ```

7. Open **http://127.0.0.1:5000** in a browser.

To stop the server, press `Ctrl+C`. To leave the virtual environment later, run:

```bat
deactivate
```

## Application URLs

| Purpose | URL |
|---|---|
| Main application | http://127.0.0.1:5000 |
| API health check | http://127.0.0.1:5000/api/health |
| Disease catalogue | http://127.0.0.1:5000/api/diseases |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns server and database status |
| `GET` | `/api/diseases` | Lists diseases; supports `crop`, `category` and `q` query parameters |
| `GET` | `/api/diseases/<id>` | Returns one disease guide |
| `POST` | `/api/symptom-guidance` | Returns educational matches for a crop and symptom |
| `POST` | `/api/detection` | Reports image-detection configuration status |

Example request:

```bat
curl "http://127.0.0.1:5000/api/diseases?crop=Rice"
```

Example symptom-guidance request:

```bat
curl -X POST "http://127.0.0.1:5000/api/symptom-guidance" ^
  -H "Content-Type: application/json" ^
  -d "{\"crop\":\"Rice\",\"symptom\":\"leaf spots\"}"
```

## Project Structure

```text
SDP--PROJECT\
|-- backend\
|   |-- app.py                 # Flask application and API routes
|   `-- requirements.txt       # Python dependencies
|-- database\
|   |-- agrocare.db            # SQLite database, created on first start
|   |-- schema.sql             # Reference database schema
|   `-- seed\
|       `-- diseases.json      # Initial disease records
|-- frontend\
|   |-- index.html             # Browser application shell
|   `-- src\
|       |-- main.js            # Routing and application behavior
|       |-- styles\
|       |   `-- global.css     # Responsive styling
|       `-- data\
|           `-- diseases.js    # Browser-side fallback catalogue
|-- index.html                 # Redirect entry page
`-- run_agrocare.bat           # Windows launcher
```

## Database Behavior

Starting `backend/app.py` creates `database/agrocare.db` if it does not exist. It then creates the required tables and inserts seed records from `database/seed/diseases.json`.

Existing database records are not replaced by seed imports. New seed records will be added, but updates to a record already in SQLite require a database migration or manual update.

## Troubleshooting

### `python` or `py` is not recognized

- Reinstall Python and enable **Add Python to PATH**.
- Open a new Command Prompt after installation.
- Confirm Python with `py --version` or `python --version`.

### `pip` cannot install the dependencies

Activate the virtual environment and upgrade `pip`:

```bat
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

### Port 5000 is already in use

Find the process using port 5000:

```bat
netstat -ano | findstr :5000
```

Stop the matching process from Task Manager, or close the earlier AgroCare terminal.

### Page opens but API data is unavailable

- Confirm the terminal shows the Flask server is running.
- Visit http://127.0.0.1:5000/api/health.
- Verify `backend/requirements.txt` dependencies are installed.
- Check that `database/seed/diseases.json` exists.

### Launcher uses an unavailable Python installation

Use the standard Command Prompt setup in this README with a virtual environment. This is also the recommended option for machines that do not use the exact Python installation referenced by the current batch launcher.

## Image Detection Status

Image uploads are previewed locally in the browser only. Files are not sent to a server. The application intentionally does not report a disease or confidence score until a real detection model or API is connected and verified.
