import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A designação passa a ter IDENTIDADE, não só nome.
 *
 * Até aqui `projeto_pessoas.pessoa` e `projetos.gci` guardavam texto, e era por esse texto
 * que a RN-10 decidia quem podia concluir cada passo. Dois usuários com o mesmo nome eram
 * indistinguíveis: o segundo herdava os passos e os e-mails do primeiro (achado da auditoria
 * dos 21 passos, 2026-08-05, reproduzido em teste).
 *
 * O que esta migration faz:
 *   1. `projeto_pessoas.usuario_id` — quem a pessoa É.
 *   2. Backfill do id a partir do nome, **só quando o nome é inequívoco** entre os usuários
 *      ativos. Nome ambíguo (justamente o caso do homônimo) ou sem correspondente fica NULO,
 *      e a autorização cai de volta na comparação por nome — o comportamento que já existia.
 *      Chutar um id aqui seria pior do que não ter: daria a um estranho o passo de outro.
 *   3. O GCI vira linha em `projeto_pessoas` com papel `gci`, a partir de `projetos.gci`
 *      (que aceita lista separada por vírgula). `projetos.gci` CONTINUA existindo como
 *      espelho — telas, documentos e o token {{GCI}} leem dali.
 *
 * `down()` desfaz por inteiro: remove as linhas de GCI que ela criou e derruba a coluna. O
 * espelho em `projetos.gci` nunca é tocado, então voltar não perde informação.
 */
export class DesignacaoPorUsuarioId1784880000000 implements MigrationInterface {
  name = 'DesignacaoPorUsuarioId1784880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projeto_pessoas\` ADD \`usuario_id\` int NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_projeto_pessoas_usuario_id\` ON \`projeto_pessoas\` (\`usuario_id\`)`,
    );

    // 1) GCI de `projetos.gci` -> linhas em projeto_pessoas.
    //
    // A lista vem separada por vírgula. O SQL abaixo estoura até 4 nomes por projeto, que é
    // muito acima do real (a RN diz que o GCI é único; a base tem no máximo dois). Sem
    // recursão de propósito: o MariaDB da casa é 12.x e suportaria CTE recursiva, mas isto
    // roda uma vez só e ser explícito aqui vale mais do que ser esperto.
    for (const n of [1, 2, 3, 4]) {
      await queryRunner.query(
        `INSERT INTO \`projeto_pessoas\` (\`projeto_id\`, \`pessoa\`, \`papel\`, \`criado_em\`)
         SELECT p.\`id\`,
                TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.\`gci\`, ',', ${n}), ',', -1)),
                'gci',
                CURRENT_TIMESTAMP
           FROM \`projetos\` p
          WHERE p.\`gci\` IS NOT NULL
            AND TRIM(p.\`gci\`) <> ''
            AND CHAR_LENGTH(p.\`gci\`) - CHAR_LENGTH(REPLACE(p.\`gci\`, ',', '')) >= ${n - 1}
            AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.\`gci\`, ',', ${n}), ',', -1)) <> ''`,
      );
    }

    // 2) Backfill do usuario_id — SÓ para nome que casa com EXATAMENTE UM usuário ativo.
    //    A subconsulta de contagem é o que protege o caso do homônimo.
    await queryRunner.query(
      `UPDATE \`projeto_pessoas\` pp
          SET pp.\`usuario_id\` = (
                SELECT u.\`id\` FROM \`usuarios\` u
                 WHERE u.\`ativo\` = 1
                   AND LOWER(TRIM(u.\`nome\`)) = LOWER(TRIM(pp.\`pessoa\`))
                 LIMIT 1)
        WHERE pp.\`usuario_id\` IS NULL
          AND (SELECT COUNT(*) FROM \`usuarios\` u2
                WHERE u2.\`ativo\` = 1
                  AND LOWER(TRIM(u2.\`nome\`)) = LOWER(TRIM(pp.\`pessoa\`))) = 1`,
    );

    // 3) O que sobrou sem id NÃO é detalhe: é gente que a autorização não reconhece.
    //    Na base de 2026-08-06, metade dos vínculos guardava apelido ou primeiro nome
    //    ("Alex", "Dibah", "Thomaz") em vez do nome do cadastro — esses vínculos JÁ não
    //    autorizavam ninguém antes desta migration, porque a comparação por nome também
    //    falhava. Imprimir a lista é o que transforma isso em tarefa para alguém resolver,
    //    em vez de um silêncio que ninguém percebe.
    // `queryRunner.query` devolve `any`; a asserção é o que dá tipo ao resultado sem
    // desligar a regra de segurança de tipo para o arquivo inteiro.
    const orfaos = (await queryRunner.query(
      `SELECT \`pessoa\`, \`papel\`, COUNT(*) AS qtd
           FROM \`projeto_pessoas\`
          WHERE \`usuario_id\` IS NULL
          GROUP BY \`pessoa\`, \`papel\`
          ORDER BY \`pessoa\``,
    )) as { pessoa: string; papel: string; qtd: number }[];
    if (orfaos.length > 0) {
      console.warn(
        `\n[DesignacaoPorUsuarioId] ${orfaos.length} nome(s) de designação NÃO casaram com ` +
          'um único usuário ativo e ficaram sem `usuario_id`. Eles continuam decidindo por ' +
          'NOME — como já faziam —, o que na prática significa que não autorizam ninguém ' +
          'quando o nome não existe no cadastro. Corrija o cadastro do usuário ou refaça a ' +
          'designação na tela para que o vínculo passe a ter identidade:',
      );
      for (const o of orfaos) {
        console.warn(`  - "${o.pessoa}" (${o.papel}, ${o.qtd} vínculo(s))`);
      }
      console.warn('');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`projeto_pessoas\` WHERE \`papel\` = 'gci'`,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_projeto_pessoas_usuario_id\` ON \`projeto_pessoas\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`projeto_pessoas\` DROP COLUMN \`usuario_id\``,
    );
  }
}
