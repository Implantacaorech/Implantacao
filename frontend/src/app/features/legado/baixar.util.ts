import { ArquivoBaixavel } from '../../core/models/legado.model';
import { LegadoService } from '../../core/services/legado.service';
import { baixarArquivo } from '../../core/utils/baixar-arquivo';

export async function baixarArquivoLegado(service: LegadoService, arquivo: ArquivoBaixavel): Promise<void> {
  const { blob, filename } = await service.baixar(arquivo.token, arquivo.nome);
  baixarArquivo(blob, filename);
}
