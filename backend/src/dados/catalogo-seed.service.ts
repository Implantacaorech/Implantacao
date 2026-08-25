import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsultaBdService } from './consulta-bd.service';
import { CATALOGO } from './catalogo/catalogo';

/** Semeia em `consultas_bd` (Sistema → Consultas BD) as consultas do catálogo cujo texto é
 * EDITÁVEL pelo Administrador.
 *
 * Antes cada módulo semeava a sua, no próprio `onModuleInit` — cinco cópias do mesmo bloco
 * try/catch, e a lista que o Administrador via dependia de quais módulos tinham subido. Com
 * o catálogo dono do SQL (ADR-0003), a semeadura passou a ser derivada dele: uma consulta
 * nova com `origem.tipo === 'consulta_salva'` aparece na tela sem código novo.
 *
 * **Idempotente e não destrutivo:** slug que já existe é PULADO, nunca sobrescrito — o
 * texto ajustado pelo Administrador contra o banco real é a fonte da verdade em produção,
 * e o daqui é só o ponto de partida. */
@Injectable()
export class CatalogoSeedService implements OnModuleInit {
  private readonly logger = new Logger('CatalogoSeedService');

  constructor(private readonly consultas: ConsultaBdService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const n = await this.semear();
      if (n > 0)
        this.logger.log(`${n} consulta(s) semeada(s) em Consultas BD.`);
    } catch (e) {
      // Semear é conveniência de primeira subida: falhar aqui não pode derrubar o boot —
      // as consultas `fixo` continuam funcionando e o Administrador pode criar à mão.
      this.logger.error(
        'Falha ao semear as consultas do catálogo',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** Devolve quantas foram criadas agora. */
  async semear(): Promise<number> {
    let criadas = 0;
    // `rns_lista_itemped` aparece em duas entradas do catálogo (listar e a ficha, que a
    // recorta) — o Set evita tentar semear o mesmo slug duas vezes.
    const vistos = new Set<string>();

    for (const consulta of CATALOGO) {
      if (consulta.origem.tipo !== 'consulta_salva') continue;
      const { slug, sqlPadrao, semente } = consulta.origem;
      if (vistos.has(slug)) continue;
      vistos.add(slug);

      if (await this.consultas.porSlug(slug)) continue;

      await this.consultas.salvar(slug, {
        nome: semente.nome,
        sql: sqlPadrao,
        ordem: semente.ordem,
        mostrarGrafico: semente.mostrarGrafico ?? false,
        colunaData: semente.colunaData ?? '',
        colunaSituacao: semente.colunaSituacao ?? '',
        conexao: semente.conexao ?? 'sicla',
      });
      criadas += 1;
    }
    return criadas;
  }
}
