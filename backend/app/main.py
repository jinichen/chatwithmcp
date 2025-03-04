import sys
import logging

# 修复bcrypt版本问题的猴子补丁
try:
    import bcrypt
    if not hasattr(bcrypt, '__about__'):
        # 创建__about__模块作为补丁
        class About:
            __version__ = bcrypt.__version__
        setattr(bcrypt, '__about__', About)
        print("Applied bcrypt patch")
except (ImportError, AttributeError) as e:
    logging.warning(f"Failed to apply bcrypt patch: {e}")

from fastapi import FastAPI, Depends, Form, HTTPException, Request
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
import traceback

from app.api.v1.api import api_router
from app.core.config import settings
from app.db.session import SessionLocal
from app import models, crud
from app.core.security import verify_password, get_password_hash
from app.core import security

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # 允许前端来源
    allow_credentials=True,  # 允许携带凭证
    allow_methods=["*"],     # 允许所有 HTTP 方法
    allow_headers=["*"],     # 允许所有 HTTP 头
)

# 添加全局异常处理中间件
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        # 获取异常信息
        error_detail = str(e)
        traceback_str = traceback.format_exc()
        
        # 记录异常
        print(f"[ERROR] Request to {request.url.path} failed:")
        print(error_detail)
        print(traceback_str)
        
        # 对于登录API和用户相关API路径特别处理
        if request.url.path == "/api/v1/auth/login" or request.url.path == "/api/v1/auth/me":
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "API请求过程中发生内部错误",
                    "error": error_detail,
                    "traceback": traceback_str.split("\n")
                }
            )
        
        # 默认异常响应
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"}
        )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/debug/db")
