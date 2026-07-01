# -*- coding: utf-8 -*-
"""Disponibilidade dos consultores via banco interno (configurável pelo Administrador).

O ADM define, na tela 'Disponibilidade' (área Sistema), a CONEXÃO (campos ou URL
SQLAlchemy) e o SELECT que devolve os COMPROMISSOS (ocupação) dos técnicos. O
agendador usa isso para liberar no calendário só os dias/turnos livres para todos
os técnicos envolvidos.

Config fica em DATA_WRITE/disponibilidade.json (gitignored, fora do versionamento).

Contrato do SELECT (o ADM escreve livremente):
  - parâmetros disponíveis:
      :data_ini e :data_fim -> intervalo ('AAAA-MM-DD'); o painel passa hoje..+18 meses;
      :tecnicos             -> OPCIONAL, lista de CÓDIGOS dos consultores envolvidos (IN).
                               Use `... IN :tecnicos` para o banco já devolver só eles
                               (muito mais rápido). Sem :tecnicos, a janela fica na semana.
  - colunas esperadas no resultado (use AS para renomear):
      tecnico  -> CÓDIGO do técnico no SICLA — casa com o "Código SICLA" do cadastro de usuário
      data     -> data do compromisso ('AAAA-MM-DD' ou DATE)
      turno    -> opcional: 'manha' | 'tarde' (se ausente/vazio, considera o DIA inteiro ocupado)
  - cada linha representa um compromisso (ocupação) do técnico.
  - exemplo: SELECT cod AS tecnico, dia AS data, periodo AS turno FROM agenda
             WHERE dia BETWEEN :data_ini AND :data_fim AND cod IN :tecnicos
"""
import os
import json
import _common as C

CFG = os.path.join(C.DATA_WRITE, "disponibilidade.json")

# tipo -> dialeto/driver SQLAlchemy (o driver precisa estar instalado no servidor)
DIALETOS = {
    "postgresql": "postgresql+psycopg2",
    "mysql": "mysql+pymysql",
    "sqlserver": "mssql+pyodbc",
    "oracle": "oracle+oracledb",
}

# dialeto -> pacote pip para instalar quando o driver faltar
DRIVER_PKG = {
    "postgresql+psycopg2": "psycopg2-binary",
    "mysql+pymysql": "pymysql",
    "mssql+pyodbc": "pyodbc  (+ driver ODBC do SQL Server no S.O.)",
    "oracle+oracledb": "oracledb",
}


