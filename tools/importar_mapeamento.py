# -*- coding: utf-8 -*-
"""
importar_mapeamento.py — ponte Levantamento -> Projeto.

Portado de GeradorProjetoSIGER/mapping_import.py. Lê um
"Mapeamento levantamento de processos_*.docx" preenchido e produz um
`tools/data/projeto_<cliente>.yaml` (formato de tokens) pronto para o
gerador, APLICANDO a conversão verbal (Presente -> Futuro) nas descrições
das rotinas. O Gerente de Projeto revisa antes de gerar o documento.

Uso:
    python importar_mapeamento.py "<caminho do Levantamento.docx>"
"""
import os
import re
import sys
import unicodedata
from collections import defaultdict

import docx
from docx.text.paragraph import Paragraph
from docx.table import Table

import _common as C
import schema_projeto as S
import conversor_verbal as V
import ortografia as O


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\s+", " ", s.strip().lower())
    return s.strip(" .:")


def _after_colon(text):
    if ":" in text:
        return text.split(":", 1)[1].strip()
    if "–" in text:
        return text.split("–", 1)[1].strip()
    return ""


def is_placeholder(line):
    s = (line or "").strip()
    if not s:
        return True
    if s.upper() in ("XX", "XXX", "XXXX"):
        return True
    if re.fullmatch(r"<.*>", s):
        return True
    if re.fullmatch(r"[_\-–—\s.]+", s):
        return True
    if re.fullmatch(r"x{3,}", s, re.IGNORECASE):
        return True
    return False


def _walk(doc):
    for child in doc.element.body.iterchildren():
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            yield 'p', Paragraph(child, doc)
        elif tag == 'tbl':
            yield 'tbl', Table(child, doc)


def detect_section(text):
    n = norm(text)
    if n.startswith("mapeamento de processo"):
        if "cliente/fornecedor" in n or ("cliente" in n and "fornecedor" in n):
            return "clifor"
        if "vendas e faturamento" in n:
            return "vendas"
        if "producao" in n:
            return "producao"
        if "compras/estoque" in n or ("compras" in n and "estoque" in n):
            return "comprasestoque"
        if "gestao financeira" in n:
            return "financeira"
        if "gestao fiscal" in n:
            return "fiscal"
        if "produto" in n:
            return "produto"
        return "IGNORE"
    if n.startswith("conversoes"):
        return "conversoes"
    if n.startswith("desenvolvimentos especificos"):
        return "desenv"
    if n.startswith("informacoes da empresa") or n.startswith("identificacao da empresa"):
        return "info"
    if n.startswith("resumo dos modulos") or n.startswith("implantacao") or n.startswith("revis"):
        return "IGNORE"
    return None


def detect_label(text, section):
    n = norm(text)
    if section == "info":
        if n.startswith("razao social"):
            return ("razao", _after_colon(text))
        if n.startswith("observacoes"):
            return ("objetivos", _after_colon(text))
        if text.strip().endswith(":") or ":" in text:
            return ("ignore", "")
        return None
    if n.startswith("modulos previsto"):
        return ("modulos", _after_colon(text))
    if n.startswith("duvidas e observacoes"):
        return ("duvidas", _after_colon(text))
    if n.startswith("detalhamento e consideracoes"):
        return ("detalhamento", _after_colon(text))
    if n.startswith("visao geral"):
        return ("ignore", "")
    if n.startswith("aspectos identificados"):
        if section == "comprasestoque":
            return ("aspectos_estoque", "") if "estoque" in n else ("aspectos_compras", "")
        return ("aspectos", "")
    return None


def _table_sig(tbl):
    return " | ".join(norm(c.text) for c in tbl.rows[0].cells) if tbl.rows else ""


def _digits(s):
    m = re.search(r"\d+", s or "")
    return m.group(0) if m else ""


def _parse_users(tbl):
    users = []
    for row in tbl.rows[1:]:
        cells = [c.text.strip() for c in row.cells]
        nome = cells[0] if cells else ""
        if not nome or is_placeholder(nome):
            continue
        users.append({"nome": nome, "email": cells[1] if len(cells) > 1 else "",
                      "area": cells[2] if len(cells) > 2 else "", "assina": "Sim"})
    return users


def _parse_horas(tbl):
    out = {}
    if len(tbl.rows) >= 2:
        cells = [c.text.strip() for c in tbl.rows[1].cells]
        if len(cells) >= 1:
            out["horas_cobradas"] = _digits(cells[0])
        if len(cells) >= 2:
            out["horas_bonificadas"] = _digits(cells[1])
    return out


def _table_to_lines(tbl):
    lines = []
    for row in tbl.rows:
        vals = [c for c in (cell.text.strip() for cell in row.cells)
                if c and not is_placeholder(c)]
        seen = []
        for v in vals:
            if v not in seen:
                seen.append(v)
        if seen:
            lines.append(" — ".join(seen))
    return lines


