/** Status da credencial do RechEdu (www.rechedu.com.br) do usuário logado. A senha nunca
 * trafega de volta — só o login, para a tela mostrar "conectado como fulano". */
export interface StatusCredencialRechEdu {
  tem: boolean;
  login: string;
}
