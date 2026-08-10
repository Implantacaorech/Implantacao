import { readFileSync } from 'fs';
import { join } from 'path';
import { TranscricaoLongtext1784890000000 } from './1784890000000-TranscricaoLongtext';

/**
 * Guarda do tamanho das colunas que recebem a transcrição.
 *
 * Em 2026-08-10 a gravação de um treinamento de ~3 h morreu em produção com
 * `Data too long for column 'transcricao'` — `TEXT` do MariaDB são 64 KB. O prejuízo não foi
 * o erro: foi perder mais de uma hora de transcrição já pronta, porque o INSERT só falha no
 * fim.
 *
 * **Nenhuma suíte pegaria isso sozinha**: dev/teste rodam em SQLite, onde `TEXT` não tem
 * limite. Então o teste possível não é gravar texto grande — é garantir que a migration que
 * alarga essas colunas continue existindo, continue apontando para colunas que existem de
 * verdade e continue cobrindo todos os campos alimentados pela transcrição. Um `git revert`
 * distraído ou o rename de uma coluna quebram aqui, e não em produção.
 */
describe('Colunas de transcrição não podem voltar a caber em 64 KB', () => {
  const migration = new TranscricaoLongtext1784890000000();
  const entidade = readFileSync(
    join(__dirname, '..', 'entities', 'protocolo.entity.ts'),
    'utf8',
  );

  /** Executa `up`/`down` contra um QueryRunner falso e devolve o SQL emitido. */
  const sqlDe = async (metodo: 'up' | 'down', grandes = 0) => {
    const emitido: string[] = [];
    const runner = {
      query: (sql: string) => {
        emitido.push(sql);
        // O `down` conta linhas acima de 64 KB antes de estreitar.
        return Promise.resolve([{ grandes }]);
      },
    };
    await migration[metodo](runner as never);
    return emitido;
  };

  /** Os campos que carregam conteúdo do tamanho de uma transcrição: o texto em si, o resumo
   * que cobre a transcrição inteira, a resposta crua da IA e o histórico, que acumula. */
  const OBRIGATORIAS = [
    'transcricao',
    'resumo_completo',
    'texto_ia',
    'historico',
  ];

  it.each(OBRIGATORIAS)('alarga `%s` para LONGTEXT', async (coluna) => {
    const sql = (await sqlDe('up')).join('\n');
    expect(sql).toContain(`MODIFY \`${coluna}\` LONGTEXT NOT NULL`);
  });

  it('só mexe na tabela `protocolos`', async () => {
    for (const sql of await sqlDe('up')) {
      expect(sql).toContain('ALTER TABLE `protocolos`');
    }
  });

  it('toda coluna citada existe mesmo na entidade Protocolo', () => {
    // Pega o rename se alguém trocar o `name:` da coluna sem lembrar da migration.
    for (const coluna of OBRIGATORIAS) {
      const declarada =
        entidade.includes(`name: '${coluna}'`) ||
        // Sem `name:` explícito, o TypeORM usa o nome da propriedade.
        new RegExp(`^\\s{2}${coluna}: string;`, 'm').test(entidade);
      expect(declarada).toBe(true);
    }
  });

  it('avisa na entidade que o tipo real no MariaDB é LONGTEXT', () => {
    // O `type: 'text'` da entidade é proposital (o driver SQLite não conhece `longtext`).
    // Sem este aviso escrito, a próxima pessoa "corrige" a divergência e reabre o defeito.
    expect(entidade).toContain('LONGTEXT');
    expect(entidade).toContain('TranscricaoLongtext1784890000000');
  });

  it('o `down` recusa estreitar quando há conteúdo que não caberia', async () => {
    await expect(sqlDe('down', 3)).rejects.toThrow(/não dá para reverter/i);
  });

  it('o `down` volta para TEXT quando tudo cabe', async () => {
    const sql = (await sqlDe('down', 0)).join('\n');
    for (const coluna of OBRIGATORIAS) {
      expect(sql).toContain(`MODIFY \`${coluna}\` TEXT NOT NULL`);
    }
  });
});
