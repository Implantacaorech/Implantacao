# -*- coding: utf-8 -*-
"""
schema_projeto.py — estrutura canônica do Projeto de Implantação.

Portado de GeradorProjetoSIGER/schema.py. Define áreas, subcampos, linhas de
tabelas (conversões, cronograma), equipe e tokens de bloco/inline usados pelo
gerador (gerar_projeto_implantacao.py) e pelo importador (importar_mapeamento.py).
"""

MESES_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

SUBFIELD_LABELS = {
    "modulos":         "Módulos Previstos",
    "detalhamento":    "Detalhamento das rotinas atendidas na área",
    "particularidade": "Particularidades identificadas na área",
    "naoprevisto":     "Não está previsto neste projeto",
}

# Áreas selecionáveis (as não marcadas são removidas do documento final).
AREAS = [
    {"id": "vendas",     "grupo": "Gestão Comercial",        "subarea": "Vendas e Faturamento",
     "subfields": ["modulos", "detalhamento", "particularidade", "naoprevisto"]},
    {"id": "estoque",    "grupo": "Gestão de Materiais",     "subarea": "Controle de Estoque",
     "subfields": ["modulos", "detalhamento", "particularidade", "naoprevisto"]},
    {"id": "compras",    "grupo": "Gestão de Materiais",     "subarea": "Controle de Compras",
     "subfields": ["modulos", "detalhamento", "particularidade", "naoprevisto"]},
    {"id": "industrial", "grupo": "Gestão da Produção",      "subarea": "Gestão Industrial",
     "subfields": ["modulos", "detalhamento", "particularidade", "naoprevisto"]},
    {"id": "financeiro", "grupo": "Gestão Financeira",       "subarea": "Controle Financeiro",
     "subfields": ["modulos", "detalhamento", "particularidade"]},   # sem "não previsto"
    {"id": "livros",     "grupo": "Gestão de Controladoria", "subarea": "Livros Fiscais",
     "subfields": ["modulos", "detalhamento", "particularidade", "naoprevisto"]},
]

SECTION_DETALHAMENTO = "Detalhamento das Rotinas"
SECTION_APOS_ROTINAS = "Responsabilidades na Execução do Projeto"
GRUPOS = ["Gestão Comercial", "Gestão de Materiais", "Gestão da Produção",
          "Gestão Financeira", "Gestão de Controladoria"]
SUBAREAS = [a["subarea"] for a in AREAS]

# Tabela de Conversões (6 linhas fixas)
CONV_ROWS = [
    ("conv_1", "Clientes e Fornecedores"),
    ("conv_2", "Cadastros de Produtos"),
    ("conv_3", "Cadastro de Formulações"),
    ("conv_4", "Documentos em Aberto"),
    ("conv_5", "Históricos de Notas de Venda"),
    ("conv_6", "Outras Conversões"),
]

# Cronograma Macro (etapas fixas)
CRONO_ROWS = [
    ("crono_levantamento",   "Planejamento", "Levantamento de requisitos"),
    ("crono_cronograma",     "Planejamento", "Elaboração do Cronograma"),
    ("crono_parametrizacao", "Planejamento", "Parametrização"),
    ("crono_treinamento",    "Execução",     "Treinamento"),
    ("crono_simulacao",      "Execução",     "Simulação"),
    ("crono_inicio",         "Execução",     "Data de Início do Uso oficial"),
    ("crono_finalizacao",    "Encerramento", "Data estimada para Finalização"),
]

# Equipe Rech / Cliente (opcionais). (key, rótulo no documento, descrição)
EQUIPE_FIELDS = [
    ("gerente",     "Gerente de Contas do Projeto:", "Gerente de Contas do Projeto (Rech)"),
    ("redator",     "Redator do Projeto:",           "Redator do Projeto (Rech)"),
    ("consultor",   "Consultor/Implantador:",        "Consultor/Implantador (Rech)"),
    ("encarregado", "Encarregado pelo Projeto:",     "Encarregado pelo Projeto (Cliente)"),
]

# Tokens "bloco" (ocupam um parágrafo; cada linha vira um bullet).
BLOCK_TOKENS = {
    "objetivos",
    "cad_clientes_fornecedores",
    "cad_produtos_servicos",
    "outros_pontos",
}
for _a in AREAS:
    for _sf in _a["subfields"]:
        BLOCK_TOKENS.add(f"{_a['id']}_{_sf}")

# Subcampos de área cujo texto deve passar pela conversão verbal (Presente->Futuro).
VERBAL_SUBFIELDS = {"detalhamento", "particularidade", "naoprevisto"}
