# -*- coding: utf-8 -*-
"""Geração FIEL das documentações das fases a partir dos layouts cadastrados.

Pega o arquivo VIGENTE do modelo (Cadastro → Modelos de Documentos), troca só os
placeholders conhecidos pelos dados do projeto e salva um novo arquivo, com a
mesma estrutura do anexo. Os placeholders manuais (estimativas, quadros de
perguntas, <XX> por área) permanecem como guia para o consultor.
"""
import os
import datetime

import _common as C
import db
import preencher_layout as PL

_MESES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
          "agosto", "setembro", "outubro", "novembro", "dezembro"]


def _data_iso(s):
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _por_extenso(d):
    return "%d de %s de %d" % (d.day, _MESES[d.month], d.year)


def _hoje():
    return datetime.date.today()


def _num(v):
    v = str(v or "").strip()
    return v


# ---- mapas de preenchimento por modelo (literal -> valor) -------------------
def _repl_termo(p):
    cli = (p.get("cliente") or "").strip()
    repl, paras = [], []
    if cli:
        repl.append(("<Razão Social Longa>", cli))
    if (p.get("numero_projeto") or "").strip():
        repl.append(("<Número do projeto quando se aplicar>", p["numero_projeto"].strip()))
    d = _data_iso(p.get("data_encerramento")) or _hoje()
    paras.append(("Novo Hamburgo", "Novo Hamburgo, %s." % _por_extenso(d)))
    return repl, paras


def _repl_projeto(p):
    cli = (p.get("cliente") or "").strip()
    repl, paras = [], []
    if cli:
        # ocorrências no corpo (literais ASCII) + linha-cabeçalho via prefixo
        repl += [("<Nome do Cliente >", cli), ("<Nome do Cliente>", cli)]
        paras.append(("Nome do Cliente:", "Nome do Cliente: %s" % cli))
    if (p.get("cnpj") or "").strip():
        paras.append(("CNPJ", "CNPJ: %s" % p["cnpj"].strip()))
    if (p.get("observacoes") or "").strip():
        repl.append(("<(preencher)>", p["observacoes"].strip()))
    hb, hc = _num(p.get("horas_bonificadas")), _num(p.get("horas_cobradas"))
    if hb:
        repl.append(("<XX horas bonificadas>", "%s horas bonificadas" % hb))
    if hc:
        repl.append(("<XX horas cobradas>", "%s horas cobradas" % hc))
    paras.append(("Novo Hamburgo", "Novo Hamburgo, %s." % _por_extenso(_hoje())))
    return repl, paras


def _repl_levantamento(p):
    cli = (p.get("cliente") or "").strip()
    repl, paras = [], []
    if cli:
        repl.append(("< Nome Cliente >", cli))
        paras.append(("<Razão Social:", "Razão Social: %s" % cli))
    d = _data_iso(p.get("data_levantamento"))
    if d:
        repl.append(("<xx/xx/xxxxx>", d.strftime("%d/%m/%Y")))
    resp = " / ".join(x for x in (p.get("gci"), p.get("consultor")) if x)
    if resp:
        repl.append(("<xxxxxxxxxxxxx>", resp))
    if (p.get("ramo") or "").strip():
        paras.append(("Ramo Atividade", "Ramo Atividade: %s" % p["ramo"].strip()))
    return repl, paras


_GERADORES_DOCX = {"termo": _repl_termo, "projeto": _repl_projeto, "levantamento": _repl_levantamento}


def _topicos_por_modulo(modulos_str):
    """Para cada módulo contratado (sigla em projeto.modulos), busca os tópicos do
    cadastro Índice de Tópicos. Devolve [{sigla, nome, topicos:[linhas]}] na ordem informada."""
    import re as _re
    sigs = [m.strip().upper() for m in _re.split(r"[,;\n]+", modulos_str or "") if m.strip()]
    nomes = {m["sigla"].upper(): m["nome"] for m in db.indice_modulos()}
    out, vistos = [], set()
    for sig in sigs:
        if sig in vistos:
            continue
        vistos.add(sig)
        linhas, _ = db.indice_listar(modulo=sig)
        if linhas:
            out.append({"sigla": sig, "nome": nomes.get(sig, ""), "topicos": linhas})
    return out


