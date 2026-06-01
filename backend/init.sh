#!/bin/bash
# Fail on any errors
set -e

echo "--------------------------------------------------------"
echo "Initializing Database: Migrations & Seeding"
echo "--------------------------------------------------------"

# 1. Run migrations to build the tables
echo "Running Alembic migrations..."
alembic upgrade head

# 2. Run db seeder script
echo "Seeding initial masters, roles, permissions, and admin user..."
PYTHONPATH=. python app/db/init_db.py

echo "Database setup successfully completed!"
