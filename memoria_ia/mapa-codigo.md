# Mapa de código — navegação rápida (economia de contexto)

> Para a IA achar a função/rota certa **sem ler os arquivos grandes inteiros**
> (`app.py` ~2.600 linhas, `db.py` ~1.900). Linhas são aproximadas (mudam com o tempo) —
> use como ponto de partida e confirme com Grep do nome. Atualizado: 2026-06-26.
>
> Geração fiel (`gerar_layout`) já foi **modularizada**: ver `gl_comum.py`, `gl_levantamento.py`,
> `gl_projeto.py`, `gl_termo.py`, `gl_xlsx.py` (cada um < 300 linhas).

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

## webapp/app.py — rotas por grupo (linha aprox.)

- **Auth/cadastro**: `/login` (162) · `/logout` (179) · `/cadastro` (199) · `/cadastro/confirmar` (230)
- **Home/painéis**: `/` home (412) · `/coordenacao` (1012) · `/atividade` (1028) · `/monitoramento` (1284) · `/mapa` (2016) · `/perfil` (583)
- **Papéis/skills**: `/papel/<rid>` (463) · `/acao/<rid>/<aid>` (471)
- **Usuários**: `/usuarios` (589)
- **Cadastros**: `/cadastros/checklist*` (631-672) · `/cadastros/indice*` (679-717) · `/cadastros/modelos*` (727-800)
- **Config**: `/config` IA (820) · `/config/email` (839) · `/config/disponibilidade` (852) · `/config/modelos-email*` (876-943) · `/config/imap` (1985) · `/config/gmail` (1998)
- **Carteira/ficha**: `/projetos` (1003) · `/projetos/novo` (1305) · `/projetos/<pid>` ficha (1317) · `/excluir` (1353) · `/avancar` (1367)
- **Geração de docs**: `/gerar/<tipo>` (1459) · `/gerar-layout/<slug>` (1496) · `/projeto/origem` gate (1540) · `/gerar_pendentes` (1405)
- **Levantamento/Projeto/edição**: `/levantamento` (1598) · `/editar/<doc>` (1852) · `/anexar` (1634) · `/nota` (1657)
- **Agendamento/Designação**: `/definir_gci` (1731) · `/agendar` (1760) · `/designar` (1669) · `/consultores` (1805)
- **Cronograma/Checklist (plano)**: `/cronograma*` (2130-2167)
- **Agendador de visitas**: `/agenda` (2197) · `/agenda/alocar` (2297) · `/agenda/alocar_visita` (2320) · `/agenda/horario` (2344) · `/agenda/tecnico_modulo` (2356) · `/agenda/status` (2368) · `/agenda/acompanhamento` (2382) · `/agenda/gerar` · `/agenda/postergar` (após 2382)
- **E-mail/fluxo**: `/projetos/<pid>/email` (959) · `/fluxo*` (1879-1909) · `/digest/enviar` (299)

## Helpers-chave do app.py (perfis/permissões/notificação)
`_perfil` · `_e_adm` · `pode_ver(area)` (111) · `pode_gerar(tipo)` (100) · `pode_designar` (96) · `_auto_avancar` · `_notificar_evento` · `_gerar_e_anexar_fiel` · `_gerar_projeto_fiel` — buscar por nome (Grep) quando precisar.
