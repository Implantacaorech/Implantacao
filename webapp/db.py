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
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker

HERE = os.path.dirname(os.path.abspath(__file__))
if not getattr(sys, "frozen", False):
    TOOLS = os.path.join(os.path.dirname(HERE), "tools")
    if TOOLS not in sys.path:
        sys.path.insert(0, TOOLS)
import _common as C   # noqa: E402

ETAPAS = ["Agendamento", "Levantamento", "Projeto", "Designação",
          "Cronograma e Check-list", "Encerramento"]
SITUACOES = ["Em andamento", "Em risco", "Pausado", "Concluído"]
PERFIS = ["ADM", "Coordenador", "Administrativo", "GCI", "Consultor"]

CAMPOS = ["cliente", "cnpj", "numero_projeto", "numero_proposta", "ramo", "responsavel",
          "consultor", "gci", "etapa", "situacao",
          "data_inicio", "data_levantamento", "data_uso_oficial", "data_encerramento",
          "horas_cobradas", "horas_bonificadas", "modulos",
          "contato_nome", "contato_email", "contato_tel",
          "contatos", "observacoes"]

# Campos obrigatórios por etapa — bloqueiam o avanço se vazios
CAMPOS_OBRIGATORIOS = {
    "Agendamento":             ["cliente", "cnpj", "numero_projeto", "modulos",
                                "horas_cobradas", "gci", "data_levantamento"],
    "Levantamento":            ["cliente", "cnpj", "numero_projeto", "modulos",
                                "horas_cobradas", "gci", "data_levantamento"],
    "Projeto":                 ["cliente", "cnpj", "numero_projeto", "modulos",
                                "horas_cobradas"],   # consultor é definido na Designação
    "Designação":              ["cliente", "cnpj", "numero_projeto", "modulos",
                                "horas_cobradas", "consultor", "data_uso_oficial"],
    "Cronograma e Check-list": ["cliente", "cnpj", "numero_projeto", "modulos",
                                "horas_cobradas", "consultor", "data_uso_oficial"],
    "Encerramento":            ["cliente", "cnpj", "numero_projeto", "modulos",
                                "horas_cobradas", "consultor", "data_uso_oficial"],
}

# Rótulos amigáveis para campos obrigatórios
CAMPO_LABELS = {
    "cliente": "Razão Social", "cnpj": "CNPJ", "numero_projeto": "Nº do Projeto",
    "numero_proposta": "Nº da Proposta", "ramo": "Ramo de Atividade",
    "responsavel": "Responsável Administrativo", "consultor": "Consultor(es)",
    "gci": "GCI (Levantamento)", "modulos": "Módulos Contratados",
    "horas_cobradas": "Horas Cobradas", "horas_bonificadas": "Horas Bonificadas",
    "data_inicio": "Data de Início", "data_levantamento": "Data do Levantamento",
    "data_uso_oficial": "Go-live Previsto", "data_encerramento": "Data de Encerramento",
    "contato_nome": "Nome do Contato", "contato_email": "E-mail do Contato",
    "contato_tel": "Telefone do Contato", "contatos": "Contatos / Stakeholders",
    "observacoes": "Observações",
}

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
    "Agendamento":             [],
    "Levantamento":            [],
    "Projeto":                 ["levantamento"],
    "Designação":              ["levantamento", "projeto"],
    "Cronograma e Check-list": ["levantamento", "projeto"],
    "Encerramento":            ["levantamento", "projeto", "cronograma", "checklist"],
}

# Ações obrigatórias para ENTRAR em cada etapa (além dos documentos):
#  - Levantamento: GCI definido (etapa 1) e Data do Levantamento (etapa 2), sequenciais.
#    O GCI deve ser definido primeiro; a data só pode ser informada após o GCI estar salvo.
#  - Cronograma e Check-list: os Consultores designados (pelo GCI, fase Designação)
ACAO_ENTRADA = {
    # Para avançar para Levantamento, ambos GCI e data_levantamento são obrigatórios.
    # A sequência é validada na UI: o botão de data só aparece após GCI salvo.
    "Levantamento": ("gci_e_data_levantamento", "Definir GCI e Data do Levantamento"),
    "Designação": ("consultores_designacao", "Designar Consultores por Módulo"),
    "Cronograma e Check-list": ("consultores", "Designar os Consultores"),
}


def acao_entrada_ok(etapa, proj):
    """A ação obrigatória para entrar nesta etapa já foi cumprida?"""
    req = (ACAO_ENTRADA.get(etapa) or (None, None))[0]
    if req == "gci_e_data_levantamento":
        # Ambos GCI e data_levantamento devem estar preenchidos para avançar
        return (bool((proj.get("gci") or "").strip()) and
                bool((proj.get("data_levantamento") or "").strip()))
    if req == "consultores_designacao":
        return bool((proj.get("gci") or "").strip())
    if req == "consultores":
        return bool((proj.get("consultor") or "").strip())
    return True


def gci_definido(proj):
    """Verifica se o GCI já foi definido (etapa 1 do agendamento)."""
    return bool((proj.get("gci") or "").strip())


def data_levantamento_definida(proj):
    """Verifica se a data do levantamento já foi definida (etapa 2 do agendamento)."""
    return bool((proj.get("data_levantamento") or "").strip())


def campos_faltantes(etapa, proj):
    """Retorna lista de {campo, label} com campos obrigatórios não preenchidos para a etapa."""
    obrig = CAMPOS_OBRIGATORIOS.get(etapa, [])
    faltam = []
    for c in obrig:
        v = (proj.get(c) or "").strip()
        if not v:
            faltam.append({"campo": c, "label": CAMPO_LABELS.get(c, c)})
    return faltam


def pode_avancar(etapa, proj, docs):
    """Verifica se o projeto pode avançar da etapa atual.
    Retorna (bool, lista_de_bloqueios)."""
    bloqueios = []
    # 1. Campos obrigatórios da etapa atual
    for f in campos_faltantes(etapa, proj):
        bloqueios.append("Campo obrigatório: %s" % f["label"])
    # 2. Gate de documentos da próxima etapa
    prox = proxima_etapa(etapa)
    if prox:
        g = gate_status(prox, docs)
        for it in g["itens"]:
            if not it["ok"]:
                bloqueios.append("Documento pendente: %s" % it["label"])
        # 3. Ação de entrada da próxima etapa
        if not acao_entrada_ok(prox, proj):
            chave, label = ACAO_ENTRADA.get(prox, (None, None))
            if label:
                bloqueios.append("Ação obrigatória: %s" % label)
    return (len(bloqueios) == 0, bloqueios)


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
    numero_proposta = Column(String(40), default="")
    ramo = Column(String(160), default="")
    responsavel = Column(String(160), default="")
    consultor = Column(String(160), default="")
    gci = Column(String(160), default="")
    etapa = Column(String(40), default="Agendamento")
    situacao = Column(String(40), default="Em andamento")
    data_inicio = Column(String(20), default="")
    data_levantamento = Column(String(20), default="")
    data_uso_oficial = Column(String(20), default="")
    data_encerramento = Column(String(20), default="")
    horas_cobradas = Column(String(20), default="")
    horas_bonificadas = Column(String(20), default="")
    modulos = Column(Text, default="")
    contato_nome = Column(String(160), default="")
    contato_email = Column(String(160), default="")
    contato_tel = Column(String(60), default="")
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
    origem = Column(String(20), default="gerado")   # "gerado" | "importado"
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
        return [{"id": u.id, "nome": u.nome or u.login, "login": u.login,
                 "email": (u.email or u.login)}
                for u in s.query(Usuario).filter(Usuario.perfil == perfil, Usuario.ativo == 1)
                .order_by(Usuario.nome).all()]


