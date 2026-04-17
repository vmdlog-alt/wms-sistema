
from fastapi import FastAPI
from pydantic import BaseModel
import sqlite3

app = FastAPI()

conn = sqlite3.connect("wms.db", check_same_thread=False)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS produtos (
id INTEGER PRIMARY KEY AUTOINCREMENT,
nome TEXT,
familia TEXT,
estoque INTEGER,
endereco TEXT,
picking TEXT
)
""")
conn.commit()

class Produto(BaseModel):
    nome: str
    familia: str
    estoque: int
    endereco: str
    picking: str

@app.get("/")
def home():
    return {"msg": "WMS Rodando"}

@app.post("/produto")
def cadastrar(p: Produto):
    cur.execute("INSERT INTO produtos (nome,familia,estoque,endereco,picking) VALUES (?,?,?,?,?)",
                (p.nome,p.familia,p.estoque,p.endereco,p.picking))
    conn.commit()
    return {"status":"ok"}

@app.get("/produtos")
def listar():
    cur.execute("SELECT * FROM produtos")
    return cur.fetchall()

@app.post("/saida")
def saida(nome: str, qtd: int):
    cur.execute("SELECT estoque,picking FROM produtos WHERE nome=?", (nome,))
    r = cur.fetchone()
    if not r:
        return {"erro":"Produto não encontrado"}

    estoque, picking = r

    if qtd > estoque:
        return {"erro":"Estoque insuficiente"}

    retirada_picking = 0
    retirada_outros = qtd

    if picking == "SIM" and qtd > 36:
        retirada_picking = qtd - 36
        retirada_outros = 36

    novo = estoque - qtd
    cur.execute("UPDATE produtos SET estoque=? WHERE nome=?", (novo,nome))
    conn.commit()

    return {
        "status":"ok",
        "picking": retirada_picking,
        "outros": retirada_outros
    }

