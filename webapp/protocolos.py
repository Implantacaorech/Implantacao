# -*- coding: utf-8 -*-
"""Pipeline Vídeo -> Protocolo: robô da pasta do SharePoint (sincronizada pelo OneDrive),
transcrição local (transcritor) e análise IA (protocolo_ia).

Fluxo: vídeo em 'Videos Pendentes' (ou upload) -> registro Pendente (dedup por hash)
-> Transcrevendo -> Analisando -> Em revisão (+ move p/ 'Videos Processados');
qualquer falha -> Erro (+ move p/ 'Videos Com Erro'). Tudo auditado no histórico.

Pasta raiz: env PROTOCOLOS_DIR ou o padrão em PortalImplantacao/Treinamentos.
Intervalo do robô: env PROTOCOLOS_POLL_MIN (padrão 10 min).
"""
import os
import logging
import shutil
import threading

import db

RAIZ_PADRAO = r"C:\SEG-EVE\OneDrive - rech.com.br\PortalImplantacao\Treinamentos"
EXTS_VIDEO = (".mp4", ".m4v", ".mkv", ".avi", ".mov", ".webm", ".wmv")
EXTS_AUDIO = (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".flac", ".wma")
EXTS = EXTS_VIDEO + EXTS_AUDIO      # o Whisper transcreve vídeo E áudio (extrai o áudio)


def eh_audio(nome):
    return (nome or "").lower().endswith(EXTS_AUDIO)

_BUSY = threading.Lock()      # 1 processamento por vez (transcrição usa CPU pesado)


def pasta_raiz():
    return os.environ.get("PROTOCOLOS_DIR", RAIZ_PADRAO)


def _pasta(nome):
    return os.path.join(pasta_raiz(), nome)


def configurado():
    return os.path.isdir(_pasta("Videos Pendentes"))


def _progresso_path(pid):
    import _common as C
    d = os.path.join(C.DATA_WRITE, "_progresso")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "protocolo_%d.json" % int(pid))


def progresso(pid):
    """Andamento do protocolo p/ a tela: {status, pct, pos, dur}. O pct só existe
    durante a transcrição (o subprocesso grava no arquivo de progresso)."""
    import json
    p = db.protocolo_get(pid)
    if not p:
        return None
    out = {"status": p["status"], "pct": None, "pos": 0, "dur": 0}
    if p["status"] == "Transcrevendo":
        try:
            with open(_progresso_path(pid), encoding="utf-8") as f:
                j = json.load(f)
            out.update(pct=j.get("pct"), pos=j.get("pos") or 0, dur=j.get("dur") or 0)
        except Exception:
            pass
    return out


def varrer_pasta(responsavel="robô"):
    """Registra (status Pendente) os vídeos novos da pasta 'Videos Pendentes'.
    Dedup por hash — o mesmo vídeo não é registrado duas vezes. Devolve os ids novos."""
    pend = _pasta("Videos Pendentes")
    if not os.path.isdir(pend):
        return []
    novos = []
    for nome in sorted(os.listdir(pend)):
        if not nome.lower().endswith(EXTS):
            continue
        caminho = os.path.join(pend, nome)
        try:
            pid, novo = db.protocolo_criar(nome, caminho, "sharepoint", responsavel)
        except Exception:
            logging.exception("Falha ao registrar vídeo %s", nome)
            continue
        if novo:
            novos.append(pid)
    return novos


def _mover_video(pid, destino_nome):
    """Move o vídeo para a pasta de destino (Processados/Com Erro) e atualiza o caminho."""
    p = db.protocolo_get(pid)
    if not p:
        return
    src = p.get("video_caminho") or ""
    if not (src and os.path.exists(src)):
        return
    dest_dir = _pasta(destino_nome)
    try:
        os.makedirs(dest_dir, exist_ok=True)
        dst = os.path.join(dest_dir, os.path.basename(src))
        base, ext = os.path.splitext(dst)
        n = 1
        while os.path.exists(dst):                    # não sobrescreve homônimos
            dst = "%s_%d%s" % (base, n, ext)
            n += 1
        shutil.move(src, dst)
        with db.Session() as s:
            obj = s.get(db.Protocolo, pid)
            if obj:
                obj.video_caminho = dst
                s.commit()
    except OSError:
        logging.exception("Falha ao mover vídeo do protocolo %s", pid)