async def debug_db(db: Session = Depends(get_db)):
    """Debug database connection"""
    try:
        # 测试数据库连接
        result = db.execute(text("SELECT 1")).fetchone()
        
        # 简单查询用户表，不使用关系
        users_data = []
        try:
            # 直接使用SQL查询用户表
            users_result = db.execute(text("SELECT id, email, username FROM users")).fetchall()
            users_data = [{"id": user[0], "email": user[1], "username": user[2]} for user in users_result]
        except Exception as e:
            users_data = [{"error": str(e)}]
            
        # 检查表结构
        tables_info = []
        try:
            tables = db.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)).fetchall()
            tables_info = [table[0] for table in tables]
        except Exception as e:
            tables_info = [{"error": str(e)}]
            
        return {
            "database_connection": "success" if result[0] == 1 else "failure",
            "tables": tables_info,
            "users_count": len(users_data),
            "users": users_data
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/debug/login")
async def debug_login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Debug login endpoint"""
    try:
        # 尝试查询用户
        user_result = db.execute(
            text("SELECT id, email, username, hashed_password FROM users WHERE email = :email"),
            {"email": email}
        ).fetchone()
        
        if not user_result:
            raise HTTPException(status_code=400, detail="用户不存在")
        
        user_data = {
            "id": user_result[0],
            "email": user_result[1],
            "username": user_result[2],
            "hashed_password": user_result[3]
        }
        
        # 验证密码
        is_password_correct = verify_password(password, user_data["hashed_password"])
        
        return {
            "user_found": True,
            "password_correct": is_password_correct,
            "user": {
                "id": user_data["id"],
                "email": user_data["email"],
                "username": user_data["username"]
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        return {"error": str(e)}

@app.post("/debug/create-user")
async def debug_create_user(
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Debug create user endpoint"""
    try:
        # 检查用户是否已存在
        existing_user = db.execute(
            text("SELECT id FROM users WHERE email = :email OR username = :username"),
            {"email": email, "username": username}
        ).fetchone()
        
        if existing_user:
            raise HTTPException(status_code=400, detail="用户已存在")
        
        # 创建新用户
        hashed_password = get_password_hash(password)
        
        # 插入新用户
        result = db.execute(
            text("""
                INSERT INTO users (email, username, hashed_password, is_active, is_superuser) 
                VALUES (:email, :username, :hashed_password, true, false)
                RETURNING id
            """),
            {
                "email": email,
                "username": username,
                "hashed_password": hashed_password
            }
        )
        db.commit()
        
        # 获取新用户ID
        user_id = result.fetchone()[0]
        
        return {
            "success": True,
            "user": {
                "id": user_id,
                "email": email,
                "username": username
            }
        }
    except HTTPException as e:
        db.rollback()
        raise e
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

@app.post("/debug/full-login")
async def debug_full_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """测试完整登录流程，包括令牌生成"""
    try:
        # 使用原始SQL查询用户
        user_result = db.execute(
            text("SELECT id, email, username, hashed_password, is_active, is_superuser FROM users WHERE email = :email"),
            {"email": form_data.username}  # OAuth2表单中username字段用于email
        ).fetchone()
        
        if not user_result:
            return {"error": "未找到用户", "username_provided": form_data.username}
        
        user_data = {
            "id": user_result[0],
            "email": user_result[1],
            "username": user_result[2],
            "hashed_password": user_result[3],
            "is_active": user_result[4],
            "is_superuser": user_result[5]
        }
        
        # 验证密码
        is_password_correct = verify_password(form_data.password, user_data["hashed_password"])
        if not is_password_correct:
            return {"error": "密码不正确"}
        
        if not user_data["is_active"]:
            return {"error": "用户未激活"}
        
        # 创建访问令牌
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = security.create_access_token(
            subject=user_data["email"],
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user_data["id"], 
                "email": user_data["email"],
                "username": user_data["username"]
            }
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/orm-test")
async def debug_orm_test(
    email: str,
    db: Session = Depends(get_db)
):
    """测试ORM查询"""
    try:
        # 尝试使用ORM查询用户
        user = None
        orm_error = None
        try:
            user = db.query(models.User).filter(models.User.email == email).first()
        except Exception as e:
            orm_error = str(e)
        
        # 尝试使用crud查询
        crud_user = None
        crud_error = None
        try:
            crud_user = crud.user.get_by_email(db, email=email)
        except Exception as e:
            crud_error = str(e)
        
        # 使用原始SQL查询（作为参考）
        sql_user = None
        sql_error = None
        try:
            result = db.execute(
                text("SELECT id, email, username FROM users WHERE email = :email"),
                {"email": email}
            ).fetchone()
            
            if result:
                sql_user = {
                    "id": result[0],
                    "email": result[1],
                    "username": result[2]
                }
        except Exception as e:
            sql_error = str(e)
            
        return {
            "orm_query": {
                "success": user is not None,
                "error": orm_error,
                "user": {
                    "id": user.id if user else None,
                    "email": user.email if user else None,
                    "username": user.username if user else None
                } if user else None
            },
            "crud_query": {
                "success": crud_user is not None,
                "error": crud_error,
                "user": {
                    "id": crud_user.id if crud_user else None,
                    "email": crud_user.email if crud_user else None,
                    "username": crud_user.username if crud_user else None
                } if crud_user else None
            },
            "sql_query": {
                "success": sql_user is not None,
                "error": sql_error,
                "user": sql_user
            }
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/current-user")
async def debug_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """调试 get_current_user 功能"""
    try:
        # 获取授权头
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return {"error": "无效的授权头"}
        
        token = auth_header.replace("Bearer ", "")
        
        # 手动解析 JWT
        try:
            from jose import jwt
            from app.core.config import settings
            from app.core.security import ALGORITHM
            
            # 解码 JWT
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[ALGORITHM]
            )
            
            # 获取用户 ID
            user_id = payload.get("sub")
            if not user_id:
                return {"error": "令牌中没有用户 ID", "payload": payload}
            
            # 尝试以不同方式查询用户
            user_by_id = None
            id_error = None
            try:
                # 1. 直接通过 ID 查询
                user_by_id = db.query(models.User).filter(models.User.id == user_id).first()
            except Exception as e:
                id_error = str(e)
            
            # 2. 使用 CRUD 功能查询
            crud_user = None
            crud_error = None
            try:
                crud_user = crud.user.get(db, id=user_id)
            except Exception as e:
                crud_error = str(e)
            
            # 3. 使用原始 SQL
            sql_user = None
            sql_error = None
            try:
                result = db.execute(
                    text("SELECT id, email, username FROM users WHERE id = :id"),
                    {"id": user_id}
                ).fetchone()
                
                if result:
                    sql_user = {
                        "id": result[0],
                        "email": result[1],
                        "username": result[2]
                    }
            except Exception as e:
                sql_error = str(e)
            
            return {
                "token_payload": payload,
                "user_id": user_id,
                "orm_query": {
                    "success": user_by_id is not None,
                    "error": id_error,
                    "user": {
                        "id": user_by_id.id if user_by_id else None,
                        "email": user_by_id.email if user_by_id else None,
                        "username": user_by_id.username if user_by_id else None
                    } if user_by_id else None
                },
                "crud_query": {
                    "success": crud_user is not None,
                    "error": crud_error,
                    "user": {
                        "id": crud_user.id if crud_user else None,
                        "email": crud_user.email if crud_user else None,
                        "username": crud_user.username if crud_user else None
                    } if crud_user else None
                },
                "sql_query": {
                    "success": sql_user is not None,
                    "error": sql_error,
                    "user": sql_user
                }
            }
        except Exception as e:
            return {"error": f"JWT 解析错误: {str(e)}"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/debug/official-login")
async def debug_official_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """测试更接近官方API实现的登录流程"""
    try:
        # 使用ORM查询用户
        user = db.query(models.User).filter(models.User.email == form_data.username).first()
        
        if not user:
            return {"error": "未找到用户", "username_provided": form_data.username}
        
        # 验证密码
        is_password_correct = verify_password(form_data.password, user.hashed_password)
        if not is_password_correct:
            return {"error": "密码不正确"}
        
        if not user.is_active:
            return {"error": "用户未激活"}
        
        # 创建访问令牌 - 使用user.id作为subject，与官方实现一致
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = security.create_access_token(
            subject=user.id,  # 使用用户ID而不是邮箱
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id, 
                "email": user.email,
                "username": user.username
            }
        }
    except Exception as e:
        return {"error": str(e), "traceback": f"{e.__class__.__name__}: {str(e)}"}

@app.post("/api/v1/fixed-login")
async def fixed_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """修复版的官方登录API路由"""
    try:
        # 使用ORM查询用户
        user = db.query(models.User).filter(models.User.email == form_data.username).first()
        
        if not user:
            raise HTTPException(status_code=400, detail="Incorrect email or password")
        
        # 验证密码
        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Incorrect email or password")
        
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        
        # 创建访问令牌
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # 注意: 这里使用user.id而不是user.email作为subject，这与官方API的实现一致
        access_token = security.create_access_token(
            subject=user.id,
            expires_delta=access_token_expires
        )
        
        # 返回与Token模型一致的响应
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 转换为秒
            "refresh_token": "dummy_refresh_token"  # 目前系统不支持刷新令牌，但需要满足模型要求
        }
    except Exception as e:
        # 记录异常但返回标准错误
        print(f"Login error: {e.__class__.__name__}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during login process"
        )

@app.get("/debug/user-serialize/{user_id}")
async def debug_user_serialize(
    user_id: int,
    db: Session = Depends(get_db)
):
    """调试用户序列化"""
    try:
        # 直接使用ID查询用户
        user = db.query(models.User).filter(models.User.id == user_id).first()
        
        if not user:
            return {"error": f"用户ID {user_id} 不存在"}
        
        # 尝试将用户数据转换为字典
        try:
            from fastapi.encoders import jsonable_encoder
            user_dict = jsonable_encoder(user)
            return {
                "serialization": "success",
                "user": user_dict,
                "model_fields": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "is_active": user.is_active,
                    "is_superuser": user.is_superuser,
                    "preferences": user.preferences,
                    "created_at": str(user.created_at) if user.created_at else None,
                    "updated_at": str(user.updated_at) if user.updated_at else None
                }
            }
        except Exception as e:
            return {
                "serialization": "failed",
                "error": str(e),
                "model_fields": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "is_active": user.is_active,
                    "is_superuser": user.is_superuser
                }
            }
    except Exception as e:
        return {"error": str(e)} 