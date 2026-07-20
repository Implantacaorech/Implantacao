# -*- coding: utf-8 -*-
"""Geração fiel — parte do TERMO de Encerramento."""
from gl_comum import _data_iso, _por_extenso, _hoje


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
