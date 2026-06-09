# -*- coding: utf-8 -*-
"""
Conversor de Tempo Verbal (motor OFFLINE) — Presente -> Futuro do Presente.

Portado do utilitário interno da Rech (Conversor_Verbal/conversor.py). Converte
verbos do Presente do Indicativo para o Futuro (ex.: "é"->"será", "tem"->"terá",
"utiliza"->"utilizará"), via whitelist de verbos. Qualquer outra palavra (nomes
de processos, telas, substantivos, termos técnicos) é preservada.

Voz passiva: converte apenas o auxiliar ("é realizado"->"será realizado").
Para maior cobertura/contexto, use o modo IA (ver skill projeto-implantacao).

Uso como módulo:
    from conversor_verbal import converter, converter_linhas
    converter("A empresa utiliza o módulo.")  -> "A empresa utilizará o módulo."
"""
import re

# Termos que NUNCA são convertidos (nomes de seção/campo), em minúsculas.
TERMOS_PROTEGIDOS = {
    "estrutura",
    "formulação",
    "formulacao",
}

# Verbos IRREGULARES: infinitivo -> (pres_sing, pres_plur, fut_sing, fut_plur)
IRREGULARES = {
    "ser":        ("é", "são", "será", "serão"),
    "estar":      ("está", "estão", "estará", "estarão"),
    "ter":        ("tem", "têm", "terá", "terão"),
    "conter":     ("contém", "contêm", "conterá", "conterão"),
    "manter":     ("mantém", "mantêm", "manterá", "manterão"),
    "obter":      ("obtém", "obtêm", "obterá", "obterão"),
    "reter":      ("retém", "retêm", "reterá", "reterão"),
    "deter":      ("detém", "detêm", "deterá", "deterão"),
    "haver":      ("há", None, "haverá", None),
    "fazer":      ("faz", "fazem", "fará", "farão"),
    "refazer":    ("refaz", "refazem", "refará", "refarão"),
    "satisfazer": ("satisfaz", "satisfazem", "satisfará", "satisfarão"),
    "dizer":      ("diz", "dizem", "dirá", "dirão"),
    "trazer":     ("traz", "trazem", "trará", "trarão"),
    "pôr":        ("põe", "põem", "porá", "porão"),
    "compor":     ("compõe", "compõem", "comporá", "comporão"),
    "dispor":     ("dispõe", "dispõem", "disporá", "disporão"),
    "propor":     ("propõe", "propõem", "proporá", "proporão"),
    "impor":      ("impõe", "impõem", "imporá", "imporão"),
    "expor":      ("expõe", "expõem", "exporá", "exporão"),
    "ir":         ("vai", "vão", "irá", "irão"),
    "vir":        ("vem", "vêm", "virá", "virão"),
    "provir":     ("provém", "provêm", "provirá", "provirão"),
    "intervir":   ("intervém", "intervêm", "intervirá", "intervirão"),
    "ver":        ("vê", "veem", "verá", "verão"),
    "prever":     ("prevê", "preveem", "preverá", "preverão"),
    "rever":      ("revê", "reveem", "reverá", "reverão"),
    "dar":        ("dá", "dão", "dará", "darão"),
    "poder":      ("pode", "podem", "poderá", "poderão"),
    "querer":     ("quer", "querem", "quererá", "quererão"),
    "requerer":   ("requer", "requerem", "requererá", "requererão"),
    "saber":      ("sabe", "sabem", "saberá", "saberão"),
    "caber":      ("cabe", "cabem", "caberá", "caberão"),
    "ler":        ("lê", "leem", "lerá", "lerão"),
    "crer":       ("crê", "creem", "crerá", "crerão"),
    "construir":  ("constrói", "constroem", "construirá", "construirão"),
    "destruir":   ("destrói", "destroem", "destruirá", "destruirão"),
    "sair":       ("sai", "saem", "sairá", "sairão"),
    "cair":       ("cai", "caem", "cairá", "cairão"),
    "basear":     ("baseia", "baseiam", "baseará", "basearão"),
    "mapear":     ("mapeia", "mapeiam", "mapeará", "mapearão"),
}

