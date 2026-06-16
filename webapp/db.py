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
import re
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

HERE = os.path.dirname(os.path.abspath(__file__))
if not getattr(sys, "frozen", False):
    TOOLS = os.path.join(os.path.dirname(HERE), "tools")
    if TOOLS not in sys.path:
        sys.path.insert(0, TOOLS)
import _common as C   # noqa: E402

ETAPAS = ["Levantamento", "Projeto", "Cronograma e Check-list", "Encerramento"]
SITUACOES = ["Em andamento", "Em risco", "Pausado", "Concluído"]
PERFIS = ["ADM", "Coordenador", "GCI", "Consultor"]

CAMPOS = ["cliente", "cnpj", "numero_projeto", "ramo", "responsavel", "consultor", "gci",
          "etapa", "situacao", "data_inicio", "data_uso_oficial", "data_encerramento",
          "horas_cobradas", "horas_bonificadas", "modulos", "contatos", "observacoes"]

# --- Gates: documentos obrigatórios por etapa (controle de qualidade) ---
DOC_LABELS = {
    "levantamento": "Mapeamento (Levantamento)",
    "projeto": "Projeto de Implantação",
    "cronograma": "Cronograma",
    "termo": "Termo de Encerramento",
    "checklist": "Check List",
}

# Documentos que já devem existir para o projeto estar (corretamente) na etapa.
# Acumulativo, encadeando a tríade obrigatória: Projeto · Cronograma · Termo.
GATES = {
    "Levantamento":            [],
    "Projeto":                 ["levantamento"],
    "Cronograma e Check-list": ["levantamento", "projeto"],
    "Encerramento":            ["levantamento", "projeto", "cronograma", "checklist"],
}


def docs_obrigatorios(etapa):
    return GATES.get(etapa, [])


# As 4 etapas SÃO as fases do stepper (modelo consolidado da proposta).
MACRO_FASES = ETAPAS
_ETAPA_MACRO = {e: i for i, e in enumerate(ETAPAS)}


def macro_idx(etapa):
    return _ETAPA_MACRO.get(etapa, 0)


def proxima_etapa(etapa):
    try:
        i = ETAPAS.index(etapa)
    except ValueError:
        return None
    return ETAPAS[i + 1] if i + 1 < len(ETAPAS) else None


def gate_status(etapa, docs):
    """Avalia o gate da etapa: quais documentos obrigatórios existem/faltam.
    `docs` = lista de dicts com a chave 'tipo'. Retorna dict pronto p/ o template."""
    presentes = {(d.get("tipo") or "").lower() for d in (docs or [])}
    itens = [{"tipo": t, "label": DOC_LABELS.get(t, t), "ok": t in presentes}
             for t in docs_obrigatorios(etapa)]
    faltam = [i["label"] for i in itens if not i["ok"]]
    return {"etapa": etapa, "itens": itens, "faltam": faltam, "ok": not faltam}


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
    gci = Column(String(160), default="")
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


class Evento(Base):
    """Item da timeline/histórico de um projeto (auditoria + passagem de bastão)."""
    __tablename__ = "eventos"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    tipo = Column(String(30), default="nota")   # nota, etapa, documento, email, alerta
    descricao = Column(Text, default="")
    autor = Column(String(120), default="")
    criado_em = Column(DateTime, default=datetime.now)


def registrar_evento(s, projeto_id, tipo, descricao, autor=""):
    """Adiciona um evento à timeline (na sessão aberta `s`; o commit é do chamador)."""
    s.add(Evento(projeto_id=projeto_id, tipo=tipo, descricao=descricao, autor=autor or ""))


class Usuario(Base):
    """Usuário do painel: login + perfil (ADM/Coordenador/GCI/Consultor)."""
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True)
    login = Column(String(120), default="")
    nome = Column(String(120), default="")
    email = Column(String(160), default="")
    senha_hash = Column(Text, default="")
    perfil = Column(String(20), default="Consultor")
    ativo = Column(Integer, default=1)
    criado_em = Column(DateTime, default=datetime.now)


