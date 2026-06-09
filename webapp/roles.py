# -*- coding: utf-8 -*-
"""Registro de papéis/setores e suas ações no Painel de Implantação."""

ROLES = [
    {"id": "consultor", "nome": "Consultor de Implantação", "icone": "🛠️",
     "desc": "Levantamento, projeto, testes, conversão, hypercare e encerramento.",
     "acoes": [
         {"id": "importar", "nome": "Importar Levantamento → Projeto", "tipo": "import",
          "desc": "Envie o Mapeamento (.docx); gera o projeto_<cliente>.yaml com as rotinas já no futuro."},
         {"id": "projeto", "nome": "Gerar Projeto de Implantação", "tipo": "gerar",
          "mod": "gerar_projeto_implantacao", "desc": "Documento Word fiel ao template (engine de tokens)."},
         {"id": "levantamento", "nome": "Gerar Levantamento (Mapeamento)", "tipo": "gerar",
          "mod": "gerar_levantamento", "desc": "Documento Word do mapeamento de processos."},
         {"id": "termo", "nome": "Gerar Termo de Encerramento", "tipo": "gerar",
          "mod": "gerar_termo_encerramento", "desc": "Documento Word de encerramento."},
         {"id": "roteiros", "nome": "Roteiros de Teste SIT/UAT", "tipo": "gerar",
          "mod": "gerar_roteiros_teste", "desc": "Planilha de casos por módulo + defeitos + sign-off."},
         {"id": "aceite", "nome": "Termo de Aceite de Testes", "tipo": "gerar",
          "mod": "gerar_aceite_uat", "desc": "Documento de sign-off dos testes (gate da virada)."},
         {"id": "reconc", "nome": "Reconciliação de Conversão", "tipo": "gerar",
          "mod": "gerar_reconciliacao_conversao", "desc": "Planilha origem×destino + cargas + aceite."},
         {"id": "hypercare", "nome": "Painel de Hypercare", "tipo": "gerar",
          "mod": "gerar_painel_hypercare", "desc": "Janela pós-virada, chamados e critérios de saída."},
         {"id": "verbal", "nome": "Conversor de Tempo Verbal", "tipo": "verbal",
          "desc": "Converte o texto do Presente para o Futuro (utiliza→utilizará)."},
     ]},
    {"id": "adm", "nome": "Setor Adm", "icone": "🗂️",
     "desc": "Documentos, RNS e encaminhamentos.",
     "acoes": [
         {"id": "levform", "nome": "Gerar Levantamento (selecionar módulos)", "tipo": "form_levantamento",
          "desc": "Marque os módulos contratados; o Resumo e os “Módulos Previstos” por área são preenchidos automaticamente pelo catálogo."},
         {"id": "levantamento", "nome": "Gerar Levantamento (dados de exemplo)", "tipo": "gerar",
          "mod": "gerar_levantamento", "desc": "Documento Word do mapeamento com os dados de exemplo/YAML."},
         {"id": "importar", "nome": "Importar Levantamento → Projeto", "tipo": "import",
          "desc": "Gera o projeto_<cliente>.yaml a partir do mapeamento."},
     ]},
    {"id": "gp", "nome": "Gerente do Projeto", "icone": "📊",
     "desc": "Datas, métricas, riscos e dossiê.",
     "acoes": [
         {"id": "kpi", "nome": "Painel de KPIs", "tipo": "gerar", "mod": "gerar_painel_kpi",
          "desc": "Indicadores de resultado (prazo, adoção, qualidade, CSAT)."},
         {"id": "raid", "nome": "RAID (riscos / issues)", "tipo": "gerar", "mod": "gerar_raid",
          "desc": "Riscos, premissas, issues, decisões e dependências."},
         {"id": "dossie", "nome": "Dossiê do Cliente", "tipo": "gerar", "mod": "gerar_dossie_cliente",
          "desc": "Estado consolidado da implantação."},
         {"id": "fitgap", "nome": "Log de Fit/Gap", "tipo": "gerar", "mod": "gerar_log_fitgap",
          "desc": "Aderência ao padrão (standard/gap/desenvolvimento)."},
     ]},
    {"id": "conversao", "nome": "Equipe de Conversão", "icone": "🔄",
     "desc": "Validação e reconciliação dos dados convertidos.",
     "acoes": [
         {"id": "reconc", "nome": "Reconciliação de Conversão", "tipo": "gerar",
          "mod": "gerar_reconciliacao_conversao", "desc": "Planilha origem×destino + cargas + aceite."},
     ]},
    {"id": "mudanca", "nome": "Gestão da Mudança", "icone": "🤝",
     "desc": "Adoção, comunicação e treinamento (OCM/ADKAR).",
     "acoes": [
         {"id": "kit", "nome": "Kit de Gestão da Mudança", "tipo": "gerar", "mod": "gerar_kit_mudanca",
          "desc": "Stakeholders, comunicação, prontidão (ADKAR), treino e indicadores."},
     ]},
    {"id": "coordenacao", "nome": "Coordenação", "icone": "🧭",
     "desc": "Orquestração e saúde do sistema.",
     "acoes": [
         {"id": "saude", "nome": "Saúde do Sistema", "tipo": "saude",
          "desc": "Roda o verificador (28 testes) e mostra o relatório."},
     ]},
]


def get_role(rid):
    return next((r for r in ROLES if r["id"] == rid), None)


def get_action(rid, aid):
    r = get_role(rid)
    return next((a for a in r["acoes"] if a["id"] == aid), None) if r else None


# Geradores que usam o YAML do cliente (estrutura exemplo_cliente.yaml) como 1º
# argumento — recebem os "Dados do Cliente" preenchidos na tela.
CLIENTE_BASE = {
    "gerar_kit_mudanca", "gerar_roteiros_teste", "gerar_aceite_uat",
    "gerar_reconciliacao_conversao", "gerar_painel_hypercare", "gerar_log_fitgap",
    "gerar_painel_kpi", "gerar_raid", "gerar_dossie_cliente",
}


def usa_cliente(acao):
    return acao.get("mod") in CLIENTE_BASE