def detect_conv_item(n):
    if n.startswith("imp. cad. clientes") or n.startswith("imp cad. clientes") \
            or ("clientes" in n and "fornecedores" in n and n.startswith("imp")):
        return ("conv_1", True)
    if "cad. produtos" in n or "cad produtos" in n or n.startswith("imp. cad. produtos"):
        return ("conv_2", True)
    if "doc. em aberto" in n or "documentos em aberto" in n or "mov. financeiro" in n:
        return ("conv_4", True)
    if "notas fiscais" in n:
        return ("conv_5", True)
    if "historico de compras" in n:
        return ("conv_6", False)
    if "movimentos da folha" in n or n.startswith("importacao de movimentos da folha"):
        return ("_skip", None)
    return None


def _extrair_modulos(doc):
    """Extrai as abreviações dos módulos contratados a partir das tabelas de
    'Resumo dos Módulos e Adicionais' (linhas 'ABREV — Descrição' ou pela descrição)."""
    import catalogo as CAT
    cat = CAT.load()
    by_ab = {str(m["abrev"]).upper(): m["abrev"] for m in cat}
    by_desc = {norm(m["descricao"]): m["abrev"] for m in cat if m.get("descricao")}
    achados, vistos = [], set()
    for kind, obj in _walk(doc):
        if kind != 'tbl' or "modulos/adicionais" not in _table_sig(obj):
            continue
        for row in obj.rows:
            cell = row.cells[0].text.strip()
            if not cell:
                continue
            ab = None
            m = re.match(r"^([A-Za-z]{2,4})\s*[—–-]\s*", cell)
            if m and m.group(1).upper() in by_ab:
                ab = by_ab[m.group(1).upper()]
            else:
                desc = re.split(r"[—–-]", cell, 1)[-1].strip()
                ab = by_desc.get(norm(desc)) or by_desc.get(norm(cell))
            if ab and ab not in vistos:
                achados.append(ab); vistos.add(ab)
    return achados


def extract(path):
    doc = docx.Document(path)
    buckets = defaultdict(list)
    usuarios, horas = [], {}
    section = bucket_key = conv_item = None
    conv_sn, conv_lines = {}, {}

    for kind, obj in _walk(doc):
        if kind == 'tbl':
            sig = _table_sig(obj)
            if "nome" in sig and ("atribuic" in sig or "e-mail" in sig or "email" in sig) and "revis" not in sig:
                usuarios = _parse_users(obj)
            elif "bonificad" in sig or "horas cobradas" in sig:
                horas = _parse_horas(obj)
            elif "revis" in sig or "modulos/adicionais" in sig or "motivo da alteracao" in sig:
                pass
            elif bucket_key:
                for ln in _table_to_lines(obj):
                    buckets[bucket_key].append(ln)
            continue

        text = obj.text.strip()
        if not text:
            continue
        sk = detect_section(text)
        if sk is not None:
            section = None if sk == "IGNORE" else sk
            bucket_key = conv_item = None
            continue
        lk = detect_label(text, section)
        if lk is not None:
            label, inline_val = lk
            bucket_key = f"{section}:{label}" if section else None
            conv_item = None
            if bucket_key and inline_val and not is_placeholder(inline_val):
                buckets[bucket_key].append(inline_val)
            continue
        if section == "conversoes":
            ci = detect_conv_item(norm(text))
            if ci is not None:
                rowkey, converte = ci
                conv_item = rowkey
                if rowkey != "_skip":
                    conv_sn[rowkey] = "Sim" if converte else "Não"
                    conv_lines.setdefault(rowkey, [])
                    if not is_placeholder(text):
                        conv_lines[rowkey].append(text)
                continue
        if not is_placeholder(text):
            if section == "conversoes" and conv_item == "_skip":
                pass
            elif section == "conversoes" and conv_item:
                conv_lines[conv_item].append(text)
            elif bucket_key:
                buckets[bucket_key].append(text)

    def J(*keys):
        out = []
        for k in keys:
            out.extend(buckets.get(k, []))
        seen, res = set(), []
        for ln in out:
            if ln not in seen:
                seen.add(ln); res.append(ln)
        return "\n".join(res)

    data = {}
    razao = J("info:razao")
    if razao:
        data["client_name"] = razao.splitlines()[0].strip()
    data["objetivos"] = J("info:objetivos")
    data["conversoes_detalhe"] = J("conversoes:detalhamento")
    data["outros_pontos"] = J("desenv:detalhamento")
    for rowkey, linhas in conv_lines.items():
        if not linhas:
            continue
        sn = conv_sn.get(rowkey, "Sim")
        data[f"{rowkey}_sn"] = sn
        data[f"{rowkey}_dados"] = "Aplica-se" if sn == "Sim" else "Não se aplica"
        seen, obs = set(), []
        for ln in linhas:
            if ln not in seen:
                seen.add(ln); obs.append(ln)
        data[f"{rowkey}_obs"] = "\n".join(obs)
    data["cad_clientes_fornecedores"] = J("clifor:aspectos", "clifor:duvidas")
    data["cad_produtos_servicos"] = J("produto:aspectos", "produto:duvidas")
    data["vendas_modulos"] = J("vendas:modulos")
    data["vendas_detalhamento"] = J("vendas:aspectos")
    data["vendas_particularidade"] = J("vendas:duvidas")
    data["industrial_modulos"] = J("producao:modulos")
    data["industrial_detalhamento"] = J("producao:aspectos")
    data["industrial_particularidade"] = J("producao:duvidas")
    data["compras_modulos"] = J("comprasestoque:modulos")
    data["compras_detalhamento"] = J("comprasestoque:aspectos_compras")
    data["compras_particularidade"] = J("comprasestoque:duvidas")
    data["estoque_modulos"] = J("comprasestoque:modulos")
    data["estoque_detalhamento"] = J("comprasestoque:aspectos_estoque")
    data["estoque_particularidade"] = J("comprasestoque:duvidas")
    data["financeiro_modulos"] = J("financeira:modulos")
    data["financeiro_detalhamento"] = J("financeira:aspectos")
    data["financeiro_particularidade"] = J("financeira:duvidas")
    data["livros_modulos"] = J("fiscal:modulos")
    data["livros_detalhamento"] = J("fiscal:aspectos")
    data["livros_particularidade"] = J("fiscal:duvidas")
    data.update(horas)
    data["usuarios"] = usuarios
    data["modulos"] = _extrair_modulos(doc)
    incluidas = [aid for aid in ("vendas", "estoque", "compras", "industrial", "financeiro", "livros")
                 if (data.get(f"{aid}_modulos") or data.get(f"{aid}_detalhamento")
                     or data.get(f"{aid}_particularidade"))]
    data["areas_incluidas"] = incluidas
    return data


