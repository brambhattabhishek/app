import os
import socket
import subprocess
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import httpx
from fastapi import FastAPI, Request, Response
from starlette.middleware.cors import CORSMiddleware

# Thin gateway: the real API is the Java Spring Boot service in /app/backend-java
JAVA_PORT = int(os.environ["JAVA_PORT"])
JAVA_JAR = os.environ["JAVA_JAR"]
HOP = {"host", "content-length", "connection", "transfer-encoding", "content-encoding"}

app = FastAPI()
client = httpx.AsyncClient(base_url=f"http://127.0.0.1:{JAVA_PORT}", timeout=120)


def java_up() -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", JAVA_PORT)) == 0


@app.on_event("startup")
async def start_java():
    if not java_up():
        log = open("/var/log/supervisor/java-backend.log", "a")
        subprocess.Popen(["java", "-Xmx512m", "-jar", JAVA_JAR], env=os.environ.copy(), stdout=log, stderr=subprocess.STDOUT, start_new_session=True)


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
