# -*- coding: utf-8 -*-
"""Formulários do painel — por enquanto, os Dados do Cliente (dossiê único)
que alimentam os geradores de escritório (estrutura de exemplo_cliente.yaml)."""
import os
import yaml

# (campo, rótulo, tipo, obrigatório, dica)
CLIENTE_FIELDS = [
    ("nome", "Razão Social do cliente", "text", True, "Ex.: Indústria Alfa Ltda"),
    ("codigo_sicla", "Código no SICLA", "text", False, ""),
    ("rns_implantacao", "RNS de Implantação", "text", False, ""),
    ("usuario_lider", "Usuário líder (cliente)", "text", False, ""),
    ("contato_fone", "Contato / telefone", "text", False, ""),
    ("sigla", "Sigla (3 caracteres)", "text", False, "Ex.: A01"),
    ("cnpj", "CNPJ", "text", False, ""),
    ("data_virada_prevista", "Data prevista da virada", "date", False, ""),
    ("consultor_responsavel", "Consultor responsável", "text", False, ""),
    ("area", "Área de atuação", "text", False, "Ex.: Negócios e Produção"),
    ("numero_projeto", "Nº do projeto", "text", False, ""),
    ("modulos", "Módulos (um por linha)", "textarea", False,
     "Estoque/Compras\nFiscal/Contábil\nFinanceiro\nFaturamento/Emissão"),
]


def build_cliente_yaml(form, data_dir, slug_fn):
    """Monta o cliente_<slug>.yaml a partir do formulário. Retorna (basename, nome)."""
    nome = (form.get("nome") or "").strip() or "cliente"
    modulos = [m.strip() for m in (form.get("modulos") or "").splitlines() if m.strip()]
    doc = {
        "cliente": {
            "codigo_sicla": (form.get("codigo_sicla") or "").strip(),
            "nome": nome,
            "rns_implantacao": (form.get("rns_implantacao") or "").strip(),
            "usuario_lider": (form.get("usuario_lider") or "").strip(),
            "contato_fone": (form.get("contato_fone") or "").strip(),
            "cnpjs": [{"sigla": (form.get("sigla") or "").strip(),
                       "cnpj": (form.get("cnpj") or "").strip()}],
            "data_virada_prevista": (form.get("data_virada_prevista") or "").strip(),
        },
        "projeto": {
            "numero": (form.get("numero_projeto") or "").strip(),
            "consultor_responsavel": (form.get("consultor_responsavel") or "").strip(),
            "area": (form.get("area") or "").strip(),
            "modulos": modulos,
        },
    }
    base = "cliente_" + slug_fn(nome) + ".yaml"
    with open(os.path.join(data_dir, base), "w", encoding="utf-8") as f:
        yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False)
    return base, nome