# Verbos REGULARES (apenas o infinitivo; formas geradas por regra). Evita-se de
# propósito verbos cuja forma do presente também é substantivo comum.
REGULARES = [
    # -ar
    "utilizar", "realizar", "gerar", "criar", "configurar", "parametrizar",
    "customizar", "personalizar", "integrar", "validar", "calcular",
    "processar", "gerenciar", "administrar", "controlar", "importar",
    "exportar", "registrar", "cadastrar", "aprovar", "reprovar", "enviar",
    "apresentar", "demonstrar", "mostrar", "disponibilizar", "armazenar",
    "salvar", "carregar", "atualizar", "sincronizar", "executar",
    "automatizar", "bloquear", "liberar", "contemplar", "considerar",
    "classificar", "organizar", "estruturar", "alimentar", "vincular",
    "associar", "relacionar", "comparar", "consolidar", "totalizar",
    "agrupar", "filtrar", "ordenar", "identificar", "indicar", "informar",
    "notificar", "alertar", "monitorar", "acompanhar", "verificar",
    "analisar", "avaliar", "aplicar", "gravar", "editar", "alterar",
    "modificar", "ajustar", "apagar", "tratar", "formatar", "transformar",
    "ocultar", "destacar", "selecionar", "habilitar", "desabilitar",
    "ativar", "desativar", "iniciar", "finalizar", "encerrar", "cancelar",
    "confirmar", "autenticar", "autorizar", "assegurar", "possibilitar",
    "viabilizar", "facilitar", "otimizar", "melhorar", "determinar",
    "precisar", "necessitar", "apoiar", "multiplicar", "detalhar",
    "exemplificar", "trabalhar", "funcionar", "operar", "atuar",
    "representar", "encaminhar", "direcionar", "redirecionar", "lançar",
    "baixar", "copiar",
    # -er
    "receber", "resolver", "escrever", "descrever", "atender", "depender",
    "corresponder", "estabelecer", "conhecer", "pertencer", "aparecer",
    "acontecer", "permanecer", "oferecer", "abranger", "proteger",
    "escolher", "preencher", "responder", "devolver", "envolver",
    "desenvolver", "mover", "remover", "promover", "vender", "perder",
    "percorrer", "ocorrer", "decorrer", "exceder", "proceder",
    "conceder", "anteceder",
    # -ir
    "permitir", "restringir", "definir", "garantir", "corrigir", "inserir",
    "exibir", "imprimir", "emitir", "admitir", "transmitir", "omitir",
    "dividir", "decidir", "dirigir", "exigir", "conferir", "preferir",
    "sugerir", "transferir", "referir", "abrir", "cobrir", "descobrir",
    "repartir", "conseguir", "distinguir", "assistir",
    "existir", "consistir", "persistir", "resistir", "desistir", "medir",
    "pedir", "ouvir", "advertir", "compartilhar",
    # -uir
    "incluir", "excluir", "possuir", "atribuir", "distribuir", "substituir",
    "contribuir", "constituir", "diminuir",
    # -zir
    "produzir", "conduzir", "reduzir", "traduzir", "introduzir",
]


def _formas_regulares(inf):
    fut_s, fut_p = inf + "á", inf + "ão"
    if inf.endswith("ar"):
        st = inf[:-2]
        return (st + "a", st + "am", fut_s, fut_p)
    if inf.endswith("uir") and not inf.endswith(("guir", "quir")):
        st = inf[:-2]
        return (st + "i", st + "em", fut_s, fut_p)
    if inf.endswith("zir"):
        st = inf[:-2]
        return (st, st + "em", fut_s, fut_p)
    if inf.endswith(("er", "ir")):
        st = inf[:-2]
        return (st + "e", st + "em", fut_s, fut_p)
    return None


def _construir_mapa():
    mapa = {}

    def add(pres, fut):
        if pres and fut:
            mapa[pres.lower()] = fut

    for pres_s, pres_p, fut_s, fut_p in IRREGULARES.values():
        add(pres_s, fut_s)
        add(pres_p, fut_p)
    for inf in REGULARES:
        formas = _formas_regulares(inf)
        if formas:
            pres_s, pres_p, fut_s, fut_p = formas
            add(pres_s, fut_s)
            add(pres_p, fut_p)
    return mapa


MAPA = _construir_mapa()
_PADRAO = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]+")


def _aplicar_caixa(original, novo):
    if original.isupper():
        return novo.upper()
    if original[:1].isupper():
        return novo[:1].upper() + novo[1:]
    return novo


def converter_texto(texto):
    """Converte um trecho. Retorna (novo_texto, [(orig, novo), ...])."""
    if not texto:
        return texto, []
    mudancas = []

    def repl(m):
        palavra = m.group(0)
        chave = palavra.lower()
        novo = MAPA.get(chave)
        if not novo:
            return palavra
        if chave in TERMOS_PROTEGIDOS:
            return palavra
        # ênclise/mesóclise ("aplica-se"): não converte (evita "aplicara-se")
        resto_apos = m.string[m.end():]
        if re.match(r"-(se|lhe|lhes|lo|la|los|las|nos|me|te|vos)\b", resto_apos):
            return palavra
        # "São Paulo"/"São José": não converte
        if chave == "são" and palavra[:1].isupper():
            prox = re.match(r"\s+([A-Za-zÀ-ÖØ-öø-ÿ])", m.string[m.end():])
            if prox and prox.group(1).isupper():
                return palavra
        final = _aplicar_caixa(palavra, novo)
        if final != palavra:
            mudancas.append((palavra, final))
        return final

    return _PADRAO.sub(repl, texto), mudancas


def converter(texto):
    """Conveniência: retorna apenas o texto convertido."""
    return converter_texto(texto)[0]


def converter_linhas(linhas):
    """Converte uma lista de strings, item a item."""
    return [converter(x) for x in (linhas or [])]


if __name__ == "__main__":
    import sys
    txt = " ".join(sys.argv[1:]) or (
        "A empresa utiliza o módulo de Vendas, possui controle de estoque e "
        "realiza a apuração. O cadastro é feito manualmente e gera o financeiro."
    )
    novo, muda = converter_texto(txt)
    print("ANTES:", txt)
    print("DEPOIS:", novo)
    print("MUDANÇAS:", muda)