def email_do_usuario(nome):
    """E-mail de um usuário ativo pelo nome (prefere o campo email; cai no login)."""
    from sqlalchemy import func
    if not nome:
        return None
    with Session() as s:
        u = s.query(Usuario).filter(func.lower(Usuario.nome) == nome.strip().lower(),
                                    Usuario.ativo == 1).first()
        return (u.email or u.login) if u else None


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


class ModeloEmail(Base):
    """Modelo de e-mail editável pelo ADM. Suporta variáveis {{NOME}} substituídas no envio."""
    __tablename__ = "modelos_email"
    id = Column(Integer, primary_key=True)
    slug = Column(String(80), default="", unique=True)   # identificador único, ex: encaminhamento
    nome = Column(String(200), default="")               # rótulo exibido no seletor
    assunto = Column(String(300), default="")
    corpo = Column(Text, default="")
    etapa = Column(String(80), default="")               # etapa sugerida (opcional, para filtro)
    ativo = Column(Integer, default=1)
    padrao = Column(Integer, default=0)                  # 1 = modelo padrão (não pode ser excluído)
    criado_em = Column(DateTime, default=datetime.now)
    atualizado_em = Column(DateTime, default=datetime.now, onupdate=datetime.now)


# Variáveis dinâmicas disponíveis para uso nos modelos de e-mail
VARIAVEIS_EMAIL = {
    "{{CLIENTE}}": "Razão Social do cliente",
    "{{CNPJ}}": "CNPJ do cliente",
    "{{NUMERO_PROJETO}}": "Número do projeto",
    "{{NUMERO_PROPOSTA}}": "Número da proposta",
    "{{GCI}}": "GCI responsável pelo levantamento",
    "{{CONSULTOR}}": "Consultor(es) designado(s)",
    "{{CONSULTOR_A}}": "Primeiro consultor designado",
    "{{CONSULTOR_B}}": "Segundo consultor designado",
    "{{CONSULTOR_X}}": "Primeiro consultor (implantação)",
    "{{CONSULTOR_Y}}": "Segundo consultor (implantação)",
    "{{CONSULTOR_RESPONSAVEL}}": "Consultor responsável principal",
    "{{DATA_LEVANTAMENTO}}": "Data do levantamento agendado",
    "{{DATA_INICIO}}": "Data de início do projeto",
    "{{DATA_USO_OFICIAL}}": "Data de go-live (uso oficial)",
    "{{DATA_ENCERRAMENTO}}": "Data de encerramento",
    "{{MODULOS}}": "Módulos contratados",
    "{{HORAS_COBRADAS}}": "Horas cobradas",
    "{{HORAS_BONIFICADAS}}": "Horas bonificadas",
    "{{CONTATO_NOME}}": "Nome do contato no cliente",
    "{{CONTATO_EMAIL}}": "E-mail do contato no cliente",
    "{{CONTATO_TEL}}": "Telefone do contato no cliente",
    "{{RESPONSAVEL}}": "Responsável administrativo",
    "{{RAMO}}": "Ramo de atividade",
    "{{NOME_CONTATO}}": "Nome do contato (alias de {{CONTATO_NOME}})",
    "{{FONE_CONTATO}}": "Telefone do contato (alias de {{CONTATO_TEL}})",
}

# Mapeamento variável -> campo do projeto
_VAR_CAMPO = {
    "{{CLIENTE}}": "cliente",
    "{{CNPJ}}": "cnpj",
    "{{NUMERO_PROJETO}}": "numero_projeto",
    "{{NUMERO_PROPOSTA}}": "numero_proposta",
    "{{GCI}}": "gci",
    "{{CONSULTOR}}": "consultor",
    "{{CONSULTOR_A}}": "_consultor_a",
    "{{CONSULTOR_B}}": "_consultor_b",
    "{{CONSULTOR_X}}": "_consultor_a",
    "{{CONSULTOR_Y}}": "_consultor_b",
    "{{CONSULTOR_RESPONSAVEL}}": "consultor",
    "{{DATA_LEVANTAMENTO}}": "data_levantamento",
    "{{DATA_INICIO}}": "data_inicio",
    "{{DATA_USO_OFICIAL}}": "data_uso_oficial",
    "{{DATA_ENCERRAMENTO}}": "data_encerramento",
    "{{MODULOS}}": "modulos",
    "{{HORAS_COBRADAS}}": "horas_cobradas",
    "{{HORAS_BONIFICADAS}}": "horas_bonificadas",
    "{{CONTATO_NOME}}": "contato_nome",
    "{{CONTATO_EMAIL}}": "contato_email",
    "{{CONTATO_TEL}}": "contato_tel",
    "{{RESPONSAVEL}}": "responsavel",
    "{{RAMO}}": "ramo",
    "{{NOME_CONTATO}}": "contato_nome",
    "{{FONE_CONTATO}}": "contato_tel",
}


def renderizar_modelo(texto, proj):
    """Substitui variáveis {{VAR}} pelo valor correspondente do projeto.
    `proj` pode ser dict ou objeto Projeto."""
    if not texto:
        return texto
    # Normaliza para dict
    if not isinstance(proj, dict):
        proj = to_dict(proj)
    # Deriva consultores A/B a partir da string de consultores (separados por vírgula)
    consultores = [c.strip() for c in (proj.get("consultor") or "").split(",") if c.strip()]
    proj["_consultor_a"] = consultores[0] if len(consultores) > 0 else ""
    proj["_consultor_b"] = consultores[1] if len(consultores) > 1 else ""
    resultado = texto
    for var, campo in _VAR_CAMPO.items():
        valor = str(proj.get(campo) or "").strip()
        resultado = resultado.replace(var, valor)
    return resultado


def listar_modelos_email(apenas_ativos=True):
    """Retorna lista de dicts dos modelos de e-mail."""
    with Session() as s:
        q = s.query(ModeloEmail)
        if apenas_ativos:
            q = q.filter(ModeloEmail.ativo == 1)
        return [to_dict(m) for m in q.order_by(ModeloEmail.nome).all()]


def obter_modelo_email(mid):
    """Retorna dict do modelo pelo id, ou None."""
    with Session() as s:
        m = s.get(ModeloEmail, int(mid))
        return to_dict(m) if m else None


def salvar_modelo_email(dados, mid=None):
    """Cria ou atualiza um modelo. Retorna o id salvo."""
    with Session() as s:
        if mid:
            m = s.get(ModeloEmail, int(mid))
            if not m:
                raise ValueError("Modelo não encontrado.")
        else:
            m = ModeloEmail()
            s.add(m)
        m.nome = (dados.get("nome") or "").strip()
        m.assunto = (dados.get("assunto") or "").strip()
        m.corpo = (dados.get("corpo") or "").strip()
        m.etapa = (dados.get("etapa") or "").strip()
        m.ativo = 1 if dados.get("ativo", True) else 0
        # Gera slug único se novo
        if not mid:
            base = re.sub(r"[^a-z0-9]+", "-", m.nome.lower()).strip("-") or "modelo"
            slug = base
            n = 1
            while s.query(ModeloEmail).filter(ModeloEmail.slug == slug).count() > 0:
                slug = "%s-%d" % (base, n); n += 1
            m.slug = slug
        m.atualizado_em = datetime.now()
        s.commit()
        return m.id


