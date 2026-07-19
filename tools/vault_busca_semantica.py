# -*- coding: utf-8 -*-
"""
Busca semântica sobre o Vault (`vault/*.md`) — RAG-lite, sem banco vetorial nem
infraestrutura nova: os embeddings ficam cacheados em `tools/data/vault_embeddings.json`
(gerado, fora do git — ver .gitignore) e a busca é um cosseno em memória (o Vault tem só
algumas dezenas de notas; não precisa de índice sofisticado).

Motor: API Gemini (`gemini-embedding-001`, mesma chave já usada para texto/imagem no
projeto — ver vault/22 - Troubleshooting/). Sem chave, `indexar()`/`buscar()` levantam
RuntimeError com uma mensagem clara (fallback explícito, não silencioso).

Uso:
    python tools/vault_busca_semantica.py --indexar          # (re)constrói o índice
    python tools/vault_busca_semantica.py "sua pergunta aqui"  # busca

Chave de API: variável de ambiente GEMINI_API_KEY, ou lida do arquivo `.env` na raiz do
repo (mesma convenção já usada nesta sessão para não versionar segredo).
"""
import hashlib
import io
import json
import math
import os
import re
import sys
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
VAULT_DIR = os.path.join(REPO, "vault")
CACHE_PATH = os.path.join(HERE, "data", "vault_embeddings.json")
MODELO_EMBED = "models/gemini-embedding-001"
ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/%s:embedContent" % MODELO_EMBED
)


def _get_key():
    k = os.environ.get("GEMINI_API_KEY")
    if k:
        return k.strip()
    env_path = os.path.join(REPO, ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for linha in f:
                if linha.startswith("GEMINI_API_KEY="):
                    return linha.split("=", 1)[1].strip()
    return ""


def _listar_notas():
    """[(caminho_relativo, titulo, corpo_sem_frontmatter)] para cada .md do Vault."""
    notas = []
    for raiz, _dirs, arquivos in os.walk(VAULT_DIR):
        for nome in arquivos:
            if not nome.endswith(".md"):
                continue
            caminho = os.path.join(raiz, nome)
            rel = os.path.relpath(caminho, REPO).replace("\\", "/")
            with io.open(caminho, encoding="utf-8") as f:
                texto = f.read()
            corpo = re.sub(r"^---\n.*?\n---\n", "", texto, flags=re.S)
            m = re.search(r'titulo:\s*"?([^"\n]+)"?', texto)
            titulo = m.group(1).strip() if m else nome
            notas.append((rel, titulo, corpo.strip()))
    return notas


def _embed(texto, key):
    corpo = json.dumps(
        {"content": {"parts": [{"text": texto[:8000]}]}}, ensure_ascii=False
    ).encode("utf-8")
    req = urllib.request.Request(
        "%s?key=%s" % (ENDPOINT, key),
        data=corpo,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            "Falha ao chamar a API de embedding (%s): %s" % (e.code, e.read().decode("utf-8", "replace"))
        )
    return data["embedding"]["values"]


def indexar(forcar=False):
    """(Re)constrói o índice local. Só reprocessa notas cujo conteúdo mudou."""
    key = _get_key()
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY não encontrada (nem no ambiente, nem em .env na raiz do repo)."
        )
    cache = {}
    if not forcar and os.path.exists(CACHE_PATH):
        with io.open(CACHE_PATH, encoding="utf-8") as f:
            cache = json.load(f)

    notas = _listar_notas()
    novo_cache = {}
    reprocessadas = 0
    for rel, titulo, corpo in notas:
        assinatura = hashlib.sha256(corpo.encode("utf-8")).hexdigest()
        existente = cache.get(rel)
        if existente and existente.get("assinatura") == assinatura:
            novo_cache[rel] = existente
            continue
        vetor = _embed(corpo, key)
        novo_cache[rel] = {
            "titulo": titulo,
            "assinatura": assinatura,
            "vetor": vetor,
            "trecho": corpo[:280].replace("\n", " "),
        }
        reprocessadas += 1

    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with io.open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(novo_cache, f, ensure_ascii=False)
    return len(novo_cache), reprocessadas


def _cosseno(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def buscar(pergunta, top_k=5):
    key = _get_key()
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY não encontrada (nem no ambiente, nem em .env na raiz do repo)."
        )
    if not os.path.exists(CACHE_PATH):
        raise RuntimeError("Índice ainda não existe — rode com --indexar primeiro.")
    with io.open(CACHE_PATH, encoding="utf-8") as f:
        cache = json.load(f)

    vetor_pergunta = _embed(pergunta, key)
    resultados = []
    for rel, item in cache.items():
        score = _cosseno(vetor_pergunta, item["vetor"])
        resultados.append((score, rel, item["titulo"], item["trecho"]))
    resultados.sort(key=lambda x: x[0], reverse=True)
    return resultados[:top_k]


def _main():
    # Console do Windows (cp1252) não representa alguns caracteres do Vault (→, ®
    # etc.) — sem isso, um resultado de busca com esses caracteres derruba o script.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    if len(sys.argv) < 2:
        print(__doc__)
        return
    if sys.argv[1] == "--indexar":
        total, novas = indexar(forcar="--forcar" in sys.argv)
        print("Índice pronto: %d notas (%d reprocessadas)." % (total, novas))
        return
    pergunta = " ".join(sys.argv[1:])
    for score, rel, titulo, trecho in buscar(pergunta):
        print("%.3f  %s (%s)" % (score, titulo, rel))
        print("      %s..." % trecho)
        print()


if __name__ == "__main__":
    _main()
