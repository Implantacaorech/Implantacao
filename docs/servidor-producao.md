# Servidor de produção do Painel de Implantação — especificação

> Documento para levar à TI. Cada número aqui tem uma razão medida ou uma restrição do
> código, não é chute — quando for estimativa, está dito.
> Escrito em 2026-08-12, quando a máquina de produção ainda era a de desenvolvimento
> (`I7M1700-01-EVE`, um notebook i7-1255U). O objetivo é sair dela.

## 1. O que roda nesta máquina

Não é "uma aplicação web". São **cinco coisas** no mesmo host, e é isso que dimensiona:

| # | Componente | O que é | Porta |
|---|---|---|---|
| 1 | **Backend NestJS** | API + serve o Angular já compilado. Um processo só. | 5100 |
| 2 | **MariaDB 12.2** | Banco `painel_novo`. Serviço nativo do Windows. | 3306 |
| 3 | **docservice** (Python/FastAPI) | Geração fiel de documentos, **transcrição de áudio/vídeo** e separação de locutores. | 8001 |
| 4 | **Ollama** *(opcional)* | Modelo de IA rodando na própria rede — ver §5. | 11434 |
| 5 | **Tarefas Agendadas** | Backup do banco, Guardião dos serviços, verificação de integridade. | — |

Mais duas dependências que não são processo, mas **precisam existir na máquina**: o
**Microsoft Word** (§3) e a pasta do **OneDrive** com os vídeos (§7).

## 2. Sistema operacional — precisa ser Windows

**Windows Server 2022 ou 2025** (ou Windows 11 Pro, que é o que roda hoje).

Não é preferência: a pré-visualização fiel de `.docx` converte o documento **abrindo o Word
de verdade** (`win32com.client`, em `docservice/docview.py`), porque só ele é espelho exato
do que o cliente vai abrir. Sem Windows + Word, essa conversão não existe.

> **Degradação, não quebra:** sem o Word, o `to_pdf` devolve `None` e o painel cai para uma
> pré-visualização em HTML. Funciona, mas deixa de ser fiel. Se a TI insistir em Linux, é
> essa a perda a negociar — e o resto do sistema roda.

## 3. Softwares a instalar

| Software | Versão | Por quê |
|---|---|---|
| **Node.js** | **24.x** (`>=24 <25`, travado no `package.json`) | backend |
| **Python** | 3.12 | docservice, geradores, ponte legado |
| **MariaDB** | 12.2+ | banco obrigatório pelo padrão da Rech (§4.8) |
| **Microsoft Word** | licenciado, na máquina | pré-visualização fiel (§2) |
| **Git** | qualquer recente | entrega é `git pull` + build |
| **Oracle Instant Client** | *só se usar modo thick* | consulta de disponibilidade dos consultores (base externa) |
| **Ollama** | recente | *opcional* — IA local (§5) |

## 4. Hardware — processador, memória e disco

### Processador

**8 a 16 núcleos físicos, homogêneos, de alta frequência.**

A transcrição é o trabalho mais pesado e roda em CPU: hoje leva **2,4 a 3 vezes o tempo real**
(medido, `faster-whisper` modelo `small`, 8 threads). Uma reunião de 1 h leva ~2h30.

⚠️ **Detalhe que a TI precisa saber:** a máquina atual é híbrida (2 núcleos de performance +
8 de eficiência) e por isso o sistema está fixado em `PROTOCOLOS_THREADS=8` — espalhar por
todos os threads era *pior*, porque o CTranslate2 sincroniza no núcleo mais lento. **Num
servidor de núcleos homogêneos essa trava deixa de fazer sentido**: reavaliar `PROTOCOLOS_THREADS`
(inclusive `0` = automático) depois de instalar, medindo.

### Memória RAM

| Cenário | RAM |
|---|---|
| Sem IA local | **32 GB** |
| **Com IA local (recomendado)** | **64 GB** |

