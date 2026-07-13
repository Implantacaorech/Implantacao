# -*- coding: utf-8 -*-
"""Rotas da aba Dashboards (/dashboards) — análises lidas das "Consultas BD" (área Sistema,
Administrador), rodadas contra a conexão externa configurada em Disponibilidade. Separado do
app.py para reduzir o monólito (mesmo padrão dos demais routes_*.py)."""
from datetime import date, timedelta

import db
from flask import request, render_template, abort

# Injetado por register() a partir do app.py:
pode_ver = None

MESES_PT = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
            "agosto", "setembro", "outubro", "novembro", "dezembro"]


def _add_months(d, n):
    m = d.month - 1 + n
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, 1)


def _periodo(request_args):
    """Calcula o período do filtro (início inclusivo, fim exclusivo) a partir de ?ref=
    (AAAA-MM, padrão = mês atual), ?direcao=avancar|recuar (padrão avançar) e ?n= (padrão 12)."""
    hoje = date.today()
    ref_raw = (request_args.get("ref") or "").strip()
    try:
        ano_ref, mes_ref = (int(x) for x in ref_raw.split("-", 1))
        ref_ini = date(ano_ref, mes_ref, 1)
    except (ValueError, TypeError):
        ref_ini = date(hoje.year, hoje.month, 1)
    direcao = request_args.get("direcao") if request_args.get("direcao") in ("avancar", "recuar") else "avancar"
    try:
        n = max(1, min(60, int(request_args.get("n") or 12)))
    except ValueError:
        n = 12
    if direcao == "recuar":
        inicio = _add_months(ref_ini, -n)
        fim_exclusivo = ref_ini
    else:
        inicio = ref_ini
        fim_exclusivo = _add_months(ref_ini, n)
    return {"ref": ref_ini, "direcao": direcao, "n": n, "inicio": inicio,
            "fim_exclusivo": fim_exclusivo, "fim": fim_exclusivo - timedelta(days=1)}


def _meses_do_periodo(periodo):
    """[{'ano','mes','nome'}] — cada mês do período, em ordem cronológica."""
    out = []
    d = periodo["inicio"]
    while d < periodo["fim_exclusivo"]:
        out.append({"ano": d.year, "mes": d.month, "nome": MESES_PT[d.month]})
        d = _add_months(d, 1)
    return out


def _atalhos_mes(periodo):
    """{mes(1-12): ano} — para os botões Jan..Dez: a que ano aquele mês corresponde dentro do
    período atual (1ª ocorrência, já que um período de até 12 meses tem cada mês uma só vez)."""
    out = {}
    for m in _meses_do_periodo(periodo):
        out.setdefault(m["mes"], m["ano"])
    return out


def _como_data(v):
    """Normaliza um valor de data vindo do Oracle (datetime/date/str) para date, ou None."""
    if v is None:
        return None
    if hasattr(v, "date") and callable(getattr(v, "date")):
        try:
            return v.date()
        except Exception:
            pass
    if hasattr(v, "year") and hasattr(v, "month"):
        return v
    s = str(v).strip()[:10]
    try:
        return date(int(s[0:4]), int(s[5:7]), int(s[8:10]))
    except (ValueError, IndexError):
        return None


def dashboards():
    """Aba Dashboards: hoje só 'Previsão Início Oficial'; estrutura já pronta para novas
    análises (uma aba por consulta salva em Consultas BD, mesmo padrão)."""
    if not pode_ver("gestao"):
        abort(403)
    import disponibilidade as D

    periodo = _periodo(request.args)
    meses = _meses_do_periodo(periodo)
    atalhos = _atalhos_mes(periodo)
    mes_sel = request.args.get("mes_sel")
    ano_sel = request.args.get("ano_sel")
    try:
        mes_sel = int(mes_sel) if mes_sel else None
        ano_sel = int(ano_sel) if ano_sel else None
    except ValueError:
        mes_sel = ano_sel = None

    consulta = db.consulta_bd_por_slug("previsao_inicio_oficial")
    erro = None
    linhas_periodo, situacoes_disp, situacoes_sel = [], [], set(request.args.getlist("situacao"))
    contagem_mes = {(m["ano"], m["mes"]): 0 for m in meses}
    linhas_tabela = []

    if not consulta or not (consulta.get("sql") or "").strip():
        erro = "Consulta 'Previsão Início Oficial' não configurada (Consultas BD, área Sistema)."
    elif not D.configurado():
        erro = "Conexão externa (Consultas BD → Disponibilidade) não configurada ou inativa."
    else:
        ok, msg, cols, linhas = D.executar_sql(
            consulta["sql"],
            params={"data_ini": periodo["inicio"].isoformat(), "data_fim": periodo["fim"].isoformat()})
        if not ok:
            erro = msg
        else:
            for lin in linhas:
                lin = {(k or "").upper(): v for k, v in lin.items()}
                d_prev = _como_data(lin.get("PREVISAO_INICIO_OFICIAL"))
                if not d_prev or d_prev < periodo["inicio"] or d_prev >= periodo["fim_exclusivo"]:
                    continue
                situacao = str(lin.get("SITUACAO") or "").strip()
                if situacao and situacao not in situacoes_disp:
                    situacoes_disp.append(situacao)
                linhas_periodo.append({
                    "rns": "%s-%s - %s" % (lin.get("CODIGO") or "", lin.get("CLIENTE") or "",
                                          lin.get("DESCRICAO") or ""),
                    "data_contratacao": _como_data(lin.get("DATA_CONTRATACAO")),
                    "previsao_inicio_oficial": d_prev,
                    "situacao": situacao,
                    "responsavel": str(lin.get("RESPONSAVEL") or "").strip(),
                })
            situacoes_disp.sort()
            if not situacoes_sel:            # nada marcado na URL = "seleções múltiplas" (todas)
                situacoes_sel = set(situacoes_disp)
            for r in linhas_periodo:
                if r["situacao"] and r["situacao"] not in situacoes_sel:
                    continue
                chave = (r["previsao_inicio_oficial"].year, r["previsao_inicio_oficial"].month)
                if chave in contagem_mes:
                    contagem_mes[chave] += 1
                if mes_sel and ano_sel and (r["previsao_inicio_oficial"].year != ano_sel
                                            or r["previsao_inicio_oficial"].month != mes_sel):
                    continue
                linhas_tabela.append(r)
            linhas_tabela.sort(key=lambda r: r["previsao_inicio_oficial"])

    grafico = {"labels": ["%s" % m["nome"] for m in meses],
              "valores": [contagem_mes.get((m["ano"], m["mes"]), 0) for m in meses]}

    return render_template("dashboards.html", periodo=periodo, meses=meses, atalhos=atalhos,
                           mes_sel=mes_sel, ano_sel=ano_sel, situacoes_disp=situacoes_disp,
                           situacoes_sel=situacoes_sel, linhas_tabela=linhas_tabela,
                           grafico=grafico, erro=erro,
                           total_periodo=sum(contagem_mes.values()))


def register(app, **deps):
    globals().update(deps)   # pode_ver
    app.add_url_rule("/dashboards", view_func=dashboards)
