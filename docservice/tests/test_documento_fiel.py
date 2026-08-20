# -*- coding: utf-8 -*-
"""Testes do endpoint /gerar/documento-fiel (Levantamento, Projeto, Cronograma, Termo) —
espelha webapp/test_painel.py:test_gerar_layout_* usando os templates reais de
tools/templates/layouts/ (os mesmos que o Cadastro de Modelos semeia em produção)."""
import base64
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import openpyxl
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


def test_gera_projeto_modo_auto_preenche_escopo_equipes_e_detalhamento():
    """modo=auto é o caminho do PASSO 10 (Criação do Projeto) — gerar o documento é o que
    conclui o passo. Cobre os campos da tela 'Projeto — edição estruturada' que a geração
    ignorava (`empresas`, `conversoes`, `encarregado`), o Detalhamento vindo das respostas
    do Levantamento e a remoção das áreas não contratadas."""
    payload = {
        "slug": "projeto",
        "modo": "auto",
        "modeloBase64": _template_base64("projeto.docx"),
        "projeto": {
            "id": 1,
            "cliente": "Metalurgica Teste Ltda",
            "cnpj": "12.345.678/0001-90",
            "gci": "GCI Teste",
            "consultor": "Consultor Teste",
            "modulos": "FAT",
            "horasCobradas": "120",
            "horasBonificadas": "20",
        },
        "docConteudo": {
            "objetivos": "Padronizar o processo comercial no SIGER.",
            "empresas": "Matriz - 12.345.678/0001-90\nFilial - 12.345.678/0002-70",
            "conversoes": "Converter clientes, produtos e titulos em aberto.",
            "redator": "Redator Teste",
            "encarregado": "Fulano da Silva",
        },
        "indiceModulos": [{"sigla": "FAT", "nome": "Faturamento"}],
        "indiceTopicos": [{"moduloSigla": "FAT", "topico": "Emissao de pedido", "adicional": ""}],
        "levantamentoRespostas": [
            {"moduloSigla": "FAT", "topico": "Emissao de pedido",
             "resposta": "Pedido digitado pelo representante."}
        ],
        "cronogramaItens": [],
    }
    r = client.post("/gerar/documento-fiel", json=payload)
    assert r.status_code == 200

    doc = Document(io.BytesIO(r.content))
    texto = _texto_completo(doc)

    # Cabeçalho e objetivos (já cobertos no modo=modelo, mantidos como âncora do modo=auto)
    assert "Nome do Cliente: Metalurgica Teste Ltda" in texto
    assert "CNPJ: 12.345.678/0001-90" in texto
    assert "Padronizar o processo comercial no SIGER." in texto

    # Escopo — campos que a geração perdia: a tela gravava e o .docx saía em branco.
    assert "Matriz - 12.345.678/0001-90" in texto
    assert "Filial - 12.345.678/0002-70" in texto
    assert "Converter clientes, produtos e titulos em aberto." in texto

    # Equipes — as três linhas da Rech e a do cliente.
    assert "Gerente de Contas do Projeto: GCI Teste" in texto
    assert "Redator do Projeto: Redator Teste" in texto
    assert "Consultor/Implantador: Consultor Teste" in texto
    assert "Encarregado pelo Projeto: Fulano da Silva" in texto

    # Detalhamento das Rotinas: só a área contratada, preenchida pelo Levantamento.
    assert "Vendas e Faturamento" in texto
    assert "Emissao de pedido: Pedido digitado pelo representante." in texto
    assert "Controle de Compras" not in texto     # área sem módulo contratado -> removida
    assert "Gestão da Produção" not in texto      # grupo que ficou vazio -> removido

    # Tempo estimado e fecho.
    assert "120 horas cobradas" in texto
    assert "20 horas bonificadas" in texto

    # Nenhum marcador do layout pode vazar para o documento entregue ao cliente.
    assert "<" not in texto or ">" not in texto
    assert "(preencher)" not in texto


def test_gera_cronograma_preenche_cliente_consultor_horas_e_linhas():
    payload = {
        "slug": "cronograma",
        "modeloBase64": _template_base64("cronograma.xlsx"),
        "projeto": {
            "id": 1,
            "cliente": "Cliente Teste LTDA",
            "consultor": "Ana Consultora",
            "horasCobradas": "40",
            "horasBonificadas": "8",
        },
        "cronogramaItens": [
            {
                "etapa": "Abertura",
                "topicos": "Parametrização",
                "horas": "4",
                "data": "2026-08-10",
                "modalidade": "Remoto",
                "status": "Previsto",
            },
            {
                "etapa": "Treinamento — Faturamento",
                "topicos": "Cadastros e rotinas",
                "horas": "8",
                "data": "2026-08-17",
                "modalidade": "Presencial",
                "status": "Previsto",
            },
        ],
    }
    r = client.post("/gerar/documento-fiel", json=payload)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    ws = wb["Cronograma de visitas"]
    assert ws["C6"].value == "Cliente Teste LTDA"
    assert ws["C3"].value == "Ana Consultora"
    assert ws["J3"].value == "40"
    assert ws["L4"].value == "8"
    assert ws["B9"].value == "2026-08-10"
    assert ws["N9"].value == "Abertura — Parametrização"
    assert ws["B10"].value == "2026-08-17"
    assert ws["N10"].value == "Treinamento — Faturamento — Cadastros e rotinas"


def test_gera_cronograma_sem_itens_ainda_preenche_cabecalho():
    payload = {
        "slug": "cronograma",
        "modeloBase64": _template_base64("cronograma.xlsx"),
        "projeto": {"id": 1, "cliente": "Cliente Sem Itens", "consultor": "Beto"},
    }
    r = client.post("/gerar/documento-fiel", json=payload)
    assert r.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    ws = wb["Cronograma de visitas"]
    assert ws["C6"].value == "Cliente Sem Itens"
    assert ws["C3"].value == "Beto"
    assert ws["B9"].value is None


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
