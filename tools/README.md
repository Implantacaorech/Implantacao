# Ferramentas — Geradores Office

Geradores que produzem artefatos **.xlsx/.docx** a partir de arquivos de dados em
`data/` (modelo **dados entram → Office sai**). Saída em `../exemplos/`.

## Instalação (uma vez)

```bash
python -m pip install -r requirements.txt
```

## Como usar

1. Copie `data/exemplo_cliente.yaml` para um arquivo do cliente e ajuste os valores.
2. Ajuste, se necessário, `data/gestao_mudanca.yaml` e `data/roteiros_teste.yaml`.
3. Rode os geradores (a partir da pasta `tools/`):

```bash
python gerar_kit_mudanca.py        # Kit de Gestão da Mudança (.xlsx)
python gerar_roteiros_teste.py     # Roteiros SIT/UAT + defeitos + sign-off (.xlsx)
python gerar_aceite_uat.py         # Termo de Aceite de Testes (.docx)
```

Para usar dados de um cliente específico, passe os caminhos:

```bash
python gerar_roteiros_teste.py data/cliente_4521.yaml data/roteiros_teste.yaml
```

## Saídas (em `../exemplos/`)

| Gerador | Arquivo | Conteúdo |
|---------|---------|----------|
| `gerar_kit_mudanca.py` | `Kit_Gestao_Mudanca_<cliente>.xlsx` | Stakeholders, Comunicação, Prontidão (ADKAR), Treinamento por papel, Indicadores de adoção |
| `gerar_roteiros_teste.py` | `Roteiros_SIT_UAT_<cliente>.xlsx` | Casos por módulo (dropdown de status), Registro de defeitos, Resumo + gate |
| `gerar_aceite_uat.py` | `Termo_Aceite_UAT_<cliente>.docx` | Termo de aceite/sign-off dos testes |

## Estrutura

```
tools/
├── _common.py              # estilos e helpers compartilhados
├── requirements.txt
├── data/
│   ├── exemplo_cliente.yaml
│   ├── gestao_mudanca.yaml
│   └── roteiros_teste.yaml
├── gerar_kit_mudanca.py
├── gerar_roteiros_teste.py
└── gerar_aceite_uat.py
```

> Os arquivos gerados em `exemplos/` **não** são versionados (são reproduzíveis).
> Para alinhar ao layout oficial da Rech, substitua os estilos/cabeçalhos pelos
> templates reais quando disponíveis.
