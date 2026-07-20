import { MigrationInterface, QueryRunner } from "typeorm";

export class SigerFonte1784556090485 implements MigrationInterface {
    name = 'SigerFonte1784556090485'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`siger_fontes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`caminho\` varchar(500) NOT NULL, \`extensao\` varchar(20) NOT NULL, \`pasta_raiz\` varchar(255) NOT NULL, \`tamanho_bytes\` int NOT NULL, \`modificado_em\` datetime NOT NULL, \`hash_sha256\` varchar(64) NOT NULL, \`conteudo\` text NULL, \`indexado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_33caecbf17ef3bfc28f5ccc24e\` (\`caminho\`), INDEX \`IDX_d7d89ad3d5dd5978ecf0806422\` (\`extensao\`), INDEX \`IDX_01c4b30c1949c2582fc34409f0\` (\`pasta_raiz\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_01c4b30c1949c2582fc34409f0\` ON \`siger_fontes\``);
        await queryRunner.query(`DROP INDEX \`IDX_d7d89ad3d5dd5978ecf0806422\` ON \`siger_fontes\``);
        await queryRunner.query(`DROP INDEX \`IDX_33caecbf17ef3bfc28f5ccc24e\` ON \`siger_fontes\``);
        await queryRunner.query(`DROP TABLE \`siger_fontes\``);
    }

}
