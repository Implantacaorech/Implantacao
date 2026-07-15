export interface IniciarCadastroPayload {
  nome: string;
  email: string;
  senha: string;
  codigoSicla: string;
}

export interface ConfirmarCadastroPayload {
  email: string;
  codigo: string;
}

export interface ReenviarCadastroPayload {
  email: string;
}
