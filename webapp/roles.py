# -*- coding: utf-8 -*-
"""Registro de papéis/setores e suas ações no Painel de Implantação.
Tela inicial: Coordenação · Setor Adm · Consultor de Implantação (nessa ordem)."""

ROLES = [
    {"id": "coordenacao", "nome": "Coordenação", "icone": "🧭",
     "desc": "Orquestração e saúde do sistema.",
     "acoes": [
         {"id": "saude", "nome": "Saúde do Sistema", "tipo": "saude",
          "desc": "Roda o verificador e mostra o relatório."},
     ]},
    {"id": "adm", "nome": "Setor Adm", "icone": "🗂️",
     "desc": "Levantamento e documentos.",
     "acoes": [
         {"id": "levform", "nome": "Gerar Levantamento (selecionar módulos)", "tipo": "form_modulos", "gera": "levantamento",
          "desc": "Marque os módulos previstos; o Resumo e os “Módulos Previstos” por área são preenchidos automaticamente pelo catálogo."},
         {"id": "importar", "nome": "Importar Levantamento → tudo", "tipo": "import",
          "desc": "Envie o Levantamento (.docx): gera em sequência o Projeto, o Check List do Consultor e o Termo — passando por tempo verbal + ortografia."},
         {"id": "verbal", "nome": "Tempo Verbal e Ortografia", "tipo": "verbal",
          "desc": "Converte Presente→Futuro e corrige ortografia. Cole o texto OU envie um documento (.docx) para verificação."},
     ]},
    {"id": "consultor", "nome": "Consultor de Implantação", "icone": "🛠️",
     "desc": "Importação automática, projeto, termo e check list.",
     "acoes": [
         {"id": "importar", "nome": "Importar Levantamento → tudo (automático)", "tipo": "import",
          "desc": "Envie o Levantamento (.docx): gera em sequência o Projeto, o Check List do Consultor e o Termo — passando por tempo verbal + ortografia. Não precisa abrir outra aba."},
         {"id": "projeto", "nome": "Gerar Projeto de Implantação (manual)", "tipo": "gerar",
          "mod": "gerar_projeto_implantacao", "desc": "Gera só o Projeto, a partir do projeto.yaml (exemplo ou upload)."},
         {"id": "termo", "nome": "Gerar Termo de Encerramento (manual)", "tipo": "gerar",
          "mod": "gerar_termo_encerramento", "desc": "Gera só o Termo de Encerramento."},
         {"id": "chkform", "nome": "Check List do Consultor (após o Projeto)", "tipo": "form_modulos", "gera": "checklist",
          "desc": "Selecione os módulos FINAIS (com inclusões/retiradas do levantamento) e gere a planilha-guia (Roteiro e Check List)."},
     ]},
]

# Geradores que usam o YAML do cliente (estrutura exemplo_cliente.yaml).
CLIENTE_BASE = {
    "gerar_kit_mudanca", "gerar_roteiros_teste", "gerar_aceite_uat",
    "gerar_reconciliacao_conversao", "gerar_painel_hypercare", "gerar_log_fitgap",
    "gerar_painel_kpi", "gerar_raid", "gerar_dossie_cliente",
}


def get_role(rid):
    return next((r for r in ROLES if r["id"] == rid), None)


def get_action(rid, aid):
    r = get_role(rid)
    return next((a for a in r["acoes"] if a["id"] == aid), None) if r else None


def usa_cliente(acao):
    return acao.get("mod") in CLIENTE_BASE