# Campos descritivos que passam pela conversão verbal (Presente -> Futuro).
VERBAL_FIELDS = {"cad_clientes_fornecedores", "cad_produtos_servicos",
                 "outros_pontos", "conversoes_detalhe"}
for _a in S.AREAS:
    for _sf in ("detalhamento", "particularidade", "naoprevisto"):
        VERBAL_FIELDS.add(f"{_a['id']}_{_sf}")


def to_yaml_dict(data, aplicar_verbal=True):
    """Converte o dict bruto em estrutura YAML (listas p/ blocos) aplicando a
    conversão verbal nos campos descritivos."""
    block = set(S.BLOCK_TOKENS) | {"conversoes_detalhe"}
    out = {}
    for k, v in data.items():
        if k in ("usuarios", "areas_incluidas", "modulos") or k == "_resumo":
            continue
        if isinstance(v, str):
            if v.strip():
                linhas = v.split("\n")
                if aplicar_verbal and k in VERBAL_FIELDS:
                    linhas = [V.converter(ln) for ln in linhas]      # tempo verbal
                linhas = [O.corrigir(ln) for ln in linhas]           # ortografia (em tudo)
                v = "\n".join(linhas)
            if k in block and "\n" in v:
                out[k] = v.split("\n")
            else:
                out[k] = v
        else:
            out[k] = v
    out["areas_incluidas"] = data.get("areas_incluidas", [])
    out["usuarios"] = data.get("usuarios", [])
    return out


def main(path=None):
    if not path:
        print("Uso: python importar_mapeamento.py \"<Levantamento.docx>\"")
        return
    import yaml
    data = extract(path)
    ydict = to_yaml_dict(data, aplicar_verbal=True)
    nome = data.get("client_name") or os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(C.DATA_WRITE, f"projeto_{C.slug(nome)}.yaml")
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"# Gerado de: {os.path.basename(path)}\n")
        f.write("# Revisar (Gerente de Projeto) antes de gerar. Texto já no FUTURO.\n")
        yaml.safe_dump(ydict, f, allow_unicode=True, sort_keys=False, width=100)
    inc = data.get("areas_incluidas", [])
    print(f"OK: {os.path.basename(out)}")
    print(f"   Cliente: {data.get('client_name') or '(não detectado)'}")
    print(f"   Áreas com conteúdo: {', '.join(inc) or '—'}")
    print(f"   Usuários: {len(data.get('usuarios', []))} | Conversão verbal aplicada nas rotinas")
    print(f"   Próximo: revisar {out} e rodar:")
    print(f"     python gerar_projeto_implantacao.py data/{os.path.basename(out)}")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(*args) if args else main()
