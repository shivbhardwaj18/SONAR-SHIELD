"""
SQLite Database engine and query helpers for SONAR-SHIELD.
"""

import sqlite3
import os
import json
from contextlib import contextmanager
from typing import Generator

DB_PATH = os.environ.get("SONAR_DB_PATH", os.path.join(os.path.dirname(__file__), "sonar_shield.db"))


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables and indexes."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Surveys Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS surveys (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            total_images INTEGER DEFAULT 0,
            status TEXT DEFAULT 'ready',
            is_demo INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            metadata TEXT
        )
        """)

        # Images Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS images (
            id TEXT PRIMARY KEY,
            survey_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            channels INTEGER DEFAULT 3,
            file_size_kb REAL NOT NULL,
            frame_id TEXT NOT NULL,
            simulated_lat REAL NOT NULL,
            simulated_lon REAL NOT NULL,
            is_simulated_coords INTEGER DEFAULT 1,
            is_demo INTEGER DEFAULT 0,
            has_labels INTEGER DEFAULT 0,
            label_path TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (survey_id) REFERENCES surveys (id) ON DELETE CASCADE
        )
        """)

        # Detections Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS detections (
            id TEXT PRIMARY KEY,
            image_id TEXT NOT NULL,
            survey_id TEXT NOT NULL,
            class_id INTEGER NOT NULL,
            class_name TEXT NOT NULL,
            confidence REAL NOT NULL,
            bbox_x1 REAL NOT NULL,
            bbox_y1 REAL NOT NULL,
            bbox_x2 REAL NOT NULL,
            bbox_y2 REAL NOT NULL,
            shape_score REAL,
            shadow_score REAL,
            context_score REAL,
            artificiality_score REAL,
            status TEXT DEFAULT 'CANDIDATE',
            review_status TEXT DEFAULT 'PENDING',
            operator_notes TEXT,
            simulated_lat REAL NOT NULL,
            simulated_lon REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
            FOREIGN KEY (survey_id) REFERENCES surveys (id) ON DELETE CASCADE
        )
        """)

        # Hotspots Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS hotspots (
            id TEXT PRIMARY KEY,
            survey_id TEXT NOT NULL,
            center_lat REAL NOT NULL,
            center_lon REAL NOT NULL,
            detection_count INTEGER NOT NULL,
            dominant_class TEXT NOT NULL,
            estimated_area_m2 REAL NOT NULL,
            avg_artificiality REAL NOT NULL,
            bio_threat_score REAL NOT NULL,
            bio_threat_level TEXT NOT NULL,
            cleanup_priority_score REAL NOT NULL,
            cleanup_priority_level TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (survey_id) REFERENCES surveys (id) ON DELETE CASCADE
        )
        """)

        # Indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_images_survey ON images (survey_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_detections_image ON detections (image_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_detections_survey ON detections (survey_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hotspots_survey ON hotspots (survey_id)")


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
