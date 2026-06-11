from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status, BackgroundTasks, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.admin import (
    CompanyOut, CompanyUpdate, BranchOut, BranchCreate, BranchUpdate,
    RoleOut, RoleCreate, RoleUpdate
)
from app.schemas.auth import UserOut, UserCreate, UserUpdate
from app.services.admin_service import AdminService

router = APIRouter()


# ==========================================
# COMPANY ENDPOINTS
# ==========================================
@router.get("/company", response_model=CompanyOut)
async def get_company(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """Fetch company profile configuration."""
    return await AdminService.get_company(db)


@router.put("/company", response_model=CompanyOut)
async def update_company(
    company_data: CompanyUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Update company details."""
    return await AdminService.update_company(db, company_data)


@router.post("/company/logo", response_model=CompanyOut)
async def upload_company_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Upload a logo image file for the company."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")
    
    import shutil
    import os
    
    extension = os.path.splitext(file.filename)[1]
    filename = f"company_logo{extension}"
    save_dir = "static/logos"
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    logo_url = f"/api/v1/static/logos/{filename}"
    
    company = await AdminService.get_company(db)
    company.logo = logo_url
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company



# ==========================================
# BRANCHES ENDPOINTS
# ==========================================
@router.get("/branches", response_model=List[BranchOut])
async def list_branches(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """List all operating branches."""
    return await AdminService.list_branches(db)


@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch_data: BranchCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "create"))
):
    """Create a new branch."""
    return await AdminService.create_branch(db, branch_data)


@router.put("/branches/{branch_id}", response_model=BranchOut)
async def update_branch(
    branch_id: UUID,
    branch_data: BranchUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Update an existing branch configuration or invoice sequence."""
    return await AdminService.update_branch(db, branch_id, branch_data)


# ==========================================
# ROLES ENDPOINTS
# ==========================================
@router.get("/roles", response_model=List[RoleOut])
async def list_roles(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """List all user roles and permissions."""
    return await AdminService.list_roles(db)


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "create"))
):
    """Create a new user role with a permission matrix."""
    return await AdminService.create_role(db, role_data)


@router.put("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: UUID,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Update a role and its permission checklist."""
    return await AdminService.update_role(db, role_id, role_data)


# ==========================================
# USER MANAGEMENT ENDPOINTS
# ==========================================
@router.get("/users", response_model=List[UserOut])
async def list_users(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """List all system user profiles."""
    return await AdminService.list_users(db)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "create"))
):
    """Create a new user account."""
    return await AdminService.create_user(db, user_data)


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Update a user's details, active status, branch mapping, or password."""
    return await AdminService.update_user(db, user_id, user_data)


