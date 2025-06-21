import sqlite3
import os
from dotenv import load_dotenv
import libsql_client
import traceback
import asyncio

# Load environment variables from a .env file
load_dotenv()

def get_table_schema(local_cursor, table_name):
    """Fetches the CREATE TABLE statement for a given table."""
    local_cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'")
    result = local_cursor.fetchone()
    if result:
        # We need to add "IF NOT EXISTS" to the schema for safety
        create_statement = result[0]
        # Ensure the table name is not quoted for the replace to work correctly
        table_name_unquoted = table_name.strip('`"\'')
        return create_statement.replace(f"CREATE TABLE {table_name_unquoted}", f"CREATE TABLE IF NOT EXISTS {table_name_unquoted}", 1)
    else:
        # Return None instead of raising an exception if the table doesn't exist locally
        return None

async def migrate_table(local_cursor, turso_client, table_name):
    """Migrates a single table from the local DB to Turso."""
    print(f"\n--- Migrating '{table_name}' table ---")
    
    # 1. Get the schema from the local DB
    schema = get_table_schema(local_cursor, table_name)
    if not schema:
        print(f"Skipping: Table '{table_name}' not found in local database. Make sure 'openings_ingestor.py' has been run.")
        return
        
    # Create the table in Turso
    await turso_client.execute(schema)
    print(f"'{table_name}' table schema created or verified in Turso.")

    # 2. Fetch all data from the local table
    local_cursor.execute(f"SELECT * FROM {table_name}")
    all_rows = local_cursor.fetchall()
    if not all_rows:
        print(f"No data found in local '{table_name}' table. Nothing to migrate.")
        return
        
    print(f"Fetched {len(all_rows)} rows from local '{table_name}' table.")
    
    # Get column names to construct the INSERT statement
    column_names = [description[0] for description in local_cursor.description]
    
    # 3. Insert data into Turso in batches
    batch_size = 100
    for i in range(0, len(all_rows), batch_size):
        batch = all_rows[i:i + batch_size]
        
        # Prepare statements for the batch insert
        statements = []
        for row in batch:
            placeholders = ', '.join(['?'] * len(column_names))
            sql = f"INSERT OR IGNORE INTO {table_name} ({', '.join(column_names)}) VALUES ({placeholders})"
            statements.append(libsql_client.Statement(sql, list(row)))
            
        await turso_client.batch(statements)
        print(f"Uploaded '{table_name}' batch {i // batch_size + 1}...")
        
    print(f"'{table_name}' table migration complete.")


async def main():
    """
    The main asynchronous function to run the database migration.
    """
    local_db_path = 'chess_ratings.db'
    if not os.path.exists(local_db_path):
        print(f"Error: Local database '{local_db_path}' not found. Please run 'openings_ingestor.py' first.")
        return

    # --- Connect to Turso ---
    turso_url = os.getenv("TURSO_DATABASE_URL")
    turso_token = os.getenv("TURSO_AUTH_TOKEN")
    if not turso_url or not turso_token:
        print("Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in your .env file.")
        return
        
    # **FIX**: Force HTTPS scheme to avoid WebSocket handshake errors
    if turso_url.startswith("libsql://"):
        turso_url = "https" + turso_url[6:]
    print(f"Connecting to Turso via HTTPS: {turso_url}")

    try:
        # Connect to both databases
        local_conn = sqlite3.connect(local_db_path)
        local_cursor = local_conn.cursor()
        print("Connected to local database.")

        async with libsql_client.create_client(url=turso_url, auth_token=turso_token) as client:
            print("Connected to Turso database.")

            # --- List of tables to migrate ---
            tables_to_migrate = ["opening_stats", "current_ratings", "rating_history", "update_tracker"]
            
            for table in tables_to_migrate:
                await migrate_table(local_cursor, client, table)

            local_conn.close()
            print("\nDatabase seeding complete!")

    except Exception as e:
        print(f"A critical error occurred: {e}")
        traceback.print_exc()

if __name__ == '__main__':
    # This correctly runs the main async function
    asyncio.run(main())
