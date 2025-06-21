import sqlite3
import os
import sys

# This should be the name of your local SQLite database file.
DB_FILE = "chess_ratings.db" 

def diagnose():
    """
    Connects to the database, runs the user's update script to ensure tables exist,
    and then prints the schema of all tables found.
    """
    print("--- Running Database Schema Diagnosis ---")
    
    # First, attempt to run the user's update script.
    # This ensures that if the database or tables don't exist, they are created.
    print("\nAttempting to run 'update_tracker_sqlite.py' to build the database...")
    try:
        # We import it to run the code in the file.
        import update_tracker_sqlite
        print("'update_tracker_sqlite.py' executed.")
    except Exception as e:
        print(f"Warning: Could not run 'update_tracker_sqlite.py'. Error: {e}")
        print("Will now attempt to inspect the database file if it already exists.")

    if not os.path.exists(DB_FILE):
        print(f"\nFATAL ERROR: The database file '{DB_FILE}' does not exist.")
        print("Please ensure 'update_tracker_sqlite.py' can run successfully and creates this file.")
        sys.exit(1)

    print(f"\nConnecting to database '{DB_FILE}' to read its schema...")
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
    except Exception as e:
        print(f"FATAL ERROR: Could not connect to the database. Error: {e}")
        sys.exit(1)

    print("\n--- Finding all tables in the database ---")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    if not tables:
        print("No tables were found in the database file.")
    else:
        print(f"Found tables: {[table[0] for table in tables]}")

        print("\n--- Inspecting Schema for Each Table ---")
        for table_name_tuple in tables:
            table_name = table_name_tuple[0]
            print(f"\nSchema for table: '{table_name}':")
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()
            if not columns:
                print("  No columns found.")
            else:
                for column in columns:
                    # column format: (id, name, type, notnull, default_value, pk)
                    print(f"  - Column {column[0]}: '{column[1]}' (Type: {column[2]})")

    conn.close()
    print("\n--- Diagnosis Complete ---")
    print("Please copy the output above and provide it for the final fix.")

if __name__ == "__main__":
    diagnose()