def excluir_modelo_email(mid):
    """Exclui modelo pelo id. Modelos padrão (padrao=1) não podem ser excluídos.
    Retorna (ok, erro)."""
    with Session() as s:
        m = s.get(ModeloEmail, int(mid))
        if not m:
            return False, "Modelo não encontrado."
        if m.padrao:
            return False, "Modelos padrão não podem ser excluídos (apenas editados)."
        s.delete(m)
        s.commit()
        return True, None


# Modelos padrão para seed inicial (migrados dos hardcoded + templates .md)
_MODELOS_PADRAO = [
    {
        "slug": "encaminhamento",
        "nome": "Encaminhamento / Abertura da implantação",
        "assunto": "Implantação do SIGER® — {{CLIENTE}}",
        "corpo": ("Olá,\n\nDamos início à implantação do ERP SIGER® na {{CLIENTE}} "
                  "(projeto nº {{NUMERO_PROJETO}}). O consultor responsável será "
                  "{{CONSULTOR}}, que entrará em contato para alinhar o cronograma e "
                  "os próximos passos.\n\nFicamos à disposição.\n\n"
                  "Atenciosamente,\nEquipe de Implantação — Rech Sistemas de Gestão"),
        "etapa": "Agendamento",
        "padrao": 1,
    },
    {
        "slug": "cronograma",
        "nome": "Compartilhamento do cronograma",
        "assunto": "Cronograma de Implantação — {{CLIENTE}}",
        "corpo": ("Olá,\n\nSegue o cronograma de implantação do SIGER® para a {{CLIENTE}} "
                  "(projeto nº {{NUMERO_PROJETO}}), com as agendas e os macro tópicos de "
                  "cada visita/treinamento. Por favor, confirme as datas ou retorne com "
                  "ajustes.\n\nAtenciosamente,\nEquipe de Implantação — Rech Sistemas de Gestão"),
        "etapa": "Cronograma e Check-list",
        "padrao": 1,
    },
    {
        "slug": "encerramento",
        "nome": "Encerramento da implantação (ao cliente)",
        "assunto": "Encerramento da implantação do SIGER® — {{CLIENTE}}",
        "corpo": ("Prezado(a) {{CONTATO_NOME}},\n\n"
                  "Comunicamos o encerramento da implantação do ERP SIGER® junto à {{CLIENTE}}, "
                  "conforme o projeto nº {{NUMERO_PROJETO}}.\n\n"
                  "A partir de agora, o canal principal de atendimento passa a ser o Suporte da Rech:\n"
                  "- Telefone (51) 3582.4001 (prioritário)\n"
                  "- E-mail suporte@rech.com.br\n"
                  "- Manual do sistema: tecla F1 em qualquer módulo.\n\n"
                  "Encaminhamos em anexo o Termo de Encerramento para formalização. "
                  "Agradecemos a parceria durante o projeto.\n\n"
                  "Atenciosamente,\n{{CONSULTOR_RESPONSAVEL}} — Implantação Rech"),
        "etapa": "Encerramento",
        "padrao": 1,
    },
    {
        "slug": "encerramento-coordenacao",
        "nome": "Encerramento da implantação (à Coordenação)",
        "assunto": "Encerramento de Implantação — {{CLIENTE}} — RNS(I) {{NUMERO_PROJETO}}",
        "corpo": ("Olá,\n\nInformo o encerramento da implantação do cliente {{CLIENTE}} "
                  "(projeto nº {{NUMERO_PROJETO}}).\n\n"
                  "Segue o checklist formalizado:\n"
                  "a. Módulos não implantados: \n"
                  "b. RNS em aberto: \n"
                  "c. RNS não entregue: \n"
                  "d. Pendências não encaminhadas: \n"
                  "e. Saldo de horas: \n"
                  "f. Responsável pela atualização: \n"
                  "g. Ajuste de deslocamento: \n"
                  "h. Negociações em aberto: \n"
                  "i. Ressalvas para ações de publicidade: \n\n"
                  "Atenciosamente,\n{{CONSULTOR_RESPONSAVEL}}"),
        "etapa": "Encerramento",
        "padrao": 1,
    },
    {
        "slug": "encaminhamento-levantamento",
        "nome": "Encaminhamento — Levantamento / Demonstração",
        "assunto": "Encaminhamento — Levantamento / Demonstração — {{CLIENTE}}",
        "corpo": ("Bom dia!\n\nConsultor(es) {{CONSULTOR_A}} e {{CONSULTOR_B}}\n\n"
                  "Esse processo será(ão) executado(s) por você(s):\n"
                  "- [ ] Levantamento\n"
                  "- [ ] Demonstração\n\n"
                  "Elaborado o escopo dos documentos solicitados, segue abaixo o link de acesso.\n\n"
                  "- Levantamento de processos: (inserir link)\n"
                  "- Planilha de horas: (inserir link)\n\n"
                  "Atenciosamente,\nAdm"),
        "etapa": "Levantamento",
        "padrao": 1,
    },
    {
        "slug": "encaminhamento-implantacao",
        "nome": "Encaminhamento de Implantação (ao consultor)",
        "assunto": "Encaminhamento de Implantação — {{CLIENTE}}",
        "corpo": ("Bom dia!\n\nConsultor(es) {{CONSULTOR_X}} e {{CONSULTOR_Y}}!\n\n"
                  "Essa implantação ficará com você.\n\n"
                  "Por gentileza, proceder com nossa documentação padrão e aguardar a instalação "
                  "para marcar a visita inicial com o cliente.\n\n"
                  "Lembramos que o prazo para elaboração do Projeto, Cronograma e comunicação ao ADM "
                  "é de no máximo 5 dias úteis após o envio deste e-mail.\n\n"
                  "Contato no cliente: {{CONTATO_NOME}} — Fone: {{CONTATO_TEL}}\n\n"
                  "Atenciosamente,\nAdm"),
        "etapa": "Designação",
        "padrao": 1,
    },
    {
        "slug": "boas-vindas",
        "nome": "Boas-vindas ao cliente",
        "assunto": "Bem-vindo(a) à implantação do SIGER® — {{CLIENTE}}",
        "corpo": ("Olá, {{CONTATO_NOME}}!\n\n"
                  "Seja muito bem-vindo(a) ao processo de implantação do SIGER®. "
                  "A partir de agora seremos seu time de implantação na Rech.\n\n"
                  "Seus consultores: {{CONSULTOR_X}} e {{CONSULTOR_Y}}\n\n"
                  "Próximos passos:\n"
                  "1. Conclusão da instalação do SIGER® no seu ambiente.\n"
                  "2. Visita/reunião inicial de alinhamento (agendaremos em seguida).\n"
                  "3. Compartilharemos o cronograma com as datas e temas de cada etapa.\n\n"
                  "Qualquer dúvida nesta fase, fale diretamente com seus consultores.\n\n"
                  "Atenciosamente,\n{{CONSULTOR_RESPONSAVEL}} — Implantação Rech"),
        "etapa": "Designação",
        "padrao": 1,
    },
]


def _seed_modelos_email():
    """Insere modelos padrão se ainda não existirem (idempotente por slug)."""
    with Session() as s:
        for m in _MODELOS_PADRAO:
            existe = s.query(ModeloEmail).filter(ModeloEmail.slug == m["slug"]).count()
            if not existe:
                s.add(ModeloEmail(
                    slug=m["slug"], nome=m["nome"], assunto=m["assunto"],
                    corpo=m["corpo"], etapa=m.get("etapa", ""),
                    ativo=1, padrao=m.get("padrao", 0)
                ))
        s.commit()


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


