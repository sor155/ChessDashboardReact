import sqlite3
import json
import os
import sys

# This is the directory where your Flask API is located.
API_DIR = "api"
# **FIX**: This now correctly matches the DB name in your update script.
DB_FILE = "chess_ratings.db" 

def export_table_to_json(table_name, query, output_filename, process_func=None):
    """
    Connects to the local SQLite DB, runs a query, and saves the result as a JSON file
    into the specified API directory.
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
    """Calculates the number of losses for each opening stat record."""
    for stat in data:
        games_played = stat.get('games_played', 0)
        white_wins = stat.get('white_wins', 0)
        black_wins = stat.get('black_wins', 0)
        draws = stat.get('draws', 0)
        stat['losses'] = games_played - (white_wins + black_wins + draws)
    return data

if __name__ == "__main__":
    print("--- Starting Data Export to JSON for Vercel API ---")
    
    print("Running local database update script...")
    try:
        # Import the script to make its functions available
        import update_tracker_sqlite
        # Call the correct function from the imported script
        update_tracker_sqlite.run_update()
        print("Local database updated successfully.")
    except Exception as e:
        print(f"ERROR: Failed to run update_tracker_sqlite.py: {e}")
        sys.exit(1)

    # Queries now use the correct column names from the database
    # and rename them (e.g., `friend_name AS player`) for the JSON output
    # so the frontend receives the expected field names.
    export_table_to_json(
        "current_ratings",
        "SELECT friend_name AS player, rapid_rating AS rapid, blitz_rating AS blitz, bullet_rating AS bullet FROM current_ratings",
        "current-ratings.json"
    )
    
    export_table_to_json(
        "rating_history",
        # **FIX**: Selects from the 'timestamp' column and renames it to 'date'
        "SELECT player_name AS player, category, rating, timestamp AS date FROM rating_history",
        "rating-history.json"
    )

    export_table_to_json(
        "opening_stats",
        # Assuming the column name is 'player' based on frontend code.
        # If this fails, we will need to see the script that creates this table.
        "SELECT player, opening_name, games_played, white_wins, black_wins, draws FROM opening_stats",
        "opening-stats.json",
        process_func=process_openings_stats
    )

    print("\n--- Data Export Complete ---")
    print(f"IMPORTANT: Please commit the updated 'generate_json.py' file and the new JSON files inside the '{API_DIR}/' directory to your repository and redeploy.")

