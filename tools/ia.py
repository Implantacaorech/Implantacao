# -*- coding: utf-8 -*-
"""
Modo IA (API Claude) — RECONFERÊNCIA de tempo verbal + ortografia.

É uma 2ª passada (opcional) sobre a correção offline (conversor_verbal + ortografia):
se houver chave de API, o texto passa pela Claude para uma revisão contextual,
deixando os verbos no FUTURO DO PRESENTE DO INDICATIVO e a ortografia correta.
Sem chave ou em qualquer erro, devolve o texto inalterado (fallback transparente).

Chave de API: variável de ambiente ANTHROPIC_API_KEY (ou CONVERSOR_API_KEY), ou o
arquivo data/anthropic_key.txt (salvo pela tela "IA" do painel).
Modelo: variável CONVERSOR_MODELO_CLAUDE (padrão claude-opus-4-8; pode trocar por
claude-sonnet-4-6 ou claude-haiku-4-5 para reduzir custo).
"""
import os
import re
import json

import _common as C

MODELO = os.environ.get("CONVERSOR_MODELO_CLAUDE", "claude-opus-4-8")
_KEY_FILE = os.path.join(C.DATA_WRITE, "anthropic_key.txt")

SISTEMA = (
    "Você é um revisor de texto técnico em português do Brasil para documentos de "
    "implantação do ERP SIGER. Para CADA segmento recebido, devolva o texto revisado de modo que:\n"
    "1) os VERBOS fiquem no FUTURO DO PRESENTE DO INDICATIVO "
    "(ex.: utiliza→utilizará, é→será, possui→possuirá, tem→terá, faz→fará, são→serão, há→haverá);\n"
    "2) a ORTOGRAFIA e a acentuação fiquem corretas.\n"
    "NÃO altere o sentido, NÃO traduza, NÃO acrescente nem remova informação, NÃO comente. "
    "Preserve termos técnicos, nomes de módulos, siglas (SIGER, NF-e, MDF-e), códigos de menu "
    "(ex.: 1.2-A) e a pontuação. Mantenha as palavras 'Formulação' e 'Estrutura' como estão. "
    "Responda APENAS com um objeto JSON, sem texto antes ou depois, no formato "
    '{"segmentos":[{"id":<inteiro>,"texto":"<corrigido>"}]} — um item para cada id recebido.'
)


def get_key():
    k = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CONVERSOR_API_KEY")
    if k:
        return k.strip()
    try:
        with open(_KEY_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""


def salvar_key(valor):
    """Salva (ou remove) a chave de API no arquivo local data/anthropic_key.txt."""
    valor = (valor or "").strip()
    os.makedirs(C.DATA_WRITE, exist_ok=True)
    if valor:
        with open(_KEY_FILE, "w", encoding="utf-8") as f:
            f.write(valor)
    elif os.path.exists(_KEY_FILE):
        os.remove(_KEY_FILE)


def disponivel():
    return bool(get_key())


def _extrai_json(txt):
    try:
        return json.loads(txt)
    except Exception:
        m = re.search(r"\{.*\}", txt or "", re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


def _um_lote(segmentos, key):
    """segmentos: list[(id, texto)] -> dict {id: texto_corrigido}. Erros propagam."""
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    payload = {"segmentos": [{"id": i, "texto": t} for i, t in segmentos]}
    resp = client.messages.create(
        model=MODELO,
        max_tokens=8000,
        system=SISTEMA,
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
    )
    texto = "".join(getattr(b, "text", "") for b in resp.content
                    if getattr(b, "type", "") == "text")
    data = _extrai_json(texto) or {}
    out = {}
    for item in data.get("segmentos", []):
        try:
            out[int(item["id"])] = str(item["texto"])
        except Exception:
            continue
    return out


def revisar_lote(linhas):
    """Recebe uma lista de strings; devolve a lista revisada (mesma ordem e tamanho).
    Sem chave de API ou em erro, devolve as linhas inalteradas."""
    linhas = list(linhas)
    key = get_key()
    if not key or not linhas:
        return linhas
    idx = [i for i, t in enumerate(linhas) if t and t.strip()]
    LOTE = 40
    try:
        for k in range(0, len(idx), LOTE):
            grupo = idx[k:k + LOTE]
            mapa = _um_lote([(i, linhas[i]) for i in grupo], key)
            for i in grupo:
                if mapa.get(i, "").strip():
                    linhas[i] = mapa[i]
    except Exception:
        return list(linhas)            # fallback transparente (mantém o offline)
    return linhas


def revisar(texto):
    """Revisa um texto único, preservando as quebras de linha."""
    if not texto or not texto.strip() or not disponivel():
        return texto
    return "\n".join(revisar_lote(texto.split("\n")))
