# -*- coding: utf-8 -*-
"""Envio de e-mail pela API do Gmail (OAuth2 sobre HTTPS) — contorna o bloqueio
de SMTP na rede. Usa só a porta 443.

Arquivos (em DATA_WRITE, gitignored):
  - gmail_client.json : credencial OAuth (Desktop) baixada do Google Cloud Console.
  - gmail_token.json  : token gerado na 1ª autorização (refresh automático depois).
"""
import os
import base64
from email.message import EmailMessage
import _common as C

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
CLIENT = os.path.join(C.DATA_WRITE, "gmail_client.json")
TOKEN = os.path.join(C.DATA_WRITE, "gmail_token.json")


def _creds():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    if not os.path.exists(TOKEN):
        return None
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN, "w", encoding="utf-8") as f:
            f.write(creds.to_json())
    return creds if (creds and creds.valid) else None


def tem_client():
    return os.path.exists(CLIENT)


def configurado():
    return os.path.exists(TOKEN)


def autorizar():
    """Fluxo OAuth interativo (abre o navegador). Roda uma vez na máquina."""
    from google_auth_oauthlib.flow import InstalledAppFlow
    if not os.path.exists(CLIENT):
        return False, "Falta a credencial OAuth (gmail_client.json) do Google Cloud."
    try:
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT, SCOPES)
        creds = flow.run_local_server(port=0, prompt="consent")
        with open(TOKEN, "w", encoding="utf-8") as f:
            f.write(creds.to_json())
        return True, None
    except Exception as e:
        return False, "%s: %s" % (type(e).__name__, e)


def enviar(destino, assunto, corpo, anexos=None):
    import mimetypes
    import httpx
    creds = _creds()
    if not creds:
        return False, "Gmail API não autorizado (Config → Gmail API)."
    if isinstance(destino, (list, tuple, set)):
        destino = ", ".join(x for x in destino if x)
    msg = EmailMessage()
    msg["To"] = destino
    msg["Subject"] = assunto
    msg.set_content(corpo)
    for p in anexos or []:
        if p and os.path.exists(p):
            ctype, _ = mimetypes.guess_type(p)
            maintype, subtype = (ctype or "application/octet-stream").split("/", 1)
            with open(p, "rb") as fh:
                msg.add_attachment(fh.read(), maintype=maintype, subtype=subtype,
                                   filename=os.path.basename(p))
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    try:
        r = httpx.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                       headers={"Authorization": "Bearer %s" % creds.token},
                       json={"raw": raw}, timeout=30)
        if r.status_code == 200:
            return True, None
        return False, "Gmail API %s: %s" % (r.status_code, r.text[:140])
    except Exception as e:
        return False, "%s: %s" % (type(e).__name__, e)