# ==========================================
# BACKUP & RESTORE ENDPOINTS
# ==========================================
def run_restore_in_background(temp_zip: str, temp_extract: str):
    import shutil
    import zipfile
    import subprocess
    import os
    from app.services.backup_manager import get_db_params, find_pg_tool
    from app.db.session import engine

    print("[BackgroundRestore] Starting recovery job...")
    try:
        # Ensure temp_extract is clean before extraction
        if os.path.exists(temp_extract):
            try:
                shutil.rmtree(temp_extract)
            except Exception as re:
                print(f"[BackgroundRestore] Could not remove old temp extract path: {re}")
        os.makedirs(temp_extract, exist_ok=True)

        # 1. Extract the bundle
        with zipfile.ZipFile(temp_zip, 'r') as zipf:
            zipf.extractall(temp_extract)
        print("[BackgroundRestore] Bundle extracted successfully.")
        
        # 2. Restore Database
        sql_file = os.path.join(temp_extract, "database.sql")
        if os.path.exists(sql_file):
            db_params = get_db_params()
            if db_params:
                user, password, host, port, dbname = db_params
                os.environ['PGPASSWORD'] = password
                
                tool_path = find_pg_tool("psql")
                restore_cmd = [
                    tool_path,
                    "-h", str(host),
                    "-p", str(port) if port else "5432",
                    "-U", str(user),
                    "-d", str(dbname),
                    "-f", sql_file
                ]
                
                # Dispose engine pool
                try:
                    engine.sync_engine.dispose()
                    print("[BackgroundRestore] Disposed SQLAlchemy connection pool.")
                except Exception as de:
                    print(f"[BackgroundRestore] Error disposing engine pool: {de}")
                
                # Clear all existing tables by dropping and recreating public schema
                reset_cmd = [
                    tool_path,
                    "-h", str(host),
                    "-p", str(port) if port else "5432",
                    "-U", str(user),
                    "-d", str(dbname),
                    "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
                ]
                print("[BackgroundRestore] Wiping existing public schema before recovery...")
                reset_res = subprocess.run(reset_cmd, capture_output=True, text=True)
                if reset_res.returncode != 0:
                    print(f"[BackgroundRestore] Warning: Schema wipe output: {reset_res.stderr}")
                else:
                    print("[BackgroundRestore] Database schema successfully wiped.")
                
                print("[BackgroundRestore] Executing psql restore process...")
                result = subprocess.run(restore_cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    print(f"[BackgroundRestore] psql error output: {result.stderr}")
                else:
                    print("[BackgroundRestore] Database restore completed successfully.")
            else:
                print("[BackgroundRestore] Database configuration details could not be parsed.")
        
        # 3. Restore .env
        env_backup_path = os.path.join(temp_extract, ".env")
        if os.path.exists(env_backup_path):
            target_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env")
            try:
                shutil.copy(env_backup_path, target_env)
                print("[BackgroundRestore] .env environment variables restored.")
            except Exception as ee:
                print(f"[BackgroundRestore] Could not copy .env file: {ee}")
                
        print("[BackgroundRestore] System recovery completed successfully.")
        
    except Exception as e:
        import traceback
        print(f"[BackgroundRestore] CRITICAL RECOVERY FAILURE:\n{traceback.format_exc()}")
    finally:
        try:
            if os.path.exists(temp_zip): os.remove(temp_zip)
        except Exception: pass
        try:
            if os.path.exists(temp_extract): shutil.rmtree(temp_extract)
        except Exception: pass
        print("[BackgroundRestore] Background cleanup done.")


@router.get("/backups")
def get_backups(current_user = Depends(deps.PermissionChecker("admin", "view"))):
    """Retrieve lists of database backup files."""
    from app.services.backup_manager import list_backups
    return list_backups()


@router.post("/backups/generate")
def generate_backup(current_user = Depends(deps.PermissionChecker("admin", "edit"))):
    """Manually generate a snapshot ZIP archive of the PostgreSQL database."""
    from app.services.backup_manager import create_backup, delete_old_backups
    try:
        name, err = create_backup()
        if err:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=err)
        delete_old_backups()
        return {"message": "Backup created successfully", "filename": name}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to generate backup: {str(e)}")


@router.get("/backups/{filename}/download")
def download_backup(filename: str, current_user = Depends(deps.PermissionChecker("admin", "view"))):
    """Download a generated backup snapshot ZIP file."""
    import os
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from app.services.backup_manager import BACKUP_DIR

    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Backup file not found")
    
    return FileResponse(path, filename=filename, media_type='application/zip')


@router.post("/backups/restore")
async def restore_backup(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Upload a backup snapshot ZIP file to restore the database in the background."""
    import os
    import shutil
    from fastapi import HTTPException
    from app.services.backup_manager import ensure_backup_dir, BACKUP_DIR

    ensure_backup_dir()
    temp_zip = os.path.join(BACKUP_DIR, "temp_restore.zip")
    temp_extract = os.path.join(BACKUP_DIR, "temp_extract")
    
    try:
        # Save the uploaded file temporarily (sync copy)
        with open(temp_zip, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Spawn the restore execution in the background
        background_tasks.add_task(run_restore_in_background, temp_zip, temp_extract)
        
        return {"message": "Restore started successfully in the background. Systems and files are being recovered."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate restore: {str(e)}")