def _anexar_topicos_levantamento(doc, modulos_str):
    """Acrescenta ao Levantamento, por módulo contratado, as perguntas/tópicos do Índice
    de Tópicos a serem respondidas. Não depende de estilos do template (robusto)."""
    grupos = _topicos_por_modulo(modulos_str)
    if not grupos:
        return 0

    def linha(txt="", bold=False):
        p = doc.add_paragraph()
        if txt:
            p.add_run(txt).bold = bold
        return p

    linha()
    linha("Tópicos a levantar por módulo contratado", bold=True)
    linha("Itens do Índice de Tópicos a responder no Levantamento, por módulo contratado.")
    total = 0
    for g in grupos:
        linha()
        linha("%s — %s" % (g["sigla"], g["nome"] or ""), bold=True)
        atual = None
        for l in g["topicos"]:
            adic = (l.get("adicional") or "").strip()
            if adic and adic != atual:
                linha(adic, bold=True)
                atual = adic
            doc.add_paragraph("•  " + (l.get("topico") or "").strip())
            total += 1
    return total


def _anexar_respostas_projeto(doc, projeto_id):
    """Acrescenta ao Projeto o detalhamento do Levantamento (tópicos JÁ respondidos no
    painel), por módulo contratado — liga as respostas do Levantamento ao Projeto."""
    if not projeto_id:
        return 0
    rs = [r for r in db.levantamento_respostas(projeto_id) if (r.get("resposta") or "").strip()]
    if not rs:
        return 0

    def linha(txt="", bold=False):
        p = doc.add_paragraph()
        if txt:
            p.add_run(txt).bold = bold
        return p

    linha()
    linha("Detalhamento do Levantamento por módulo", bold=True)
    linha("Rotinas e particularidades identificadas no Levantamento (respostas registradas no painel).")
    mod_atual = adic_atual = None
    total = 0
    for r in rs:
        sig = r.get("modulo_sigla", "")
        if sig != mod_atual:
            mod_atual, adic_atual = sig, None
            linha()
            linha("%s — %s" % (sig, r.get("modulo", "") or ""), bold=True)
        adic = (r.get("adicional") or "").strip()
        if adic and adic != adic_atual:
            adic_atual = adic
            linha(adic, bold=True)
        p = doc.add_paragraph()
        p.add_run(((r.get("topico") or "").strip() + ": ")).bold = True
        p.add_run((r.get("resposta") or "").strip())
        total += 1
    return total


def _norm(s):
    """Normaliza rótulo: colapsa espaços, tira pontuação final e baixa caixa."""
    return " ".join(str(s or "").split()).strip().rstrip(":. ").lower()


