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
    val = _conteudo(p, "projeto")
    cli = (p.get("cliente") or "").strip()
    repl, paras = [], []
    if cli:
        # ocorrências no corpo (literais ASCII) + linha-cabeçalho via prefixo
        repl += [("<Nome do Cliente >", cli), ("<Nome do Cliente>", cli)]
        paras.append(("Nome do Cliente:", "Nome do Cliente: %s" % cli))
    if val("cnpj", "cnpj"):
        paras.append(("CNPJ", "CNPJ: %s" % val("cnpj", "cnpj")))
    if val("objetivos", "observacoes"):
        repl.append(("<(preencher)>", val("objetivos", "observacoes")))
    # Equipes (telas de edição estruturada)
    if val("gerente_contas", "gci"):
        paras.append(("Gerente de Contas do Projeto", "Gerente de Contas do Projeto: %s" % val("gerente_contas", "gci")))
    if val("redator"):
        paras.append(("Redator do Projeto", "Redator do Projeto: %s" % val("redator")))
    if val("consultor", "consultor"):
        paras.append(("Consultor/Implantador", "Consultor/Implantador: %s" % val("consultor", "consultor")))
    hb, hc = _num(p.get("horas_bonificadas")), _num(p.get("horas_cobradas"))
    if hb:
        repl.append(("<XX horas bonificadas>", "%s horas bonificadas" % hb))
    if hc:
        repl.append(("<XX horas cobradas>", "%s horas cobradas" % hc))
    paras.append(("Novo Hamburgo", "Novo Hamburgo, %s." % _por_extenso(_hoje())))
    return repl, paras


def _conteudo(p, doc):
    """Valores estruturados (DocConteudo) do documento; val(campo, origem_projeto)."""
    cont = db.doc_conteudo(p.get("id"), doc) if p.get("id") else {}

    def val(campo, orig=None):
        return (cont.get(campo) or (p.get(orig) if orig else "") or "").strip()
    return val


def _repl_levantamento(p):
    val = _conteudo(p, "levantamento")
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
    # Identificação da empresa (telas de edição estruturada)
    if val("ramo", "ramo"):
        paras.append(("Ramo Atividade", "Ramo Atividade: %s" % val("ramo", "ramo")))
    if val("produto"):
        paras.append(("Produto:", "Produto: %s" % val("produto")))
    if val("software_atual"):
        paras.append(("Fornecedor Atual Software", "Fornecedor Atual Software: %s" % val("software_atual")))
    if val("filiais"):
        repl.append(("<Localização / Filiais:>", "Localização / Filiais: %s" % val("filiais")))
    if val("objetivos", "observacoes"):
        paras.append(("Observações / Objetivos", "Observações / Objetivos: %s" % val("objetivos", "observacoes")))
    if val("qtd_usuarios"):
        repl.append(("<Quantidade usuários e identificação: >", "Quantidade usuários e identificação: %s" % val("qtd_usuarios")))
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


# Mapa sigla -> palavras-chave dos blocos do Levantamento que ela mantém (AJUSTÁVEL).
_SIGLA_BLOCOS = {
    "FAT": ["vendas e faturamento"], "PDV": ["vendas e faturamento"],
    "OSE": ["vendas e faturamento"], "SAC": ["vendas e faturamento"],
    "GIN": ["produção"], "GCA": ["produção"],
    "EST": ["compras/estoque"], "COM": ["compras/estoque"], "TLO": ["compras/estoque"],
    "FIN": ["gestão financeira"], "GCO": ["gestão financeira"],
    "CTB": ["gestão fiscal"], "LFI": ["gestão fiscal"], "GPA": ["gestão fiscal"], "AUE": ["gestão fiscal"],
    "FPA": ["folha de pagamento"],
    "PWC": ["portal de funcion", "portal de vagas"], "PGP": ["portal de funcion", "portal de vagas"],
    "RHU": ["recrutamento", "treinamen", "saúde ocupacional", "segurança do trabalho",
            "avaliação", "cargos e sal"],
}
_BLOCOS_FIXOS = ["cliente/fornecedor", "produto"]   # blocos fundacionais, sempre mantidos


def _inserir_textos_depois(anchor_p, textos):
    """Insere parágrafos de texto simples logo após `anchor_p` (preservando ordem)."""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    el = anchor_p._p
    for txt in textos:
        p = OxmlElement("w:p")
        r = OxmlElement("w:r")
        t = OxmlElement("w:t")
        t.set(qn("xml:space"), "preserve")
        t.text = txt
        r.append(t)
        p.append(r)
        el.addnext(p)
        el = p


