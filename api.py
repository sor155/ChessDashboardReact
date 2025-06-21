from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import traceback
import libsql_client

# Initialize Flask App
app = Flask(__name__)
CORS(app)

# --- Turso Database Helper Function ---
def get_db_connection():
    """
    Creates a connection to the remote Turso database using environment variables.
    """
    # These are read from the Vercel Environment Variables you set
    url = os.environ.get("TURSO_DATABASE_URL")
    auth_token = os.environ.get("TURSO_AUTH_TOKEN")

    if not url or not auth_token:
        # This will be logged in Vercel if the environment variables are missing
        print("FATAL ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are not set.")
        raise Exception("Turso database URL and Auth Token must be set as environment variables.")
        
    # Force HTTPS for reliability
    if url.startswith("libsql://"):
        url = "https" + url[6:]

    # Connect to the Turso database
    return libsql_client.create_client(url=url, auth_token=auth_token)

# --- API Endpoints ---

@app.route('/api/get-eco', methods=['POST'])
def get_eco():
    """
    Looks up the opening name for a given FEN from the remote Turso database.
    This now queries the 'opening_stats' table as requested.
    """
    print("\n--- /api/get-eco endpoint triggered ---")
    try:
        data = request.get_json()
        fen = data.get('fen')
        if not fen:
            return jsonify({"error": "FEN string is required."}), 400

        client = get_db_connection()
        print("Database connection to Turso successful.")
        
        # **FIX**: Querying from 'opening_stats' table now.
        # Assuming it has 'eco' and 'name' columns for a given 'fen'.
        # If the column names are different, this query will need to be adjusted.
        print(f"Querying 'opening_stats' for FEN: {fen}")
        rs = client.execute("SELECT eco, name FROM opening_stats WHERE fen = ?", [fen])
        
        if len(rs.rows) > 0:
            opening = rs.rows[0]
            eco = opening["eco"]
            name = opening["name"]
            print(f"Opening found: {eco} - {name}")
            return jsonify({"eco": eco, "name": name})
        else:
            print("No opening found for this FEN in opening_stats.")
            return jsonify({"eco": "N/A", "name": "No opening found."})

    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/get-eco: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred. Check Vercel function logs."}), 500

# Other endpoints...

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify(message="Chess API is running and configured for Turso!")

# Vercel will run this 'app' object.
