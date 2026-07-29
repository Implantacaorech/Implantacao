/**
 * Importa/sincroniza os Usuários do Painel a partir de `SICLA.LISTA_TECNICOS`.
 *
 * Roda o MESMO `TecnicosSiclaService` que a tela de Usuários usa (nada de lógica paralela),
 * num contexto Nest mínimo — só o módulo de técnicos + a conexão do banco. Não sobe HTTP,
 * cron, IMAP nem os robôs, então é seguro rodar com o Painel no ar.
 *
 * Uso (de dentro de backend/, com MIGRACAO_DB_URL definido):
 *   npx ts-node -r tsconfig-paths/register scripts/importar-tecnicos-sicla.ts          # simula
 *   npx ts-node -r tsconfig-paths/register scripts/importar-tecnicos-sicla.ts gravar   # efetiva
 *
 * Sem `gravar`, só mostra o que aconteceria — use sempre antes de efetivar.
 */
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from '../src/database/entities';
import { Usuario } from '../src/database/entities/usuario.entity';
import { ConsultaBD } from '../src/database/entities/consulta-bd.entity';
import { DisponibilidadeService } from '../src/disponibilidade/disponibilidade.service';
import { ConsultaBdService } from '../src/disponibilidade/consulta-bd.service';
import { TecnicosSiclaService } from '../src/tecnicos-sicla/tecnicos-sicla.service';

const url = process.env.MIGRACAO_DB_URL;
if (!url) {
  console.error('Falta MIGRACAO_DB_URL no ambiente.');
  process.exit(1);
}

// Providers avulsos em vez de importar TecnicosSiclaModule/DisponibilidadeModule: os
// módulos trazem junto os CONTROLLERS, cujos guards puxam PermissoesService e o resto da
// árvore da aplicação. Aqui só interessa o serviço.
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mariadb',
      url,
      entities: ENTITIES,
      synchronize: false,
      charset: 'utf8mb4',
    }),
    TypeOrmModule.forFeature([Usuario, ConsultaBD]),
  ],
  providers: [TecnicosSiclaService, DisponibilidadeService, ConsultaBdService],
})
class ScriptModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ScriptModule, {
    logger: ['error', 'warn'],
  });
  try {
    const service = app.get(TecnicosSiclaService);
    const gravar = process.argv[2] === 'gravar';

    const lista = await service.listar();
    if (!lista.ok) {
      console.error(`Consulta ao SICLA falhou: ${lista.mensagem}`);
      process.exitCode = 1;
      return;
    }
    const novos = lista.tecnicos.filter((t) => !t.jaCadastrado);
    console.log(`\nSICLA -> ${lista.tecnicos.length} técnico(s) ativo(s)`);
    console.log(
      `  já existem no Painel: ${lista.tecnicos.length - novos.length}`,
    );
    console.log(`  entrariam como novos: ${novos.length}`);

    if (!gravar) {
      console.log(
        '\n(simulação — nada gravado. Repita com "gravar" para efetivar.)',
      );
      return;
    }

    console.log('\nImportando...');
    const r = await service.importar();
    console.log(`\n${r.mensagem}`);
    console.log(`  criados:     ${r.criados}`);
    console.log(`  atualizados: ${r.atualizados}`);
    if (r.ignorados.length > 0) {
      console.log(`  ignorados:   ${r.ignorados.length}`);
      for (const i of r.ignorados) {
        console.log(`    ${i.codigo} ${i.nome} — ${i.motivo}`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('ERRO:', e);
  process.exit(1);
});
