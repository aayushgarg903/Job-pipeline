import os
import psycopg2
from dotenv import load_dotenv

def apply_migrations():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found!")
        return

    print("Connecting to Supabase...")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()

        # Run 02_sprint1_migration.sql
        print("Applying 02_sprint1_migration.sql...")
        with open("db/02_sprint1_migration.sql", "r", encoding="utf-8") as f:
            cur.execute(f.read())
        print("[OK] Sprint 1 Migration applied!")

        # Run 03_fix_jsearch_ids.sql
        print("Applying 03_fix_jsearch_ids.sql...")
        with open("db/03_fix_jsearch_ids.sql", "r", encoding="utf-8") as f:
            cur.execute(f.read())
        print("[OK] JSearch fix applied!")

        conn.close()
        print("All migrations completed successfully.")
    except Exception as e:
        print(f"[ERROR] Error applying migrations: {e}")

if __name__ == "__main__":
    apply_migrations()