def _erro_amigavel(e):
    """Traduz erros comuns da API/pipeline para uma mensagem clara ao usuário."""
    txt = "%s: %s" % (type(e).__name__, e)
    low = txt.lower()
    if "credit balance is too low" in low:
        return ("Créditos da API de IA esgotados — recarregue em console.anthropic.com "
                "(Plans & Billing) e clique em Processar agora. A transcrição já feita "
                "será aproveitada (não transcreve de novo).")
    if "authentication" in low or "invalid x-api-key" in low or "401" in low:
        return "Chave da API de IA inválida — confira em Config → IA."
    if "overloaded" in low or "529" in low:
        return "API de IA sobrecarregada no momento — tente Processar agora em alguns minutos."
    return txt


def processar(pid, autor="robô"):
    """Roda o pipeline de UM protocolo: transcreve -> analisa -> Em revisão. Se a transcrição
    JÁ existe (ex.: reprocessando após falha da IA ou edição), ela é APROVEITADA — vai direto
    para a análise. Em falha, marca Erro e move o vídeo p/ 'Videos Com Erro'. Devolve (ok, msg)."""
    import transcritor
    import protocolo_ia
    p = db.protocolo_get(pid)
    if not p:
        return False, "Protocolo não encontrado."
    video = p.get("video_caminho") or ""
    texto = (p.get("transcricao") or "").strip()
    if not texto and not os.path.exists(video):
        db.protocolo_atualizar_status(pid, "Erro", "Arquivo de vídeo não encontrado.", autor)
        return False, "Arquivo de vídeo não encontrado."
    with _BUSY:                                       # serializa (transcrição é pesada)
        try:
            if not texto:                             # só transcreve se ainda não há transcrição
                db.protocolo_atualizar_status(pid, "Transcrevendo", autor=autor)
                t = transcritor.transcrever_isolado(video, progress_file=_progresso_path(pid))
                with db.Session() as s:
                    obj = s.get(db.Protocolo, pid)
                    obj.transcricao = t.get("texto") or ""
                    obj.duracao_seg = int(t.get("duracao") or 0)
                    s.commit()
                texto = (t.get("texto") or "").strip()
                if not texto:
                    raise RuntimeError("Transcrição vazia (vídeo sem fala reconhecível?).")

            db.protocolo_atualizar_status(pid, "Analisando", autor=autor)
            campos, bruto = protocolo_ia.analisar(texto, p.get("video_nome") or "")
            with db.Session() as s:
                obj = s.get(db.Protocolo, pid)
                for c, v in campos.items():
                    setattr(obj, c, v)
                obj.texto_ia = bruto
                s.commit()

            db.protocolo_atualizar_status(pid, "Em revisão", autor=autor)
            if (p.get("video_origem") or "") == "sharepoint":
                _mover_video(pid, "Videos Processados")
            return True, "Protocolo pronto para revisão."
        except Exception as e:
            logging.exception("Pipeline do protocolo %s falhou", pid)
            db.protocolo_atualizar_status(pid, "Erro", _erro_amigavel(e), autor)
            if (p.get("video_origem") or "") == "sharepoint":
                _mover_video(pid, "Videos Com Erro")
            return False, "Falha no processamento: %s" % type(e).__name__


def processar_pendentes(autor="robô"):
    """Varre a pasta e processa TODOS os registros Pendentes (sequencial). Devolve nº ok."""
    varrer_pasta(autor)
    with db.Session() as s:
        ids = [x.id for x in s.query(db.Protocolo)
               .filter(db.Protocolo.status == "Pendente")
               .order_by(db.Protocolo.criado_em).all()]
    ok = 0
    for pid in ids:
        if processar(pid, autor)[0]:
            ok += 1
    return ok


def processar_async(pid, autor=""):
    """Dispara o pipeline de um protocolo em thread de fundo (botão 'Processar agora')."""
    threading.Thread(target=processar, args=(pid, autor or "manual"),
                     daemon=True, name="protocolo-%s" % pid).start()


def agendador():
    """Robô: a cada PROTOCOLOS_POLL_MIN min, registra e processa os vídeos novos da pasta."""
    import time
    mins = int(os.environ.get("PROTOCOLOS_POLL_MIN", "10") or 10)
    while True:
        try:
            if configurado():
                n = processar_pendentes()
                if n:
                    logging.info("Robô de protocolos: %d vídeo(s) processado(s).", n)
        except Exception:
            logging.exception("Robô de protocolos falhou")
        time.sleep(max(120, mins * 60))
