import os
import platform
import shutil
import socket
import threading
import subprocess
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)

import httpx
from fastapi import FastAPI, Request, Response
from starlette.middleware.cors import CORSMiddleware

# Thin gateway: the real API is the Java Spring Boot service in /app/backend-java
JAVA_PORT = int(os.environ["JAVA_PORT"])
JAVA_JAR = os.environ["JAVA_JAR"]
HOP = {"host", "content-length", "connection", "transfer-encoding", "content-encoding"}

app = FastAPI()
client = httpx.AsyncClient(base_url=f"http://localhost:{JAVA_PORT}", timeout=120)


def java_up() -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("localhost", JAVA_PORT)) == 0


def ensure_jdk() -> str:
    home = os.environ["JAVA_HOME_DIR"]
    if os.path.exists(f"{home}/bin/javac"):
        return home
    if shutil.which("javac"):
        return str(Path(shutil.which("javac")).resolve().parent.parent)
    arch = "aarch64" if platform.machine() in ("aarch64", "arm64") else "x64"
    url = f"https://api.adoptium.net/v3/binary/latest/17/ga/linux/{arch}/jdk/hotspot/normal/eclipse"
    tmp = "/tmp/jdk17.tar.gz"
    subprocess.run(["curl", "-sSL", "-o", tmp, url], check=True)
    os.makedirs(home, exist_ok=True)
    subprocess.run(["tar", "-xzf", tmp, "-C", home, "--strip-components=1"], check=True)
    return home


def launch_java():
    home = ensure_jdk()
    env = os.environ.copy()
    env["JAVA_HOME"] = home
    env["PATH"] = f"{home}/bin:" + env.get("PATH", "")
    log = open("/var/log/supervisor/java-backend.log", "a")
    subprocess.Popen([f"{home}/bin/java", "-Xmx512m", "-jar", JAVA_JAR], env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)


@app.on_event("startup")
async def start_java():
    if not java_up():
        threading.Thread(target=launch_java, daemon=True).start()


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    try:
        r = await client.request(request.method, f"/api/{path}", params=request.query_params, content=await request.body(), headers=headers)
    except httpx.ConnectError:
        return Response('{"message":"Java backend is starting, retry in a few seconds"}', status_code=503, media_type="application/json")
    return Response(r.content, status_code=r.status_code, headers={k: v for k, v in r.headers.items() if k.lower() not in HOP})


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
