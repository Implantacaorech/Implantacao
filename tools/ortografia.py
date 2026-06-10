# -*- coding: utf-8 -*-
"""
Correção ortográfica CONSERVADORA (offline). Normaliza espaços/pontuação e aplica
um dicionário EXTENSÍVEL de correções comuns (acentuação etc.), preservando
termos técnicos. Para correção profunda/contextual, usar o modo IA (API Claude).

Adicione novas correções em CORRECOES (chave em minúsculas).
"""
import re

# Correções comuns (em minúsculas). Estenda conforme a necessidade da Rech.
CORRECOES = {
    # -ção / -são / -ções
    "implantacao": "implantação", "configuracao": "configuração",
    "integracao": "integração", "parametrizacao": "parametrização",
    "informacao": "informação", "informacoes": "informações",
    "operacao": "operação", "operacoes": "operações",
    "movimentacao": "movimentação", "movimentacoes": "movimentações",
    "transacao": "transação", "transacoes": "transações",
    "aplicacao": "aplicação", "manutencao": "manutenção",
    "producao": "produção", "importacao": "importação", "exportacao": "exportação",
    "devolucao": "devolução", "emissao": "emissão", "comissao": "comissão",
    "previsao": "previsão", "versao": "versão", "versoes": "versões",
    "situacao": "situação", "validacao": "validação", "conciliacao": "conciliação",
    "apuracao": "apuração", "deducao": "dedução", "retencao": "retenção",
    "padronizacao": "padronização", "atualizacao": "atualização",
    "numeracao": "numeração", "descricao": "descrição", "observacao": "observação",
    # acentuação comum
    "tambem": "também", "atraves": "através", "apos": "após", "alem": "além",
    "necessario": "necessário", "necessaria": "necessária",
    "usuario": "usuário", "usuarios": "usuários",
    "relatorio": "relatório", "relatorios": "relatórios",
    "codigo": "código", "codigos": "códigos",
    "modulo": "módulo", "modulos": "módulos",
    "automatico": "automático", "automatica": "automática",
    "obrigatorio": "obrigatório", "obrigatoria": "obrigatória",
    "padrao": "padrão", "credito": "crédito", "debito": "débito",
    "contabil": "contábil", "patrimonio": "patrimônio",
    "numero": "número", "numeros": "números",
    "calculo": "cálculo", "calculos": "cálculos", "analise": "análise",
    "periodo": "período", "mes": "mês",
    "historico": "histórico", "minimo": "mínimo", "maximo": "máximo",
    "unico": "único", "unica": "única", "varios": "vários", "varias": "várias",
    "proprio": "próprio", "propria": "própria",
    "responsavel": "responsável", "responsaveis": "responsáveis",
    "disponivel": "disponível", "disponiveis": "disponíveis",
    "possivel": "possível", "nivel": "nível", "niveis": "níveis",
    "especifico": "específico", "especifica": "específica",
    "tributario": "tributário", "tributaria": "tributária", "rotulo": "rótulo",
    "formula": "fórmula", "formulas": "fórmulas", "logistica": "logística",
    "endereco": "endereço", "enderecos": "endereços",
    "duvida": "dúvida", "duvidas": "dúvidas", "ciencia": "ciência",
    "referencia": "referência", "sequencia": "sequência", "frequencia": "frequência",
    "pendencia": "pendência", "pendencias": "pendências",
    "ja": "já", "voce": "você", "sao": "são", "nao": "não",
    "porem": "porém", "entao": "então", "conteudo": "conteúdo",
}
# Nunca alterar (nomes/siglas).
PROTEGIDOS = {"siger", "nf-e", "nfs-e", "mdf-e", "ct-e", "sped", "rech", "cnpj", "icms"}

_PAL = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]+")


def _caixa(orig, novo):
    if orig.isupper():
        return novo.upper()
    if orig[:1].isupper():
        return novo[:1].upper() + novo[1:]
    return novo


def corrigir(texto):
    """Aplica as correções e normaliza espaços/pontuação. Retorna o texto corrigido."""
    if not texto:
        return texto

    def repl(m):
        p = m.group(0)
        k = p.lower()
        if k in PROTEGIDOS:
            return p
        novo = CORRECOES.get(k)
        return _caixa(p, novo) if novo else p

    texto = _PAL.sub(repl, texto)
    texto = re.sub(r"[ \t]{2,}", " ", texto)            # espaços duplicados
    texto = re.sub(r"\s+([,;:.!?])", r"\1", texto)      # espaço antes de pontuação
    return texto
