import sqlite3
import json
import os
import sys

# --- Configuration ---
API_DIR = "api"
DB_FILE = "chess_ratings.db" 

# This maps the Chess.com usernames in 'opening_stats' to the display names used elsewhere.
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
    This function processes the opening stats to match the frontend's expectations.
    It pivots the data from being color-specific to being aggregated per opening,
    and maps the username to the friend's display name.
    """
    # The frontend expects a 'player' key with the friend's name, not the username.
    # It also expects wins to be broken down by color.
    # The original query has already aggregated the data, so now we just rename the key.
    for row in data:
        username = row.get("player_username")
        if username in USERNAME_TO_NAME_MAP:
            row["player"] = USERNAME_TO_NAME_MAP[username]
        else:
            row["player"] = username # Fallback
    return data

if __name__ == "__main__":
    print("--- Starting Data Export to JSON for Vercel API ---")
    
    # Run the user's script to update the local SQLite database first.
    print("Running local database update script...")
    try:
        import update_tracker_sqlite
        update_tracker_sqlite.run_update()
        print("Local database updated successfully.")
    except Exception as e:
        print(f"ERROR: Failed to run update_tracker_sqlite.py: {e}")
        sys.exit(1)

    # --- Generate JSON Files ---

    # Export current ratings, renaming columns to match frontend
    export_table_to_json(
        "SELECT friend_name AS player, rapid_rating AS rapid, blitz_rating AS blitz, bullet_rating AS bullet FROM current_ratings",
        "current-ratings.json"
    )
    
    # Export rating history, renaming columns to match frontend
    export_table_to_json(
        "SELECT player_name AS player, category, rating, timestamp AS date FROM rating_history",
        "rating-history.json"
    )

    # Export and process opening stats
    export_table_to_json(
        """
        SELECT
          player_username,
          opening_name,
          SUM(games_played) AS games_played,
          SUM(CASE WHEN color = 'white' THEN wins ELSE 0 END) AS white_wins,
          SUM(CASE WHEN color = 'black' THEN wins ELSE 0 END) AS black_wins,
          SUM(draws) AS draws,
          SUM(losses) AS losses
        FROM
          opening_stats
        GROUP BY
          player_username,
          opening_name
        """,
        "opening-stats.json",
        process_func=process_openings_stats
    )

    print("\n--- Data Export Complete ---")