# ===================================================================
#  Cadastros de referência (master data) — tabelas independentes:
#    - ChecklistModelo : roteiro/check-list por módulo (planilha "Roteiro e Check List")
#    - IndiceTopico    : Índice de Tópicos para Mapeamento de Processos
#  Seed inicial a partir dos YAMLs em tools/data (idempotente: só se a tabela
#  estiver vazia). Editáveis pelo painel (Sistema → Cadastros).
# ===================================================================
class ChecklistModelo(Base):
    """Linha do roteiro/check-list por módulo (catálogo de referência, editável)."""
    __tablename__ = "checklist_modelo"
    id = Column(Integer, primary_key=True)
    ordem = Column(Integer, default=0, index=True)
    modulo = Column(String(40), default="")
    adicional = Column(String(40), default="")
    tipo = Column(String(60), default="")
    integracoes = Column(Text, default="")
    golive = Column(String(20), default="")
    menu = Column(String(60), default="")
    item = Column(Text, default="")
    acao = Column(Text, default="")
    seq = Column(String(20), default="")


class IndiceTopico(Base):
    """Tópico do 'Índice de Tópicos para Mapeamento de Processos' (catálogo, editável).
    Cada registro é um Tópico, carregando todo o contexto (Módulo e Adicional)."""
    __tablename__ = "indice_topicos"
    id = Column(Integer, primary_key=True)
    ordem = Column(Integer, default=0, index=True)
    modulo_num = Column(String(10), default="")
    modulo_sigla = Column(String(10), default="")
    modulo = Column(String(120), default="")
    adicional_num = Column(String(10), default="")
    adicional_sigla = Column(String(10), default="")
    adicional = Column(String(120), default="")
    topico = Column(Text, default="")


CHECKMOD_CAMPOS = ["modulo", "adicional", "tipo", "integracoes", "golive",
                   "menu", "item", "acao", "seq"]
CHECKMOD_LABELS = {"modulo": "Módulo", "adicional": "Adicional", "tipo": "Tipo",
                   "integracoes": "Integrações", "golive": "Go-Live", "menu": "Menu",
                   "item": "Item", "acao": "Ação / Observação", "seq": "Seq."}
INDICE_CAMPOS = ["modulo_num", "modulo_sigla", "modulo",
                 "adicional_num", "adicional_sigla", "adicional", "topico"]
INDICE_LABELS = {"modulo_num": "Nº Mód.", "modulo_sigla": "Sigla Mód.", "modulo": "Módulo",
                 "adicional_num": "Nº Adic.", "adicional_sigla": "Sigla Adic.",
                 "adicional": "Adicional", "topico": "Tópico"}


def _seed_checklist_modelo():
    """Popula checklist_modelo a partir de tools/data/checklist_modulos.yaml (1ª vez)."""
    with Session() as s:
        if s.query(ChecklistModelo).count():
            return
        try:
            linhas = C.load_yaml("checklist_modulos.yaml").get("linhas", []) or []
        except Exception:
            linhas = []
        for i, l in enumerate(linhas):
            s.add(ChecklistModelo(ordem=i, **{c: str(l.get(c, "") or "") for c in CHECKMOD_CAMPOS}))
        s.commit()


def _seed_indice_topicos():
    """Popula indice_topicos a partir de tools/data/indice_topicos.yaml (1ª vez)."""
    with Session() as s:
        if s.query(IndiceTopico).count():
            return
        try:
            linhas = C.load_yaml("indice_topicos.yaml").get("linhas", []) or []
        except Exception:
            linhas = []
        for i, l in enumerate(linhas):
            s.add(IndiceTopico(ordem=int(l.get("ordem", i) or i),
                               **{c: str(l.get(c, "") or "") for c in INDICE_CAMPOS}))
        s.commit()


def _reseed_checklist_modelo():
    """Reimporta o checklist do YAML, substituindo TODO o catálogo. Retorna o nº de linhas."""
    with Session() as s:
        s.query(ChecklistModelo).delete()
        s.commit()
    _seed_checklist_modelo()
    with Session() as s:
        return s.query(ChecklistModelo).count()


def _reseed_indice_topicos():
    """Reimporta o índice do YAML, substituindo TODO o catálogo. Retorna o nº de linhas."""
    with Session() as s:
        s.query(IndiceTopico).delete()
        s.commit()
    _seed_indice_topicos()
    with Session() as s:
        return s.query(IndiceTopico).count()


def _proxima_ordem(Model):
    with Session() as s:
        m = s.query(Model).order_by(Model.ordem.desc()).first()
        return (m.ordem + 1) if m else 0


def checklist_modelo_listar(modulo="", q="", offset=0, limite=None):
    """Lista o catálogo de checklist com filtro por módulo/adicional e busca textual."""
    with Session() as s:
        query = s.query(ChecklistModelo)
        if modulo:
            query = query.filter((ChecklistModelo.modulo == modulo) |
                                 (ChecklistModelo.adicional == modulo))
        if q:
            like = "%%%s%%" % q
            query = query.filter(ChecklistModelo.item.ilike(like) |
                                 ChecklistModelo.acao.ilike(like) |
                                 ChecklistModelo.menu.ilike(like))
        total = query.count()
        query = query.order_by(ChecklistModelo.ordem, ChecklistModelo.id)
        if offset:
            query = query.offset(offset)
        if limite:
            query = query.limit(limite)
        return [to_dict(x) for x in query.all()], total


def checklist_modelo_modulos():
    """Códigos distintos (modulo/adicional) para o filtro do cadastro."""
    with Session() as s:
        a = {r[0] for r in s.query(ChecklistModelo.modulo).distinct() if r[0]}
        a |= {r[0] for r in s.query(ChecklistModelo.adicional).distinct() if r[0]}
    return sorted(a)


def checklist_modelo_salvar(form):
    """Cria/atualiza uma linha do catálogo de checklist a partir de um form dict."""
    with Session() as s:
        cid = form.get("id")
        obj = s.get(ChecklistModelo, int(cid)) if cid else ChecklistModelo(ordem=_proxima_ordem(ChecklistModelo))
        for c in CHECKMOD_CAMPOS:
            setattr(obj, c, (form.get(c) or "").strip())
        if not cid:
            s.add(obj)
        s.commit()
        return obj.id


def checklist_modelo_excluir(cid):
    with Session() as s:
        obj = s.get(ChecklistModelo, int(cid))
        if obj:
            s.delete(obj); s.commit()


def indice_listar(modulo="", q="", offset=0, limite=None):
    """Lista o Índice de Tópicos com filtro por sigla do módulo e busca textual."""
    with Session() as s:
        query = s.query(IndiceTopico)
        if modulo:
            query = query.filter(IndiceTopico.modulo_sigla == modulo)
        if q:
            like = "%%%s%%" % q
            query = query.filter(IndiceTopico.topico.ilike(like) |
                                 IndiceTopico.adicional.ilike(like) |
                                 IndiceTopico.modulo.ilike(like))
        total = query.count()
        query = query.order_by(IndiceTopico.ordem, IndiceTopico.id)
        if offset:
            query = query.offset(offset)
        if limite:
            query = query.limit(limite)
        return [to_dict(x) for x in query.all()], total


def indice_modulos():
    """Lista (sigla, nome) distintos dos módulos principais, na ordem da planilha."""
    with Session() as s:
        vistos, out = set(), []
        for r in s.query(IndiceTopico).order_by(IndiceTopico.ordem, IndiceTopico.id).all():
            chave = (r.modulo_sigla, r.modulo)
            if r.modulo_sigla and chave not in vistos:
                vistos.add(chave); out.append({"sigla": r.modulo_sigla, "nome": r.modulo})
        return out


