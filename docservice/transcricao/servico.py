# -*- coding: utf-8 -*-
"""Orquestração da transcrição — expõe a `transcritor.transcrever_isolado` (copiada sem
alterar de webapp/transcritor.py) como um job assíncrono em memória, já que uma
transcrição pode levar até 3h e o docservice nunca deve bloquear a resposta HTTP por tanto
tempo. Um `threading.Lock` global serializa as transcrições (CPU pesado) — mesmo padrão de
webapp/protocolos.py:_BUSY, só que aqui cada `POST /transcrever` dispara uma thread de
fundo e devolve na hora; quem chama consulta o andamento em `GET /transcrever/{id}/status`.

O NestJS é quem decide QUANDO chamar (ele possui o Protocolo e a máquina de estados) —
este serviço só executa e reporta; nunca fala com um banco.

Duas garantias que este módulo dá além de "iniciar e reportar":

* **Dá para desistir.** `cancelar` mata o subprocesso e esquece o job — inclusive quando o
  trabalho ainda está na FILA, esperando a vez atrás de outro vídeo. Sem isso, cancelar na
  tela do painel só apagava o registro do banco: o transcritor seguia moendo o arquivo
  inteiro (observado a 377% de CPU em 2026-08-06).
* **O registro não cresce para sempre.** Cada job concluído carrega a transcrição INTEIRA
  (uma reunião de 3 h passa de 200 KB de texto) e nada limpava `_jobs`: a memória subia
  enquanto o processo vivesse. Agora os terminados são podados por idade e por teto — os
  em andamento, nunca.
"""
import json
import os
import threading
import time

import transcritor

_BUSY = threading.Lock()
_jobs = {}          # protocoloId -> {"status": "processando"|"concluido"|"erro", ...}
_controles = {}     # protocoloId -> _Controle (só enquanto o job está vivo)
_lock_jobs = threading.Lock()

# Por quanto tempo um resultado pronto fica disponível para ser buscado. Generoso de
# propósito: o painel reaproveita a transcrição já pronta quando a gravação no banco falha
# e alguém só percebe (e reprocessa) horas depois — foi o que salvou 3 h de CPU em
# 2026-08-10. O que não faz sentido é guardar para sempre.
_VALIDADE_JOB_SEG = 24 * 3600
# Teto de resultados guardados, independente da idade — protege o caso de muitos vídeos
# processados em sequência no mesmo dia.
_TETO_JOBS = 50

_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dados", "progresso")


def _progresso_path(protocolo_id):
    os.makedirs(_DIR, exist_ok=True)
    return os.path.join(_DIR, "protocolo_%d.json" % int(protocolo_id))


class _Controle(object):
    """Alça para MATAR uma transcrição em andamento.

    Existe porque o cancelamento pode chegar em três momentos diferentes, e os três
    precisam funcionar: com o job ainda na fila (o subprocesso nem nasceu), no instante
    entre o `Popen` e o registro da alça, e com o subprocesso já rodando."""

    def __init__(self):
        self.trava = threading.Lock()
        self.cancelado = False
        self.proc = None

    def registrar(self, proc):
        """Chamado pelo transcritor assim que o subprocesso nasce."""
        with self.trava:
            self.proc = proc
            cancelado = self.cancelado
        if cancelado:
            # Cancelaram enquanto o processo nascia — mata agora, senão ele rodaria a
            # transcrição inteira sem ninguém esperando o resultado.
            self._matar()

    def cancelar(self):
        with self.trava:
            self.cancelado = True
        self._matar()

    def _matar(self):
        with self.trava:
            proc = self.proc
        if proc is None:
            return   # ainda na fila: `_rodar` desiste sozinho ao ver `cancelado`
        try:
            proc.kill()
        except Exception:   # noqa: BLE001 — processo já morto é o resultado desejado
            pass


def _podar():
    """Descarta jobs TERMINADOS antigos ou excedentes. Precisa ser chamada com `_lock_jobs`
    tomado. Job em andamento nunca é podado — nem que seja o mais velho de todos: uma
    transcrição de 3 h passaria por qualquer critério de idade."""
    terminados = sorted(
        (j.get("terminado_em") or 0.0, i)
        for i, j in _jobs.items()
        if j.get("status") != "processando"
    )
    agora = time.time()
    excedente = max(0, len(terminados) - _TETO_JOBS)
    for pos, (fim, protocolo_id) in enumerate(terminados):
        if pos < excedente or agora - fim > _VALIDADE_JOB_SEG:
            _jobs.pop(protocolo_id, None)


