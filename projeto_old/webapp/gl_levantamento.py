# -*- coding: utf-8 -*-
"""Geração fiel — parte do LEVANTAMENTO (Mapeamento de Processos)."""
import db
import preencher_layout as PL
from gl_comum import (_conteudo, _data_iso, _norm, _inserir_textos_depois,
                      _SIGLA_BLOCOS, _BLOCOS_FIXOS)


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


def _preencher_levantamento_usuarios(doc, projeto):
    """Preenche a tabela de Usuários-chave (Nome | E-mail | Atribuições) do Levantamento."""
    cont = db.doc_conteudo(projeto.get("id"), "levantamento") if projeto.get("id") else {}
    if not cont:
        return
    for t in doc.tables:
        hdr = [(c.text or "").strip().lower() for c in t.rows[0].cells] if t.rows else []
        if hdr and hdr[0] == "nome" and any(("atribuiç" in h or "atribuic" in h) for h in hdr):
            base = t.rows[1:]
            usuarios = []
            for i in range(5):
                nome = (cont.get("usu_%d_nome" % i) or "").strip()
                if nome:
                    usuarios.append([nome, cont.get("usu_%d_email" % i, ""), cont.get("usu_%d_atrib" % i, "")])
            for idx, u in enumerate(usuarios):
                row = base[idx] if idx < len(base) else t.add_row()
                for j, v in enumerate(u):
                    if j < len(row.cells):
                        row.cells[j].text = v
            break