def indice_salvar(form):
    """Cria/atualiza um tópico do índice a partir de um form dict."""
    with Session() as s:
        cid = form.get("id")
        obj = s.get(IndiceTopico, int(cid)) if cid else IndiceTopico(ordem=_proxima_ordem(IndiceTopico))
        for c in INDICE_CAMPOS:
            setattr(obj, c, (form.get(c) or "").strip())
        if not cid:
            s.add(obj)
        s.commit()
        return obj.id


def indice_excluir(cid):
    with Session() as s:
        obj = s.get(IndiceTopico, int(cid))
        if obj:
            s.delete(obj); s.commit()


# ===================================================================
#  Modelos de Documentos (layouts FIÉIS das fases) — registro + versões + campos
#    - ModeloDocumento        : 1 por fase (Levantamento, Projeto, Cronograma, Termo)
#    - ModeloDocumentoVersao  : histórico de arquivos (.docx/.xlsx) — o vigente é o último
#    - ModeloDocumentoCampo   : mapa de preenchimento (placeholder -> de onde vem no projeto)
#  Arquivos-base fiéis ficam em tools/templates/layouts (empacotados); as versões
#  enviadas ficam no store gravável <DATA_WRITE>/modelos_documento.
# ===================================================================
class ModeloDocumento(Base):
    __tablename__ = "modelos_documento"
    id = Column(Integer, primary_key=True)
    slug = Column(String(40), default="", index=True)
    nome = Column(String(160), default="")
    fase = Column(String(40), default="")
    tipo = Column(String(10), default="docx")     # docx | xlsx
    arquivo = Column(String(200), default="")      # nome do arquivo VIGENTE no store
    descricao = Column(Text, default="")
    ordem = Column(Integer, default=0)
    atualizado_em = Column(DateTime, default=datetime.now)


class ModeloDocumentoVersao(Base):
    __tablename__ = "modelos_documento_versoes"
    id = Column(Integer, primary_key=True)
    modelo_id = Column(Integer, index=True)
    versao = Column(Integer, default=1)
    arquivo = Column(String(200), default="")
    autor = Column(String(120), default="")
    motivo = Column(Text, default="")
    vigente = Column(Integer, default=0)
    criado_em = Column(DateTime, default=datetime.now)


class ModeloDocumentoCampo(Base):
    __tablename__ = "modelos_documento_campos"
    id = Column(Integer, primary_key=True)
    modelo_id = Column(Integer, index=True)
    ordem = Column(Integer, default=0)
    secao = Column(String(120), default="")        # seção do documento
    placeholder = Column(String(200), default="")  # marcador no layout (ex.: <Razão Social>)
    rotulo = Column(String(160), default="")        # nome amigável do campo
    origem = Column(String(160), default="")        # de onde vem no projeto
    obrigatorio = Column(Integer, default=0)
    observacao = Column(Text, default="")


MODELODOC_CAMPO_CAMPOS = ["secao", "placeholder", "rotulo", "origem", "obrigatorio", "observacao"]
MODELODOC_CAMPO_LABELS = {"secao": "Seção", "placeholder": "Placeholder no layout",
                          "rotulo": "Campo", "origem": "Origem no projeto",
                          "obrigatorio": "Obrigatório", "observacao": "Observação"}

_MODELOS_DOC_DEFAULTS = [
    {"slug": "levantamento", "nome": "Mapeamento / Levantamento de Processos",
     "fase": "Levantamento", "tipo": "docx", "base": "levantamento.docx",
     "descricao": "Layout do mapeamento de processos preenchido na fase de Levantamento."},
    {"slug": "projeto", "nome": "Projeto de Implantação",
     "fase": "Projeto", "tipo": "docx", "base": "projeto.docx",
     "descricao": "Layout do Projeto de Implantação gerado na fase de Projeto."},
    {"slug": "cronograma", "nome": "Cronograma",
     "fase": "Cronograma e Check-list", "tipo": "xlsx", "base": "cronograma.xlsx",
     "descricao": "Planilha de cronograma de visitas, tarefas e pendências."},
    {"slug": "termo", "nome": "Termo de Encerramento",
     "fase": "Encerramento", "tipo": "docx", "base": "termo.docx",
     "descricao": "Layout do Termo de Encerramento gerado no fim da implantação."},
]

# Mapa de preenchimento por modelo: (seção, placeholder, rótulo, origem, obrigatório, obs)
_MODELOS_DOC_CAMPOS = {
    "levantamento": [
        ("Identificação", "<Nome Cliente>", "Razão Social", "projeto.cliente", 1, ""),
        ("Identificação", "Data: <xx/xx/xxxx>", "Data do Levantamento", "projeto.data_levantamento", 0, ""),
        ("Identificação", "Responsáveis: <...>", "Responsáveis (GCI/Consultor)", "projeto.gci + designações", 0, ""),
        ("Identificação da Empresa", "Ramo Atividade:", "Ramo de Atividade", "projeto.ramo", 0, ""),
        ("Identificação da Empresa", "Produto:", "Produto", "manual", 0, "Produto principal do cliente"),
        ("Identificação da Empresa", "Fornecedor Atual Software:", "Software atual", "manual", 0, ""),
        ("Identificação da Empresa", "<Localização / Filiais:>", "Localização / Filiais", "manual", 0, ""),
        ("Identificação da Empresa", "Observações / Objetivos:", "Objetivos", "projeto.observacoes", 0, ""),
        ("Identificação da Empresa", "<Quantidade usuários e identificação:>", "Qtd. de usuários", "manual", 0, ""),
        ("Usuários (tabela)", "Nome / E-mail / Atribuições", "Usuários-chave", "designações / usuarios", 0, ""),
        ("Módulos e Adicionais (A)", "Previstos antes do Levantamento", "Módulos contratados", "projeto.modulos", 1, ""),
        ("Módulos e Adicionais (B)", "Identificados no Levantamento", "Módulos adicionais", "manual", 0, ""),
        ("Implantação/Treinamento", "Quantidade de horas Cobradas", "Horas cobradas", "projeto.horas_cobradas", 0, ""),
        ("Implantação/Treinamento", "Quantidade de horas Bonificadas", "Horas bonificadas", "projeto.horas_bonificadas", 0, ""),
        ("Conversões", "CONVERSÕES <(xxxx horas)>", "Conversões", "manual", 0, ""),
        ("Mapeamento por área", "<Colar aqui o quadro com as perguntas>", "Tópicos por módulo", "Cadastro: Índice de Tópicos", 0, "Usar o cadastro Índice de Tópicos por módulo"),
    ],
    "projeto": [
        ("Cabeçalho", "Nome do Cliente: <RAZÃO SOCIAL>", "Razão Social", "projeto.cliente", 1, ""),
        ("Escopo", "CNPJ: <(preencher)>", "CNPJ", "projeto.cnpj", 1, ""),
        ("Objetivos", "<(preencher)>", "Objetivos", "projeto.observacoes", 0, ""),
        ("Conversões (tabela)", "Conversão (Sim/Não) / Dados / Obs", "Conversões por módulo", "manual", 0, ""),
        ("Detalhamento das Rotinas", "- Módulos Previstos <XX>", "Módulos previstos por área", "projeto.modulos", 1, ""),
        ("Detalhamento das Rotinas", "Detalhamento das rotinas <XX>", "Rotinas atendidas", "Cadastro: Índice de Tópicos / manual", 0, ""),
        ("Equipes (Rech)", "Gerente de Contas do Projeto", "GCI", "projeto.gci", 0, ""),
        ("Equipes (Rech)", "Redator do Projeto", "Redator", "manual", 0, ""),
        ("Equipes (Rech)", "Consultor/Implantador", "Consultor", "projeto.consultor / designações", 0, ""),
        ("Equipes (Cliente)", "Encarregado pelo Projeto", "Encarregado (cliente)", "projeto.contato_nome", 0, ""),
        ("Tabela de Usuários", "Nome / E-mail / Área / Assina Protocolo", "Usuários do cliente", "designações / usuarios", 0, ""),
        ("Cronograma Macro (tabela)", "Período previsto <XX>", "Datas das etapas", "cronograma_itens / datas", 0, ""),
        ("Tempo Estimado", "<XX horas bonificadas>", "Horas bonificadas", "projeto.horas_bonificadas", 0, ""),
        ("Tempo Estimado", "<XX horas cobradas>", "Horas cobradas", "projeto.horas_cobradas", 0, ""),
        ("Rodapé", "Novo Hamburgo, <_> de <_> de 202<X>", "Data de emissão", "data atual", 0, ""),
    ],
    "cronograma": [
        ("Cabeçalho", "Consultor:", "Consultor", "projeto.consultor / designações", 0, ""),
        ("Cabeçalho", "Cliente: XXXX - RAZÃO SOCIAL", "Razão Social", "projeto.cliente", 1, ""),
        ("Cabeçalho", "Usuário chave:", "Usuário chave", "designações", 0, ""),
        ("Cabeçalho", "Horas do Planejamento", "Horas planejamento", "projeto.horas_cobradas", 0, ""),
        ("Cabeçalho", "Hrs previstas bonificadas", "Horas bonificadas", "projeto.horas_bonificadas", 0, ""),
        ("Aba: Cronograma de visitas", "Data / Local / Turno / Horário / Técnico / Módulo(s) / O que será abordado / Ações", "Linhas de visita", "cronograma_itens", 0, ""),
        ("Aba: Tarefas_usuários", "Tipo / Tarefa / Status / Responsável / Datas", "Tarefas do usuário", "checklist_itens / manual", 0, ""),
        ("Aba: Pendências_Consultores", "Tipo / Tarefa / Prazo / Status / Dias de atraso", "Pendências", "manual", 0, ""),
    ],
    "termo": [
        ("Cabeçalho", "Cliente: <Razão Social Longa>", "Razão Social", "projeto.cliente", 1, ""),
        ("Resumo Geral (tabela)", "Módulo / Adicional / Processo / Status de Uso / Obs.", "Módulos e status de uso", "projeto.modulos / designações", 0, ""),
        ("Alterações fora do escopo", "<Detalhamento das alterações>", "Alterações / incrementos", "manual", 0, ""),
        ("Pendências", "<Pendência 01> / <Técnico responsável> / <Detalhamento>", "Pendências sequenciadas", "manual", 0, ""),
        ("Rodapé", "Novo Hamburgo, _ de _ de 202X", "Data de encerramento", "projeto.data_encerramento", 0, ""),
    ],
}


