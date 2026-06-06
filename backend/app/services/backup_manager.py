import os
import subprocess
import datetime
import shutil
import zipfile
from app.core.config import settings
from sqlalchemy.engine import make_url

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups")

def ensure_backup_dir():
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

def get_db_params():
    try:
        # Convert any asyncpg URL to standard pg url
        url_str = settings.DATABASE_URL
        if "postgresql+asyncpg" in url_str:
            url_str = url_str.replace("postgresql+asyncpg", "postgresql")
        url = make_url(url_str)
        return url.username, url.password, url.host, url.port, url.database
    except Exception as e:
        print(f"Error parsing DATABASE_URL: {e}")
        return None

def find_pg_tool(tool_name):
    # 1. Search in PATH
    path = shutil.which(tool_name)
    if path:
        return path
    
    # 2. Check standard Linux path
    linux_path = f"/usr/bin/{tool_name}"
    if os.path.exists(linux_path):
        return linux_path
        
    # 3. Check common Windows PostgreSQL installation paths
    if os.name == 'nt':
        program_files = os.environ.get("ProgramFiles", "C:\\Program Files")
        pg_dir = os.path.join(program_files, "PostgreSQL")
        if os.path.exists(pg_dir):
            try:
                versions = sorted(os.listdir(pg_dir), reverse=True)
                for v in versions:
                    bin_path = os.path.join(pg_dir, v, "bin", f"{tool_name}.exe")
                    if os.path.exists(bin_path):
                        return bin_path
            except Exception:
                pass
                
    return tool_name

def create_backup():
    ensure_backup_dir()
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_dir = os.path.join(BACKUP_DIR, f"temp_{timestamp}")
    os.makedirs(temp_dir)
    
    try:
        # 1. Dump Database
        db_params = get_db_params()
        if not db_params:
            return None, "Failed to parse database configuration"
        
        user, password, host, port, dbname = db_params
        port = str(port) if port else "5432"
        sql_file = os.path.join(temp_dir, "database.sql")
        
        # Set environment variable for password to avoid interactive prompt
        os.environ['PGPASSWORD'] = password
        
        tool_path = find_pg_tool("pg_dump")
        dump_cmd = [
            tool_path,
            "-h", str(host),
            "-p", port,
            "-U", str(user),
            "-f", sql_file,
            str(dbname)
        ]
        
        try:
            result = subprocess.run(dump_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                error_msg = result.stderr if result.stderr else "Unknown error"
                print(f"pg_dump error: {error_msg}")
                return None, f"Database backup failed: {error_msg}"
        except FileNotFoundError:
            return None, f"PostgreSQL client utility '{tool_path}' not found."
        
        # 2. Create Final Bundle
        bundle_name = f"orbx_backup_{timestamp}.zip"
        bundle_path = os.path.join(BACKUP_DIR, bundle_name)
        
        with zipfile.ZipFile(bundle_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(sql_file, "database.sql")
            
            # Pack .env if it exists in app root or backend dir
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
            if os.path.exists(env_path):
                zipf.write(env_path, ".env")
            else:
                backend_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
                if os.path.exists(backend_env):
                    zipf.write(backend_env, ".env")
        
        return bundle_name, None
        
    finally:
        # Cleanup temp files
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

def list_backups():
    ensure_backup_dir()
    files = [f for f in os.listdir(BACKUP_DIR) if f.startswith("orbx_backup_") and f.endswith(".zip")]
    backups = []
    for f in files:
        path = os.path.join(BACKUP_DIR, f)
        stat = os.stat(path)
        backups.append({
            "filename": f,
            "size": stat.st_size,
            "created_at": datetime.datetime.fromtimestamp(stat.st_ctime).isoformat()
        })
    return sorted(backups, key=lambda x: x['created_at'], reverse=True)

def delete_old_backups(keep=7):
    backups = list_backups()
    if len(backups) > keep:
        for b in backups[keep:]:
            path = os.path.join(BACKUP_DIR, b['filename'])
            if os.path.exists(path):
                os.remove(path)
