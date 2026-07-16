export interface ConfigImap {
  host: string;
  port: string;
  user: string;
  pasta: string;
}

export type StatusConfigImap = ConfigImap & { configurado: boolean };

export type SalvarConfigImapPayload = Partial<ConfigImap> & { senha?: string };
