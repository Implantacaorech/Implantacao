# -*- coding: utf-8 -*-
"""Transcrição AO VIVO de uma reunião — presencial (microfone) ou remota (áudio do Teams
capturado pelo navegador). O navegador manda TRECHOS de áudio já prontos (WAV 16 kHz mono
16 bits, cortados de preferência num silêncio) enquanto a reunião acontece; cada trecho é
transcrito na hora por um worker com o modelo aquecido (`worker_vivo.py`) e o texto vai
aparecendo na tela. No fim, `finalizar` junta os trechos num único .wav e devolve a
transcrição inteira, com timestamps contínuos — daí para frente é o pipeline normal do
Protocolo (análise de IA + resumo completo), que fica no NestJS.

Diferença para o `servico.py` (pipeline de vídeo): lá é UM arquivo grande transcrito de
uma vez, num subprocesso que nasce e morre; aqui é um fluxo contínuo de trechos curtos
transcritos por um worker que vive o tempo todo da reunião. Os dois nunca compartilham o
worker nem a trava — uma gravação ao vivo não pode ficar presa atrás de um vídeo de 3 h na
fila.

Este módulo não fala com banco nenhum (nem sabe o que é um Protocolo): o NestJS é o dono
do estado; aqui só existe a sessão em memória + os arquivos de trecho no disco.
"""
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import wave

_DIR_BASE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "dados", "vivo"
)
_WORKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worker_vivo.py")

# Formato aceito nos trechos — é o que o worklet do navegador produz. Fixo de propósito:
# a junção final (`_concatenar`) é uma cópia crua de frames PCM, que só é válida se todos
# os trechos tiverem exatamente os mesmos parâmetros.
TAXA = 16000
CANAIS = 1
LARGURA = 2  # bytes por amostra (16 bits)

# Sessões abandonadas (aba fechada no meio da reunião) são varridas depois disso.
_VALIDADE_SEG = 12 * 3600

_sessoes = {}
_lock = threading.Lock()


def _fmt_ts(seg):
    m, s = divmod(int(seg or 0), 60)
    h, m = divmod(m, 60)
    return ("%d:%02d:%02d" % (h, m, s)) if h else ("%d:%02d" % (m, s))