def _preencher_cronograma_xlsx(wb, projeto):
    """Preenche o cabeçalho (Consultor/Horas) por rótulo e as linhas de visita a partir
    do cronograma do projeto, sem tocar nas colunas com fórmula (Total/Horário)."""
    ws = wb["Cronograma de visitas"] if "Cronograma de visitas" in wb.sheetnames else wb.worksheets[0]
    alvos = {
        "consultor": (projeto.get("consultor") or "").strip(),
        "horas do planejamento": str(projeto.get("horas_cobradas") or "").strip(),
        "hrs previstas bonificadas": str(projeto.get("horas_bonificadas") or "").strip(),
    }
    for row in ws.iter_rows(min_row=1, max_row=8):       # cabeçalho: valor à direita do rótulo
        for c in row:
            if isinstance(c.value, str):
                v = alvos.get(_norm(c.value))
                if v:
                    ws.cell(row=c.row, column=c.column + 1, value=v)
    itens = db.cronograma_do_projeto(projeto.get("id")) if projeto.get("id") else []
    if not itens:
        return 0
    hdr, cols = None, {}
    for row in ws.iter_rows(min_row=1, max_row=15):       # acha a linha de cabeçalho da tabela
        vals = {_norm(c.value): c.column for c in row if isinstance(c.value, str)}
        if "data" in vals and "o que será abordado" in vals:
            hdr, cols = row[0].row, vals
            break
    if not hdr:
        return 0
    cons = (projeto.get("consultor") or "").strip()
    for i, it in enumerate(itens):
        r = hdr + 1 + i

        def setc(label, val):
            col = cols.get(label)
            if col and val:
                ws.cell(row=r, column=col, value=val)

        abordado = (it.get("etapa") or "").strip()
        if it.get("topicos"):
            abordado = (abordado + " — " + it["topicos"]).strip(" —")
        setc("data", it.get("data", ""))
        setc("local", it.get("modalidade", ""))
        setc("técnico", cons)
        setc("o que será abordado", abordado)
    return len(itens)


def _preencher_termo_grade(doc, modulos_str):
    """Preenche a grade 'Resumo Geral' do Termo (Módulo/Adicional/Processo/Status) a
    partir dos módulos contratados. Usa as linhas existentes e cria novas se faltar."""
    import re as _re
    sigs = [m.strip() for m in _re.split(r"[,;\n]+", modulos_str or "") if m.strip()]
    if not sigs or not doc.tables:
        return 0
    t = doc.tables[0]          # Resumo Geral: Módulo | Adicional | Processo | Status de Uso | Obs.
    if len(t.columns) < 4:
        return 0
    base = t.rows[1:]          # exclui o cabeçalho
    for i, sig in enumerate(sigs):
        row = base[i] if i < len(base) else t.add_row()
        cells = row.cells
        cells[0].text = sig
        cells[2].text = "Implantado"
        cells[3].text = "Sim"
    return len(sigs)


def _saida(slug, cliente, ext):
    nome = "%s_%s.%s" % (slug, C.slug(cliente or "cliente"), ext)
    os.makedirs(C.OUT, exist_ok=True)
    return os.path.join(C.OUT, nome)


def gerar(slug, projeto):
    """Gera o documento fiel da fase `slug` para o `projeto` (dict). Devolve o caminho."""
    modelo = next((m for m in db.modelos_documento_listar() if m["slug"] == slug), None)
    if not modelo:
        raise ValueError("Modelo '%s' não cadastrado." % slug)
    base = db.modelo_documento_arquivo_path(modelo["id"])
    if not base or not os.path.exists(base):
        raise FileNotFoundError("Arquivo do modelo '%s' não encontrado." % slug)
    destino = _saida(slug, projeto.get("cliente"), modelo["tipo"])

    if modelo["tipo"] == "docx":
        repl, paras = _GERADORES_DOCX.get(slug, lambda p: ([], []))(projeto)
        doc = PL.preencher_docx(base, repl, paras)
        if slug == "levantamento":   # injeta as perguntas do Índice de Tópicos por módulo contratado
            _anexar_topicos_levantamento(doc, projeto.get("modulos", ""))
        elif slug == "projeto":      # puxa as respostas do Levantamento (liga as fases)
            _anexar_respostas_projeto(doc, projeto.get("id"))
        elif slug == "termo":        # preenche a grade Resumo Geral com os módulos contratados
            _preencher_termo_grade(doc, projeto.get("modulos", ""))
        doc.save(destino)
    else:  # xlsx (cronograma)
        repl = []
        cli = (projeto.get("cliente") or "").strip()
        if cli:
            repl.append(("XXXX - RAZÃO SOCIAL LONGA", cli))
        wb = PL.preencher_xlsx(base, repl)
        _preencher_cronograma_xlsx(wb, projeto)   # cabeçalho (consultor/horas) + linhas de visita
        wb.save(destino)
    return destino
