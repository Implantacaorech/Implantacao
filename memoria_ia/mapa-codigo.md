# Mapa de código — navegação rápida (economia de contexto)

> Para a IA achar a função/rota certa **sem ler os arquivos grandes inteiros**
> (`db.py` ~1.900 linhas). Linhas são aproximadas (mudam com o tempo) —
> use como ponto de partida e confirme com Grep do nome. Atualizado: 2026-06-26.
>
> Geração fiel (`gerar_layout`) já foi **modularizada**: ver `gl_comum.py`, `gl_levantamento.py`,
> `gl_projeto.py`, `gl_termo.py`, `gl_xlsx.py` (cada um < 300 linhas).
>
> `app.py` foi **dividido** (2593 → ~880 linhas): as rotas vivem em 8 módulos `routes_*.py`,
> cada um com `register(app, **deps)` + `add_url_rule` (endpoints e `url_for` inalterados).
> O `app.py` mantém só o núcleo (criação do app, login/before_request, perfis/permissões,
> notificações, robôs) e registra os módulos perto do fim, antes de `if __name__ == "__main__"`.

## webapp/db.py — por domínio

**Fluxo / gates (constantes + regras)** — topo do arquivo
- Constantes: `ETAPAS`/`SITUACOES`/`PERFIS` (26), `CAMPOS_OBRIGATORIOS` (39), `GATES` (79), `ACAO_ENTRADA` (92), `DOC_LABELS` (69), `CAMPO_LABELS` (55)
- `acao_entrada_ok` (101) · `campos_faltantes` (125) · `pode_avancar` (136) · `proxima_etapa` (171) · `gate_status` (179) · `cabecalho` (1876)

**Infra ORM**: `_db_url` (189) · `engine`/`Session`/`Base` (200-202) · `to_dict` (707) · `_auto_migrar` (1680) · `_migrar_etapas` (1705) · `init_db` (1715)

**Projeto**: `class Projeto` (205) · `aplicar_form` (711) · `projeto_existe` (722) · `class Documento` (234) · `class Evento` (246) / `registrar_evento` (257) · `class Modificacao` (767) / `registrar_modificacao` (813) / `salvar_linhas` (824)

**Usuários / auth**: `class Usuario` (262) · `class CadastroPendente` (275) · `set_senha`/`checa_senha` (288/293) · `autenticar` (301) · `usuarios_por_perfil` (315) · `email_do_usuario` (323) · `salvar_pendente`/`confirmar_pendente` (356/388)

**E-mail (modelos)**: `class ModeloEmail` (415) · `renderizar_modelo` (489) · `listar/obter/salvar/excluir_modelo_email` (508-552) · `_seed_modelos_email` (678)

**Designação**: `class Designacao` (692) · `designacoes_do_projeto` (701)

**Cronograma/Checklist (planos editáveis)**: `class CronogramaItem` (740) · `class ChecklistItem` (754) · `cronograma_do_projeto` (793) · `checklist_do_projeto` (799) · `CRONO_CAMPOS`/`CHECK_CAMPOS`/status (≈781-789)

**Cadastros (catálogos)**: `class ChecklistModelo` (861) · `class IndiceTopico` (877) · `checklist_modelo_listar/salvar/excluir` (959-1001) · `indice_listar` (1008) · `indice_modulos` (1028) · `_seed/_reseed_*` (904-943)

**Modelos de Documentos (layouts)**: `class ModeloDocumento`/`Versao`/`Campo` (1067/1080/1092) · `modelos_documento_listar` (1218) · `modelo_documento_arquivo_path` (1270) · `_modelos_doc_store` (1182) · `_seed_modelos_documento` (1192)

**Levantamento (respostas)**: `class LevantamentoResposta` (1311) · `levantamento_seed` (1323) · `levantamento_respostas` (1350) · `levantamento_salvar` (1357) · `levantamento_resumo` (1371) · `levantamento_importado` (1380) · `levantamento_importar_respostas` (1389)

**Agendador de visitas**: `class AtividadeCronograma` (1431) · `CRONO_STATUS_AGENDA` (≈1447) · `cronograma_atividades_seed` (1462) · `cronograma_atividades` (1495) · `cronograma_visitas` (1504) · `cronograma_alocar` (1519) · `class SlotCronograma` (1547) · `cronograma_horarios` (1558) · `cronograma_horas` (1572) · `cronograma_horario_salvar` (1577) · `cronograma_status` (1593) · `cronograma_postergar` (1607) · `cronograma_tecnico_modulo` (1627)

