# -*- coding: utf-8 -*-
"""Capacidade da equipe: cruza os 4 sinais para responder ao Comercial se dá para
receber um cliente novo e QUANDO começar.

Sinais por técnico (Consultor/GCI ativo no cadastro):
  1. MÓDULOS do cliente novo × CONHECIMENTO (Matriz de Conhecimento, nota 0-10);
  2. AGENDA: turnos ocupados nas próximas semanas — alocações do agendador do Painel
     + compromissos do SICLA (disponibilidade, quando configurada). 10 turnos/semana;
  3. CARGA: nº de clientes ativos (projetos não encerrados em que ele é consultor/GCI);
  4. LIBERAÇÃO: próxima virada oficial (go-live) prevista entre os projetos dele.

Score 0-100 (explicável): 45% conhecimento nos módulos + 35% folga de agenda
+ 20% carga de clientes. Janela de início: 1ª semana com >= LIVRE_MIN turnos livres.
"""
from datetime import date, timedelta

import db

TURNOS_SEMANA = 10          # 5 dias úteis × 2 turnos
LIVRE_MIN = 6               # turnos livres na semana p/ considerá-la "janela de início"
CARGA_CHEIA = 3             # nº de clientes ativos que zera a parcela de carga do score


def _tokens(txt):
    return [t.strip().lower() for t in (txt or "").replace(";", ",").split(",") if t.strip()]


def _semanas(qtd):
    """[(segunda, sexta)] das próximas `qtd` semanas, começando na desta semana."""
    seg = date.today() - timedelta(days=date.today().weekday())
    return [(seg + timedelta(weeks=i), seg + timedelta(weeks=i, days=4)) for i in range(qtd)]


def _ocupacao_sicla(tecnicos, data_ini, data_fim):
    """{(tecnico_lower, data, turno)} do SICLA — vazio se a disponibilidade não está ativa."""
    try:
        import disponibilidade as D
        if D.configurado():
            return set(D.ocupacao_por_slot_cache(data_ini, data_fim, tecnicos=tecnicos))
    except Exception:
        pass
    return set()


def avaliar_equipe(modulos=None, semanas=6):
    """Avalia todos os Consultores/GCIs ativos. `modulos` = lista de siglas do cliente
    novo (ex.: ['FAT','CTB']); vazio = visão geral sem o recorte de conhecimento."""
    modulos = [m.strip().upper() for m in (modulos or []) if m.strip()]
    hoje = date.today()
    jan = _semanas(semanas)
    ini, fim = jan[0][0].isoformat(), jan[-1][1].isoformat()

    with db.Session() as s:
        usuarios = [db.to_dict(u) for u in s.query(db.Usuario)
                    .filter(db.Usuario.perfil.in_(["Consultor", "GCI"]),
                            db.Usuario.ativo == 1).order_by(db.Usuario.nome).all()]
        projetos = [db.to_dict(p) for p in s.query(db.Projeto)
                    .filter(db.Projeto.etapa != "Encerramento").all()]
        aloc = [(a.tecnico or "", a.data or "", a.turno or "")
                for a in s.query(db.AtividadeCronograma)
                .filter(db.AtividadeCronograma.data >= ini,
                        db.AtividadeCronograma.data <= fim,
                        db.AtividadeCronograma.status.in_(["Solicitada", "Agendada"])).all()]

    codigos = [u.get("codigo_sicla") or u.get("nome") or "" for u in usuarios]
    sicla = _ocupacao_sicla([c for c in codigos if c], ini, fim)
    matriz_por_nome = {(t["nome"] or "").strip().lower(): t for t in db.matriz_listar()}

    equipe = []
    for u in usuarios:
        chaves = {x for x in (_tokens(u.get("codigo_sicla", "")) + _tokens(u.get("nome", ""))) if x}

        # 3. carga: projetos ativos em que aparece como consultor ou GCI
        meus = [p for p in projetos
                if chaves & set(_tokens(p.get("consultor", "")) + _tokens(p.get("gci", "")))]

        # 4. próxima liberação (go-live futuro mais próximo)
        golives = sorted(g for g in (p.get("data_uso_oficial") or "" for p in meus)
                         if g and g >= hoje.isoformat())
        libera_em = golives[0] if golives else ""

        # 2. agenda: turnos ocupados por semana (painel + SICLA)
        ocup_datas = {(d, t) for tec, d, t in aloc if tec.strip().lower() in chaves}
        ocup_datas |= {(d, t) for tec, d, t in sicla if tec in chaves}
        livres_sem, janela = [], ""
        for seg, sex in jan:
            oc = sum(1 for d, _t in ocup_datas if seg.isoformat() <= d <= sex.isoformat())
            livres = max(0, TURNOS_SEMANA - oc)
            livres_sem.append(livres)
            if not janela and livres >= LIVRE_MIN and sex >= hoje:
                janela = max(seg, hoje).isoformat()

        # 1. conhecimento nos módulos pedidos
        linha = next((matriz_por_nome[c] for c in chaves if c in matriz_por_nome), None)
        notas_mod, sem_nota = {}, []
        if linha:
            notas = db.matriz_notas(linha)
            notas_ci = {k.strip().upper(): v for k, v in notas.items()}
            for m in modulos:
                if m in notas_ci:
                    notas_mod[m] = notas_ci[m]
                else:
                    sem_nota.append(m)
        else:
            sem_nota = list(modulos)
        media = (sum(notas_mod.values()) / len(notas_mod)) if notas_mod else 0.0

        # score explicável
        p_con = (media / 10.0) if modulos else 0.5          # sem recorte: neutro
        p_ag = (sum(livres_sem) / (TURNOS_SEMANA * len(jan))) if jan else 0
        p_cg = max(0.0, 1.0 - len(meus) / float(CARGA_CHEIA))
        score = int(round(100 * (0.45 * p_con + 0.35 * p_ag + 0.20 * p_cg)))

        if modulos and not notas_mod:
            veredito = "Sem nota nos módulos"
        elif not janela:
            veredito = "Sem janela no período"
        elif (not modulos or media >= 6) and len(meus) < CARGA_CHEIA:
            veredito = "Pronto"
        else:
            veredito = "Parcial"

        equipe.append({
            "nome": u.get("nome") or u.get("login"), "perfil": u.get("perfil"),
            "sicla": u.get("codigo_sicla") or "", "clientes": len(meus),
            "projetos": [{"cliente": p.get("cliente"), "golive": p.get("data_uso_oficial") or ""}
                         for p in meus],
            "libera_em": libera_em, "livres_semana": livres_sem, "janela": janela,
            "notas_modulos": notas_mod, "sem_nota": sem_nota, "media": round(media, 1),
            "tem_matriz": bool(linha), "score": score, "veredito": veredito,
        })

    equipe.sort(key=lambda x: -x["score"])
    return {"equipe": equipe, "semanas": [s.isoformat() for s, _f in jan],
            "modulos": modulos, "turnos_semana": TURNOS_SEMANA}
