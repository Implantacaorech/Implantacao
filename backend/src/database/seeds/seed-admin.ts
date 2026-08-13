import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AppDataSource } from '../data-source';
import { Usuario } from '../entities/usuario.entity';

/** Cria o primeiro usuário ADM se o banco ainda não tiver nenhum usuário ativo — substitui
 * o modo "login desabilitado = acesso total" do Flask (ver docs/migracao/02-decisao-arquitetura.md).
 * Uso: npm run seed:admin -- --login=admin --nome="Administrador" --email=adm@rech.com.br
 *
 * `--senha=` define uma senha DETERMINÍSTICA (em vez da aleatória). Serve ao e2e/CI, que precisa
 * de credenciais conhecidas para semear os demais usuários pela API — nunca use senha fixa fora
 * de uma instância descartável (A19). Sem `--senha`, gera uma temporária como antes. */
async function main(): Promise<void> {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [chave, valor] = arg.replace(/^--/, '').split('=');
      return [chave, valor ?? ''];
    }),
  );
  const login = args.login || 'admin';
  const nome = args.nome || 'Administrador';
  const email = args.email || '';

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Usuario);

  const existentes = await repo.count({ where: { ativo: true } });
  if (existentes > 0) {
    console.log(
      `Já existem ${existentes} usuário(s) ativo(s) — seed não executado.`,
    );
    await AppDataSource.destroy();
    return;
  }

  // `--senha` explícita (e2e/CI, instância descartável) OU uma temporária aleatória.
  const senhaTemporaria = args.senha || randomBytes(9).toString('base64url');
  const senhaHash = await bcrypt.hash(senhaTemporaria, 12);
  await repo.save(
    repo.create({
      login,
      nome,
      email,
      senhaHash,
      perfil: 'ADM',
      codigoSicla: '',
      ativo: true,
    }),
  );

  console.log('Usuário ADM criado com sucesso.');
  console.log(`  login: ${login}`);
  console.log(
    args.senha
      ? '  senha: definida via --senha (instância descartável)'
      : `  senha temporária (troque no primeiro acesso): ${senhaTemporaria}`,
  );
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
