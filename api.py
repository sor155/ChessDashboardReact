from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import traceback
import requests # Using the standard requests library
from datetime import datetime

# Initialize Flask App
app = Flask(__name__)
CORS(app)

def execute_turso_query(sql_statement, params=()):
    """
    Executes a single SQL query against the Turso database using its HTTP API.
    This is a synchronous function that avoids asyncio issues.
    """
    url = os.environ.get("TURSO_URL")
    auth_token = os.environ.get("TURSO_AUTH_TOKEN")

    if not url or not auth_token:
        print("FATAL ERROR: Database credentials not found in environment variables.")
        raise Exception("Database credentials (TURSO_URL, TURSO_AUTH_TOKEN) not found.")

    # The Turso HTTP API endpoint is the database URL itself, converted to https.
    if url.startswith("libsql://"):
        http_url = "https" + url[6:]
    else:
        http_url = url
        
    # The API endpoint for making queries is the base URL.
    # It requires a POST request with the statements.
    
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }
    
    # The body of the request contains the SQL statements to execute.
    payload = {
      "statements": [
        {"q": sql_statement, "params": params}
      ]
    }
    
    try:
        response = requests.post(http_url, headers=headers, json=payload)
        response.raise_for_status() # Raise an exception for HTTP errors (like 4xx or 5xx)
        
        results = response.json()
        
        # The result for the first (and only) statement is at index 0
        query_result = results[0]
        
        if "error" in query_result:
            raise Exception(f"Database query error: {query_result['error']['message']}")
            
        # Reconstruct a list of dictionaries, which is what the frontend expects
        columns = [col.get("name") for col in query_result.get("cols", [])]
        data = [dict(zip(columns, row)) for row in query_result.get("rows", [])]
        
        return data
    except requests.exceptions.RequestException as e:
        print(f"!!! HTTP Request FAILED: {e}")
        raise # Re-raise the exception to be caught by the main handler
    except Exception as e:
        print(f"!!! Data processing FAILED: {e}")
        raise # Re-raise the exception

# --- API Endpoints (Now using the stable HTTP API) ---

@app.route('/api/current-ratings', methods=['GET'])
def get_current_ratings():
    print("\n--- /api/current-ratings endpoint triggered ---")
    try:
        ratings = execute_turso_query("SELECT player, rapid, blitz, bullet FROM current_ratings")
        print(f"Successfully fetched {len(ratings)} current ratings.")
        return jsonify(ratings)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/current-ratings: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/rating-history', methods=['GET'])
def get_rating_history():
    print("\n--- /api/rating-history endpoint triggered ---")
    try:
        history = execute_turso_query("SELECT player, category, rating, date FROM rating_history")
        print(f"Successfully fetched {len(history)} rating history records.")
        return jsonify(history)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/rating-history: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/opening-stats', methods=['GET'])
def get_opening_stats():
    print("\n--- /api/opening-stats endpoint triggered ---")
    try:
        stats = execute_turso_query("SELECT player, opening_name, games_played, white_wins, black_wins, draws FROM opening_stats")
        for stat in stats:
            games_played = stat.get('games_played', 0)
            white_wins = stat.get('white_wins', 0)
            black_wins = stat.get('black_wins', 0)
            draws = stat.get('draws', 0)
            stat['losses'] = games_played - (white_wins + black_wins + draws)
        print(f"Successfully fetched and processed {len(stats)} opening stat records.")
        return jsonify(stats)
    except Exception as e:
        print(f"!!! UNHANDLED EXCEPTION in /api/opening-stats: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify(message="Chess API is running in stable HTTP mode.")

# Vercel will run this 'app' object.
