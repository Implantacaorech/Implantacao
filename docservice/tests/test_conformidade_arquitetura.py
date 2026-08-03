# -*- coding: utf-8 -*-
"""Guarda automática do **Guia Mestre de Arquitetura de Desenvolvimento**
(``vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md``, ADR-0002)
traduzido para o docservice (FastAPI).

O guia é escrito sobre um backend em camadas (Controller → Service → Repository). Aqui a
tradução é:

===========================  ==================================================
Guia (backend)               Aqui (docservice)
===========================  ==================================================
Controller recebe e delega   ``main.py`` — rotas, validação Pydantic, HTTP
Service concentra a regra    ``gerador/`` e ``transcricao/``
Repository só persiste       ``gerador/db.py`` (shim de contexto)
Nunca vazar detalhe interno  5xx responde mensagem genérica
===========================  ==================================================

Irmão de ``backend/src/common/conformidade-arquitetura.spec.ts`` e pela mesma razão: o
desvio entra por pressa, não por decisão.
"""
import ast
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MAIN = RAIZ / "main.py"

# Módulos de manipulação de documento/áudio: são a REGRA, e a camada de entrada não os
# conhece — ela chama gerador/ e transcricao/, que os encapsulam.
BIBLIOTECAS_DE_REGRA = {
    "docx",
    "openpyxl",
    "faster_whisper",
    "whisper",
    "pptx",
    "PIL",
}


def _arvore(caminho: Path) -> ast.Module:
    return ast.parse(caminho.read_text(encoding="utf-8"))


def _rotas(arvore: ast.Module) -> list[ast.FunctionDef]:
    """Funções decoradas com @app.<verbo>(...)."""
    achadas = []
    for no in ast.walk(arvore):
        if not isinstance(no, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in no.decorator_list:
            alvo = dec.func if isinstance(dec, ast.Call) else dec
            if isinstance(alvo, ast.Attribute) and isinstance(alvo.value, ast.Name):
                if alvo.value.id == "app":
                    achadas.append(no)
                    break
    return achadas


def test_encontra_as_rotas_para_inspecionar():
    """Se o parser parar de achar rota, os testes abaixo passariam vazios — sem valor."""
    assert len(_rotas(_arvore(MAIN))) >= 10


def test_camada_de_entrada_nao_manipula_documento_nem_audio():
    """main.py delega a geração; não importa docx/openpyxl/whisper direto."""
    importados = set()
    for no in ast.walk(_arvore(MAIN)):
        if isinstance(no, ast.Import):
            importados.update(a.name.split(".")[0] for a in no.names)
        elif isinstance(no, ast.ImportFrom) and no.module:
            importados.add(no.module.split(".")[0])

    infratores = sorted(importados & BIBLIOTECAS_DE_REGRA)
    assert infratores == [], (
        "main.py é a camada de entrada e não deve manipular documento/áudio direto — "
        f"mova para gerador/ ou transcricao/. Achados: {infratores}"
    )


def test_toda_rota_tem_docstring():
    """§Documentação do guia: a rota é o contrato público deste serviço."""
    sem_doc = [r.name for r in _rotas(_arvore(MAIN)) if not ast.get_docstring(r)]
    # /health é auto-explicativo e não carrega contrato — exceção única e declarada.
    sem_doc = [n for n in sem_doc if n != "health"]
    assert sem_doc == [], f"Rotas sem docstring: {sem_doc}"


def test_erro_5xx_nao_devolve_o_texto_da_excecao():
    """Falha interna pode carregar caminho de arquivo e detalhe de ambiente.

    4xx com ``str(e)`` é deliberado (mensagem de domínio, útil ao chamador) — a regra vale
    só para 5xx. É o que o próprio main.py já dizia em comentário na geração de documentos;
    aqui vira teste.
    """
    fonte = MAIN.read_text(encoding="utf-8")
    padrao = re.compile(
        r"HTTPException\(\s*status_code\s*=\s*5\d{2}\s*,\s*detail\s*=\s*(str\(e\)|f[\"'])"
    )
    infratores = [
        f"linha {fonte[: m.start()].count(chr(10)) + 1}"
        for m in padrao.finditer(fonte)
    ]
    assert infratores == [], (
        "5xx deve responder mensagem genérica e logar o detalhe no servidor. "
        f"Achados: {infratores}"
    )


def test_servico_de_transcricao_nao_conhece_http():
    """A camada de regra não importa FastAPI — quem traduz erro para HTTP é main.py.

    Equivale à regra do backend "Repository não lança exceção HTTP": se o serviço souber
    responder 404, ele deixa de ser reaproveitável fora da rota.
    """
    infratores = []
    for pasta in ("gerador", "transcricao"):
        for arquivo in sorted((RAIZ / pasta).glob("*.py")):
            fonte = arquivo.read_text(encoding="utf-8")
            if re.search(r"^\s*(from|import)\s+fastapi", fonte, re.MULTILINE):
                infratores.append(f"{pasta}/{arquivo.name}")
    assert infratores == [], (
        f"Camada de regra não conhece HTTP. Achados: {infratores}"
    )
