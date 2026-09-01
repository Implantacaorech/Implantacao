/** Quanto tempo sem batida até a sessão deixar de contar como "online".
 *
 * O navegador bate a cada `INTERVALO_PING_S`; a janela é mais que o dobro disso de propósito,
 * para uma batida perdida (rede oscilando, aba congelada por um instante) não derrubar
 * alguém da lista e fazer a tela piscar gente entrando e saindo. */
export const JANELA_ONLINE_S = 120;

/** De quanto em quanto tempo o navegador bate. Contrato compartilhado com o frontend —
 * mudar aqui exige mudar lá, e a janela acima precisa continuar sendo pelo menos o dobro. */
export const INTERVALO_PING_S = 45;

/** Acima disto sem interação, a sessão aparece como OCIOSA (continua online, mas a tela
 * mostra que a pessoa não está mexendo). */
export const OCIOSO_S = 300;

/** Sessão mais velha que isto é lixo: aba fechada sem aviso, máquina desligada na tomada.
 * Podada na própria batida do usuário — ver `PresencaService.registrar`. */
export const EXPURGO_S = 60 * 60;