def _modelos_doc_store():
    d = os.path.join(C.DATA_WRITE, "modelos_documento")
    os.makedirs(d, exist_ok=True)
    return d


def _layouts_base_dir():
    return os.path.join(os.path.dirname(C.DATA), "templates", "layouts")


def _seed_modelos_documento():
    """Cria os 4 modelos (1ª vez), copiando o layout fiel como versão 1 e semeando os campos."""
    import shutil
    base, store = _layouts_base_dir(), _modelos_doc_store()
    with Session() as s:
        if s.query(ModeloDocumento).count():
            return
        for i, m in enumerate(_MODELOS_DOC_DEFAULTS):
            stored = "%s_v1.%s" % (m["slug"], m["tipo"])
            try:
                origem = os.path.join(base, m["base"])
                if os.path.exists(origem):
                    shutil.copy2(origem, os.path.join(store, stored))
            except Exception:
                pass
            mod = ModeloDocumento(slug=m["slug"], nome=m["nome"], fase=m["fase"], tipo=m["tipo"],
                                  arquivo=stored, descricao=m["descricao"], ordem=i)
            s.add(mod); s.flush()
            s.add(ModeloDocumentoVersao(modelo_id=mod.id, versao=1, arquivo=stored,
                                        autor="sistema", motivo="Layout inicial (anexo).", vigente=1))
            for j, c in enumerate(_MODELOS_DOC_CAMPOS.get(m["slug"], [])):
                s.add(ModeloDocumentoCampo(modelo_id=mod.id, ordem=j, secao=c[0], placeholder=c[1],
                                           rotulo=c[2], origem=c[3], obrigatorio=c[4], observacao=c[5]))
        s.commit()


def modelos_documento_listar():
    with Session() as s:
        out = []
        for m in s.query(ModeloDocumento).order_by(ModeloDocumento.ordem, ModeloDocumento.id).all():
            d = to_dict(m)
            d["n_versoes"] = s.query(ModeloDocumentoVersao).filter_by(modelo_id=m.id).count()
            d["n_campos"] = s.query(ModeloDocumentoCampo).filter_by(modelo_id=m.id).count()
            out.append(d)
        return out


def modelo_documento_get(mid):
    with Session() as s:
        m = s.get(ModeloDocumento, int(mid))
        return to_dict(m) if m else None


def modelo_documento_versoes(mid):
    with Session() as s:
        return [to_dict(x) for x in s.query(ModeloDocumentoVersao)
                .filter_by(modelo_id=int(mid)).order_by(ModeloDocumentoVersao.versao.desc()).all()]


def modelo_documento_campos(mid):
    with Session() as s:
        return [to_dict(x) for x in s.query(ModeloDocumentoCampo)
                .filter_by(modelo_id=int(mid)).order_by(ModeloDocumentoCampo.ordem, ModeloDocumentoCampo.id).all()]


def modelo_documento_proxima_versao(mid):
    with Session() as s:
        v = s.query(ModeloDocumentoVersao).filter_by(modelo_id=int(mid)).order_by(
            ModeloDocumentoVersao.versao.desc()).first()
        return (v.versao + 1) if v else 1


def registrar_versao_documento(mid, stored_name, autor="", motivo=""):
    """Registra uma nova versão (já salva no store) e a torna a vigente."""
    with Session() as s:
        mod = s.get(ModeloDocumento, int(mid))
        if not mod:
            return None
        n = modelo_documento_proxima_versao(mid)
        s.query(ModeloDocumentoVersao).filter_by(modelo_id=mod.id).update({"vigente": 0})
        s.add(ModeloDocumentoVersao(modelo_id=mod.id, versao=n, arquivo=stored_name,
                                    autor=autor or "", motivo=motivo or "", vigente=1))
        mod.arquivo = stored_name
        mod.atualizado_em = datetime.now()
        s.commit()
        return n


def modelo_documento_arquivo_path(mid, versao_id=None):
    """Caminho absoluto do arquivo vigente (ou de uma versão específica) no store."""
    with Session() as s:
        if versao_id:
            v = s.get(ModeloDocumentoVersao, int(versao_id))
            arq = v.arquivo if v and v.modelo_id == int(mid) else None
        else:
            m = s.get(ModeloDocumento, int(mid))
            arq = m.arquivo if m else None
    if not arq:
        return None
    return os.path.join(_modelos_doc_store(), arq)


