# -*- coding: utf-8 -*-
"""Leitura da caixa de entrada (IMAP) para detectar o e-mail de fechamento.

Config local em imap.json (gitignored; senha só na máquina) ou env IMAP_*.
buscar_fechamento(): devolve (corpo, assunto, erro) do último e-mail marcado.
"""
import os
import json
import email
from email.header import decode_header
import _common as C

CFG = os.path.join(C.DATA_WRITE, "imap.json")


def load_cfg():
    cfg = {}
    if os.path.exists(CFG):
        try:
            with open(CFG, encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception:
            cfg = {}
    env = {"host": os.environ.get("IMAP_HOST"), "port": os.environ.get("IMAP_PORT"),
           "user": os.environ.get("IMAP_USER"), "senha": os.environ.get("IMAP_PASS"),
           "pasta": os.environ.get("IMAP_FOLDER")}
    for k, v in env.items():
        if v:
            cfg[k] = v
    return cfg


def salvar_cfg(form):
    cfg = {k: (form.get(k) or "").strip() for k in ("host", "port", "user", "pasta")}
    senha = (form.get("senha") or "").strip()
    cfg["senha"] = senha or load_cfg().get("senha", "")
    os.makedirs(os.path.dirname(CFG), exist_ok=True)
    with open(CFG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg


def configurado():
    c = load_cfg()
    return bool(c.get("host") and c.get("user"))


def _texto(msg):
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition")):
                try:
                    return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                except Exception:
                    pass
        return ""
    try:
        return msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", "replace")
    except Exception:
        return msg.get_payload() or ""


def _assunto(msg):
    partes = decode_header(msg.get("Subject", ""))
    out = ""
    for txt, enc in partes:
        out += txt.decode(enc or "utf-8", "replace") if isinstance(txt, bytes) else txt
    return out


def processar_fechamentos(criar_fn, marcador="IMPLANTA"):
    """Para cada e-mail NÃO LIDO marcado, chama criar_fn(corpo, assunto) e o marca como
    lido (para não reprocessar). Retorna quantos foram processados. Usado pelo robô."""
    import imaplib
    import email
    c = load_cfg()
    if not c.get("host"):
        return 0
    n = 0
    try:
        M = imaplib.IMAP4_SSL(c["host"], int(c.get("port") or 993))
        M.login(c["user"], c.get("senha", ""))
        M.select(c.get("pasta") or "INBOX")
        typ, data = M.search(None, "UNSEEN")
        ids = data[0].split() if data and data[0] else []
        for mid in ids:
            typ, md = M.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (SUBJECT)])")
            cab = b"".join(p[1] for p in md if isinstance(p, tuple)).decode("utf-8", "replace")
            if marcador.lower() not in cab.lower():
                continue
            typ, md = M.fetch(mid, "(BODY.PEEK[])")
            msg = email.message_from_bytes(md[0][1])
            try:
                criar_fn(_texto(msg), _assunto(msg))
                M.store(mid, "+FLAGS", "\\Seen")
                n += 1
            except Exception:
                pass
        M.logout()
    except Exception:
        return n
    return n


def buscar_fechamento(marcador="IMPLANTA"):
    """Conecta no IMAP e devolve (corpo, assunto, erro) do último e-mail NÃO LIDO
    cujo assunto contém o marcador. Não marca como lido (PEEK)."""
    import imaplib
    c = load_cfg()
    if not c.get("host"):
        return None, None, "IMAP não configurado (Config → Caixa de entrada)."
    try:
        M = imaplib.IMAP4_SSL(c["host"], int(c.get("port") or 993))
        M.login(c["user"], c.get("senha", ""))
        M.select(c.get("pasta") or "INBOX")
        typ, data = M.search(None, "UNSEEN")
        ids = data[0].split() if data and data[0] else []
        alvo = None
        for mid in reversed(ids):
            typ, md = M.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (SUBJECT)])")
            cab = b"".join(p[1] for p in md if isinstance(p, tuple)).decode("utf-8", "replace")
            if marcador.lower() in cab.lower():
                alvo = mid
                break
        if not alvo:
            M.logout()
            return None, None, "Nenhum e-mail de fechamento novo encontrado."
        typ, md = M.fetch(alvo, "(BODY.PEEK[])")
        msg = email.message_from_bytes(md[0][1])
        corpo, assunto = _texto(msg), _assunto(msg)
        M.logout()
        return corpo, assunto, None
    except Exception as e:
        if type(e).__name__ == "gaierror":
            return None, None, ("Servidor IMAP não encontrado (%s). Confira o host em "
                                "Config → Caixa de entrada — ex.: imap.gmail.com ou "
                                "outlook.office365.com." % c.get("host"))
        if "authenticate" in str(e).lower() or "login" in str(e).lower():
            return None, None, ("Falha de autenticação (usuário/senha rejeitados). Gmail e "
                                "Outlook/365 exigem uma SENHA DE APP (não a senha normal da conta) "
                                "e o IMAP habilitado. Confira o usuário e a senha em "
                                "Config → Caixa de entrada.")
        return None, None, "%s: %s" % (type(e).__name__, e)
