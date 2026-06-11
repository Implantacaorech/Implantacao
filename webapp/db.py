# -*- coding: utf-8 -*-
"""Camada de dados do Hub 'Projetos por Cliente'.

Banco AGNÓSTICO via SQLAlchemy: por padrão um arquivo SQLite; para migrar para
PostgreSQL (nuvem/servidor) basta definir a env PAINEL_DB_URL — sem reescrever código.

Onde mora o banco:
  - PAINEL_DB_URL = "postgresql+psycopg://user:senha@host/base"  (qualquer banco), OU
  - PAINEL_DB     = caminho do arquivo SQLite (ex.: R:\\Implantacao\\painel.db p/ rede), OU
  - padrão: <pasta gravável>/painel.db (local).
"""
import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

HERE = os.path.dirname(os.path.abspath(__file__))
if not getattr(sys, "frozen", False):
    TOOLS = os.path.join(os.path.dirname(HERE), "tools")
    if TOOLS not in sys.path:
        sys.path.insert(0, TOOLS)
import _common as C   # noqa: E402

ETAPAS = ["Levantamento", "Projeto", "Cronograma", "Parametrização", "Treinamento",
          "Testes/Simulação", "Conversão", "Virada", "Hypercare", "Encerrado"]
SITUACOES = ["Em andamento", "Em risco", "Pausado", "Concluído"]

CAMPOS = ["cliente", "cnpj", "numero_projeto", "ramo", "responsavel", "consultor",
          "etapa", "situacao", "data_inicio", "data_uso_oficial", "data_encerramento",
          "horas_cobradas", "horas_bonificadas", "modulos", "contatos", "observacoes"]


def _db_url():
    url = os.environ.get("PAINEL_DB_URL")
    if url:
        return url
    path = os.environ.get("PAINEL_DB") or os.path.join(C.DATA_WRITE, "painel.db")
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    return "sqlite:///" + path


engine = create_engine(_db_url(), future=True)
Session = sessionmaker(bind=engine, future=True)
Base = declarative_base()


class Projeto(Base):
    __tablename__ = "projetos"
    id = Column(Integer, primary_key=True)
    cliente = Column(String(200), nullable=False, default="")
    cnpj = Column(String(40), default="")
    numero_projeto = Column(String(40), default="")
    ramo = Column(String(160), default="")
    responsavel = Column(String(160), default="")
    consultor = Column(String(160), default="")
    etapa = Column(String(40), default="Levantamento")
    situacao = Column(String(40), default="Em andamento")
    data_inicio = Column(String(20), default="")
    data_uso_oficial = Column(String(20), default="")
    data_encerramento = Column(String(20), default="")
    horas_cobradas = Column(String(20), default="")
    horas_bonificadas = Column(String(20), default="")
    modulos = Column(Text, default="")
    contatos = Column(Text, default="")
    observacoes = Column(Text, default="")
    criado_em = Column(DateTime, default=datetime.now)
    atualizado_em = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Documento(Base):
    """Documento gerado e anexado a um projeto (histórico/versionado)."""
    __tablename__ = "documentos"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    tipo = Column(String(40), default="")
    arquivo = Column(String(255), default="")
    caminho = Column(Text, default="")
    criado_em = Column(DateTime, default=datetime.now)


def to_dict(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def aplicar_form(p, form):
    for c in CAMPOS:
        setattr(p, c, (form.get(c) or "").strip())
    if not p.cliente:
        p.cliente = "Cliente"
    return p


def init_db():
    Base.metadata.create_all(engine)