def modelo_documento_campo_salvar(mid, form):
    with Session() as s:
        cid = form.get("id")
        obj = s.get(ModeloDocumentoCampo, int(cid)) if cid else ModeloDocumentoCampo(
            modelo_id=int(mid), ordem=_proxima_ordem(ModeloDocumentoCampo))
        obj.modelo_id = int(mid)
        for c in ("secao", "placeholder", "rotulo", "origem", "observacao"):
            setattr(obj, c, (form.get(c) or "").strip())
        obj.obrigatorio = 1 if form.get("obrigatorio") else 0
        if not cid:
            s.add(obj)
        s.commit()
        return obj.id


def modelo_documento_campo_excluir(cid):
    with Session() as s:
        obj = s.get(ModeloDocumentoCampo, int(cid))
        if obj:
            s.delete(obj); s.commit()


# ===================================================================
#  Respostas do Levantamento (por projeto) — as perguntas do Índice de Tópicos
#  dos módulos contratados viram campos respondíveis no painel. Estas respostas
#  alimentam a geração/criação do Projeto (liga Levantamento → Projeto).
# ===================================================================
class LevantamentoResposta(Base):
    __tablename__ = "levantamento_respostas"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    ordem = Column(Integer, default=0)
    modulo_sigla = Column(String(10), default="")
    modulo = Column(String(120), default="")
    adicional = Column(String(120), default="")
    topico = Column(Text, default="")
    resposta = Column(Text, default="")


def levantamento_seed(projeto_id, modulos_str):
    """Semeia (1ª vez) as linhas de resposta a partir do Índice de Tópicos dos módulos
    contratados. Idempotente: não recria nem apaga respostas já digitadas. Devolve o total."""
    import re as _re
    with Session() as s:
        ja = s.query(LevantamentoResposta).filter_by(projeto_id=projeto_id).count()
    if ja:
        return ja
    sigs = [m.strip().upper() for m in _re.split(r"[,;\n]+", modulos_str or "") if m.strip()]
    nomes = {m["sigla"].upper(): m["nome"] for m in indice_modulos()}
    linhas, vistos = [], set()
    for sig in sigs:
        if sig in vistos:
            continue
        vistos.add(sig)
        tops, _ = indice_listar(modulo=sig)
        for l in tops:
            linhas.append((sig, nomes.get(sig, l.get("modulo", "")),
                           l.get("adicional", ""), l.get("topico", "")))
    with Session() as s:
        for i, (sig, nome, adic, top) in enumerate(linhas):
            s.add(LevantamentoResposta(projeto_id=projeto_id, ordem=i, modulo_sigla=sig,
                                       modulo=nome, adicional=adic, topico=top))
        s.commit()
    return len(linhas)


def levantamento_respostas(projeto_id):
    with Session() as s:
        return [to_dict(x) for x in s.query(LevantamentoResposta)
                .filter_by(projeto_id=projeto_id)
                .order_by(LevantamentoResposta.ordem, LevantamentoResposta.id).all()]


def levantamento_salvar(projeto_id, form):
    """Salva as respostas (campos `resposta_<id>`). Devolve o nº de respostas preenchidas."""
    with Session() as s:
        rs = s.query(LevantamentoResposta).filter_by(projeto_id=projeto_id).all()
        n = 0
        for r in rs:
            v = (form.get("resposta_%d" % r.id) or "").strip()
            r.resposta = v
            if v:
                n += 1
        s.commit()
        return n


def levantamento_resumo(projeto_id):
    """(respondidas, total) das perguntas do Levantamento do projeto."""
    with Session() as s:
        rs = s.query(LevantamentoResposta).filter_by(projeto_id=projeto_id).all()
    total = len(rs)
    resp = sum(1 for r in rs if (r.resposta or "").strip())
    return resp, total


def levantamento_importado(projeto_id):
    """Documento de Levantamento IMPORTADO (.docx enviado), se houver. Devolve dict ou None."""
    with Session() as s:
        d = (s.query(Documento)
             .filter_by(projeto_id=projeto_id, tipo="levantamento", origem="importado")
             .order_by(Documento.id.desc()).first())
        return to_dict(d) if d else None


def levantamento_importar_respostas(projeto_id, docx_path):
    """Lê um Mapeamento (.docx) e preenche as respostas semeadas casando cada tópico
    com a frase do documento (texto após o tópico). Não apaga respostas existentes.
    Devolve o nº de respostas preenchidas a partir do arquivo."""
    from docx import Document as _Docx
    doc = _Docx(docx_path)
    linhas = [(p.text or "") for p in doc.paragraphs if (p.text or "").strip()]

    def _depois(raw, top):
        rl, tl = raw.lower(), top.lower().strip()
        i = rl.find(tl)
        if i < 0 or not tl:
            return ""
        resto = raw[i + len(tl):].lstrip(" \t:;-–—•·").strip()
        # ignora placeholders do modelo em branco (ex.: "<xxxx>")
        if not resto or (resto.startswith("<") and resto.endswith(">")):
            return ""
        return resto

    with Session() as s:
        rs = s.query(LevantamentoResposta).filter_by(projeto_id=projeto_id).all()
        n = 0
        for r in rs:
            top = (r.topico or "").strip()
            if not top:
                continue
            ans = ""
            for raw in linhas:
                ans = _depois(raw, top)
                if ans:
                    break
            if ans:
                r.resposta = ans
                n += 1
        s.commit()
        return n


# --- Agendador de Visitas (cronograma por calendário) ----------------------------
# Substitui o cronograma linear: as VISITAS (V{seq}) vêm do Check List (checklist_modelo)
# por módulo contratado, agrupadas por (modulo, seq). Cada atividade é um "card" alocável
# no calendário (data + turno + técnico).
class AtividadeCronograma(Base):
    """Atividade alocável do agendador de visitas (deriva do Check List)."""
    __tablename__ = "cronograma_atividades"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    modulo = Column(String(40), default="")
    seq = Column(Integer, default=0)            # nº da Visita (V{seq})
    ordem = Column(Integer, default=0)          # ordem da atividade dentro da visita
    descricao = Column(Text, default="")        # "Menu - Item"
    tipo = Column(String(60), default="")       # Tipo de Atividade (do Check List)
    data = Column(String(10), default="")       # "AAAA-MM-DD" ("" = não alocada)
    turno = Column(String(10), default="")      # "manha" | "tarde" | ""
    tecnico = Column(String(120), default="")   # consultor designado
    status = Column(String(20), default="Previsto")
    is_copia = Column(Boolean, default=False)