def _encerrar(protocolo_id, controle, resultado):
    """Grava o resultado do job — a menos que ele tenha sido cancelado no meio.

    Cancelar APAGA o job em vez de deixá-lo em 'erro': para quem consulta, é como se a
    transcrição nunca tivesse sido pedida, e o próximo `iniciar` começa limpo. Deixar um
    'erro' para trás faria o painel exibir a morte do subprocesso (que fomos nós que
    matamos) como se fosse falha do transcritor."""
    with _lock_jobs:
        if _controles.get(protocolo_id) is not controle:
            # Já começou OUTRA transcrição para este id — o resultado desta é passado.
            return
        _controles.pop(protocolo_id, None)
        if controle.cancelado:
            _jobs.pop(protocolo_id, None)
        elif resultado is not None:
            resultado["terminado_em"] = time.time()
            _jobs[protocolo_id] = resultado
            _podar()


def _rodar(protocolo_id, caminho_video, vocabulario, pessoas, controle):
    with _BUSY:
        # Pode ter sido cancelado enquanto esperava a vez: o docservice transcreve UM job
        # por vez, e essa espera passa de hora quando há um vídeo grande na frente.
        if controle.cancelado:
            _encerrar(protocolo_id, controle, None)
            return
        try:
            t = transcritor.transcrever_isolado(
                caminho_video, progress_file=_progresso_path(protocolo_id),
                vocabulario=vocabulario, pessoas=pessoas,
                ao_iniciar=controle.registrar,
            )
            texto = (t.get("texto") or "").strip()
            if not texto:
                raise RuntimeError("Transcrição vazia (vídeo sem fala reconhecível?).")
            resultado = {
                "status": "concluido",
                "transcricao": t.get("texto") or "",
                "duracaoSeg": int(t.get("duracao") or 0),
                "idioma": t.get("idioma") or "pt",
                "locutores": int(t.get("locutores") or 0),
            }
        except Exception as e:
            resultado = {"status": "erro", "mensagem": "%s: %s" % (type(e).__name__, e)}
        _encerrar(protocolo_id, controle, resultado)


def iniciar(protocolo_id, caminho_video, vocabulario=None, pessoas=0):
    """Dispara a transcrição em segundo plano. `vocabulario` são termos esperados (nomes,
    jargão) usados como hotwords. Lança FileNotFoundError se o vídeo não existir; lança
    RuntimeError se já houver um job em andamento para este id."""
    if not os.path.exists(caminho_video):
        raise FileNotFoundError(caminho_video)
    with _lock_jobs:
        atual = _jobs.get(protocolo_id)
        if atual and atual.get("status") == "processando":
            raise RuntimeError("Já há uma transcrição em andamento para este protocolo.")
        controle = _Controle()
        _controles[protocolo_id] = controle
        _jobs[protocolo_id] = {"status": "processando"}
        _podar()
    threading.Thread(
        target=_rodar, args=(protocolo_id, caminho_video, vocabulario, pessoas, controle),
        daemon=True, name="transcricao-%s" % protocolo_id,
    ).start()


def cancelar(protocolo_id):
    """Desiste da transcrição: mata o subprocesso (ou impede que ele nasça, se o job ainda
    estiver na fila) e esquece o job. Devolve True se havia algo para cancelar.

    Também serve para descartar um resultado já pronto que ninguém vai mais buscar — é o
    que o painel faz ao EXCLUIR o protocolo."""
    with _lock_jobs:
        controle = _controles.get(protocolo_id)
        tinha = _jobs.pop(protocolo_id, None) is not None
    if controle is not None:
        controle.cancelar()
    return tinha


def status(protocolo_id):
    """Devolve o estado atual do job, ou None se nunca foi iniciado (ou se já foi
    cancelado/podado). Durante 'processando', mescla pct/pos/dur lidos do arquivo de
    progresso (gravado pelo subprocesso, com throttle de ~2s — pode não existir ainda no
    início)."""
    with _lock_jobs:
        job = _jobs.get(protocolo_id)
    if job is None:
        return None
    out = dict(job)
    out.pop("terminado_em", None)   # controle interno da poda, não faz parte do contrato
    if out.get("status") == "processando":
        out.update(pct=None, pos=0, dur=0, fase="transcrevendo")
        try:
            with open(_progresso_path(protocolo_id), encoding="utf-8") as f:
                j = json.load(f)
            out.update(pct=j.get("pct"), pos=j.get("pos") or 0, dur=j.get("dur") or 0,
                       fase=j.get("fase") or "transcrevendo")
        except Exception:
            pass
    return out
