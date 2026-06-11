# -*- coding: utf-8 -*-
"""Motor de onboarding da Implantação: a partir do e-mail de FECHAMENTO do
Comercial, extrai os dados e prepara a criação do fluxo completo.

- MODELO_FECHAMENTO: modelo padrão para o Comercial preencher (extração confiável).
- parse_fechamento(texto): lê o corpo do e-mail e devolve os campos do projeto.
- resumo_projeto(proj, docs): texto-resumo para o e-mail final aos responsáveis.
"""
import re
import unicodedata

MARCADOR = "[IMPLANTACAO]"   # marcador no assunto (comparado sem acento/caixa)

MODELO_FECHAMENTO = """Assunto: [IMPLANTAÇÃO] Fechamento - <Razão Social>

Cliente (Razão Social):
CNPJ:
Ramo:
Cidade/UF:
Contato (nome):
E-mail do contato:
Telefone:
Nº da proposta/projeto:
Módulos contratados (siglas):
Horas cobradas:
Horas bonificadas:
Produto / Observações:
"""

# rótulo normalizado -> campo interno
_LABELS = [
    (("cliente", "razao social"), "cliente"),
    (("cnpj",), "cnpj"),
    (("ramo",), "ramo"),
    (("cidade", "cidade/uf", "localizacao", "cidade / uf"), "cidade"),
    (("contato", "contato (nome)", "nome do contato"), "contato_nome"),
    (("e-mail do contato", "email do contato", "e-mail", "email"), "contato_email"),
    (("telefone", "fone", "celular"), "contato_tel"),
    (("no da proposta/projeto", "no proposta", "no projeto", "no da proposta",
      "proposta", "numero do projeto", "projeto", "no"), "numero_projeto"),
    (("modulos contratados", "modulos contratados (siglas)", "modulos"), "modulos"),
    (("horas cobradas", "horas contratadas"), "horas_cobradas"),
    (("horas bonificadas", "bonificadas"), "horas_bonificadas"),
    (("produto / observacoes", "produto/observacoes", "produto", "observacoes", "obs"), "observacoes"),
]


def _norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s.strip().lower())


def _campo(rotulo):
    n = _norm(rotulo).strip(" .:-")
    for alvos, campo in _LABELS:
        if n in alvos:
            return campo
    # casamento por prefixo (tolera variações)
    for alvos, campo in _LABELS:
        if any(n.startswith(a) for a in alvos):
            return campo
    return None


def parse_fechamento(texto):
    """Extrai os campos do corpo do e-mail (linhas 'Rótulo: valor')."""
    d = {}
    for linha in (texto or "").splitlines():
        if ":" not in linha:
            continue
        rotulo, valor = linha.split(":", 1)
        valor = valor.strip().strip("<>").strip()
        campo = _campo(rotulo)
        if campo and valor and not d.get(campo):
            d[campo] = valor
    return d


def para_projeto(d):
    """Converte os campos extraídos no dict de campos do Projeto (hub)."""
    contatos = " · ".join(x for x in (d.get("contato_nome"), d.get("contato_email"),
                                      d.get("contato_tel")) if x)
    obs = " · ".join(x for x in (d.get("cidade"), d.get("observacoes")) if x)
    return {
        "cliente": d.get("cliente", ""), "cnpj": d.get("cnpj", ""),
        "ramo": d.get("ramo", ""), "numero_projeto": d.get("numero_projeto", ""),
        "modulos": d.get("modulos", ""),
        "horas_cobradas": d.get("horas_cobradas", ""),
        "horas_bonificadas": d.get("horas_bonificadas", ""),
        "contatos": contatos, "observacoes": obs,
        "contato_email": d.get("contato_email", ""),
    }


def resumo_projeto(proj, docs=None, gci="", tecnicos=""):
    """Texto-resumo do projeto para o e-mail final aos responsáveis."""
    linhas = ["Resumo do projeto de implantação", "=" * 34, ""]
    campos = [("Cliente", proj.get("cliente")), ("CNPJ", proj.get("cnpj")),
              ("Ramo", proj.get("ramo")), ("Nº do projeto", proj.get("numero_projeto")),
              ("Módulos", proj.get("modulos")),
              ("Horas", "%s cobradas + %s bonificadas" % (proj.get("horas_cobradas") or "0",
                                                          proj.get("horas_bonificadas") or "0")),
              ("Contatos", proj.get("contatos")),
              ("GCI (Levantamento)", gci), ("Técnico(s)", tecnicos)]
    for rot, val in campos:
        if val:
            linhas.append("• %s: %s" % (rot, val))
    if docs:
        linhas += ["", "Documentos em anexo:"]
        linhas += ["  - %s" % d for d in docs]
    linhas += ["", "Próximo passo: o GCI realiza o Levantamento de Processos e segue o fluxo no Painel.",
               "", "— Painel de Implantação · Rech Sistemas de Gestão"]
    return "\n".join(linhas)