def _seq_int(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def cronograma_atividades_seed(projeto_id, modulos_str):
    """Semeia (1ª vez) as atividades do agendador a partir do Check List dos módulos
    contratados, agrupadas por módulo + seq (Visita). Idempotente. Devolve o total."""
    import re as _re
    with Session() as s:
        ja = s.query(AtividadeCronograma).filter_by(projeto_id=projeto_id).count()
    if ja:
        return ja
    sigs = [m.strip().upper() for m in _re.split(r"[,;\n]+", modulos_str or "") if m.strip()]
    if not sigs:
        return 0
    novas, contador = [], {}
    with Session() as s:
        rows = (s.query(ChecklistModelo)
                .filter(ChecklistModelo.modulo.in_(sigs))
                .order_by(ChecklistModelo.modulo, ChecklistModelo.ordem, ChecklistModelo.id).all())
        for r in rows:
            seq = _seq_int(r.seq)
            if not seq or seq <= 0:
                continue
            menu, item = (r.menu or "").strip(), (r.item or "").strip()
            desc = (menu + " - " + item).strip(" -") if (menu or item) else (r.acao or "").strip()
            chave = (r.modulo, seq)
            contador[chave] = contador.get(chave, 0) + 1
            novas.append(AtividadeCronograma(
                projeto_id=projeto_id, modulo=r.modulo, seq=seq, ordem=contador[chave],
                descricao=desc, tipo=(r.tipo or "").strip(), status="Previsto"))
        for a in novas:
            s.add(a)
        s.commit()
    return len(novas)


def cronograma_atividades(projeto_id):
    """Lista as atividades do agendador (ordenadas por módulo, visita e ordem)."""
    with Session() as s:
        return [to_dict(x) for x in s.query(AtividadeCronograma)
                .filter_by(projeto_id=projeto_id)
                .order_by(AtividadeCronograma.modulo, AtividadeCronograma.seq,
                          AtividadeCronograma.ordem, AtividadeCronograma.id).all()]


def cronograma_visitas(projeto_id):
    """Agrupa as atividades em Visitas (módulo+seq) para o painel lateral do agendador."""
    grupos = {}
    for a in cronograma_atividades(projeto_id):
        chave = (a["modulo"], a["seq"])
        g = grupos.get(chave)
        if g is None:
            g = {"modulo": a["modulo"], "seq": a["seq"],
                 "titulo": "Visita V%s (%s)" % (a["seq"], a["modulo"]),
                 "atividades": []}
            grupos[chave] = g
        g["atividades"].append(a)
    return sorted(grupos.values(), key=lambda g: (g["modulo"], g["seq"]))


def cronograma_alocar(atividade_id, projeto_id=None, data=None, turno=None, tecnico=None, status=None):
    """Atualiza uma atividade do agendador. Cada campo é opcional: None = não mexe;
    para data/turno, "" desaloca (volta à lista de visitas). `projeto_id` (quando passado)
    garante que a atividade pertence ao projeto. Devolve o dict atualizado ou None."""
    with Session() as s:
        a = s.get(AtividadeCronograma, int(atividade_id))
        if not a or (projeto_id is not None and a.projeto_id != projeto_id):
            return None
        if data is not None:
            a.data = data.strip()
        if turno is not None:
            a.turno = turno.strip()
        if tecnico is not None:
            a.tecnico = (tecnico or "").strip()
        if status is not None:
            a.status = (status or "").strip() or "Previsto"
        s.commit()
        return to_dict(a)


# Horário padrão por turno (HH:MM) — usado quando o slot não tem horário definido.
TURNO_PADRAO = {"manha": ("08:00", "12:00"), "tarde": ("13:00", "17:00")}


class SlotCronograma(Base):
    """Horário de início/fim de um turno (data+turno) do agendador, por projeto."""
    __tablename__ = "cronograma_slots"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    data = Column(String(10), default="")       # "AAAA-MM-DD"
    turno = Column(String(10), default="")      # "manha" | "tarde"
    hora_inicio = Column(String(5), default="")  # "HH:MM"
    hora_fim = Column(String(5), default="")


def cronograma_slots(projeto_id):
    """{(data, turno): {'hora_inicio','hora_fim'}} dos slots com horário definido."""
    with Session() as s:
        return {(r.data, r.turno): {"hora_inicio": r.hora_inicio, "hora_fim": r.hora_fim}
                for r in s.query(SlotCronograma).filter_by(projeto_id=projeto_id).all()}


def cronograma_slot_horas(slots, data, turno):
    """Horário (inicio, fim) de um slot: o definido, senão o padrão do turno."""
    st = slots.get((data, turno))
    if st and (st.get("hora_inicio") or st.get("hora_fim")):
        ini, fim = TURNO_PADRAO.get(turno, ("", ""))
        return (st.get("hora_inicio") or ini, st.get("hora_fim") or fim)
    return TURNO_PADRAO.get(turno, ("", ""))


def cronograma_slot_salvar(projeto_id, data, turno, hora_inicio, hora_fim):
    """Cria/atualiza o horário de um slot (data+turno). Devolve o dict atualizado."""
    data, turno = (data or "").strip(), (turno or "").strip()
    if not data or turno not in ("manha", "tarde"):
        return None
    with Session() as s:
        r = (s.query(SlotCronograma)
             .filter_by(projeto_id=projeto_id, data=data, turno=turno).first())
        if not r:
            r = SlotCronograma(projeto_id=projeto_id, data=data, turno=turno)
            s.add(r)
        r.hora_inicio = (hora_inicio or "").strip()
        r.hora_fim = (hora_fim or "").strip()
        s.commit()
        return {"data": data, "turno": turno, "hora_inicio": r.hora_inicio, "hora_fim": r.hora_fim}


# --- Conteúdo estruturado dos documentos (telas de edição que espelham os layouts) ---
class DocConteudo(Base):
    """Campo estruturado de um documento (levantamento/projeto) por projeto. As telas de
    edição (espelho do layout) gravam aqui; a geração lê para preencher o .docx."""
    __tablename__ = "doc_conteudo"
    id = Column(Integer, primary_key=True)
    projeto_id = Column(Integer, index=True)
    doc = Column(String(30), default="")     # levantamento | projeto
    campo = Column(String(60), default="")
    valor = Column(Text, default="")


def doc_conteudo(projeto_id, doc):
    """Devolve {campo: valor} do documento `doc` para o projeto."""
    with Session() as s:
        return {r.campo: (r.valor or "") for r in s.query(DocConteudo)
                .filter_by(projeto_id=projeto_id, doc=doc).all()}


def doc_conteudo_salvar(projeto_id, doc, campos, form):
    """Salva os campos (lista de chaves) do documento a partir de um form dict."""
    atual = doc_conteudo(projeto_id, doc)
    with Session() as s:
        for c in campos:
            v = (form.get(c) or "").strip()
            if c in atual:
                obj = s.query(DocConteudo).filter_by(projeto_id=projeto_id, doc=doc, campo=c).first()
                obj.valor = v
            else:
                s.add(DocConteudo(projeto_id=projeto_id, doc=doc, campo=c, valor=v))
        s.commit()


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
        _seed_modelos_email()
        _seed_checklist_modelo()
        _seed_indice_topicos()
        _seed_modelos_documento()
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
    # Próxima ação = documento faltante; se os docs estão ok mas falta a AÇÃO
    # (GCI / data do Levantamento / consultores), a próxima ação passa a ser essa.
    proxima = next((i for i in itens if not i["ok"]), None)
    acao_ok = acao_entrada_ok(prox, d) if prox else True
    if proxima is None and prox and not acao_ok:
        chave, label = ACAO_ENTRADA[prox]
        # Para o agendamento, distingue entre etapa 1 (GCI) e etapa 2 (data)
        if chave == "gci_e_data_levantamento":
            if not gci_definido(d):
                proxima = {"tipo": "acao:definir_gci", "label": "Definir GCI Responsável", "ok": False}
            else:
                proxima = {"tipo": "acao:data_levantamento", "label": "Definir Data do Levantamento", "ok": False}
        else:
            proxima = {"tipo": "acao:" + chave, "label": label, "ok": False}
    # Campos obrigatórios faltantes na etapa atual
    cf = campos_faltantes(etapa, d)
    ok_avancar, bloqueios = pode_avancar(etapa, d, docs)
    return {
        "stepper": stepper, "fase": MACRO_FASES[cur], "etapa": etapa,
        "go_live": d.get("data_uso_oficial") or "", "atraso": atraso,
        "horas_cob": cob, "horas_bon": bon, "horas_total": cob + bon,
        "docs_ok": sum(1 for i in itens if i["ok"]), "docs_total": len(itens),
        "proxima": proxima,
        "prox_etapa": prox, "avancar_ok": ok_avancar,
        "gate": gate_ref,
        "campos_faltantes": cf,
        "bloqueios": bloqueios,
    }
