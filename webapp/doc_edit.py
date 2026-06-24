# -*- coding: utf-8 -*-
"""Especificação das telas de edição estruturadas (espelham as seções dos layouts).

Cada doc: lista de seções; cada seção tem campos (chave, label, tipo, origem):
  - tipo: "texto" | "textarea" | "ro" (somente leitura, vem do projeto/fechamento)
  - origem: campo do projeto para pré-preencher (ou "")

As telas gravam em DocConteudo; a geração fiel lê esses valores para preencher o .docx.
"""

SPEC = {
    "levantamento": {
        "titulo": "Levantamento — edição estruturada",
        "fase": "Levantamento",
        "secoes": [
            {"titulo": "Identificação da empresa", "campos": [
                ("razao_social", "Razão Social", "ro", "cliente"),
                ("ramo", "Ramo de Atividade", "texto", "ramo"),
                ("produto", "Produto", "texto", ""),
                ("software_atual", "Fornecedor Atual / Software", "texto", ""),
                ("filiais", "Localização / Filiais", "texto", ""),
                ("objetivos", "Observações / Objetivos", "textarea", "observacoes"),
                ("qtd_usuarios", "Quantidade de usuários e identificação", "textarea", ""),
            ]},
            {"titulo": "Módulos e horas (do fechamento)", "campos": [
                ("modulos", "Módulos contratados", "ro", "modulos"),
                ("horas_cobradas", "Horas cobradas", "ro", "horas_cobradas"),
                ("horas_bonificadas", "Horas bonificadas", "ro", "horas_bonificadas"),
            ]},
        ],
    },
    "projeto": {
        "titulo": "Projeto de Implantação — edição estruturada",
        "fase": "Projeto",
        "secoes": [
            {"titulo": "Cabeçalho", "campos": [
                ("razao_social", "Razão Social", "ro", "cliente"),
                ("cnpj", "CNPJ", "texto", "cnpj"),
            ]},
            {"titulo": "Objetivos", "campos": [
                ("objetivos", "Objetivos do projeto", "textarea", "observacoes"),
            ]},
            {"titulo": "Escopo", "campos": [
                ("empresas", "Empresas contempladas no projeto", "textarea", ""),
                ("conversoes", "Conversões — detalhamento", "textarea", ""),
            ]},
            {"titulo": "Equipes", "campos": [
                ("gerente_contas", "Gerente de Contas (GCI)", "texto", "gci"),
                ("redator", "Redator do Projeto", "texto", ""),
                ("consultor", "Consultor / Implantador", "texto", "consultor"),
                ("encarregado", "Encarregado pelo Projeto (cliente)", "texto", "contato_nome"),
            ]},
            {"titulo": "Tempo estimado", "campos": [
                ("horas_cobradas", "Horas cobradas", "ro", "horas_cobradas"),
                ("horas_bonificadas", "Horas bonificadas", "ro", "horas_bonificadas"),
            ]},
        ],
    },
}


def campos_editaveis(doc):
    """Chaves dos campos editáveis (não-ro) de um doc."""
    out = []
    for sec in SPEC.get(doc, {}).get("secoes", []):
        out += [c[0] for c in sec["campos"] if c[2] != "ro"]
    return out


def valores(doc, projeto, conteudo):
    """Valor efetivo de cada campo: conteúdo salvo; senão o do projeto (origem)."""
    v = {}
    for sec in SPEC.get(doc, {}).get("secoes", []):
        for chave, _label, _tipo, orig in sec["campos"]:
            val = conteudo.get(chave)
            if not val and orig:
                val = projeto.get(orig, "")
            v[chave] = val or ""
    return v
