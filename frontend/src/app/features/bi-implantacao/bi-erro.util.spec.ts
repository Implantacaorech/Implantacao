import { HttpErrorResponse } from '@angular/common/http';
import { mensagemErroBi } from './bi-erro.util';

/** A mensagem genérica ("não foi possível carregar") escondia a causa real e travava o
 * diagnóstico. Cada status precisa dizer o que fazer. */
describe('mensagemErroBi', () => {
  const erro = (status: number, corpo?: unknown) =>
    new HttpErrorResponse({ status, error: corpo, statusText: 'Erro' });

  it('404 aponta para backend desatualizado (rota nova ausente)', () => {
    expect(mensagemErroBi(erro(404), 'o extrato')).toContain('reinicie o Painel');
  });

  it('403 aponta para o menu não liberado', () => {
    const m = mensagemErroBi(erro(403), 'o extrato');
    expect(m).toContain('Permissões');
  });

  it('401 pede novo login', () => {
    expect(mensagemErroBi(erro(401), 'o extrato')).toContain('Sessão expirada');
  });

  it('status 0 indica servidor fora do ar', () => {
    expect(mensagemErroBi(erro(0), 'o extrato')).toContain('Sem resposta do servidor');
  });

  it('500 mostra a mensagem devolvida pela API', () => {
    const m = mensagemErroBi(erro(500, { message: 'ORA-00942' }), 'o extrato');
    expect(m).toContain('HTTP 500');
    expect(m).toContain('ORA-00942');
  });

  it('erro que não é HTTP cai na mensagem genérica', () => {
    expect(mensagemErroBi(new Error('qualquer'), 'o extrato')).toBe(
      'Não foi possível carregar o extrato.',
    );
  });
});
