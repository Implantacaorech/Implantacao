import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IniciarGravacaoDto } from './gravacao.dto';

/** `participantes` é OBRIGATÓRIO (decisão do usuário em 2026-08-04) e a obrigatoriedade
 * mora aqui, não só na tela: a separação de locutores só pode ser feita DURANTE a
 * gravação. Se um default silencioso decidir por "não separar", quem descobrir depois que
 * queria a separação terá de refazer a reunião com o cliente — o erro é caro e não tem
 * conserto pelo painel. */
describe('IniciarGravacaoDto', () => {
  const validar = (obj: Record<string, unknown>) =>
    validateSync(plainToInstance(IniciarGravacaoDto, obj));

  const erroDe = (obj: Record<string, unknown>, campo: string) =>
    validar(obj).find((e) => e.property === campo);

  it('recusa quando participantes não é enviado', () => {
    const erro = erroDe({ fonte: 'microfone' }, 'participantes');
    expect(erro).toBeDefined();
    expect(Object.values(erro!.constraints ?? {}).join(' ')).toContain(
      'Informe quantas pessoas vão falar',
    );
  });

  it('recusa 0 — não existe reunião com zero pessoas falando', () => {
    expect(erroDe({ participantes: 0 }, 'participantes')).toBeDefined();
  });

  it('aceita 1 (uma pessoa, sem separar) e 2+ (separa as vozes)', () => {
    expect(erroDe({ participantes: 1 }, 'participantes')).toBeUndefined();
    expect(erroDe({ participantes: 4 }, 'participantes')).toBeUndefined();
  });

  it('converte o número que chega como texto do formulário', () => {
    const dto = plainToInstance(IniciarGravacaoDto, { participantes: '3' });
    expect(dto.participantes).toBe(3);
    expect(erroDe({ participantes: '3' }, 'participantes')).toBeUndefined();
  });

  it('recusa acima do teto', () => {
    expect(erroDe({ participantes: 50 }, 'participantes')).toBeDefined();
  });

  it('os demais campos seguem opcionais — só participantes ficou obrigatório', () => {
    const erros = validar({ participantes: 2 });
    expect(erros).toHaveLength(0);
  });
});
