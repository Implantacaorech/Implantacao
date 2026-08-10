import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CadastrarClienteDto } from './cadastrar-cliente.dto';

/** O tipo de demanda (Levantamento / Demonstração) é OBRIGATÓRIO no cadastro do cliente.
 * Testado no próprio DTO porque a regra é de validação, e porque ela é frágil por herança:
 * CadastrarClienteDto estende CreateProjetoDto, e um `@IsOptional()` no pai para este mesmo
 * campo passaria a valer aqui (o class-validator só descarta metadado herdado do MESMO
 * tipo) — o campo voltaria a ser opcional sem ninguém perceber. */
describe('CadastrarClienteDto — tipo de demanda', () => {
  async function erros(payload: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(CadastrarClienteDto, payload);
    const falhas = await validate(dto);
    return falhas.map((f) => f.property);
  }

  it('aceita Levantamento', async () => {
    expect(
      await erros({ cliente: 'ACME', tipoDemanda: 'Levantamento' }),
    ).toEqual([]);
  });

  it('aceita Demonstração', async () => {
    expect(
      await erros({ cliente: 'ACME', tipoDemanda: 'Demonstração' }),
    ).toEqual([]);
  });

  it('recusa o cadastro sem tipo de demanda', async () => {
    expect(await erros({ cliente: 'ACME' })).toContain('tipoDemanda');
  });

  it('recusa o tipo de demanda vazio', async () => {
    expect(await erros({ cliente: 'ACME', tipoDemanda: '' })).toContain(
      'tipoDemanda',
    );
  });

  it('recusa um tipo fora da lista', async () => {
    expect(
      await erros({ cliente: 'ACME', tipoDemanda: 'Implantação' }),
    ).toContain('tipoDemanda');
  });
});
