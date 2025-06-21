import sqlite3
import json
import os
import sys

# --- Configuration ---
API_DIR = "api"
DB_FILE = "chess_ratings.db" 

# Maps usernames to the display names used elsewhere
USERNAME_TO_NAME_MAP = {
    "realulysse": "Ulysse",
    "poulet_tao": "Simon",
    "adrienbourque": "Adrien",
    "naatiry": "Alex",
    "kevor24": "Kevin",
}

def export_table_to_json(query, output_filename, process_func=None):
    """
    Connects to the local SQLite DB, runs a query, and saves the result as a JSON file.
    """
    if not os.path.exists(DB_FILE):
        print(f"ERROR: Database file '{DB_FILE}' not found.")
        sys.exit(1)

    print(f"Connecting to database '{DB_FILE}'...")
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print(f"Querying data for '{output_filename}'...")
    cursor.execute(query)
    data = [dict(row) for row in cursor.fetchall()]

    if process_func:
        data = process_func(data)

    conn.close()

    os.makedirs(API_DIR, exist_ok=True)
    output_path = os.path.join(API_DIR, output_filename)
    
    print(f"Saving {len(data)} records to '{output_path}'...")
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Successfully created '{output_path}'.")

def process_openings_stats(data):
    """
    Processes the opening stats to match the frontend's expectations by adding
    a 'player' field based on the username.
    """
    for row in data:
        username = row.get("player_username")
        if username in USERNAME_TO_NAME_MAP:
            row["player"] = USERNAME_TO_NAME_MAP[username]
        else:
            row["player"] = username # Fallback
    return data

if __name__ == "__main__":
    print("--- Starting Data Export to JSON for Vercel API ---")
    
    print("Running local database update script...")
    try:
        import update_tracker_sqlite
        update_tracker_sqlite.run_update()
        print("Local database updated successfully.")
    except Exception as e:
        print(f"ERROR: Failed to run update_tracker_sqlite.py: {e}")
        sys.exit(1)

    # --- Generate JSON Files using correct schema ---

    export_table_to_json(
        "SELECT friend_name AS player, rapid_rating AS rapid, blitz_rating AS blitz, bullet_rating AS bullet FROM current_ratings",
        "current-ratings.json"
    )
    
    export_table_to_json(
        "SELECT player_name AS player, category, rating, timestamp AS date FROM rating_history",
        "rating-history.json"
    )

    export_table_to_json(
        """
        SELECT
          player_username,
          opening_name,
          color,  -- Added 'color' to select to distinguish White and Black games
          SUM(games_played) AS games_played,
          SUM(wins) AS wins,   -- Sum wins directly, as 'color' is now a grouping key
          SUM(losses) AS losses,
          SUM(draws) AS draws
        FROM
          opening_stats
        GROUP BY
          player_username,
          opening_name,
          color -- Group by 'color' to get separate entries for White and Black
        ORDER BY
          player_username, games_played DESC
        """,
        "opening-stats.json",
        process_func=process_openings_stats
    )

    print("\n--- Data Export Complete ---")