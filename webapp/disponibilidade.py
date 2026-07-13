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
      tecnico  -> identificador do técnico como o SELECT o devolve (no SICLA é o NOME). O painel
                  aceita no cadastro tanto o CÓDIGO numérico quanto o nome: ele traduz um pelo
                  outro via `select_tecnicos` (SELECT_TECNICOS_PADRAO) antes de consultar.
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


def executar_sql(sql, params=None, cfg=None, limite=500):
    """Roda um SQL arbitrário (SELECT) contra a MESMA conexão configurada para a
    Disponibilidade — usado pelas consultas nomeadas de 'Consultas BD' (área Sistema,
    Administrador) e pelos Dashboards que leem essas consultas. Só aceita SELECT/WITH (proteção
    mínima contra colar um comando destrutivo por engano — quem edita já é Administrador).
    Devolve (ok, mensagem, colunas, linhas) — linhas como lista de dicts, cortada em `limite`."""
    cfg = cfg or load_cfg()
    sql_strip = (sql or "").strip()
    if not sql_strip:
        return False, "Consulta vazia.", [], []
    inicio = sql_strip.lstrip("(").upper()
    if not (inicio.startswith("SELECT") or inicio.startswith("WITH")):
        return False, "Só é permitido rodar comandos SELECT (ou WITH ... SELECT).", [], []
    from sqlalchemy import text
    try:
        with _engine(cfg).connect() as conn:
            r = conn.execute(text(sql_strip), params or {})
            cols = list(r.keys())
            linhas = [dict(zip(cols, row)) for row in r.fetchmany(limite)]
        return True, "%d linha(s)." % len(linhas), cols, linhas
    except ModuleNotFoundError:
        url = _build_url(cfg)
        dial = url.split("://", 1)[0] if "://" in url else ""
        pkg = DRIVER_PKG.get(dial, "o driver do banco")
        return False, ("Driver do banco não instalado no servidor. Instale com: pip install %s "
                       "(e reinicie o servidor)." % pkg), [], []
    except Exception as e:
        msg = str(e)
        if "DPY-3015" in msg:
            return False, ("Senha Oracle com verificador antigo (não aceito no modo thin). Marque "
                           "'Modo thick' na aba Disponibilidade e informe a pasta do client, OU peça "
                           "ao DBA para redefinir a senha com verificador 11g/12c."), [], []
        if "DPI-1047" in msg or "126" in msg:
            return False, ("Não consegui carregar o Oracle Instant Client (modo thick) — veja a aba "
                           "Disponibilidade para os detalhes de configuração."), [], []
        return False, "%s: %s" % (type(e).__name__, msg[:300]), [], []


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


# Cache em memória da ocupação (TTL curto): evita reconsultar o banco externo a cada
# navegação de semana no agendador. Chave = (janela, técnicos); invalida por tempo.
_CACHE = {}
_CACHE_TTL = 180   # segundos

# Consulta que mapeia CÓDIGO<->NOME do técnico no SICLA. O SELECT de ocupação casa pelo
# NOME (tec.TECNICO), mas o cadastro pode ter o CÓDIGO numérico OU o nome — esta consulta
# permite aceitar os dois (o painel traduz para o nome antes de consultar a ocupação).
SELECT_TECNICOS_PADRAO = "SELECT CODIGO AS codigo, TECNICO AS tecnico FROM SICLA.TECNICOS"
_TEC_CACHE = {"ts": 0.0, "map": {}}
_TEC_TTL = 600     # segundos


def mapa_tecnicos(cfg=None, ttl=_TEC_TTL):
    """{chave_lower -> NOME canônico do técnico}, resolvendo tanto o CÓDIGO numérico quanto o
    próprio nome. Vem de `select_tecnicos` (ou SELECT_TECNICOS_PADRAO). {} se indisponível —
    aí o painel usa o valor do cadastro como está (comportamento antigo)."""
    import time
    cfg = cfg or load_cfg()
    if _TEC_CACHE["map"] and (time.time() - _TEC_CACHE["ts"] < ttl):
        return _TEC_CACHE["map"]
    q = (cfg.get("select_tecnicos") or SELECT_TECNICOS_PADRAO).strip()
    m = {}
    try:
        from sqlalchemy import text
        with _engine(cfg).connect() as conn:
            for r in conn.execute(text(q)).mappings().all():
                nome = str(r.get("tecnico") or "").strip()
                cod = str(r.get("codigo") or "").strip()
                if not nome:
                    continue
                m[nome.strip().lower()] = nome
                if cod:
                    m[cod.strip().lower()] = nome
        _TEC_CACHE.update(ts=time.time(), map=m)
    except Exception:
        import logging
        logging.exception("Falha ao montar o mapa de técnicos do SICLA (código<->nome)")
    return m


def ocupacao_por_slot_cache(data_ini, data_fim, tecnicos=None, cfg=None):
    """Como ocupacao_por_slot, com cache de _CACHE_TTL segundos por (janela, técnicos).
    Use nas TELAS (navegação rápida); a validação final de alocação pode usar a direta."""
    import time
    chave = (data_ini, data_fim, tuple(sorted(str(t).strip().lower() for t in (tecnicos or []))))
    hit = _CACHE.get(chave)
    agora = time.time()
    if hit and agora - hit[0] < _CACHE_TTL:
        return hit[1]
    ocup = ocupacao_por_slot(data_ini, data_fim, tecnicos, cfg)
    _CACHE[chave] = (agora, ocup)
    if len(_CACHE) > 64:                      # nunca cresce sem limite
        for k, _ in sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:32]:
            _CACHE.pop(k, None)
    return ocup


def ocupacao_por_slot(data_ini, data_fim, tecnicos=None, cfg=None):
    """{(chave_lower, data, turno): True} dos compromissos. Aceita em `tecnicos` o CÓDIGO
    numérico OU o nome do técnico: traduz para o nome antes de consultar (o SELECT casa por
    nome) e re-indexa o resultado TAMBÉM pela chave original — assim a tela, que procura pelo
    valor do cadastro (código ou nome), encontra a ocupação. turno '' = dia inteiro."""
    cfg = cfg or load_cfg()
    entradas = [str(t).strip() for t in (tecnicos or []) if str(t).strip()]
    mapa = mapa_tecnicos(cfg) if entradas else {}
    nomes, alias = [], {}                       # alias: nome_lower -> {chaves originais lower}
    for e in entradas:
        nome = mapa.get(e.lower(), e)           # cai no próprio valor se o mapa não resolver
        nomes.append(nome)
        alias.setdefault(nome.strip().lower(), set()).add(e.lower())
    ocup = {}
    for r in consultar(data_ini, data_fim, (nomes or None), cfg):
        tec = (r["tecnico"] or "").strip().lower()
        if not tec or not r["data"]:
            continue
        chaves = {tec} | alias.get(tec, set())  # nome canônico + apelidos (código/nome do cadastro)
        turnos = (r["turno"],) if r["turno"] else ("manha", "tarde")
        for t in turnos:
            for k in chaves:
                ocup[(k, r["data"], t)] = True
    return ocup
