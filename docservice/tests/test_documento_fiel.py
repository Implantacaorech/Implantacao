# -*- coding: utf-8 -*-
"""Testes do endpoint /gerar/documento-fiel (Levantamento, Projeto, Termo — .docx) —
espelha webapp/test_painel.py:test_gerar_layout_* usando os templates reais de
tools/templates/layouts/ (os mesmos que o Cadastro de Modelos semeia em produção)."""
import base64
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from docx import Document
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

_LAYOUTS = Path(__file__).resolve().parents[2] / "tools" / "templates" / "layouts"


def _template_base64(nome):
    return base64.b64encode((_LAYOUTS / nome).read_bytes()).decode("ascii")


def _texto_completo(doc):
    return "\n".join(p.text for p in doc.paragraphs)


def test_gera_termo_preenche_cliente_numero_projeto_e_grade():
    payload = {
        "slug": "termo",
        "modeloBase64": _template_base64("termo.docx"),
        "projeto": {
            "id": 1,
            "cliente": "Cliente Teste LTDA",
            "numeroProjeto": "PRJ-42",
            "dataEncerramento": "2026-08-20",
            "modulos": "FAT, EST",
        },
    }
    r = client.post("/gerar/documento-fiel", json=payload)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    doc = Document(io.BytesIO(r.content))
    texto = _texto_completo(doc)
    assert "Cliente Teste LTDA" in texto
    assert "PRJ-42" in texto
    assert "<Razão Social Longa>" not in texto
    assert "<Número do projeto quando se aplicar>" not in texto

    grade = doc.tables[0]
    linhas = [[c.text.strip() for c in row.cells] for row in grade.rows[1:]]
    assert linhas[0][0] == "FAT"
    assert linhas[0][2] == "Implantado"
    assert linhas[0][3] == "Sim"
    assert linhas[1][0] == "EST"


def test_gera_levantamento_preenche_cliente_e_data():
    payload = {
        "slug": "levantamento",
        "modeloBase64": _template_base64("levantamento.docx"),
        "projeto": {
            "id": 1,
            "cliente": "Cliente Teste LTDA",
            "dataLevantamento": "2026-07-10",
            "gci": "Ana",
            "consultor": "Beto",
            "modulos": "FAT",
        },
        "indiceModulos": [{"sigla": "FAT", "nome": "Faturamento"}],
        "indiceTopicos": [
            {"moduloSigla": "FAT", "topico": "Emissão de nota fiscal", "adicional": ""}
        ],
    }
    r = client.post("/gerar/documento-fiel", json=payload)
    assert r.status_code == 200
    doc = Document(io.BytesIO(r.content))
    texto = _texto_completo(doc)
    assert "Cliente Teste LTDA" in texto
    assert "10/07/2026" in texto
    assert "Ana / Beto" in texto
    assert "< Nome Cliente >" not in texto


def test_gera_projeto_modo_modelo_preenche_cliente():
    payload = {
        "slug": "projeto",
        "modo": "modelo",
        "modeloBase64": _template_base64("projeto.docx"),
        "projeto": {
            "id": 1,
            "cliente": "Cliente Teste LTDA",
            "cnpj": "00.000.000/0001-00",
            "modulos": "FAT",
        },
    }
    r = client.post("/gerar/documento-fiel", json=payload)
    assert r.status_code == 200
    doc = Document(io.BytesIO(r.content))
    texto = _texto_completo(doc)
    assert "Nome do Cliente: Cliente Teste LTDA" in texto
    assert "CNPJ: 00.000.000/0001-00" in texto


def test_slug_invalido_devolve_422():
    r = client.post(
        "/gerar/documento-fiel",
        json={"slug": "checklist", "modeloBase64": base64.b64encode(b"x").decode()},
    )
    assert r.status_code == 422


def test_modelo_base64_invalido_devolve_422():
    r = client.post(
        "/gerar/documento-fiel",
        json={"slug": "termo", "modeloBase64": "***nao-e-base64***", "projeto": {"id": 1, "cliente": "X"}},
    )
    assert r.status_code == 422
