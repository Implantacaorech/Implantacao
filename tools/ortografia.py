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
    "implantacao": "implantação", "configuracao": "configuração",
    "integracao": "integração", "parametrizacao": "parametrização",
    "tambem": "também", "atraves": "através", "apos": "após",
    "necessario": "necessário", "necessaria": "necessária",
    "usuario": "usuário", "usuarios": "usuários",
    "relatorio": "relatório", "relatorios": "relatórios",
    "codigo": "código", "codigos": "códigos",
    "modulo": "módulo", "modulos": "módulos",
    "automatico": "automático", "automatica": "automática",
    "obrigatorio": "obrigatório", "padrao": "padrão",
    "credito": "crédito", "debito": "débito", "saldo": "saldo",
    "fiscal": "fiscal", "contabil": "contábil", "patrimonio": "patrimônio",
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
