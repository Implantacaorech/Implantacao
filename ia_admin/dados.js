// GERADO por gerar_painel.py a partir de uso-cloud.yaml — NÃO editar à mão.
window.IA_DADOS = {
  "atualizado_em": "2026-06-19",
  "sessoes": [
    {
      "data": "2026-06-19",
      "objetivo": "Governança de contexto/IA (.cloudignore, memoria_ia, ia_admin, guias)",
      "modelo": "Claude Opus 4.8",
      "ferramentas": [
        "filesystem",
        "git"
      ],
      "arquivos_lidos": [
        "CLAUDE.md",
        ".gitignore",
        "docs/",
        "estrutura do repo"
      ],
      "arquivos_alterados": [
        "CLAUDE.md",
        ".cloudignore",
        "docs/*",
        "entrada_ia/",
        "memoria_ia/",
        "ia_admin/"
      ],
      "comandos": [
        "git fetch/status",
        "listagem de pastas"
      ],
      "risco_contexto": "medio",
      "handoff": false,
      "decisoes": [
        "camada de governança de IA separada do painel"
      ],
      "pendencias": [
        "popular ia_admin com sessões reais",
        "validar layouts fiéis"
      ],
      "responsavel": "Everton",
      "custo_obs": "estimativa manual (sem API de tokens)"
    },
    {
      "data": "2026-06-19",
      "objetivo": "Cadastros + geração fiel das fases + troca dos botões",
      "modelo": "Claude Opus 4.8",
      "ferramentas": [
        "filesystem",
        "git",
        "python"
      ],
      "arquivos_lidos": [
        "webapp/app.py",
        "webapp/db.py",
        "layouts anexos"
      ],
      "arquivos_alterados": [
        "webapp/app.py",
        "webapp/db.py",
        "webapp/gerar_layout.py",
        "tools/preencher_layout.py",
        "templates"
      ],
      "comandos": [
        "pytest",
        "git commit/push"
      ],
      "risco_contexto": "alto",
      "handoff": false,
      "decisoes": [
        "não gerar .exe",
        "subir total sempre"
      ],
      "pendencias": [
        "validar documentos gerados"
      ],
      "responsavel": "Everton",
      "custo_obs": "estimativa manual"
    }
  ]
};