**DocConteudo (telas estruturadas)**: `class DocConteudo` (1648) · `doc_conteudo` (1659) · `doc_conteudo_salvar` (1666)

**Métricas/alertas**: `metricas` (1744) · `alertas` (1812) · `metricas_uso` (1847) · `funil_macro` (1860) · `_pnum` (1739) · `_pdate` (1729)

## webapp/app.py — núcleo (linha aprox.) + registro dos módulos

Permanece no `app.py` (núcleo, não foi movido):
- **Auth/cadastro**: `/login` (162) · `/logout` (179) · `/cadastro` (199) · `/cadastro/confirmar` (230) · `before_request` `_exige_login`
- **Papéis/skills**: `/papel/<rid>` (463) · `/acao/<rid>/<aid>` (471)
- **Perfil/usuários/cliente**: `/perfil` (583) · `/usuarios` (589) · `/cliente` (634)
- **Carteira/ficha**: `/projetos` lista (655) · `/projetos/novo` · `/projetos/<pid>` ficha · `/excluir` · `/avancar` · `/anexar` · `/nota`
- **Digest/download/health**: `/digest/enviar` (299) · `/download` · `/health`
- **Context processors**: `inject_cliente` · `inject_alertas`
- **Robôs**: `_agendador_digest` · `_agendador_caixa` · `_criar_projeto_de_fechamento` (usado pelo robô)
- **Registro dos módulos**: bloco `import routes_* / routes_*.register(app, ...)` perto do fim (antes de `if __name__`).

## webapp/routes_*.py — rotas por módulo (Grep pelo nome; cada arquivo é pequeno)

- **routes_agenda.py** — Agendador de Visitas: `/agenda` · `/agenda/alocar` · `/agenda/alocar_visita` · `/agenda/horario` · `/agenda/tecnico_modulo` · `/agenda/status` · `/agenda/acompanhamento` · `/agenda/gerar` · `/agenda/postergar`
- **routes_config.py** — `/config` (IA) · `/config/email` · `/config/disponibilidade` · `/config/modelos-email*` · `/config/imap` · `/config/gmail`
- **routes_cadastros.py** — `/cadastros/checklist*` · `/cadastros/indice*` · `/cadastros/modelos*`
- **routes_cronograma.py** — planos editáveis: `/cronograma` (+`/seed`,`/gerar`) · `/checklist` (+`/seed`); helpers `_linhas_do_form`/`_seed_cronograma`/`_seed_checklist`/`_gerar_cronograma_de_itens`
- **routes_geracao.py** — `/gerar/<tipo>` · `/gerar-layout/<slug>` · `/gerar_projeto` · `/gerar_pendentes` · `/projeto/origem` (gate) · `/levantamento` · `/editar/<doc>`; helpers `_gerar_e_anexar_fiel`/`_gerar_projeto_fiel`; const `_LAYOUT_SLUGS`
- **routes_designacao.py** — `/designar` · `/definir_gci` · `/agendar` · `/consultores`
- **routes_fluxo.py** — `/fluxo*` (`/parse`,`/inbox`,`/criar`) · `/projetos/<pid>/email` · `/mapa` · `/projetos/<pid>/doc/<id>/ver`; helper `_fluxo_confirmar`
- **routes_painel.py** — telas executivas: `/` (home) · `/coordenacao` · `/atividade` · `/monitoramento`; helpers `_split_nomes`/`_parse_data`/`_idade_media`/`_estado_setor`/`_monitoramento_operacional`

## Helpers-chave do app.py (perfis/permissões/notificação) — injetados nos módulos
`_perfil` · `_e_adm` · `pode_ver(area)` (111) · `pode_gerar(tipo)` (100) · `pode_designar` (96) · `_so_meus` · `_autor` · `_etapa_permite_gerar` · `_auto_avancar` · `_notificar` · `_notificar_evento` · `_data_br` · dicts `_EVT_DOC`/`_ETAPA_DOC` · const `UPLOADS`/`ALLOWED_DIRS` — passados via `register(app, **deps)`. Buscar por nome (Grep) quando precisar.
