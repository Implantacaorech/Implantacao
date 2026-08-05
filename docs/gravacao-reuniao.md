# Gravar reunião com transcrição ao vivo

Rota: **Transcrição Áudio/Vídeo → Gravar reunião** (`/protocolos/gravar`).
Serve tanto para **reunião presencial** (microfone da sala) quanto para **reunião remota
pelo Teams** (áudio da aba/tela compartilhada), ou as duas ao mesmo tempo.

Também há um atalho na tela **Levantamento** (`/projetos/<id>/levantamento`): o botão
*Gravar reunião* abre a gravação **em outra aba**, já com o cliente daquele projeto
selecionado e o título preenchido — o formulário do levantamento continua aberto do lado.

## Quem vê o quê

A lista de transcrições mostra **apenas o material do usuário logado** — o que ele mesmo
gravou ou enviou. Reunião de cliente é de quem a conduziu; ninguém enxerga a gravação do
colega. Duas exceções deliberadas:

- **ADM** vê tudo (regra geral do painel — é quem administra e aprova);
- **vídeos do robô do SharePoint** continuam visíveis para todos: vêm de uma pasta
  compartilhada, não têm dono e sempre foram a base de conhecimento comum do time.

A regra vale na **listagem e em todas as rotas por id** (ficha, transcrição, áudio,
processar, aprovar, excluir e nos endpoints da gravação): filtrar só a lista deixaria o
conteúdo acessível a quem digitasse o id na URL. Fonte única:
`backend/src/protocolos/protocolos.acesso.ts` (com testes).

## Como usar

1. **Escolha o cliente.** O campo busca no **SICLA** — a MESMA consulta do *Novo Cliente*
   (passo 1), inclusive o SQL editável em Consultas BD. Digite o código ou parte do nome e
   **clique na opção**: só digitar não vincula. Deixe em branco para conteúdo genérico.
   A carteira de projetos do painel não serve de fonte aqui — ela só tem quem já virou
   implantação, e reunião costuma acontecer antes disso. Quando existe projeto com o mesmo
   CNPJ, a gravação é amarrada a ele automaticamente.
2. **Escolha a fonte do áudio:**
   - **Reunião presencial** — microfone desta máquina. Deixe o notebook no centro da mesa.
   - **Reunião remota (Teams)** — o navegador pede o que compartilhar; **marque
     "Compartilhar áudio"**:
     - Teams **no navegador**: escolha a **guia** da reunião ("Compartilhar áudio da guia");
     - **aplicativo** do Teams: escolha a **tela inteira** e marque o **áudio do sistema**
       (o navegador não enxerga o áudio de uma janela isolada de outro programa).
   - **Híbrida** — microfone + áudio remoto somados. Use quando há gente na sala e no Teams.
3. **Iniciar gravação.** O texto começa a aparecer depois de ~15 s de fala (mais o tempo de
   o transcritor carregar o modelo na primeira reunião, ~10 s).
4. **Encerrar e resumir.** O áudio vira um `.wav` único, a IA monta o protocolo e o
   **resumo completo**, e o registro vai para a tela de revisão.

**A gravação vive na aba.** Fechar a aba ou sair da tela encerra a captura — o áudio já
enviado fica salvo, mas o registro continua como *Gravando* até alguém encerrar ou
descartar. Não deixe a máquina suspender no meio da reunião.

## Requisito: contexto seguro (HTTPS)

O navegador **só libera microfone e captura de tela em contexto seguro** — HTTPS, ou
`http://localhost`. O painel é servido em `http://I7M1700-01-EVE:5100`, que **não é**: nessa
origem os botões de gravação aparecem bloqueados, com a explicação na própria tela.

**Atalho imediato para quem está na máquina do painel:** abra a mesma tela por
`http://localhost:5100/protocolos/gravar`. `localhost` é contexto seguro por definição —
sem HTTPS, sem certificado, sem política de navegador. A própria tela mostra esse link
quando detecta o bloqueio.

Caminhos possíveis para o resto da equipe, do melhor para o mais simples:

1. **Publicar o painel em HTTPS** — já vem pronto no backend, ver a seção abaixo. Resolve
   para todo mundo, de uma vez, e serve tanto por nome quanto por IP.