def _montar_blocos_levantamento(doc, projeto):
    """Mantém apenas os blocos 'Mapeamento de processo – ÁREA' dos módulos contratados
    (remove os demais) e injeta as perguntas/respostas em cada bloco mantido. Módulos
    contratados sem bloco próprio são acrescentados ao final. Devolve (mantidos, removidos)."""
    import re as _re
    sigs = [m.strip().upper() for m in _re.split(r"[,;\n]+", projeto.get("modulos", "") or "") if m.strip()]
    nomes = {m["sigla"].upper(): m["nome"] for m in db.indice_modulos()}
    por_sigla = {}
    for r in (db.levantamento_respostas(projeto.get("id")) if projeto.get("id") else []):
        por_sigla.setdefault((r.get("modulo_sigla") or "").upper(), []).append(r)

    def itens_da_sigla(sig):
        its = por_sigla.get(sig)
        if its:
            return its
        tops, _ = db.indice_listar(modulo=sig)   # sem respostas semeadas: usa o Índice
        return tops

    # 1) varre os blocos (heading "Mapeamento de processo – X")
    blocos, atual = [], None
    for p in doc.paragraphs:
        t = p.text.strip()
        if _norm(t).startswith("mapeamento de processo") and ("-" in t or "–" in t):
            area = _norm(_re.split(r"[-–]", t, 1)[1])
            atual = {"area": area, "ps": [p], "colar": None, "modval": None, "viu_mod": False}
            blocos.append(atual)
        elif atual is not None:
            atual["ps"].append(p)
            tl = _norm(t)
            if "colar aqui" in tl and atual["colar"] is None:
                atual["colar"] = p
            if tl.startswith("módulos previsto") or tl.startswith("modulos previsto"):
                atual["viu_mod"] = True
            elif atual["viu_mod"] and atual["modval"] is None and t.startswith("<") and t.endswith(">"):
                atual["modval"] = p   # o "<xxxxx>" logo após "Módulos Previstos:"

    # 2) decide manter/remover e injeta perguntas
    remover, injetadas, removidos = [], set(), 0
    for b in blocos:
        area = b["area"]
        fixo = any(k in area for k in _BLOCOS_FIXOS)
        siglas_bloco = [s for s in sigs if any(k in area for k in _SIGLA_BLOCOS.get(s, []))]
        if not fixo and not siglas_bloco:
            remover.extend(b["ps"])               # bloco não contratado -> remover
            removidos += 1
            continue
        if siglas_bloco:
            if b["modval"] is not None:           # "<xxxxx>" -> sigla(s) do bloco
                rot = ", ".join(("%s — %s" % (s, nomes[s])) if nomes.get(s) else s for s in siglas_bloco)
                PL._aplica_no_paragrafo(b["modval"], rot)
            if b["colar"] is not None:            # injeta perguntas (com respostas) no bloco
                textos = []
                for s in siglas_bloco:
                    for it in itens_da_sigla(s):
                        top = (it.get("topico") or "").strip()
                        resp = (it.get("resposta") or "").strip()
                        textos.append("•  " + top + (": " + resp if resp else ""))
                        injetadas.add(s)
                _inserir_textos_depois(b["colar"], textos)

    # 3) remove os parágrafos dos blocos não contratados
    for p in remover:
        el = p._p
        if el.getparent() is not None:
            el.getparent().remove(el)

    # 4) módulos contratados sem bloco próprio -> acrescenta ao final
    sobrando = [s for s in sigs if s not in injetadas]
    if sobrando:
        def linha(txt="", bold=False):
            par = doc.add_paragraph()
            if txt:
                par.add_run(txt).bold = bold
        linha(); linha("Outros módulos contratados", bold=True)
        for s in sobrando:
            linha(); linha("%s — %s" % (s, nomes.get(s, "")), bold=True)
            for it in itens_da_sigla(s):
                top = (it.get("topico") or "").strip()
                resp = (it.get("resposta") or "").strip()
                doc.add_paragraph("•  " + top + (": " + resp if resp else ""))
    return (len(blocos) - removidos), removidos


def _preencher_levantamento_tabelas(doc, projeto):
    """Preenche no Levantamento a tabela 'Módulos/Adicionais (A)' (módulos contratados)
    e a tabela de horas (Cobradas / Bonificadas / Total) com os dados do fechamento."""
    import re as _re
    sigs = [m.strip() for m in _re.split(r"[,;\n]+", projeto.get("modulos", "") or "") if m.strip()]
    nomes = {m["sigla"].upper(): m["nome"] for m in db.indice_modulos()}
    cob = (projeto.get("horas_cobradas") or "").strip()
    bon = (projeto.get("horas_bonificadas") or "").strip()
    for t in doc.tables:
        h0 = (t.rows[0].cells[0].text or "").strip().lower() if t.rows else ""
        # Tabela de horas: Cobradas | Bonificadas | Total
        if "horas cobradas" in h0 and len(t.rows) >= 2 and len(t.columns) >= 3:
            t.rows[1].cells[0].text = cob
            t.rows[1].cells[1].text = bon
            def _n(v):
                m = _re.search(r"\d+(?:[.,]\d+)?", v or "")
                return float(m.group(0).replace(",", ".")) if m else 0.0
            tot = _n(cob) + _n(bon)
            if tot:
                t.rows[1].cells[2].text = ("%g" % tot)
        # Tabela 'Módulos/Adicionais (A)': uma linha por módulo contratado
        if "módulos/adicionais (a)" in h0 and sigs:
            base = t.rows[2:] if len(t.rows) > 2 else []
            for i, sig in enumerate(sigs):
                row = base[i] if i < len(base) else t.add_row()
                nome = nomes.get(sig.upper(), "")
                row.cells[0].text = ("%s — %s" % (sig, nome)) if nome else sig
                if len(row.cells) > 1:
                    row.cells[1].text = "X"   # Necessidade: Sim
    return True


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
        if slug == "levantamento":   # mantém só os blocos contratados + injeta perguntas + tabelas
            _montar_blocos_levantamento(doc, projeto)
            _preencher_levantamento_tabelas(doc, projeto)
        elif slug == "projeto":      # puxa as respostas do Levantamento (liga as fases)
            _anexar_respostas_projeto(doc, projeto.get("id"))
        elif slug == "termo":        # preenche a grade Resumo Geral com os módulos contratados
            _preencher_termo_grade(doc, projeto.get("modulos", ""))
        PL.remover_marcadores_docx(doc)   # remove todos os marcadores <...> restantes
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