Somam ao mesmo tempo: MariaDB (2–4 GB), Node (1–2 GB), o subprocesso de transcrição
(1–2 GB por vez, isolado de propósito), separação de locutores, instâncias do Word para
conversão — e, se a IA rodar em CPU, o modelo inteiro na memória (um 14B em 4 bits ocupa
~10 GB).

### Disco

**SSD NVMe. 1 TB, com folga para crescer.**

O volume vem dos **vídeos de treinamento**: cada gravação passa de 180 MB, e elas ficam
guardadas (`Videos Pendentes` → `Processados`). O banco é pequeno em comparação — o dump
diário tem ~4 MB —, mas as transcrições são `LONGTEXT` e crescem.

Reserve `C:\PainelBackups` no mesmo disco ou em outro: retenção de 14 dias, ~1 MB por dia.

### Rede

1 Gbps na rede interna. IP fixo ou nome DNS estável — a equipe acessa pelo nome da máquina.

## 5. GPU — quando é obrigatória

**Uma placa NVIDIA dedicada com 16 a 24 GB de memória própria (VRAM).**

Ela resolve **dois** gargalos de uma vez:

1. **Transcrição** — o `faster-whisper` com CUDA é ordens de grandeza mais rápido que em CPU.
   As 2h30 de uma reunião de 1 h viram minutos.