class CadastroPendente(Base):
    """Cadastro novo aguardando validação por código enviado ao e-mail."""
    __tablename__ = "cadastros_pendentes"
    id = Column(Integer, primary_key=True)
    nome = Column(String(120), default="")
    login = Column(String(120), default="")
    email = Column(String(160), default="")
    senha_hash = Column(Text, default="")
    codigo = Column(String(12), default="")
    tentativas = Column(Integer, default=0)
    criado_em = Column(DateTime, default=datetime.now)


def set_senha(u, senha):
    from werkzeug.security import generate_password_hash
    u.senha_hash = generate_password_hash(senha or "")


def checa_senha(u, senha):
    from werkzeug.security import check_password_hash
    try:
        return bool(u.senha_hash) and check_password_hash(u.senha_hash, senha or "")
    except Exception:
        return False


def autenticar(login, senha):
    with Session() as s:
        u = s.query(Usuario).filter(Usuario.login == (login or "").strip(),
                                    Usuario.ativo == 1).first()
        if u and checa_senha(u, senha):
            return {"id": u.id, "login": u.login, "nome": u.nome, "perfil": u.perfil}
    return None


def ha_usuarios():
    with Session() as s:
        return s.query(Usuario).filter(Usuario.ativo == 1).count() > 0


def usuarios_por_perfil(perfil):
    with Session() as s:
        return [{"id": u.id, "nome": u.nome or u.login, "login": u.login}
                for u in s.query(Usuario).filter(Usuario.perfil == perfil, Usuario.ativo == 1)
                .order_by(Usuario.nome).all()]


def existe_usuario(login=None, email=None):
    """True se já houver usuário (ativo ou não) com este login OU e-mail."""
    from sqlalchemy import or_, func
    conds = []
    if login:
        conds.append(func.lower(Usuario.login) == login.strip().lower())
    if email:
        conds.append(func.lower(Usuario.email) == email.strip().lower())
    if not conds:
        return False
    with Session() as s:
        return s.query(Usuario).filter(or_(*conds)).count() > 0


# --- Autocadastro com validação por código (CadastroPendente) ---
def limpar_pendentes(minutos=30):
    with Session() as s:
        s.query(CadastroPendente).filter(
            CadastroPendente.criado_em < datetime.now() - timedelta(minutes=minutos)).delete()
        s.commit()


def salvar_pendente(nome, login, email, senha, codigo):
    """Cria/substitui o cadastro pendente do e-mail (senha já guardada como hash)."""
    from sqlalchemy import func
    from werkzeug.security import generate_password_hash
    with Session() as s:
        s.query(CadastroPendente).filter(func.lower(CadastroPendente.email) == email.lower()).delete()
        s.add(CadastroPendente(nome=nome, login=login, email=email,
                               senha_hash=generate_password_hash(senha or ""), codigo=codigo))
        s.commit()


def atualizar_codigo(email, codigo):
    """Reenvio: novo código, zera tentativas e renova o prazo."""
    from sqlalchemy import func
    with Session() as s:
        p = s.query(CadastroPendente).filter(func.lower(CadastroPendente.email) == (email or "").lower()).first()
        if p:
            p.codigo = codigo
            p.tentativas = 0
            p.criado_em = datetime.now()
            s.commit()
            return True
    return False


def pendente_por_email(email):
    from sqlalchemy import func
    with Session() as s:
        p = s.query(CadastroPendente).filter(func.lower(CadastroPendente.email) == (email or "").lower()).first()
        return to_dict(p) if p else None


def confirmar_pendente(email, codigo):
    """Valida o código. Se OK, cria o Usuario (perfil inicial Consultor) e remove o
    pendente. Retorna (usuario_dict | None, erro | None)."""
    from sqlalchemy import func
    with Session() as s:
        p = s.query(CadastroPendente).filter(func.lower(CadastroPendente.email) == (email or "").lower())\
            .order_by(CadastroPendente.criado_em.desc()).first()
        if not p:
            return None, "Cadastro não encontrado. Recomece o cadastro."
        if (datetime.now() - p.criado_em) > timedelta(minutes=30):
            s.delete(p); s.commit()
            return None, "O código expirou. Recomece o cadastro."
        if p.tentativas >= 5:
            s.delete(p); s.commit()
            return None, "Muitas tentativas. Recomece o cadastro."
        if (codigo or "").strip() != (p.codigo or ""):
            p.tentativas += 1
            s.commit()
            return None, "Código incorreto. Confira o e-mail e tente de novo."
        u = Usuario(nome=p.nome, login=p.login or p.email, email=p.email,
                    senha_hash=p.senha_hash, perfil="Consultor", ativo=1)
        s.add(u)
        s.delete(p)
        s.commit()
        return {"id": u.id, "login": u.login, "nome": u.nome or u.login, "perfil": u.perfil}, None


