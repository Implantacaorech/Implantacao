export interface ConfigEmail {
  host: string;
  port: string;
  user: string;
  remetente: string;
  useTls: boolean;
}

export type StatusConfigEmail = ConfigEmail & { configurado: boolean };

export type SalvarConfigEmailPayload = Partial<ConfigEmail> & { senha?: string };
