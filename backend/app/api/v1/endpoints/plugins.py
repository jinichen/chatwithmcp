from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
import os
import shutil
import uuid
import json
from datetime import datetime

from app.db.session import get_db
from app.core.config import settings
from app.api.deps import get_current_active_user
from app.schemas.user import User

router = APIRouter()

# 插件模型
class PluginBase(BaseModel):
    name: str
    description: str
    author: str
    version: str
    tags: List[str]


class PluginCreate(PluginBase):
    pass


class PluginResponse(PluginBase):
    id: str
    downloads: int
    isInstalled: bool
    createdAt: str
    updatedAt: str
    repository: Optional[str] = None


class PluginInstallResponse(BaseModel):
    success: bool
    message: Optional[str] = None


class PluginSearchParams(BaseModel):
    query: Optional[str] = None
    sort: Optional[str] = "popular"


# 初始化插件目录
def init_plugin_dirs():
    os.makedirs(os.path.join(settings.PLUGINS_DIR, "store"), exist_ok=True)
    os.makedirs(os.path.join(settings.PLUGINS_DIR, "installed"), exist_ok=True)
    
    # 如果没有 plugins.json，创建一个空的
    store_file = os.path.join(settings.PLUGINS_DIR, "store.json")
    if not os.path.exists(store_file):
        with open(store_file, "w") as f:
            json.dump([], f)
    
    installed_file = os.path.join(settings.PLUGINS_DIR, "installed.json")
    if not os.path.exists(installed_file):
        with open(installed_file, "w") as f:
            json.dump([], f)


# 获取所有插件
def get_all_plugins():
    store_file = os.path.join(settings.PLUGINS_DIR, "store.json")
    try:
        with open(store_file, "r") as f:
            return json.load(f)
    except:
        return []


# 获取已安装插件
def get_installed_plugins():
    """
    获取已安装的MCP插件列表。
    
    注意：已安装的插件会在对话过程中被自动调用。当用户发送消息时，系统将尝试
    调用所有已安装的插件处理该消息。如果插件能够处理该消息，则使用插件的响应，
    否则回退到默认的AI模型生成响应。
    
    每个插件应提供一个API端点 /api/plugin/{plugin_id}/invoke 来处理消息。
    该端点接收以下格式的POST请求：
    {
        "message": "用户消息内容",
        "history": [{"role": "user", "content": "历史消息"}, ...],
        "model": "当前使用的模型ID",
        "user_id": 123 // 当前用户ID
    }
    
    并应返回以下格式的响应：
    {
        "success": true,
        "data": "插件生成的响应文本"
    }
    """
    installed_file = os.path.join(settings.PLUGINS_DIR, "installed.json")
    try:
        with open(installed_file, "r") as f:
            return json.load(f)
    except:
        return []


# 保存插件列表
def save_plugins(plugins):
    store_file = os.path.join(settings.PLUGINS_DIR, "store.json")
    with open(store_file, "w") as f:
        json.dump(plugins, f, indent=2)


# 保存已安装插件列表
def save_installed_plugins(plugins):
    installed_file = os.path.join(settings.PLUGINS_DIR, "installed.json")
    with open(installed_file, "w") as f:
        json.dump(plugins, f, indent=2)