class Designacao(Base):
    """Consultor responsável por um módulo de um projeto."""
    __tablename__ = "designacoes"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    modulo = Column(String(80), default="")
    consultor = Column(String(160), default="")


def designacoes_do_projeto(pid):
    with Session() as s:
        return [{"modulo": d.modulo, "consultor": d.consultor}
                for d in s.query(Designacao).filter_by(projeto_id=pid).order_by(Designacao.modulo).all()]


def to_dict(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def aplicar_form(p, form):
    for c in CAMPOS:
        v = (form.get(c) or "").strip()
        if c in ("etapa", "situacao") and not v:
            continue   # não zera os defaults (Levantamento / Em andamento) se vierem vazios
        setattr(p, c, v)
    if not p.cliente:
        p.cliente = "Cliente"
    return p


def projeto_existe(cliente=None, cnpj=None):
    """ID de um projeto já cadastrado com o mesmo CNPJ (preferência, comparando só os
    dígitos) ou, na falta de CNPJ, o mesmo nome de cliente. None se não houver.
    Usado para NÃO duplicar o mesmo fechamento."""
    cnpj_d = re.sub(r"\D", "", str(cnpj or ""))
    cli = re.sub(r"\s+", " ", (cliente or "").strip().lower())
    if not cnpj_d and not cli:
        return None
    with Session() as s:
        for p in s.query(Projeto).all():
            if cnpj_d and re.sub(r"\D", "", p.cnpj or "") == cnpj_d:
                return p.id
            if cli and not cnpj_d and re.sub(r"\s+", " ", (p.cliente or "").strip().lower()) == cli:
                return p.id
    return None


# --- F: Cronograma e Check-list EDITÁVEIS no painel (+ histórico de modificações) ---
class CronogramaItem(Base):
    """Linha do cronograma, editável durante a implantação."""
    __tablename__ = "cronograma_itens"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    ordem = Column(Integer, default=0)
    etapa = Column(Text, default="")
    topicos = Column(Text, default="")
    horas = Column(String(20), default="")
    data = Column(String(20), default="")
    modalidade = Column(String(40), default="")
    status = Column(String(30), default="Previsto")


class ChecklistItem(Base):
    """Linha do check-list de acompanhamento, editável durante a implantação."""
    __tablename__ = "checklist_itens"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    ordem = Column(Integer, default=0)
    modulo = Column(String(80), default="")
    item = Column(Text, default="")
    responsavel = Column(String(160), default="")
    status = Column(String(30), default="Pendente")
    obs = Column(Text, default="")


class Modificacao(Base):
    """Histórico de modificações linha-a-linha do cronograma / check-list."""
    __tablename__ = "modificacoes"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    entidade = Column(String(30), default="")   # cronograma | checklist
    ref = Column(String(60), default="")
    campo = Column(String(40), default="")
    de = Column(Text, default="")
    para = Column(Text, default="")
    autor = Column(String(120), default="")
    criado_em = Column(DateTime, default=datetime.now)


CRONO_CAMPOS = ["etapa", "topicos", "horas", "data", "modalidade", "status"]
CHECK_CAMPOS = ["modulo", "item", "responsavel", "status", "obs"]
CRONO_LABELS = {"etapa": "Etapa / Treinamento", "topicos": "Macro tópicos", "horas": "Horas",
                "data": "Data", "modalidade": "Modalidade", "status": "Status"}
CHECK_LABELS = {"modulo": "Módulo", "item": "Item", "responsavel": "Responsável",
                "status": "Status", "obs": "Observação"}
CRONO_STATUS = ["Previsto", "Agendado", "Concluído", "Cancelado"]
CHECK_STATUS = ["Pendente", "Em andamento", "Concluído", "N/A"]
_MODELS = {"cronograma": (CronogramaItem, CRONO_CAMPOS),
           "checklist": (ChecklistItem, CHECK_CAMPOS)}


def cronograma_do_projeto(pid):
    with Session() as s:
        return [to_dict(x) for x in s.query(CronogramaItem)
                .filter_by(projeto_id=pid).order_by(CronogramaItem.ordem).all()]


def checklist_do_projeto(pid):
    with Session() as s:
        return [to_dict(x) for x in s.query(ChecklistItem)
                .filter_by(projeto_id=pid).order_by(ChecklistItem.ordem).all()]


def modificacoes_do_projeto(pid, entidade=None, limite=200):
    with Session() as s:
        q = s.query(Modificacao).filter_by(projeto_id=pid)
        if entidade:
            q = q.filter_by(entidade=entidade)
        return [to_dict(x) for x in q.order_by(Modificacao.criado_em.desc()).limit(limite).all()]


def registrar_modificacao(s, projeto_id, entidade, ref, campo, de, para, autor=""):
    s.add(Modificacao(projeto_id=projeto_id, entidade=entidade, ref=ref, campo=campo,
                      de=str(de or ""), para=str(para or ""), autor=autor or ""))


def _resumo_linha(d, campos):
    get = d.get if isinstance(d, dict) else (lambda c: getattr(d, c, ""))
    parts = [str(get(c)).strip() for c in campos[:2] if str(get(c) or "").strip()]
    return " · ".join(parts) or "(linha vazia)"


def salvar_linhas(pid, entidade, novas, autor=""):
    """Substitui as linhas (cronograma|checklist) do projeto pelas `novas` (lista de dicts),
    registrando as diferenças linha a linha em Modificacao. Retorna o nº de alterações."""
    Model, campos = _MODELS[entidade]
    with Session() as s:
        antigas = s.query(Model).filter_by(projeto_id=pid).order_by(Model.ordem).all()
        mud = 0
        for i in range(max(len(antigas), len(novas))):
            old = antigas[i] if i < len(antigas) else None
            new = novas[i] if i < len(novas) else None
            if old is not None and new is None:
                registrar_modificacao(s, pid, entidade, "linha %d" % (i + 1), "linha",
                                      _resumo_linha(old, campos), "(removida)", autor); mud += 1
            elif old is None and new is not None:
                registrar_modificacao(s, pid, entidade, "linha %d" % (i + 1), "linha",
                                      "(nova)", _resumo_linha(new, campos), autor); mud += 1
            else:
                for c in campos:
                    ov, nv = str(getattr(old, c) or "").strip(), str(new.get(c) or "").strip()
                    if ov != nv:
                        registrar_modificacao(s, pid, entidade, "linha %d · %s" % (i + 1, c), c, ov, nv, autor)
                        mud += 1
        for old in antigas:
            s.delete(old)
        for i, new in enumerate(novas):
            s.add(Model(projeto_id=pid, ordem=i, **{c: (new.get(c) or "") for c in campos}))
        s.commit()
        return mud


def _auto_migrar():
    """Migração leve aditiva: cria colunas novas que faltarem (SQLite e Postgres).
    Cobre a evolução de schema entre versões; só adiciona, nunca remove dados."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    tabelas = set(insp.get_table_names())
    with engine.begin() as conn:
        for tbl in Base.metadata.sorted_tables:
            if tbl.name not in tabelas:
                continue
            cols = {c["name"] for c in insp.get_columns(tbl.name)}
            for col in tbl.columns:
                if col.name not in cols:
                    tipo = col.type.compile(engine.dialect)
                    conn.execute(text("ALTER TABLE %s ADD COLUMN %s %s" % (tbl.name, col.name, tipo)))


_MIGRA_ETAPA = {
    "Cronograma": "Cronograma e Check-list", "Parametrização": "Cronograma e Check-list",
    "Treinamento": "Cronograma e Check-list", "Testes/Simulação": "Cronograma e Check-list",
    "Conversão": "Cronograma e Check-list", "Virada": "Cronograma e Check-list",
    "Hypercare": "Cronograma e Check-list", "Encerrado": "Encerramento",
}


def _migrar_etapas():
    """Converte etapas do modelo antigo (10) para o consolidado (4)."""
    with Session() as s:
        antigos = s.query(Projeto).filter(Projeto.etapa.in_(list(_MIGRA_ETAPA))).all()
        for p in antigos:
            p.etapa = _MIGRA_ETAPA[p.etapa]
        if antigos:
            s.commit()


def init_db():
    Base.metadata.create_all(engine)
    try:
        _auto_migrar()
        _migrar_etapas()
    except Exception:
        pass


# --- Métricas da carteira (Painel Coordenação) ---
def _pdate(s):
    s = str(s or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _pnum(s):
    m = re.search(r"\d+(?:[.,]\d+)?", str(s or ""))
    return float(m.group(0).replace(",", ".")) if m else 0.0


def metricas(projetos, docs_map=None):
    """Agrega a carteira para o Painel Coordenação.
    `projetos` = lista de dicts; `docs_map` = {projeto_id: [ {tipo: ...}, ... ]}."""
    docs_map = docs_map or {}
    hoje = datetime.now().date()
    por_situacao = {s: 0 for s in SITUACOES}
    por_etapa = {e: 0 for e in ETAPAS}
    consultores = {}
    atrasados, em_risco, ttv = [], [], []
    gate_pendente = concluidos = 0
    horas_cob = horas_bon = 0.0

    for p in projetos:
        sit, et = p.get("situacao") or "", p.get("etapa") or ""
        por_situacao[sit] = por_situacao.get(sit, 0) + 1
        por_etapa[et] = por_etapa.get(et, 0) + 1
        encerrado = (sit == "Concluído")
        cob, bon = _pnum(p.get("horas_cobradas")), _pnum(p.get("horas_bonificadas"))
        horas_cob += cob; horas_bon += bon
        cons = (p.get("consultor") or "").strip() or "— sem consultor —"

        if encerrado:
            concluidos += 1
            di, df = _pdate(p.get("data_inicio")), _pdate(p.get("data_uso_oficial")) or _pdate(p.get("data_encerramento"))
            if di and df and df >= di:
                ttv.append((df - di).days)
            continue

        c = consultores.setdefault(cons, {"projetos": 0, "horas": 0.0})
        c["projetos"] += 1; c["horas"] += cob + bon
        duso = _pdate(p.get("data_uso_oficial"))
        if duso and duso < hoje:
            atrasados.append({"id": p.get("id"), "cliente": p.get("cliente"),
                              "etapa": et, "consultor": cons, "dias": (hoje - duso).days})
        if sit == "Em risco":
            em_risco.append({"id": p.get("id"), "cliente": p.get("cliente"), "etapa": et})
        if not gate_status(et, docs_map.get(p.get("id"), []))["ok"]:
            gate_pendente += 1

    ativos = len(projetos) - concluidos
    atrasados.sort(key=lambda x: -x["dias"])
    return {
        "total": len(projetos), "ativos": ativos, "concluidos": concluidos,
        "por_situacao": por_situacao, "por_etapa": por_etapa,
        "atrasados": atrasados, "n_atrasados": len(atrasados),
        "em_risco": em_risco, "n_risco": len(em_risco),
        "gate_pendente": gate_pendente, "no_prazo": ativos - len(atrasados),
        "consultores": sorted(([{"consultor": k, **v} for k, v in consultores.items()]),
                              key=lambda x: -x["projetos"]),
        "horas_cob": horas_cob, "horas_bon": horas_bon, "horas_total": horas_cob + horas_bon,
        "ttv_medio": round(sum(ttv) / len(ttv)) if ttv else None,
    }


# --- Alertas proativos (SLA / hypercare / risco) ---
ALERTA_PARADO_DIAS = 14
ALERTA_HYPERCARE_DIAS = 15
SLA_CRONOGRAMA_UTEIS = 5


def _uteis(d, n):
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d


def alertas(projetos, docs_map=None):
    """Lista de alertas acionáveis dos projetos ATIVOS.
    Cada item: {nivel: alto|medio, projeto_id, cliente, tipo, msg}."""
    docs_map = docs_map or {}
    hoje = datetime.now().date()
    out = []
    for p in projetos:
        sit, et = p.get("situacao") or "", p.get("etapa") or ""
        if sit == "Concluído":
            continue
        pid, cli = p.get("id"), p.get("cliente")
        tipos = {(d.get("tipo") or "").lower() for d in docs_map.get(pid, [])}
        duso = _pdate(p.get("data_uso_oficial"))

        def add(nivel, tipo, msg):
            out.append({"nivel": nivel, "projeto_id": pid, "cliente": cli, "tipo": tipo, "msg": msg})

        if duso and duso < hoje:
            add("alto", "atraso", "Uso oficial previsto venceu há %d dia(s)" % (hoje - duso).days)
        if sit == "Em risco":
            add("alto", "risco", "Projeto marcado como Em risco")
        di = _pdate(p.get("data_inicio"))
        if di and "cronograma" not in tipos and hoje > _uteis(di, SLA_CRONOGRAMA_UTEIS):
            add("medio", "sla", "Cronograma pendente além do SLA de %d dias úteis (início %s)"
                % (SLA_CRONOGRAMA_UTEIS, di.strftime("%d/%m/%Y")))
        if et == "Encerramento" and duso and hoje > duso + timedelta(days=ALERTA_HYPERCARE_DIAS):
            add("medio", "encerramento", "Em Encerramento há mais de %d dias após o go-live — concluir o projeto" % ALERTA_HYPERCARE_DIAS)
        at = p.get("atualizado_em")
        if isinstance(at, datetime) and (datetime.now() - at).days >= ALERTA_PARADO_DIAS:
            add("medio", "parado", "Sem atualização há %d dias" % (datetime.now() - at).days)

    out.sort(key=lambda a: 0 if a["nivel"] == "alto" else 1)
    return out


def metricas_uso(eventos, projetos, dias=30):
    """Contagens de uso no período: projetos criados + eventos por tipo."""
    corte = datetime.now() - timedelta(days=dias)
    rec = [e for e in eventos if isinstance(e.get("criado_em"), datetime) and e["criado_em"] >= corte]
    por = {}
    for e in rec:
        por[e.get("tipo")] = por.get(e.get("tipo"), 0) + 1
    novos = sum(1 for p in projetos if isinstance(p.get("criado_em"), datetime) and p["criado_em"] >= corte)
    return {"dias": dias, "projetos_novos": novos, "documentos": por.get("documento", 0),
            "emails": por.get("email", 0), "notas": por.get("nota", 0),
            "transicoes": por.get("etapa", 0), "total_eventos": len(rec)}


def funil_macro(projetos):
    """Projetos por macro-fase + idade média (dias desde a criação)."""
    fases = {f: [] for f in MACRO_FASES}
    hoje = datetime.now()
    for p in projetos:
        f = MACRO_FASES[macro_idx(p.get("etapa"))]
        c = p.get("criado_em")
        fases[f].append((hoje - c).days if isinstance(c, datetime) else None)
    out = []
    for f in MACRO_FASES:
        idades = [d for d in fases[f] if d is not None]
        out.append({"fase": f, "n": len(fases[f]),
                    "idade_media": round(sum(idades) / len(idades)) if idades else None})
    return out


def cabecalho(d, docs):
    """Dados do cabeçalho da ficha (stepper + KPIs + próxima ação + avançar).
    O que se cobra é o gate da PRÓXIMA etapa = o que falta para avançar."""
    etapa = d.get("etapa")
    cur = macro_idx(etapa)
    stepper = [{"nome": f, "estado": ("done" if i < cur else "atual" if i == cur else "futuro")}
               for i, f in enumerate(MACRO_FASES)]
    cob, bon = _pnum(d.get("horas_cobradas")), _pnum(d.get("horas_bonificadas"))
    duso = _pdate(d.get("data_uso_oficial"))
    encerrado = d.get("situacao") == "Concluído"
    hoje = datetime.now().date()
    atraso = (hoje - duso).days if (duso and not encerrado and duso < hoje) else None
    prox = proxima_etapa(etapa)
    gate_ref = gate_status(prox, docs) if prox else gate_status(etapa, docs)
    itens = gate_ref["itens"]
    return {
        "stepper": stepper, "fase": MACRO_FASES[cur], "etapa": etapa,
        "go_live": d.get("data_uso_oficial") or "", "atraso": atraso,
        "horas_cob": cob, "horas_bon": bon, "horas_total": cob + bon,
        "docs_ok": sum(1 for i in itens if i["ok"]), "docs_total": len(itens),
        "proxima": next((i for i in itens if not i["ok"]), None),
        "prox_etapa": prox, "avancar_ok": bool(prox) and gate_ref["ok"],
    }
