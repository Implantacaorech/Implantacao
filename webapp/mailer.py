# -*- coding: utf-8 -*-
"""E-mail interno (SMTP) do Painel: configuração local + envio + modelos.

A senha fica SÓ na máquina (DATA_WRITE/smtp.json) — nunca versionada. Em
servidores, as variáveis de ambiente SMTP_* têm prioridade sobre o arquivo.
"""
import os
import json
import ssl
import smtplib
from email.message import EmailMessage
import _common as C

CFG = os.path.join(C.DATA_WRITE, "smtp.json")


def load_cfg():
    cfg = {}
    if os.path.exists(CFG):
        try:
            with open(CFG, encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception:
            cfg = {}
    env = {"host": os.environ.get("SMTP_HOST"), "port": os.environ.get("SMTP_PORT"),
           "user": os.environ.get("SMTP_USER"), "senha": os.environ.get("SMTP_PASS"),
           "remetente": os.environ.get("SMTP_FROM"), "use_tls": os.environ.get("SMTP_TLS")}
    for k, v in env.items():
        if v:
            cfg[k] = v
    return cfg


def salvar_cfg(form):
    cfg = {k: (form.get(k) or "").strip() for k in ("host", "port", "user", "remetente")}
    cfg["use_tls"] = bool(form.get("use_tls"))
    senha = (form.get("senha") or "").strip()
    cfg["senha"] = senha or load_cfg().get("senha", "")   # não apaga a senha ao reeditar
    os.makedirs(os.path.dirname(CFG), exist_ok=True)
    with open(CFG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg


def configurado():
    c = load_cfg()
    return bool(c.get("host") and c.get("remetente"))


def enviar(destino, assunto, corpo, anexos=None):
    """Envia um e-mail de texto, com anexos opcionais (lista de caminhos).
    `destino` pode ser string (1 ou vários separados por vírgula) ou lista. Retorna (ok, erro)."""
    import mimetypes
    c = load_cfg()
    if not c.get("host"):
        return False, "SMTP não configurado (Config → E-mail)."
    if isinstance(destino, (list, tuple, set)):
        destino = ", ".join(x for x in destino if x)
    try:
        msg = EmailMessage()
        msg["From"] = c.get("remetente") or c.get("user")
        msg["To"] = destino
        msg["Subject"] = assunto
        msg.set_content(corpo)
        for path in anexos or []:
            if not (path and os.path.exists(path)):
                continue
            ctype, _ = mimetypes.guess_type(path)
            maintype, subtype = (ctype or "application/octet-stream").split("/", 1)
            with open(path, "rb") as fh:
                msg.add_attachment(fh.read(), maintype=maintype, subtype=subtype,
                                   filename=os.path.basename(path))
        port = int(c.get("port") or 587)
        ctx = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(c["host"], port, context=ctx, timeout=20) as srv:
                if c.get("user"):
                    srv.login(c["user"], c.get("senha", ""))
                srv.send_message(msg)
        else:
            with smtplib.SMTP(c["host"], port, timeout=20) as srv:
                if c.get("use_tls"):
                    srv.starttls(context=ctx)
                if c.get("user"):
                    srv.login(c["user"], c.get("senha", ""))
                srv.send_message(msg)
        return True, None
    except Exception as e:
        return False, "%s: %s" % (type(e).__name__, e)


def templates(proj):
    """Modelos prontos a partir do registro do projeto."""
    cli = proj.get("cliente") or "cliente"
    cons = proj.get("consultor") or "a equipe de implantação"
    num = proj.get("numero_projeto") or ""
    ref = (" (projeto nº %s)" % num) if num else ""
    rodape = "Atenciosamente,\nEquipe de Implantação — Rech Sistemas de Gestão"
    return {
        "encaminhamento": {
            "nome": "Encaminhamento / Abertura da implantação",
            "assunto": "Implantação do SIGER® — %s" % cli,
            "corpo": ("Olá,\n\nDamos início à implantação do ERP SIGER® na %s%s. O consultor "
                      "responsável será %s, que entrará em contato para alinhar o cronograma e "
                      "os próximos passos.\n\nFicamos à disposição.\n\n%s" % (cli, ref, cons, rodape)),
        },
        "cronograma": {
            "nome": "Compartilhamento do cronograma",
            "assunto": "Cronograma de Implantação — %s" % cli,
            "corpo": ("Olá,\n\nSegue o cronograma de implantação do SIGER® para a %s%s, com as "
                      "agendas e os macro tópicos de cada visita/treinamento. Por favor, confirme "
                      "as datas ou retorne com ajustes.\n\n%s" % (cli, ref, rodape)),
        },
        "encerramento": {
            "nome": "Encerramento da implantação",
            "assunto": "Encerramento da Implantação — %s" % cli,
            "corpo": ("Olá,\n\nComunicamos o encerramento da implantação do SIGER® na %s%s. A partir "
                      "desta data, o atendimento passa a ser conduzido pelo setor de Suporte da Rech "
                      "(telefone, e-mail e Teams).\n\nAgradecemos a parceria.\n\n%s" % (cli, ref, rodape)),
        },
    }
