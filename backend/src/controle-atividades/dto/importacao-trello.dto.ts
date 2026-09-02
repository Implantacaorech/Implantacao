import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** De/para das listas do Trello, como **JSON em um campo de texto**.
 *
 * Não como campo repetido (`destinos[0][listaId]`): num `multipart/form-data` quem monta o
 * corpo é o multer, que não interpreta notação de colchetes — os campos chegariam como
 * chaves literais e `destinos` viria vazio, importando tudo em colunas novas sem ninguém
 * perceber. Um JSON em campo único atravessa o multipart intacto. */
export class ImportarTrelloDto {
  @ApiPropertyOptional({
    description: 'JSON: [{ "idListaTrello": "...", "listaId": 12 }]',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  destinos?: string;
}