2. **Liberar a origem por política do navegador** (Edge/Chrome, distribuível por GPO):
   `OverrideSecurityRestrictionsOnInsecureOrigin` com o valor
   `http://I7M1700-01-EVE:5100`. É o caminho rápido para uma ferramenta interna.
3. **Usar a máquina do servidor** e abrir `http://localhost:5100` — funciona sem
   configuração nenhuma, mas só ali.

### Ligar o HTTPS pela CA interna da Rech (melhor opção)

A Rech tem uma **Autoridade Certificadora própria no domínio** —
`rechinfo-PR-ADCS-VS25-CA` (`PR-ADCS-VS25.rechinfo.local`), com o modelo **WebServer**
publicado e inscrição automática. **Todo computador do domínio já confia nela**, porque o
AD distribui a raiz sozinho. Um certificado emitido por ela resolve o problema inteiro sem
tocar em máquina nenhuma: nada a instalar, nada de GPO, nenhum aviso no navegador.

```
Certificado_CA_Interna_Painel.bat     (duplo clique — ele pede a elevação sozinho)
Iniciar_Painel_Novo.bat               (para o certificado novo entrar no ar)
```

O script monta o pedido com o SAN correto (FQDN + nome curto + IPs, o IP como `iPAddress`),
submete à CA, instala o certificado com a chave privada e aponta as variáveis de ambiente
para o `.pfx` novo.

Se a CA responder que o pedido ficou **pendente** ou negar, é permissão: peça à TI o direito
de *Enroll* no modelo `WebServer` para esta máquina. Até lá, o certificado autoassinado
abaixo funciona igual — só exige instalar o `.cer` nas máquinas.

### Ligar o HTTPS com certificado autoassinado (alternativa)

O backend atende **HTTP e HTTPS no mesmo processo**, e o HTTPS é **opcional**: sem as
variáveis abaixo nada muda: o painel sobe em HTTP na 5100 como sempre. Com elas, a 5100
**continua no ar** (favoritos e quem já está testando não são afetados) e o HTTPS passa a
responder em paralelo na 5443.

```powershell
# na máquina do painel, como Administrador
.\Gerar_Certificado_Painel.ps1
```

O script cria um certificado autoassinado válido por 5 anos, exporta o `.pfx` em
`backend/certs/` e o instala na raiz confiável **desta** máquina. Depois, defina as
variáveis de ambiente do sistema e reinicie o painel:

| Variável | Valor |
| --- | --- |
| `MIGRACAO_HTTPS_PFX` | caminho do `.pfx` gerado |
| `MIGRACAO_HTTPS_PFX_SENHA` | senha escolhida (padrão `painel`) |
| `MIGRACAO_HTTPS_PORT` | `5443` (padrão; opcional) |

Alternativa para certificado de CA em PEM: `MIGRACAO_HTTPS_CERT` + `MIGRACAO_HTTPS_KEY`.
Configuração pela metade **falha o boot** de propósito — subir em HTTP puro sem avisar seria
a forma de a gravação voltar a quebrar sem ninguém entender por quê.

**Por IP funciona igual a por nome.** O que decide não é ser IP: é o certificado cobrir
exatamente o que está na barra de endereços. O detalhe que costuma derrubar a tentativa é o
IP precisar estar no SAN como **`iPAddress`** — Chrome e Edge **não** aceitam IP declarado
como nome DNS. O script já monta o SAN certo (`DNS=` para nomes, `IPAddress=` para IPs).
Se o IP for de DHCP, prefira o nome: IP trocado invalida o certificado.

Nas demais máquinas, instale o `.cer` gerado (duplo clique → Computador local →
Autoridades de Certificação Raiz Confiáveis, ou por GPO) para não aparecer aviso. **Sem
instalar, o aviso aparece — mas aceitando uma vez a gravação já funciona**: a página vira
contexto seguro mesmo com certificado não confiável.

### Destravar só para testar

`Testar_Gravacao_Microfone.bat` (raiz do repositório) abre o Edge/Chrome tratando a origem
do painel como segura e já cai em `/protocolos/gravar`.

Dois detalhes que fazem a diferença entre funcionar e não funcionar:

- ele usa um **perfil separado** (`--user-data-dir`): a flag é ignorada se o navegador
  reaproveitar uma janela do perfil normal já aberta. Como o perfil é novo, é preciso
  **fazer login de novo** no painel;
