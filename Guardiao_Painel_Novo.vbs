' Guardiao do Painel de Implantacao NOVO (Angular + NestJS).
' Vigia TRES servicos e sobe o que estiver fora do ar. Roda OCULTO (sem janela).
'
'   painel      (5100) -> Iniciar_Painel_Novo.bat     (NestJS + Angular)
'   docservice  (8001) -> docservice\iniciar.bat      (geracao de documentos + transcricao)
'   Portal API  (5110) -> Iniciar_Portal_Conexoes.bat (instancia interna da API de Dados)
'
' Por que os dois: sao processos SEPARADOS, e o Iniciar_Painel_Novo.bat so sobe o
' docservice quando ele mesmo e executado. Vigiar so a 5100 deixava um buraco real —
' em 2026-08-04 o painel reiniciou as 05:35 e o docservice ficou para tras, sem ninguem
' para reergue-lo. O sintoma chega ao usuario como "Nao foi possivel iniciar a gravacao:
' ECONNREFUSED 127.0.0.1:8001", varias horas depois, sem relacao aparente com a causa.
'
' O Portal API entrou na vigilancia em 2026-08-26, pelo MESMO motivo e no dia seguinte ao
' de ele subir pela primeira vez: a instancia caiu durante a noite (o log termina em ^C —
' janela fechada) e ninguem a reergueu, porque o guardiao so conhecia as outras duas.
' Enquanto o Painel consumir dado por ela, aquela porta fora do ar e tela sem dado aqui.
'
' Pre-requisito: MIGRACAO_DB_URL / MIGRACAO_JWT_SECRET / MIGRACAO_JWT_REFRESH_SECRET
' definidas como variavel de ambiente (sem elas, Iniciar_Painel_Novo.bat falha rapido e
' loga o motivo). Disparado por uma Tarefa Agendada do Windows PROPRIA.
' Log em C:\PainelBackups\guardiao_novo.log
Option Explicit
Dim fso, base, shell, subiu, backupDir, porta, portaDados

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName) & "\"
shell.CurrentDirectory = base
subiu = False

' F1 da migracao p/ servidor dedicado: pasta de log e porta vem do ambiente quando
' definidas (MIGRACAO_BACKUP_DIR / MIGRACAO_PORT); sem elas, os padroes de sempre.
backupDir = shell.ExpandEnvironmentStrings("%MIGRACAO_BACKUP_DIR%")
If backupDir = "%MIGRACAO_BACKUP_DIR%" Or backupDir = "" Then backupDir = "C:\PainelBackups"
porta = shell.ExpandEnvironmentStrings("%MIGRACAO_PORT%")
If porta = "%MIGRACAO_PORT%" Or porta = "" Then porta = "5100"
portaDados = shell.ExpandEnvironmentStrings("%MIGRACAO_DADOS_PORT%")
If portaDados = "%MIGRACAO_DADOS_PORT%" Or portaDados = "" Then portaDados = "5110"

' O painel PRIMEIRO: o Iniciar_Painel_Novo.bat ja sobe o docservice junto quando a 8001
' esta livre, entao nesse caso a checagem seguinte nao tem mais o que fazer.
If Not NoAr("http://localhost:" & porta & "/api/health") Then
    Registrar "Painel novo fora do ar; reiniciando."
    shell.Run """" & base & "Iniciar_Painel_Novo.bat""", 0, False
    subiu = True
    WScript.Sleep 15000   ' da tempo de o .bat subir o docservice antes de conferir
End If

If Not NoAr("http://127.0.0.1:8001/health") Then
    Registrar "docservice fora do ar; reiniciando."
    shell.Run """" & base & "docservice\iniciar.bat""", 0, False
End If

' Portal API (instancia interna da API de Dados). So e vigiado se ALGUEM ja o subiu alguma
' vez nesta maquina — e o .bat dele deixou o log. Sem essa condicao, uma maquina que nunca
' quis o Portal API (um servidor so do Painel, por exemplo) veria o guardiao tentando
' subi-lo a cada 5 minutos, para sempre.
If fso.FileExists(backupDir & "\portal_conexoes_stdout.log") Then
    If Not NoAr("http://localhost:" & portaDados & "/api/health") Then
        Registrar "Portal API fora do ar; reiniciando."
        shell.Run """" & base & "Iniciar_Portal_Conexoes.bat""", 0, False
    End If
End If

WScript.Quit 0


' Devolve True se o endereco respondeu 200. Qualquer falha (conexao recusada, timeout)
' conta como fora do ar.
Function NoAr(url)
    Dim http
    NoAr = False
    Set http = CreateObject("MSXML2.XMLHTTP")
    On Error Resume Next
    http.open "GET", url, False
    http.send
    If Err.Number = 0 And http.status = 200 Then NoAr = True
    On Error GoTo 0
End Function


' Registra a queda no log (nao falha se o arquivo estiver ocupado).
Sub Registrar(msg)
    Dim log
    On Error Resume Next
    Set log = fso.OpenTextFile(backupDir & "\guardiao_novo.log", 8, True)
    log.WriteLine Now & " - " & msg
    log.Close
    On Error GoTo 0
End Sub
