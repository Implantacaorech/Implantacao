# Serviço de Geração de Documentos (docservice)

Serviço Python interno (FastAPI) — **nunca exposto publicamente**, chamado só pela API
NestJS (`backend/`) via HTTP em `localhost`. Reaproveita a lógica de preenchimento fiel já
existente em `webapp/gl_*.py` (copiada para `gerador/`, não importada — ver
[docs/migracao/02-decisao-arquitetura.md](../docs/migracao/02-decisao-arquitetura.md),
seção "Arquitetura híbrida").

## Escopo atual

Só o cronograma de visitas do Agendador (`POST /gerar/cronograma-visitas`, equivalente a
`webapp/routes_agenda.py:projeto_agenda_gerar`). Levantamento/Projeto/Termo (`.docx`, com
blocos condicionais por módulo contratado) ainda não foram convertidos — ver
[docs/migracao/03-documento-conversao.md](../docs/migracao/03-documento-conversao.md).

## ⚠️ UTF-8 mode é obrigatório

Os módulos em `gerador/` foram copiados de `webapp/` sem alteração e têm strings com
acento/travessão. Neste Windows, **sem `PYTHONUTF8=1` o interpretador decodifica esses
arquivos com a codepage do sistema em vez de UTF-8**, corrompendo silenciosamente todo
texto acentuado nos documentos gerados (achado real desta migração). `main.py` falha
rápido com um erro claro se detectar que o UTF-8 mode não está ativo — sempre use
`iniciar.bat` (já define a variável) ou rode com `python -X utf8`.

## Comandos

```bash
# Instalação (uma vez)
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# Desenvolvimento
iniciar.bat                              # já define PYTHONUTF8=1
# ou, manualmente:
set PYTHONUTF8=1
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8001

# Testes
set PYTHONUTF8=1
.venv\Scripts\python -m pytest tests/ -v
```

Documentação interativa (Swagger): `http://127.0.0.1:8001/docs` (com o serviço rodando).

## Variável de ambiente lida pelo backend NestJS

`MIGRACAO_DOCSERVICE_URL` (padrão `http://127.0.0.1:8001`) — ver
`backend/src/config/configuration.ts` e `backend/src/geracao/`.