2. **IA local** — um modelo de 14B com 32 mil tokens de contexto (o necessário para ler uma
   transcrição inteira: a do protocolo #67 consumiu **25.875 tokens**) exige GPU para
   responder em tempo aceitável.

Dois pontos para não haver mal-entendido com a TI:

- **A memória que conta é a da placa (VRAM)**, não a do servidor. O modelo precisa caber nela.
- **NVIDIA especificamente** — é o que essas ferramentas suportam bem (CUDA).

> **Sem GPU o sistema funciona**, só que a transcrição continua lenta e a IA local não
> substitui bem o processamento dos protocolos. Nesse caso o desenho é híbrido: Dicionário
> local, Protocolos e Levantamento num modelo pago barato (centavos por gravação).

### Se for usar Ollama

```bash
OLLAMA_HOST=0.0.0.0            # senão só responde à própria máquina
OLLAMA_CONTEXT_LENGTH=32768    # OBRIGATÓRIO — ver o aviso abaixo
```

⚠️ **O Ollama corta a entrada em silêncio** quando ela passa do contexto configurado (padrão
~4.096 tokens), e a API compatível com a da OpenAI **não permite** mandar esse tamanho na
requisição. Sem esse ajuste, o modelo leria ~16% da transcrição e devolveria um resumo bem
formatado do começo da reunião — **sem erro nenhum**. É a falha mais traiçoeira de toda esta
especificação.

## 6. HTTPS — e o recurso que ele destrava

O servidor deve responder em **HTTPS**, com certificado da CA interna
(`rechinfo-PR-ADCS-VS25-CA`; o repositório já tem `Gerar_Certificado_Painel.ps1` e
`Certificado_CA_Interna_Painel.bat`).

Não é só boa prática: **a gravação de reunião ao vivo não funciona sem isso**. O navegador só
libera microfone e captura de tela em "contexto seguro" (HTTPS ou localhost). Hoje o painel
roda em `http://I7M1700-01-EVE:5100` e a tela de gravação sobe bloqueada — é uma
funcionalidade pronta e inutilizável desde 2026-07-30, e a máquina nova é a hora de resolver.

Variáveis: `MIGRACAO_HTTPS_PFX`, `MIGRACAO_HTTPS_SENHA`, `MIGRACAO_HTTPS_PORT`.

## 7. OneDrive e a pasta dos vídeos

O robô de protocolos vigia `PortalImplantacao/Treinamentos/Videos Pendentes`, que é
sincronizada pelo **OneDrive**. O servidor precisa:

- ter o OneDrive instalado e sincronizando a pasta;
- **manter a sessão do usuário ativa** — OneDrive e a automação do Word são coisas de sessão
  interativa, não de serviço. Combine com a TI como isso será garantido depois de um reboot
  (login automático ou equivalente).

Alternativa, se a TI recusar sessão permanente: apontar `MIGRACAO_PROTOCOLOS_DIR` para uma
pasta de rede e alimentar por outro caminho. É decisão, não detalhe.

## 8. Energia e disponibilidade

- **Nobreak (UPS).** Já houve dia de backup não rodar porque a máquina estava desligada às
  22:00. Guardião não resolve falta de energia.
- **Ligada 24/7.** O robô de protocolos, o digest diário e o backup são agendados.
- **Tarefas Agendadas** a recriar no servidor novo:

| Tarefa | Quando | Script |
|---|---|---|
| Backup do MariaDB | diária, 22:00 | `tools/Painel_Novo_Backup_MariaDB.ps1` |
| Guardião (painel + docservice) | a cada poucos minutos | `Guardiao_Painel_Novo.vbs` |
| Verificação de integridade | diária | `tools/Verificar_Integridade_Novo.ps1` |

## 9. Variáveis de ambiente (nível de USUÁRIO do Windows)

Obrigatórias — sem elas o `Iniciar_Painel_Novo.bat` para antes de subir:

| Variável | Conteúdo |
|---|---|
| `MIGRACAO_DB_URL` | `mysql://usuario:senha@127.0.0.1:3306/painel_novo` |
| `MIGRACAO_JWT_SECRET` | string aleatória longa |
| `MIGRACAO_JWT_REFRESH_SECRET` | outra, diferente da anterior |

Opcionais mais usadas: `MIGRACAO_PORT` (5100), `MIGRACAO_PROTOCOLOS_DIR`,
`MIGRACAO_BACKUP_DIR` (`C:\PainelBackups`), `MIGRACAO_DIGEST_HORA`, `MIGRACAO_DIGEST_PARA`,
`PROTOCOLOS_WHISPER` (modelo), `PROTOCOLOS_THREADS`.

⚠️ Nunca use o prefixo `PAINEL_` — é do painel Flask desligado, e ler uma dessas por engano já
causou conexão acidental a banco errado.

## 10. Firewall

| Porta | Origem | Observação |
|---|---|---|
| 5100 (e a de HTTPS) | rede interna | acesso da equipe |
| 3306 | **só localhost** | o banco não deve ser exposto |
| 8001 | **só localhost** | docservice nunca é exposto publicamente |
| 11434 | **só localhost** | se o Ollama rodar no mesmo host |

## 11. Resumo para cotação

**Configuração recomendada (com IA local e transcrição rápida):**

- Windows Server 2022/2025 + Microsoft Word licenciado
- 8–16 núcleos físicos homogêneos
- **64 GB** de RAM
- **GPU NVIDIA com 16–24 GB de VRAM**
- SSD NVMe de 1 TB
- Nobreak
- Rede 1 Gbps, IP fixo/DNS, certificado da CA interna

**Configuração mínima (sem IA local, transcrição lenta):**

- Windows Server 2022/2025 + Word
- 8 núcleos
- 32 GB de RAM
- sem GPU
- SSD NVMe de 1 TB
- Nobreak

## 12. Checklist de aceitação

Depois de instalado, o servidor está pronto quando:

- [ ] `GET /api/health` responde `{"status":"ok","db":"mariadb"}`
- [ ] `GET /api/saude` mostra os seis itens, todos ok (banco, backup, Guardião, docservice,
      transcrições, e-mail)
- [ ] a tela abre por HTTPS de outra máquina da rede
- [ ] a **gravação de reunião** inicia (prova prática de que o HTTPS está valendo)
- [ ] uma transcrição de teste roda ponta a ponta e o tempo é aceitável
- [ ] o backup das 22:00 gerou um zip acima de 100 KB
- [ ] o Guardião reergue o painel quando o processo é encerrado à mão
- [ ] a pré-visualização de um `.docx` abre em PDF (prova que o Word está acessível)