class SessaoVivo(object):
    """Uma reunião sendo gravada. Todo acesso ao estado passa por `self.trava` — as
    chamadas HTTP (uma por trecho) e a thread que lê a saída do worker mexem nas mesmas
    listas."""

    def __init__(self, sessao_id, vocabulario=None):
        self.id = sessao_id
        self.vocabulario = (vocabulario or "").strip()
        self.pasta = os.path.join(_DIR_BASE, "sessao_%s" % sessao_id)
        self.trava = threading.RLock()
        self.criada_em = time.time()
        self.trechos = []          # [{seq, caminho, inicio, duracao, segmentos|None, erro}]
        self.duracao_total = 0.0   # segundos de áudio já recebidos (não transcritos)
        self.pronto = False        # modelo carregado?
        self.erro = None           # erro FATAL da sessão (worker morreu, por exemplo)
        self.encerrada = False
        self.proc = None
        self.leitor = None

    # ------------------------------------------------------------------ ciclo de vida
    def iniciar(self):
        os.makedirs(self.pasta, exist_ok=True)
        env = dict(os.environ)
        # Mesma lição do main.py: sem UTF-8 mode o worker escreveria JSON com acento na
        # codepage do sistema e a transcrição chegaria corrompida aqui.
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        if self.vocabulario:
            env["PROTOCOLOS_HOTWORDS"] = self.vocabulario
        self.proc = subprocess.Popen(
            [sys.executable, "-X", "utf8", _WORKER],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", bufsize=1, env=env,
        )
        self.leitor = threading.Thread(
            target=self._ler_worker, daemon=True, name="vivo-%s" % self.id
        )
        self.leitor.start()

    def _ler_worker(self):
        """Consome a saída do worker até o EOF (fim do processo)."""
        try:
            for linha in self.proc.stdout:
                linha = (linha or "").strip()
                if not linha:
                    continue
                try:
                    msg = json.loads(linha)
                except ValueError:
                    continue
                if msg.get("evento") == "pronto":
                    with self.trava:
                        self.pronto = True
                elif msg.get("evento") == "trecho":
                    with self.trava:
                        for t in self.trechos:
                            if t["seq"] == msg.get("seq"):
                                t["segmentos"] = msg.get("segmentos") or []
                                t["erro"] = msg.get("erro")
                                break
        except Exception as e:  # noqa: BLE001 — pipe quebrado no encerramento é normal
            with self.trava:
                if not self.encerrada:
                    self.erro = "Falha lendo o transcritor: %s" % e
        finally:
            with self.trava:
                if not self.encerrada and self.pendentes() > 0:
                    detalhe = ""
                    try:
                        detalhe = (self.proc.stderr.read() or "").strip()[-400:]
                    except Exception:  # noqa: BLE001
                        pass
                    self.erro = (
                        "O transcritor encerrou antes da hora. %s" % detalhe
                    ).strip()

    def encerrar_worker(self):
        self.encerrada = True
        if not self.proc:
            return
        try:
            if self.proc.stdin and not self.proc.stdin.closed:
                self.proc.stdin.write(json.dumps({"evento": "encerrar"}) + "\n")
                self.proc.stdin.flush()
                self.proc.stdin.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            self.proc.wait(timeout=10)
        except Exception:  # noqa: BLE001
            try:
                self.proc.kill()
            except Exception:  # noqa: BLE001
                pass

    def apagar_arquivos(self):
        try:
            shutil.rmtree(self.pasta, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass

    # ----------------------------------------------------------------------- trechos
    def adicionar_trecho(self, seq, audio_bytes):
        """Grava o trecho em disco e enfileira no worker. Devolve o deslocamento (em
        segundos) desse trecho dentro da reunião. Lança ValueError se o WAV não vier no
        formato combinado."""
        caminho = os.path.join(self.pasta, "trecho_%05d.wav" % int(seq))
        with open(caminho, "wb") as f:
            f.write(audio_bytes)
        try:
            with wave.open(caminho, "rb") as w:
                params = (w.getnchannels(), w.getsampwidth(), w.getframerate())
                quadros = w.getnframes()
        except Exception as e:  # noqa: BLE001
            os.remove(caminho)
            raise ValueError("Trecho de áudio ilegível (não é um WAV válido): %s" % e)
        if params != (CANAIS, LARGURA, TAXA):
            os.remove(caminho)
            raise ValueError(
                "Trecho fora do formato esperado (%d canal(is)/%d bits/%d Hz recebidos, "
                "esperado %d/%d/%d)."
                % (params[0], params[1] * 8, params[2], CANAIS, LARGURA * 8, TAXA)
            )

        duracao = quadros / float(TAXA)
        with self.trava:
            if any(t["seq"] == seq for t in self.trechos):
                # Reenvio do mesmo trecho (retry do navegador após timeout) — ignora,
                # senão o áudio entraria duplicado na junção final.
                return next(t["inicio"] for t in self.trechos if t["seq"] == seq)
            inicio = self.duracao_total
            self.duracao_total += duracao
            self.trechos.append({
                "seq": seq, "caminho": caminho, "inicio": inicio,
                "duracao": duracao, "segmentos": None, "erro": None,
            })
            self.trechos.sort(key=lambda t: t["seq"])
        try:
            self.proc.stdin.write(
                json.dumps({"seq": seq, "caminho": caminho}, ensure_ascii=False) + "\n"
            )
            self.proc.stdin.flush()
        except Exception as e:  # noqa: BLE001
            with self.trava:
                self.erro = "Não foi possível enviar o áudio ao transcritor: %s" % e
            raise RuntimeError(self.erro)
        return inicio

    def pendentes(self):
        return sum(1 for t in self.trechos if t["segmentos"] is None)

    def texto(self):
        """Transcrição acumulada, no mesmo formato do pipeline de vídeo ('[MM:SS] fala'),
        com os timestamps já deslocados para a linha do tempo da reunião.

        O deslocamento é recalculado AQUI, acumulando as durações na ordem de `seq` — e não
        lido do `inicio` gravado na chegada. O gravado segue a ordem de CHEGADA, e trecho
        chegando fora de ordem (retry do navegador, requisições em paralelo) produzia linha
        do tempo embaralhada na tela: '[0:34] ...' aparecendo depois de '[0:44] ...'
        (observado em 2026-08-18). A ordem de seq é a mesma da junção final do .wav, então
        o timestamp mostrado bate com o áudio salvo."""
        linhas = []
        with self.trava:
            inicio = 0.0
            for t in self.trechos:  # ordenados por seq (adicionar_trecho mantém)
                for s in t["segmentos"] or []:
                    linhas.append(
                        "[%s] %s" % (_fmt_ts(inicio + (s.get("inicio") or 0)), s["texto"])
                    )
                inicio += t["duracao"]
        return "\n".join(linhas)

    def estado(self):
        with self.trava:
            return {
                "pronto": self.pronto,
                "duracaoSeg": int(self.duracao_total),
                "trechos": len(self.trechos),
                "pendentes": self.pendentes(),
                "texto": self.texto(),
                "erro": self.erro,
            }

    # ---------------------------------------------------------------------- finalizar
    def _concatenar(self, destino):
        pasta = os.path.dirname(destino)
        if pasta:
            os.makedirs(pasta, exist_ok=True)
        with wave.open(destino, "wb") as saida:
            saida.setnchannels(CANAIS)
            saida.setsampwidth(LARGURA)
            saida.setframerate(TAXA)
            with self.trava:
                caminhos = [t["caminho"] for t in self.trechos]
            for caminho in caminhos:
                if not os.path.exists(caminho):
                    continue
                with wave.open(caminho, "rb") as entrada:
                    saida.writeframes(entrada.readframes(entrada.getnframes()))

    def finalizar(self, caminho_destino, timeout_seg=300):
        """Espera a fila drenar (limitada por `timeout_seg`), junta os trechos num único
        .wav e encerra o worker. Um trecho que não voltou a tempo entra como pendente no
        resultado: o áudio completo continua salvo, e o usuário pode mandar retranscrever
        o arquivo inteiro pelo pipeline normal."""
        limite = time.time() + max(0, timeout_seg)
        while time.time() < limite:
            with self.trava:
                if self.pendentes() == 0 or self.erro:
                    break
            time.sleep(0.5)
        with self.trava:
            faltando = self.pendentes()
            erro = self.erro
        self._concatenar(caminho_destino)
        self.encerrar_worker()
        return {
            "texto": self.texto(),
            "duracaoSeg": int(self.duracao_total),
            "caminhoAudio": caminho_destino,
            "trechos": len(self.trechos),
            "pendentes": faltando,
            "erro": erro,
        }


# ----------------------------------------------------------------------- API do módulo
def _limpar_antigas():
    """Remove pastas de sessões abandonadas (aba fechada no meio da reunião)."""
    if not os.path.isdir(_DIR_BASE):
        return
    with _lock:
        vivas = {s.pasta for s in _sessoes.values()}
    for nome in os.listdir(_DIR_BASE):
        caminho = os.path.join(_DIR_BASE, nome)
        if caminho in vivas or not os.path.isdir(caminho):
            continue
        try:
            if time.time() - os.path.getmtime(caminho) > _VALIDADE_SEG:
                shutil.rmtree(caminho, ignore_errors=True)
        except OSError:
            pass


def iniciar(sessao_id, vocabulario=None):
    """Abre a sessão e sobe o worker (o modelo carrega em paralelo — `estado.pronto` diz
    quando ele já está de pé). `vocabulario` são os termos esperados na reunião (nomes,
    jargão), que o worker usa como hotwords. Lança RuntimeError se a sessão já existir."""
    sessao_id = str(sessao_id)
    with _lock:
        if sessao_id in _sessoes:
            raise RuntimeError("Já existe uma gravação em andamento para esta sessão.")
        sessao = SessaoVivo(sessao_id, vocabulario)
        _sessoes[sessao_id] = sessao
    try:
        _limpar_antigas()
        sessao.iniciar()
    except Exception:
        with _lock:
            _sessoes.pop(sessao_id, None)
        raise
    return sessao


def obter(sessao_id):
    with _lock:
        return _sessoes.get(str(sessao_id))


def _exigir(sessao_id):
    sessao = obter(sessao_id)
    if sessao is None:
        raise KeyError(sessao_id)
    return sessao


def trecho(sessao_id, seq, audio_bytes):
    sessao = _exigir(sessao_id)
    inicio = sessao.adicionar_trecho(int(seq), audio_bytes)
    return {"recebido": True, "inicioSeg": int(inicio)}


def estado(sessao_id):
    sessao = obter(sessao_id)
    return None if sessao is None else sessao.estado()


def finalizar(sessao_id, caminho_destino, timeout_seg=300):
    sessao = _exigir(sessao_id)
    try:
        resultado = sessao.finalizar(caminho_destino, timeout_seg)
    finally:
        with _lock:
            _sessoes.pop(str(sessao_id), None)
    sessao.apagar_arquivos()
    return resultado


def cancelar(sessao_id):
    """Descarta a gravação: mata o worker e apaga os trechos do disco."""
    sessao = obter(sessao_id)
    if sessao is None:
        return False
    sessao.encerrar_worker()
    with _lock:
        _sessoes.pop(str(sessao_id), None)
    sessao.apagar_arquivos()
    return True
