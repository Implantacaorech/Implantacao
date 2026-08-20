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
            {"titulo": "Usuários-chave", "tipo": "tabela", "prefixo": "usu", "linhas": 5,
             "colunas": [("nome", "Nome"), ("email", "E-mail"), ("atrib", "Atribuições")]},
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
            # Bloco "Cadastros" do layout. Não herda a etapa 3: são definições alinhadas COM O
            # CLIENTE no projeto (compartilhamento, codificação, campos além do padrão), que
            # não existem como pergunta no Levantamento. Sem estes campos o bloco saía vazio
            # em todo Projeto — o layout tem o marcador, mas nada o preenchia.
            {"titulo": "Cadastros", "campos": [
                ("cad_clientes", "Clientes e Fornecedores", "textarea", ""),
                ("cad_produtos", "Produtos/Serviços", "textarea", ""),
                ("cad_outros", "Outros pontos gerais do projeto", "textarea", ""),
            ]},
            {"titulo": "Equipes", "campos": [
                ("gerente_contas", "Gerente de Contas (GCI)", "texto", "gci"),
                ("redator", "Redator do Projeto", "texto", ""),
                ("consultor", "Consultor / Implantador", "texto", "consultor"),
                ("encarregado", "Encarregado pelo Projeto (cliente)", "texto", "contato_nome"),
            ]},
            # 5 linhas, iguais às de Usuários-chave do Levantamento (a etapa 10 herda a
            # etapa 3) — com 4, o 5º usuário levantado sumia sem aviso.
            {"titulo": "Tabela de Usuários", "tipo": "tabela", "prefixo": "usu", "linhas": 5,
             "colunas": [("nome", "Nome"), ("email", "E-mail"),
                         ("area", "Área de Atuação no SIGER"), ("assina", "Assina Protocolo")]},
            {"titulo": "Cronograma Macro", "campos": [
                ("crono_levantamento", "Levantamento de requisitos — período", "texto", ""),
                ("crono_cronograma", "Elaboração do Cronograma — período", "texto", ""),
                ("crono_parametrizacao", "Parametrização — período", "texto", ""),
                ("crono_treinamento", "Treinamento — período", "texto", ""),
                ("crono_simulacao", "Simulação — período", "texto", ""),
                ("crono_inicio", "Início do Uso oficial — período", "texto", ""),
                ("crono_finalizacao", "Data estimada para Finalização — período", "texto", ""),
            ]},
            {"titulo": "Tempo estimado", "campos": [
                ("horas_cobradas", "Horas cobradas", "ro", "horas_cobradas"),
                ("horas_bonificadas", "Horas bonificadas", "ro", "horas_bonificadas"),
            ]},
        ],
    },
}


# Áreas do "Detalhamento das Rotinas" do layout do Projeto (chave, nome no doc, siglas).
# AJUSTÁVEL — o layout do Projeto tem só estas 6 áreas.
_PROJ_AREAS = [
    ("vendas",     "Vendas e Faturamento", ["FAT", "PDV", "OSE", "SAC"]),
    ("estoque",    "Controle de Estoque",  ["EST"]),
    ("compras",    "Controle de Compras",  ["COM", "TLO"]),
    ("industrial", "Gestão Industrial",    ["GIN", "GCA"]),
    ("financeiro", "Controle Financeiro",  ["FIN", "GCO"]),
    ("fiscal",     "Livros Fiscais",       ["LFI", "CTB", "GPA", "AUE"]),
]


def _areas_contratadas(projeto):
    import re as _re
    sigs = {m.strip().upper() for m in _re.split(r"[,;\n]+", projeto.get("modulos", "") or "") if m.strip()}
    return [(k, nome) for (k, nome, ss) in _PROJ_AREAS if sigs & set(ss)]


def _detalhamento_secoes(projeto):
    """Seções dinâmicas: 'Detalhamento de Rotinas' por área contratada (Projeto)."""
    out = []
    for k, nome in _areas_contratadas(projeto):
        out.append({"titulo": "Detalhamento de Rotinas — %s" % nome, "campos": [
            ("det_%s_modulos" % k, "Módulos previstos", "textarea", ""),
            ("det_%s_detalhamento" % k, "Detalhamento das rotinas atendidas", "textarea", ""),
            ("det_%s_particularidade" % k, "Particularidade específica da área", "textarea", ""),
            ("det_%s_naoprevisto" % k, "Não está previsto neste projeto", "textarea", ""),
        ]})
    return out


def _tabela_chaves(sec):
    """Chaves dos campos de uma seção do tipo 'tabela' (prefixo_linha_coluna)."""
    return ["%s_%d_%s" % (sec["prefixo"], i, ck)
            for i in range(sec["linhas"]) for ck, _cl in sec["colunas"]]


def secoes(doc, projeto):
    """Seções do documento na ORDEM do layout: estáticas (SPEC) + dinâmicas por área
    (Projeto, inseridas logo após o Escopo)."""
    base = [s for s in SPEC.get(doc, {}).get("secoes", [])]
    if doc != "projeto":
        return base
    out = []
    for sec in base:
        out.append(sec)
        if sec.get("titulo") == "Escopo":
            out += _detalhamento_secoes(projeto or {})
    return out


def campos_editaveis(doc, projeto=None):
    """Chaves dos campos editáveis (não-ro) de um doc (inclui dinâmicas e tabelas)."""
    out = []
    for sec in secoes(doc, projeto or {}):
        if sec.get("tipo") == "tabela":
            out += _tabela_chaves(sec)
        else:
            out += [c[0] for c in sec["campos"] if c[2] != "ro"]
    return out


def valores(doc, projeto, conteudo):
    """Valor efetivo de cada campo: conteúdo salvo; senão o do projeto (origem)."""
    v = {}
    for sec in secoes(doc, projeto):
        if sec.get("tipo") == "tabela":
            for k in _tabela_chaves(sec):
                v[k] = conteudo.get(k, "") or ""
        else:
            for chave, _label, _tipo, orig in sec["campos"]:
                val = conteudo.get(chave)
                if not val and orig:
                    val = projeto.get(orig, "")
                v[chave] = val or ""
    return v
