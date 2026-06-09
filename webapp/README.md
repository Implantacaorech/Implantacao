# Painel de Implantação (web local)

App **Flask** que centraliza o processo de implantação por **setor/função**. Abre no navegador.

## Iniciar
- **Duplo-clique** em `Iniciar_Painel.bat` (instala dependências e abre o navegador), **ou**:
  ```bash
  python -m pip install -r tools/requirements.txt
  python webapp/app.py
  ```
- Acesse: <http://127.0.0.1:5000>

## Como funciona
**Início** → escolha o setor: Consultor, Setor Adm, Gerente do Projeto, Equipe de Conversão,
Gestão da Mudança, Coordenação. Cada papel mostra apenas **suas ações**:

| Tipo de ação | O que faz |
|---|---|
| **Gerar documento** | Gera com **dados de exemplo** (conferência) ou envie seu `.yaml`; baixe o arquivo. |
| **Importar Levantamento → Projeto** | Envie o `.docx`; recebe `projeto_<cliente>.yaml` com a **conversão verbal** aplicada. |
| **Conversor de Tempo Verbal** | Cole o texto → converte Presente → Futuro. |
| **Saúde do Sistema** | Roda o verificador (28 testes) e mostra o relatório. |

## Fluxo recomendado do Projeto
1. **Consultor → Importar Levantamento → Projeto** (envia o `.docx` do mapeamento).
2. Revisar o `projeto_<cliente>.yaml` gerado (Gerente de Projeto).
3. **Consultor → Gerar Projeto de Implantação** (envia esse `.yaml`) → baixa o `.docx`.

## Observações
- Uso **local** (127.0.0.1) — não exponha na rede sem autenticação.
- Uploads em `webapp/_uploads/` e dados de cliente em `tools/data/` ficam **fora do git**.
- Os documentos saem em `exemplos/`. Letterhead vem de `tools/templates/` (ver README de lá).
- **Próximo passo:** empacotar como `.exe` (PyInstaller), como os utilitários internos da Rech;
  e formulários por campo (hoje: exemplo ou upload de YAML).