- a origem tem de bater **exatamente** com a da barra de endereços (o script usa
  `http://i7m1700-01-eve:5100`); se vocês acessam por outro nome ou IP, edite a variável
  `ORIGEM` no início do arquivo.

Alternativa manual, sem script: `edge://flags/#unsafely-treat-insecure-origin-as-secure` →
adicione a origem, marque **Enabled** e reinicie o navegador.

Se mesmo assim continuar bloqueado, olhe a linha de **diagnóstico** que a tela imprime
(origem, contexto seguro, microfone disponível): ela diz se a liberação pegou. O erro mais
comum é voltar a navegar na **janela antiga** do Edge, que não recebeu a flag.

Isso é **paliativo de teste**, não solução: vale só na máquina onde foi feito.

Enquanto nada disso estiver feito, a alternativa é gravar por fora (Teams, celular,
gravador) e **enviar o arquivo pelo upload da mesma tela** — o resultado final é o mesmo,
só não há transcrição durante a reunião.

## Como funciona por dentro

```text
navegador (Angular)                     backend (NestJS)          docservice (Python)
─────────────────────                   ────────────────          ───────────────────
microfone ─┐
           ├─ mixer ─ worklet ─ trecho  ─POST /gravacao/:id/trecho─→ worker (modelo quente)
Teams/tela ┘         (15-30 s, corta        GET  /gravacao/:id    ←─ texto parcial
                      numa pausa)
                                         POST /gravacao/:id/finalizar
                                              └─ junta os .wav, devolve a transcrição
                                              └─ pipeline normal: IA + resumo completo
```

- **Corte por pausa, não por relógio.** Cortar de 20 em 20 s exatos partiria palavra ao meio
  ~180 vezes numa reunião de 1 h, e a transcrição final é a emenda dos trechos. O cortador
  espera um silêncio depois de 15 s (fim de frase); os 30 s são só o escape para quem fala
  sem pausa. Código: `frontend/src/app/core/audio/cortador.ts` (com testes).
- **Formato fixo:** WAV PCM 16 bits, mono, 16 kHz. O docservice recusa qualquer outra
  combinação — a junção final é uma cópia crua de frames e só é válida se todos os trechos
  forem iguais.
- **Worker aquecido:** o pipeline de vídeo abre um subprocesso novo por transcrição (carrega
  o modelo do zero, ~8 s). Inviável a cada 20 s — por isso a gravação tem um worker próprio
  (`docservice/transcricao/worker_vivo.py`) que vive do início ao fim da reunião e morre
  depois, devolvendo a memória. Os dois caminhos não compartilham fila: uma reunião nunca
  fica presa atrás de um vídeo de 3 h.
- **Áudio nunca sai da rede.** Transcrição local (faster-whisper, CPU). Só o **texto** vai
  para a IA, como já acontece com os vídeos. É por isso que publicar o painel num túnel de
  internet (ngrok/Cloudflare) para resolver o HTTPS é um mau negócio: cada trecho de áudio
  da reunião passaria a trafegar pela internet, ida e volta, para chegar a uma máquina que
  está na mesa ao lado.

## O guardião vigia os DOIS serviços

`Guardiao_Painel_Novo.vbs` (Tarefa Agendada, a cada 5 min) checa **painel (5100)** e
**docservice (8001)**, e sobe o que estiver fora do ar. Vigiar só o painel era um buraco
real: em **2026-08-04** o painel reiniciou às 05:35 e o docservice ficou para trás — nada o
reergueu, e o sintoma chegou ao usuário horas depois como *"Não foi possível iniciar a
gravação: ECONNREFUSED 127.0.0.1:8001"*, sem relação aparente com a causa. O painel é
checado primeiro, porque o `Iniciar_Painel_Novo.bat` já sobe o docservice junto quando a
8001 está livre.

## Reiniciar o painel NÃO reinicia o docservice

Os dois são processos separados: o painel é o `node` (5100/5443), o docservice é o
`uvicorn` (8001). O `Iniciar_Painel_Novo.bat` só sobe o docservice **se a 8001 estiver
livre** — então derrubar e subir o painel deixa o docservice antigo no ar, com o código
Python de antes. O sintoma é exatamente este: *"Não foi possível iniciar a gravação.
Verifique se o serviço de transcrição está no ar"*, com o `/health` do docservice
respondendo normalmente (aconteceu em 2026-07-30). Ao mexer em `docservice/`, encerre **os
dois** e deixe o guardião subir tudo:

```powershell
Get-NetTCPConnection -LocalPort 8001,5100 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-ScheduledTask -TaskName 'Painel Novo - Guardiao'
```

Conferência rápida de que a versão nova entrou (deve devolver **202**, não 404):

```powershell
Invoke-WebRequest -Method Post -Uri http://127.0.0.1:8001/transcrever/vivo `
  -ContentType 'application/json' -Body '{"sessaoId":999999}'
Invoke-WebRequest -Method Delete -Uri http://127.0.0.1:8001/transcrever/vivo/999999
```

## Qualidade da transcrição

Reclamação real de 2026-07-30: *"ormai"* no lugar de **ouro**, *"IVEA"* no lugar de
**IVIAN**. Não é falha do áudio — é o modelo escolhendo a sequência de sons mais provável do
português **geral**, e nome próprio e jargão de ERP são justamente o que não aparece nesse
português geral. Três medidas, na ordem de impacto:

**1. Vocabulário da reunião (o que mais resolve).** O campo *"Participantes e termos"* na
tela de gravação vira `hotwords` do Whisper: a lista de palavras que ele deve esperar ouvir.
O nome do cliente entra sozinho, junto com um glossário curto da casa (SIGER, RNS, SICLA…).
Vale nos dois passes — ao vivo e na retranscrição — porque fica gravado no registro
(`protocolos.vocabulario`). Código: `backend/src/protocolos/vocabulario.ts`.

**2. Modelo `small` no lugar de `base`.** Medido nesta máquina (i7-1255U) sobre 120 s de uma
reunião real:

| Modelo / parâmetros | Tempo (120 s de áudio) | Fator | Resultado |
| --- | --- | --- | --- |
| `base`, beam 1 (o que havia) | 11,2 s | 10,7× | "independente, será a matéria prima ou pronto" |
| `base`, beam 5 + contexto + hotwords | 18,2 s | 6,6× | ainda embolado |
| **`small`, beam 5 + contexto + hotwords** | 50,4 s | **2,4×** | "independente **se ele é** matéria-prima **ou produto** pronto" |
| `medium`, idem | 134,8 s | 0,9× | praticamente igual ao `small` |

`small` é o padrão novo: o ganho de inteligibilidade é grande e 2,4× ainda deixa o ao vivo
acompanhar a reunião (um trecho de 20 s transcreve em ~8 s). `medium` custa 4× o tempo do
`small` para um ganho que não apareceu neste áudio — e uma reunião de 36 min levaria ~40 min
só para transcrever.

**3. Parâmetros de decodificação.** `beam_size` saiu de 1 (busca gulosa: escolhe a primeira
hipótese sem comparar alternativas) para 5, o padrão do Whisper; o filtro de voz ganhou
`speech_pad_ms=400`, porque sem esse respiro ele corta o ataque das palavras — parte dos
"erros de transcrição" nascia aí; e a transcrição do arquivo inteiro passou a usar
`condition_on_previous_text=True`, que deixa o modelo levar o contexto adiante e acertar
termo técnico já citado. No ao vivo isso fica desligado de propósito: cada trecho chega
isolado, e "contexto anterior" ali viraria invenção.

**O que ainda não resolve:** sotaque forte, gíria e fala muito sobreposta continuam sendo o
limite do modelo. Duas coisas ajudam mais que qualquer ajuste de software — microfone perto
de quem fala (notebook no centro da mesa) e listar os nomes no campo de vocabulário antes de
começar.

## Separação de locutores (quem falou)

O Whisper transcreve *o que* foi dito, não *quem* disse — não há parâmetro de locutor nele.
Isso exige um segundo modelo. Escolhemos **sherpa-onnx** (44 MB de ONNX, sem download
restrito) em vez do pyannote, que arrastaria o PyTorch (~2,5 GB) e exigiria conta e token no
HuggingFace.

**Como usar:** na tela de gravação, informe *"quantas pessoas vão falar"*. Ao encerrar, a
transcrição sai como `[12:34] P1: fala`. Na ficha de revisão aparece o painel **"Quem falou
na reunião"**: dê o nome de cada um e ele substitui o rótulo.

**Renomear não reescreve a transcrição.** O texto guarda sempre `P1`; o nome vive num mapa
à parte (`protocolos.mapa_locutores`). Consequências deliberadas: renomear é reversível,
corrigir um nome digitado errado não deixa rastro, e um "P2" citado *dentro* de uma fala
(um código de produto) nunca é trocado por engano. Ao reprocessar, a IA recebe o texto já
com os nomes — o resumo passa a distinguir consultor e cliente. Código:
`backend/src/protocolos/locutores.ts` (com testes).

**O número de pessoas é informado, não descoberto.** Medido em 2026-07-31 sobre 3 min de
uma reunião real: no modo automático o agrupamento encontrou de 7 a 10 vozes onde havia 2;
com o número fixo em 2, o corte saiu limpo (99 s e 58 s de fala) e o diálogo ficou coerente.
Microfone de sala, fala distante e sobreposta não dão contraste para adivinhar sozinho — e
quem convoca a reunião sabe quantos vão falar.

| Medição (i7-1255U) | Resultado |
| --- | --- |
| 1 thread | 1,3× tempo real |
| 8 threads (padrão atual) | **3,3× tempo real** — 1 h de reunião ≈ 18 min |
| Turnos em 3 min | 12 turnos coerentes (27 picotados antes do ajuste abaixo) |

Palavra curta que cai num vazio da diarização (`né?`, `que`) **herda o locutor anterior** em
vez de virar desconhecida — sem isso o diálogo se esfarela em turnos de uma palavra só.

**Instalação dos modelos** (44 MB, fora do git):

```powershell
docservice\.venv\Scripts\python.exe -m pip install sherpa-onnx numpy
# baixe e coloque em docservice\modelos\diarizacao\ :
#   segmentacao.onnx  <- sherpa-onnx-pyannote-segmentation-3-0.tar.bz2 (model.onnx)
#   embedding.onnx    <- 3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx
# ambos em github.com/k2-fsa/sherpa-onnx/releases
```

Sem os modelos, a separação simplesmente não acontece — o resto do pipeline segue igual.

**Limite honesto:** a qualidade depende do áudio. Vozes parecidas, fala muito sobreposta e
microfone distante confundem o agrupamento (pode dividir uma pessoa em duas ou juntar
duas). Serve para separar 2 a 4 pessoas numa reunião típica, não para transcrição
forense.

## Configuração

| Variável | Para que serve | Padrão |
| --- | --- | --- |
| `PROTOCOLOS_DIR` | Pasta raiz; as gravações ficam em `<raiz>/Gravacoes` | `...\PortalImplantacao\Treinamentos` |
| `PROTOCOLOS_WHISPER` | Modelo do arquivo/retranscrição | `small` |
| `PROTOCOLOS_WHISPER_VIVO` | Modelo do ao vivo (`base` alivia a CPU) | o de `PROTOCOLOS_WHISPER` |
| `PROTOCOLOS_BEAM` | Largura da busca (1 = guloso, rápido e pior) | `5` |
| `PROTOCOLOS_THREADS_VIVO` | Núcleos do worker ao vivo | `0` (automático) |
| `PROTOCOLOS_THREADS_DIAR` | Núcleos da separação de locutores | `8` |

**Espaço em disco:** o `.wav` fica em ~115 MB por hora de reunião (16 kHz mono). É menos que
os vídeos de treinamento que já são sincronizados na mesma pasta, mas conta na cota do
OneDrive.

## Onde está o código

| Camada | Arquivo |
| --- | --- |
| Tela | `frontend/src/app/features/protocolos/gravacao.component.*` |
| Captura/corte/WAV | `frontend/src/app/core/audio/` (+ `frontend/public/gravacao-audio-worklet.js`) |
| Regras da gravação | `backend/src/protocolos/gravacao-protocolos.service.ts` |
| Ponte HTTP | `backend/src/transcricao/transcricao.service.ts` (métodos `vivo*`) |
| Sessão e junção do áudio | `docservice/transcricao/vivo.py` |
| Transcritor aquecido | `docservice/transcricao/worker_vivo.py` |