@router.get("/", response_model=Dict[str, Any])
def list_plugins(
    query: Optional[str] = None,
    sort: Optional[str] = "popular",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取所有可用插件
    """
    init_plugin_dirs()
    
    plugins = get_all_plugins()
    installed_ids = [p["id"] for p in get_installed_plugins()]
    
    # 标记已安装的插件
    for plugin in plugins:
        plugin["isInstalled"] = plugin["id"] in installed_ids
    
    # 搜索
    if query:
        query = query.lower()
        plugins = [
            p for p in plugins
            if (
                query in p["name"].lower() or
                query in p["description"].lower() or
                query in p["author"].lower() or
                any(query in tag.lower() for tag in p["tags"])
            )
        ]
    
    # 排序
    if sort == "popular":
        plugins.sort(key=lambda p: p["downloads"], reverse=True)
    elif sort == "newest":
        plugins.sort(key=lambda p: p["createdAt"], reverse=True)
    elif sort == "name":
        plugins.sort(key=lambda p: p["name"])
    elif sort == "downloads":
        plugins.sort(key=lambda p: p["downloads"], reverse=True)
    
    return {"items": plugins, "total": len(plugins)}


@router.get("/installed", response_model=List[PluginResponse])
def list_installed_plugins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取已安装的插件
    """
    init_plugin_dirs()
    return get_installed_plugins()


@router.get("/{plugin_id}", response_model=PluginResponse)
def get_plugin(
    plugin_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取插件详情
    """
    init_plugin_dirs()
    
    # 查找插件
    all_plugins = get_all_plugins()
    plugin = next((p for p in all_plugins if p["id"] == plugin_id), None)
    
    if not plugin:
        installed_plugins = get_installed_plugins()
        plugin = next((p for p in installed_plugins if p["id"] == plugin_id), None)
    
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    
    # 标记安装状态
    installed_ids = [p["id"] for p in get_installed_plugins()]
    plugin["isInstalled"] = plugin["id"] in installed_ids
    
    return plugin


@router.post("/upload", response_model=PluginResponse)
async def upload_plugin(
    name: str = Form(...),
    description: str = Form(...),
    author: str = Form(...),
    version: str = Form(...),
    tags: str = Form(...),
    repository: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    上传新插件
    """
    init_plugin_dirs()
    
    # 验证上传文件
    if not file.filename.endswith((".zip", ".py")):
        raise HTTPException(status_code=400, detail="Invalid plugin format. Only .zip or .py files are allowed")
    
    # 解析tags
    try:
        tag_list = json.loads(tags)
        if not isinstance(tag_list, list):
            tag_list = [tag.strip() for tag in tags.split(",")]
    except:
        tag_list = [tag.strip() for tag in tags.split(",")]
    
    # 创建插件记录
    plugin_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    new_plugin = {
        "id": plugin_id,
        "name": name,
        "description": description,
        "author": author,
        "version": version,
        "tags": tag_list,
        "downloads": 0,
        "isInstalled": False,
        "createdAt": now,
        "updatedAt": now
    }
    
    if repository:
        new_plugin["repository"] = repository
    
    # 保存插件文件
    file_path = os.path.join(settings.PLUGINS_DIR, "store", f"{plugin_id}_{file.filename}")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # 更新插件列表
    plugins = get_all_plugins()
    plugins.append(new_plugin)
    save_plugins(plugins)
    
    return new_plugin


@router.post("/{plugin_id}/install", response_model=PluginInstallResponse)
def install_plugin(
    plugin_id: str,
    from_repository: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    安装插件
    """
    init_plugin_dirs()
    
    # 查找插件
    all_plugins = get_all_plugins()
    plugin = next((p for p in all_plugins if p["id"] == plugin_id), None)
    
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    
    # 检查是否已安装
    installed_plugins = get_installed_plugins()
    if any(p["id"] == plugin_id for p in installed_plugins):
        return {"success": True, "message": "Plugin already installed"}
    
    # 尝试复制插件文件到安装目录
    src_pattern = os.path.join(settings.PLUGINS_DIR, "store", f"{plugin_id}_*")
    import glob
    src_files = glob.glob(src_pattern)
    
    # 如果存在实际文件，则复制；否则创建一个空的占位文件
    if src_files:
        src_file = src_files[0]
        filename = os.path.basename(src_file)
        dest_file = os.path.join(settings.PLUGINS_DIR, "installed", filename)
        
        try:
            shutil.copy2(src_file, dest_file)
        except Exception as e:
            # 记录错误但不中断流程
            print(f"警告: 复制插件文件失败: {str(e)}")
    else:
        # 创建一个空的占位文件，这样未来可以检测到它已被安装
        placeholder_filename = f"{plugin_id}_placeholder.txt"
        dest_file = os.path.join(settings.PLUGINS_DIR, "installed", placeholder_filename)
        try:
            with open(dest_file, 'w') as f:
                f.write(f"Placeholder for plugin: {plugin['name']} (ID: {plugin_id})")
        except Exception as e:
            print(f"警告: 创建占位文件失败: {str(e)}")
    
    # 更新已安装插件列表
    plugin_copy = plugin.copy()
    plugin_copy["isInstalled"] = True
    installed_plugins.append(plugin_copy)
    save_installed_plugins(installed_plugins)
    
    # 更新下载计数
    for p in all_plugins:
        if p["id"] == plugin_id:
            p["downloads"] += 1
            p["updatedAt"] = datetime.now().isoformat()
    save_plugins(all_plugins)
    
    return {"success": True, "message": "Plugin installed successfully"}


@router.delete("/{plugin_id}/uninstall", response_model=PluginInstallResponse)
def uninstall_plugin(
    plugin_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    卸载插件
    """
    init_plugin_dirs()
    
    # 检查是否已安装
    installed_plugins = get_installed_plugins()
    plugin = next((p for p in installed_plugins if p["id"] == plugin_id), None)
    
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not installed")
    
    # 尝试删除插件文件
    pattern = os.path.join(settings.PLUGINS_DIR, "installed", f"{plugin_id}_*")
    import glob
    files = glob.glob(pattern)
    
    # 如果存在文件则删除
    file_deleted = False
    if files:
        for file in files:
            try:
                os.remove(file)
                file_deleted = True
            except Exception as e:
                print(f"警告: 删除插件文件失败: {str(e)}")
    
    # 即使没有找到文件也继续处理
    if not file_deleted:
        print(f"警告: 未找到插件文件: {plugin_id}")
    
    # 更新已安装插件列表
    installed_plugins = [p for p in installed_plugins if p["id"] != plugin_id]
    save_installed_plugins(installed_plugins)
    
    return {"success": True, "message": "Plugin uninstalled successfully"}


@router.get("/repository/search", response_model=List[PluginResponse])
def search_repository(
    repository_url: Optional[str] = None,
    query: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    从仓库搜索插件
    """
    init_plugin_dirs()
    
    # 获取所有插件和已安装插件ID
    all_plugins = get_all_plugins()
    installed_ids = [p["id"] for p in get_installed_plugins()]
    
    # 准备插件列表
    repo_plugins = []
    
    # 特殊情况: 当repository_url为"all"或为空时，返回所有插件
    if not repository_url or repository_url.lower() == "all":
        for plugin in all_plugins:
            plugin_copy = plugin.copy()
            plugin_copy["isInstalled"] = plugin["id"] in installed_ids
            repo_plugins.append(plugin_copy)
    else:
        # 根据仓库URL过滤插件
        for plugin in all_plugins:
            # 检查插件是否有repository字段，并且值匹配
            if "repository" in plugin and plugin["repository"] == repository_url:
                # 复制插件数据并标记安装状态
                plugin_copy = plugin.copy()
                plugin_copy["isInstalled"] = plugin["id"] in installed_ids
                repo_plugins.append(plugin_copy)
    
    # 搜索
    if query:
        query = query.lower()
        repo_plugins = [
            p for p in repo_plugins
            if (
                query in p["name"].lower() or
                query in p["description"].lower() or
                query in p["author"].lower() or
                any(query in tag.lower() for tag in p["tags"])
            )
        ]
    
    return repo_plugins 