def load_cfg():
    if os.path.exists(CFG):
        try:
            with open(CFG, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def salvar_cfg(form):
    """Salva a config a partir do form. A senha não é apagada se vier em branco."""
    cfg = load_cfg()
    for k in ("tipo", "host", "porta", "banco", "usuario", "url", "select", "oracle_lib_dir"):
        cfg[k] = (form.get(k) or "").strip()
    cfg["ativo"] = bool(form.get("ativo"))
    cfg["oracle_thick"] = bool(form.get("oracle_thick"))   # Oracle Instant Client
    senha = (form.get("senha") or "").strip()
    if senha:
        cfg["senha"] = senha
    os.makedirs(os.path.dirname(CFG), exist_ok=True)
    with open(CFG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg


def _build_url(cfg):
    """URL SQLAlchemy: usa a URL completa se informada; senão monta pelos campos."""
    url = (cfg.get("url") or "").strip()
    if url:
        return url
    dial = DIALETOS.get((cfg.get("tipo") or "").strip().lower())
    if not dial:
        return ""
    from urllib.parse import quote_plus
    cred = quote_plus(cfg.get("usuario") or "")
    if cfg.get("senha"):
        cred += ":" + quote_plus(cfg.get("senha"))
    host = (cfg.get("host") or "").strip()
    if cfg.get("porta"):
        host += ":" + str(cfg.get("porta")).strip()
    return "%s://%s@%s/%s" % (dial, cred, host, (cfg.get("banco") or "").strip())


def configurado():
    cfg = load_cfg()
    return bool(cfg.get("ativo") and (cfg.get("select") or "").strip() and _build_url(cfg))


_thick_init = False


def _maybe_thick(url, cfg):
    """Habilita o modo thick do oracledb (Oracle Instant Client) quando pedido — necessário
    para senhas com verificador antigo (DPY-3015). Roda uma vez por processo."""
    global _thick_init
    if _thick_init or not url.startswith("oracle") or not cfg.get("oracle_thick"):
        return
    import oracledb
    lib = (cfg.get("oracle_lib_dir") or "").strip() or None
    try:
        oracledb.init_oracle_client(lib_dir=lib)
    except Exception as e:
        if "already been initialized" not in str(e).lower():
            raise
    _thick_init = True


def _engine(cfg):
    from sqlalchemy import create_engine
    url = _build_url(cfg)
    if not url:
        raise ValueError("Conexão não configurada (informe os campos ou a URL).")
    _maybe_thick(url, cfg)
    return create_engine(url, pool_pre_ping=True)


def filtra_por_tecnico(cfg=None):
    """True se o SELECT usa o filtro :tecnicos — então vale ampliar a janela de datas
    (a consulta já vem restrita aos consultores envolvidos)."""
    cfg = cfg or load_cfg()
    return ":tecnicos" in (cfg.get("select") or "")


def consultar(data_ini, data_fim, tecnicos=None, cfg=None):
    """Executa o SELECT no intervalo (:data_ini/:data_fim) e, se o SELECT usar :tecnicos,
    filtra pelos CÓDIGOS informados — devolve a OCUPAÇÃO normalizada como
    lista de {'tecnico','data','turno'} (turno '' = dia inteiro)."""
    cfg = cfg or load_cfg()
    from sqlalchemy import text, bindparam
    sql = cfg.get("select") or ""
    clause = text(sql)
    params = {"data_ini": data_ini, "data_fim": data_fim}
    if ":tecnicos" in sql:                                  # filtro server-side por consultor
        clause = clause.bindparams(bindparam("tecnicos", expanding=True))
        params["tecnicos"] = [str(t).strip() for t in (tecnicos or []) if str(t).strip()]
    with _engine(cfg).connect() as conn:
        rows = conn.execute(clause, params).mappings().all()
    out = []
    for r in rows:
        d = dict(r)
        turno = (str(d.get("turno") or "").strip().lower())
        out.append({"tecnico": str(d.get("tecnico") or "").strip(),
                    "data": str(d.get("data") or "").strip()[:10],
                    "turno": turno if turno in ("manha", "tarde") else ""})
    return out


def testar(cfg=None):
    """Testa conexão+consulta numa janela de 30 dias. Devolve (ok, mensagem, amostra)."""
    cfg = cfg or load_cfg()
    import datetime as _dt
    hoje = _dt.date.today()
    try:
        linhas = consultar(hoje.isoformat(), (hoje + _dt.timedelta(days=30)).isoformat(), cfg=cfg)
        return True, "Conexão OK — %d compromisso(s) no período de teste." % len(linhas), linhas[:8]
    except ModuleNotFoundError:
        url = _build_url(cfg)
        dial = url.split("://", 1)[0] if "://" in url else ""
        pkg = DRIVER_PKG.get(dial, "o driver do banco")
        return False, ("Driver do banco não instalado no servidor. Instale com: pip install %s "
                       "(e reinicie o servidor)." % pkg), []
    except Exception as e:
        msg = str(e)
        if "DPY-3015" in msg:
            return False, ("Senha Oracle com verificador antigo (não aceito no modo thin). "
                           "Marque 'Modo thick (Oracle Instant Client)' e informe a pasta do client, "
                           "OU peça ao DBA para redefinir a senha do usuário com verificador 11g/12c."), []
        if "DPI-1047" in msg or "126" in msg:
            lib = (cfg.get("oracle_lib_dir") or "").strip()
            extra = ""
            if lib and not os.path.isdir(lib):
                extra = " A pasta informada não existe: %s." % lib
            elif lib and not os.path.exists(os.path.join(lib, "oci.dll")):
                extra = " A pasta existe mas NÃO contém oci.dll: %s." % lib
            return False, ("Não consegui carregar o Oracle Instant Client (modo thick). Verifique: "
                           "(1) instale o Microsoft Visual C++ Redistributable x64 (causa nº 1 do erro 126); "
                           "(2) o Instant Client deve ser 64-bit; "
                           "(3) a pasta deve conter o oci.dll. Depois reinicie o servidor." + extra), []
        return False, "%s: %s" % (type(e).__name__, msg[:300]), []


def ocupacao_por_slot(data_ini, data_fim, tecnicos=None, cfg=None):
    """{(tecnico_lower, data, turno): True} dos compromissos (opcionalmente restrito aos
    códigos em `tecnicos`). turno '' marca o dia inteiro (expande para manha e tarde)."""
    ocup = {}
    for r in consultar(data_ini, data_fim, tecnicos, cfg):
        tec = (r["tecnico"] or "").strip().lower()
        if not tec or not r["data"]:
            continue
        turnos = (r["turno"],) if r["turno"] else ("manha", "tarde")
        for t in turnos:
            ocup[(tec, r["data"], t)] = True
    return ocup
