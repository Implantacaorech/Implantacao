/** Credenciais do registro de aplicativo no Entra ID usado para enviar e-mail pela API do
 * Microsoft Graph. O segredo (client secret) NUNCA trafega de volta do backend — por isso
 * ele não faz parte de `ConfigGraph`, só do payload de gravação. */
export interface ConfigGraph {
  tenantId: string;
  clientId: string;
  remetente: string;
}

export type StatusConfigGraph = ConfigGraph & {
  /** Há um segredo guardado no servidor (permite explicar que deixar em branco o mantém). */
  temSegredo: boolean;
  configurado: boolean;
};

export type SalvarConfigGraphPayload = Partial<ConfigGraph> & {
  clientSecret?: string;
};
