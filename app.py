from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import sqlite3

app = FastAPI()

templates = Jinja2Templates(directory="templates")

conn = sqlite3.connect("wms.db", check_same_thread=False)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    quantidade INTEGER,
    endereco TEXT
)
""")
conn.commit()


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/salvar")
def salvar(nome: str, quantidade: int, endereco: str):
    cur.execute(
        "INSERT INTO produtos (nome, quantidade, endereco) VALUES (?, ?, ?)",
        (nome, quantidade, endereco)
    )
    conn.commit()
    return {"status": "ok"}
